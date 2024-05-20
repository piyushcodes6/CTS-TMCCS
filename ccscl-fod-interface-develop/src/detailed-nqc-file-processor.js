/*
FileName - detailed-nqc-file-processor.js
Objective - To read data from FOD Detailed NQC text file and store the data in DB.
--------------------------------File History--------------------------------------
Date - 07/23/2023
By - Piyush Goswami
Modification - Initial creation of the script.
----------------------------------------------------------------------------------
Date - 07/29/2023
By - Piyush Goswami
Modification - Optimized the code for huge files.
----------------------------------------------------------------------------------
Date - 08/23/2023
By - Mayukh Ray
Modification - Code refactoring and Business logic update.
----------------------------------------------------------------------------------
Date - 09/07/2023
By - Piyush Goswami
Modification - Removed refresh MV stkgnqm function.
----------------------------------------------------------------------------------
Date - 09/20/2023
By - Piyush Goswami
Modification - Fixed global variable declaration lambda issue. 
----------------------------------------------------------------------------------
Date - 09/28/2023
By - Piyush Goswami
Modification - Updated the code get currentDate in CST Timezone. 
----------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to trigger status email. 
----------------------------------------------------------------------------------
Date - 11/21/2023
By - Piyush Goswami
Modification - Updated the code to check galc suspension and  store file name and location to unprocessed_table
----------------------------------------------------------------------------------
Date - 11/21/2023
By - Anish Gupta
Modification - Updated the code to move/copy processed/unprocessed files in s3 onJobSuccess. 
----------------------------------------------------------------------------------
Date - 12/28/2023
By - Piyush Goswami
Modification - Updated the code to make detailed-nqc lambda run by file trigger. 
----------------------------------------------------------------------------------
Date - 04/10/2024
By - Piyush Goswami
Modification - Updated the code to resolve sonar critical security fix. 
----------------------------------------------------------------------------------
*/

const AWS = require('aws-sdk');
const { Pool } = require("pg");
const { performance } = require("perf_hooks");
const moment = require('moment-timezone');
const { MailReqDO, jobStatusConst, mailJobStatus, mailStatusConst, ArchiveDO, moveFiles, archiveConst } = require('@tmna-devops/ccscl-batch-job-common-lib');
const { DETAILED_NQC_CONSTANTS } = require('./constants/constants');

const bucketName = process.env.S3_BUCKET_NAME;
const secretName = process.env.DB_CONNECTION_PARAMS;
const region = process.env.AWS_REGION;

AWS.config.update({ region: `${region}` });

var s3 = new AWS.S3({ region: `${region}` });
const secretsManager = new AWS.SecretsManager();
let p1;

const getJobDetailsForFile = async (params, connection) => {

  const fileName = params.Key.split("/").pop();
  console.log(`Getting Job Details from DB for fileName: ${fileName}`);

  //removing timeStamp from R4Lock file for Detailed NQC
  const fileNameWithoutTimestampSuffix = await removeTimeStamp(fileName);

  const result = await connection.query(`select namc_id, line_number from tmm.ccsb_batch_files where name='${fileNameWithoutTimestampSuffix}';`);
  const namcId = result.rows[0].namc_id;
  const lineNumber = result.rows[0].line_number === null ? undefined : result.rows[0].line_number;

  await processDetailedNQCFile(namcId, lineNumber, params, connection);
  
};

const removeTimeStamp = async (fileName) => {

  const match = fileName.match(/^(.*?)_\d{8}_\d{6}\.txt$/);

  let truncatedFileName;
  if (match && match[1]) {
    truncatedFileName = match[1] + '.txt';
  } else {
    truncatedFileName = fileName;
  }

  return truncatedFileName;

};

const processDetailedNQCFile = async (namcId, lineNumber, params, connection) => {

  const notificationResult = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${DETAILED_NQC_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}';`);
  const notificationData = notificationResult.rows[0];
  console.log('Notification:', notificationData);

  p1 = performance.now();

  // Update Job Status
  if (lineNumber !== undefined) {
    await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
  } else {
    await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
  }


  try {
    
    await connection.query('BEGIN');
    await retrieveFileFromS3Bucket(params, namcId, lineNumber, connection);
    await moveProcessedFileToArchive(params.Key, notificationData);
    await connection.query('COMMIT');
    
    await onJobSuccess(namcId, lineNumber, notificationData, connection);
    
  } catch (error) {
    await connection.query('ROLLBACK');
    await onJobFailure(error, namcId, lineNumber, notificationData, connection);
    throw error;
  }
};

const retrieveFileFromS3Bucket = async (params, namcId, lineNumber, connection) => {

  const file = await s3.getObject(params).promise();
  const fileContent = file.Body.toString('utf-8');
  await deleteExistingData(namcId, lineNumber, connection);
  await processFileContent(namcId, lineNumber, fileContent, params, connection);

};

//Delete existing data, as per Business Requirement
const deleteExistingData = async (namcId, lineNumber, connection) => {

  let deleteSQL;
  if (lineNumber !== undefined) {
    deleteSQL = `delete from tmm.ccsb_galc_nqc where(refno,namc_id) in(select refno,namc_id from tmm.ccsb_galc_vehicles_sold where namc_id='${namcId}') and line_number='${lineNumber}';`;
    console.log(`Deleting Sold Vehicles Data from Exisiting Table Data for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    deleteSQL = `delete from tmm.ccsb_galc_nqc where(refno,namc_id) in(select refno,namc_id from tmm.ccsb_galc_vehicles_sold where namc_id='${namcId}');`;
    console.log(`Deleting Sold Vehicles Data from Exisiting Table Data for namcId: ${namcId}`);
  }

  const t1 = performance.now();
  const result = await connection.query(deleteSQL);
  const t2 = performance.now();
  console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

  if (lineNumber !== undefined) {
    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId}`);
  }

  console.log(`------------------------------------------------------`);

};

const processFileContent = async (namcId, lineNumber, fileContent, params, connection) => {

  const fileRowsArr = fileContent.split('\n');
  const noOfLines = fileRowsArr.length;
  const lo_date = fileRowsArr[0].split(',')[3];

  if (lineNumber !== undefined) {
    console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId} , lineNumber: ${lineNumber} and lo_Date : ${lo_date}`);
  } else {
    console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId} and lo_Date : ${lo_date}`);
  }

  // If the file is empty, skip processing and set status of job to success
  // This is done so that the downstream jobs/lambdas in the Step Function can be processed
  if (noOfLines === 0) {
    if (lineNumber !== undefined) {
      console.log(`No data to process in file ${params.Key} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    } else {
      console.log(`No data to process in file ${params.Key} for namcId: ${namcId}`);
    }
  }
  // If total rows is greater than 8,000,000
  else if (noOfLines > 8000000) {
    await splitFileContent(namcId, lineNumber, fileRowsArr, connection, 40);
  }
  // If total rows is more than 500,000 but less than 8,000,000
  else if (noOfLines > 500000) {
    await splitFileContent(namcId, lineNumber, fileRowsArr, connection, 15);
  }
  // If total rows is less than 500,000
  else {
    await retrieveRefNoForURN(namcId, lineNumber, fileRowsArr, connection, 0, 0);
  }

};

const splitFileContent = async (namcId, lineNumber, fileRowsArr, connection, noOfChunks) => {

  const chunksArray = await splitIntoChunks(fileRowsArr, noOfChunks);

  let batchNum;
  let totalInsertedRow = 0;

  for (let index = 0; index < chunksArray.length; index++) {
    batchNum = index + 1;
    console.log(`Processing Batch No: --> ${batchNum}`);
    const insertedRows = await retrieveRefNoForURN(namcId, lineNumber, chunksArray[index], connection, batchNum, noOfChunks);
    totalInsertedRow += insertedRows;
    console.log(`------------------------------------------------------`);
  }

  console.log(`Total Inserted Rows: ${totalInsertedRow} for namcId: ${namcId} and jobCode: ${DETAILED_NQC_CONSTANTS.jobCode}`);

};

const splitIntoChunks = async (fileRowsArr, noOfChunks) => {
  const size = Math.ceil(fileRowsArr.length / noOfChunks);
  return Array.from({ length: noOfChunks }, (v, i) =>
    fileRowsArr.slice(i * size, i * size + size)
  );
};

const retrieveRefNoForURN = async (namcId, lineNumber, fileRowsArr, connection, batchNum, noOfChunks) => {

  const uniqueUrns = await retrieveUniqueURNs(fileRowsArr);
  const refNoMap = await fetchRefNos(uniqueUrns, connection);

  const rowsWithRefNoArr = [];
  const notFoundRefNoArr = [];

  fileRowsArr.forEach((line, index) => {
    if (index === fileRowsArr.length) {
      // Last line, save any incomplete line for the next iteration
    } else {
      const fieldsArr = line.split(',');
      if (fieldsArr.length === 5) {
        const urn = fieldsArr[0];
        const refno = refNoMap.get(urn);
        if (refno !== undefined) {
          rowsWithRefNoArr.push(`${line},${refno}`);
        } else {
          rowsWithRefNoArr.push(`${line},null`);

          notFoundRefNoArr.push(`${urn}`);
        }
      }
    }
  });


  if (notFoundRefNoArr.length > 0) {
    console.log(`Refno not found for following URNs: ${notFoundRefNoArr.length}`);
  }

  if (rowsWithRefNoArr.length === 0) {
    console.log('No refNo found for any of the following URNs: ' + uniqueUrns.length);
  }

  return await insertTableData(namcId, lineNumber, rowsWithRefNoArr, connection, batchNum, noOfChunks);

};

//Retrieve list of unique URNs
const retrieveUniqueURNs = async (data) => {
  return new Promise((resolve, reject) => {
    const uniqueUrns = [...new Set(data.map(line => line.split(',')[0]))];
    resolve(uniqueUrns);
  });
};

//Fetching RefNos corresponding to the provided URNs
const fetchRefNos = async (uniqueUrns, connection) => {
  return new Promise((resolve, reject) => {
    const refNoMap = new Map();
    const fetchQuery = `SELECT urn, refno FROM tmm.ccsb_vehicle WHERE vehicle_source_id=1 and urn = ANY($1::text[])`;
    connection.query(fetchQuery, [uniqueUrns], (err, result) => {
      if (err) {
        reject(err);
      } else {
        result.rows.forEach(row => {
          refNoMap.set(row.urn, row.refno);
        });
        resolve(refNoMap);
      }
    });
  });
};

const insertTableData = async (namcId, lineNumber, rows, connection, batchNum, noOfChunks) => {

  let insertedRows;

  if (rows.length !== 0) {

    console.log(`Batch Length --> ${rows.length}`);

    let insertSQLStr;
    if (lineNumber !== undefined) {
      insertSQLStr = 'insert into tmm.ccsb_galc_nqc (urn, part_no, dock, lo_date, qty, refno, namc_id, line_number) values ';
    } else {
      insertSQLStr = 'insert into tmm.ccsb_galc_nqc (urn, part_no, dock, lo_date, qty, refno, namc_id) values ';
    }

    rows.forEach(row => {
      const fieldsArr = row.split(',');
      fieldsArr.push(namcId);
      if (lineNumber !== undefined) {
        fieldsArr.push(lineNumber);
      }

      insertSQLStr += `(${fieldsArr.map((element, index) => {
        if (index === 4) {
          return element; // Don't cover 4th element with quotes
        } else if (index === 5) {
          return element !== 'null' ? `'${element}'` : element; // Check and conditionally cover 5th element
        } else {
          return `'${element}'`; // Cover other elements with quotes
        }
      }).join(', ')}), \n`;

    });

    const insertSQL = insertSQLStr.substring(0, insertSQLStr.length - 3);

    const t1 = performance.now();
    const result = await connection.query(insertSQL);
    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    if (lineNumber !== undefined) {
      console.log(`Rows Inserted: ${result.rowCount} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    } else {
      console.log(`Rows Inserted: ${result.rowCount} for namcId: ${namcId}`);
    }

    insertedRows = result.rowCount;
  }

  return insertedRows;

};

const connectToDatabase = async () => {
  const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  const secret = JSON.parse(data.SecretString);
  return new Pool({
    host: secret.host,
    database: secret.database,
    port: secret.port,
    password: secret.password,
    user: secret.username,
  });
};

const moveProcessedFileToArchive = async (fileName, notificationData,) => {
  if (fileName) {
    await moveFiles(
      new ArchiveDO(
        archiveConst.s3_bucket,
        [fileName],
        archiveConst.s3_bucket,
        `processed/${DETAILED_NQC_CONSTANTS.objectPath.split('/').splice(1).join('/')}${notificationData.name}/${new Date().toISOString()}`,
        true,
        archiveConst.standard_storage_class
      )
    );
  }
}

const onJobSuccess = async (namcId, lineNumber, notificationData, connection) => {

  if (lineNumber !== undefined) {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_COMPLETED}`);
  } else {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_COMPLETED}`);
  }

  if (notificationData.success_notification === "Y" || notificationData.delayed === "Y") {
    await mailJobStatus(
      null,
      new MailReqDO(
        notificationData.name,
        process.env.appId,
        process.env.appName,
        process.env.moduleId,
        DETAILED_NQC_CONSTANTS.jobCode,
        mailStatusConst.SUCCESS_STATUS
      )
    );
  }

  await connection.end();

};

const onJobFailure = async (error, namcId, lineNumber, notificationData, connection) => {

  if (lineNumber !== undefined) {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_FAILED}`);
  } else {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${DETAILED_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_FAILED}`);
  }
  if (notificationData.failure_notification === "Y") {
    await mailJobStatus(
      error,
      new MailReqDO(
        notificationData.name,
        process.env.appId,
        process.env.appName,
        process.env.moduleId,
        DETAILED_NQC_CONSTANTS.jobCode,
        mailStatusConst.FAILURE_STATUS
      )
    );
  }
  console.log(`------------------------------------------------------`);

  await connection.end();

};

exports.handler = async (event) => {

  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log("Key/File Path :" + key);
  const connection = await connectToDatabase();

  const params = {
    Bucket: bucketName,
    Key: key
  }

  await getJobDetailsForFile(params, connection);

};
