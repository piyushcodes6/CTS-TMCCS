/*
FileName - summary-nqc-file-processor.js
Objective - To read data from FOD Summary NQC text file and store the data in DB.
--------------------------------File History-------------------------------------
Date- 07/11/2023
By- Piyush Goswami
Modification- Initial creation of the script.
---------------------------------------------------------------------------------
Date - 08/24/2023
By - Mayukh Ray
Modification - Code refactoring and Business logic update.
----------------------------------------------------------------------------------
Date - 09/14/2023
By - Anish Gupta
Modification - Code refactoring, Issue fix for duplicate records in between chunks 
and requirement for inserting adjustmnet into archive table.
----------------------------------------------------------------------------------
Date - 09/23/2023
By -Piyush Goswami
Modification - Updated the code to summarize TMMBC line 60 and 61 files.
----------------------------------------------------------------------------------
Date - 10/05/2023
By -Anish Gupta
Modification - Updated the code to sort TMMBC line 60 and 61 summarized file 
before the prcessing starts.
----------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to group parts before calling insert method.
----------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to trigger status email. 
----------------------------------------------------------------------------------
Date - 11/21/2023
By - Anish Gupta
Modification - Updated the code to move/copy processed/unprocessed files in s3 onJobSuccess. 
----------------------------------------------------------------------------------
Date - 12/18/2023
By - Anish Gupta
Modification - Fix for archive countdown query.
----------------------------------------------------------------------------------
Date - 12/28/2023
By - Anish Gupta
Modification - Fix for archive countdown query summarization for same part,supplier,container code and different dock.
----------------------------------------------------------------------------------
Date - 02/05/2024
By - Anish Gupta
Modification - Process Summary NQC based on executionFlag from ccsb_job_details.
----------------------------------------------------------------------------------
Date - 03/04/2024
By - Piyush Goswami
Modification - Updated code to resolved ardb 15 min job overlapping issue. 
----------------------------------------------------------------------------------
Date - 04/10/2024
By - Piyush Goswami
Modification - Updated the code to resolve sonar critical security fix. 
----------------------------------------------------------------------------------
*/

const AWS = require('aws-sdk');
const { Pool } = require("pg");
const { performance } = require("perf_hooks");
const { SUMMARY_NQC_CONSTANTS } = require("./constants/constants");
const { MailReqDO, jobStatusConst, mailJobStatus, mailStatusConst, ArchiveDO, moveFiles, archiveConst } = require('@tmna-devops/ccscl-batch-job-common-lib');

const bucketName = process.env.S3_BUCKET_NAME;
const secretName = process.env.DB_CONNECTION_PARAMS;
const region = process.env.AWS_REGION;

AWS.config.update({ region: `${region}` });

var s3 = new AWS.S3({ region: `${region}` });
const secretsManager = new AWS.SecretsManager();
let p1;
let totalInsertedRow = 0;

/**
 * This method will Update Job Status, get Summary NQC File data & start processing on it 
 * based on namcId and lineNumber.
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - line number from input
 * @param {*} connection - DB Connection for query execution
 */
const processSummaryNQCFile = async (namcId, lineNumber, connection) => {

  let notificationData = {};
  if (lineNumber !== undefined) {
    const result = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed, t1.execution_flag,t1.current_status from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${SUMMARY_NQC_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}' and line_number='${lineNumber}';`);
    notificationData = result.rows[0];
    console.log('Notification:', notificationData);
  } else {
    const result = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed, t1.execution_flag,t1.current_status from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${SUMMARY_NQC_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}';`);
    notificationData = result.rows[0];
    console.log('Notification:', notificationData);
  }

  try {
    // execute summary NQC daily load based on execution flag
    if ('Y' === notificationData.execution_flag && notificationData.current_status !== 'INPROGRESS') {
      p1 = performance.now();

      // Update Job Status
      if (lineNumber !== undefined) {
        await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='INPROGRESS', start_timestamp=CURRENT_TIMESTAMP where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
        console.log(`BATCH JOB_STATUS in ccsb_job_details for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
      } else {
        await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='INPROGRESS', start_timestamp=CURRENT_TIMESTAMP where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
        console.log(`BATCH JOB_STATUS in ccsb_job_details for namcId: ${namcId} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
      }

      // Get File Details
      let query;
      if (lineNumber !== undefined) {
        console.log(`Getting File Details in ccsb_batch_files for namcId: ${namcId} and lineNumber: ${lineNumber}`);
        query = `select * from tmm.ccsb_batch_files where namc_id='${namcId}' and job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and line_number='${lineNumber}';`;
      } else {
        console.log(`Getting File Details in ccsb_batch_files for namcId: ${namcId}`);
        query = `select * from tmm.ccsb_batch_files where namc_id='${namcId}' and job_code='${SUMMARY_NQC_CONSTANTS.jobCode}';`;
      }
      const fileDetailsResult = await connection.query(query);
      console.log(`Rows Affected: ${fileDetailsResult.rowCount}`);
      let params;

      if (namcId === SUMMARY_NQC_CONSTANTS.TMMBC_NAMC_ID) {
        const fileName1 = fileDetailsResult.rows[0].name;
        const fileName2 = fileDetailsResult.rows[1].name;
        params = { Bucket: bucketName, Key1: SUMMARY_NQC_CONSTANTS.objectPath + fileName1.replace(/\+/g, ' '), Key2: SUMMARY_NQC_CONSTANTS.objectPath + fileName2.replace(/\+/g, ' ') };
      }
      else {
        const fileName = fileDetailsResult.rows[0].name;
        params = { Bucket: bucketName, Key: SUMMARY_NQC_CONSTANTS.objectPath + fileName.replace(/\+/g, ' ') };
      }
      await connection.query("BEGIN");
      await retrieveFileFromS3Bucket(namcId, lineNumber, params, notificationData, connection);
      await connection.query("COMMIT");
    } else {
      console.log('Skipped Summary NQC execution as it has already ran for the current day OR it is already in-progress.');
    }
  } catch (error) {
    await connection.query("ROLLBACK");
    await onJobFailure(error, namcId, lineNumber, notificationData, connection);
    throw error;
  }

};

/**
 * This method will retrieve file from S3 based on params and perform then below actions -
 * 1. Clean temp table data based on namc and line number
 * 2. Process File Content
 * 3. Insert adjustment into Archive table
 * 4. Cleanup: delete data in nqc summary table and move file data in it from temp table
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line number from input
 * @param {*} params - file meta required to fetch data from S3
 * @param {*} notificationData - Notification Details
 * @param {*} connection - DB Connection required to execute queries
 */
const retrieveFileFromS3Bucket = async (namcId, lineNumber, params, notificationData, connection) => {

  let fileContent;
  const fileNames = [];

  if (namcId === SUMMARY_NQC_CONSTANTS.TMMBC_NAMC_ID) {

    const s3Param1 = {
      Bucket: params.Bucket,
      Key: params.Key1
    }
    const file1 = await s3.getObject(s3Param1).promise();
    const file1Content = file1.Body.toString('utf-8');
    fileNames.push(params.Key1);
    const s3Param2 = {
      Bucket: params.Bucket,
      Key: params.Key2
    }
    const file2 = await s3.getObject(s3Param2).promise();
    const file2Content = file2.Body.toString('utf-8');
    fileNames.push(params.Key2);
    fileContent = file1Content + file2Content;

  } else {
    const file = await s3.getObject(params).promise();
    fileContent = file.Body.toString('utf-8');
    fileNames.push(params.Key);
  }

  await deleteTempData(namcId, lineNumber, connection);
  // Fetching max lo_date from vehicle table
  const maxLoDate = await getMaxLoDate(namcId, lineNumber, connection);
  await processFileContent(namcId, lineNumber, fileContent, maxLoDate, params, null, connection);
  await insertAdjustmnetInArchive(namcId, maxLoDate, fileNames, connection);
  await deleteExistingData(namcId, lineNumber, connection);
  console.log(`------------------------------------------------------`);
  await onJobSuccess(namcId, lineNumber, notificationData, fileNames, connection);

  const p2 = performance.now();
  console.log(`Total Time Taken by lambda: ${(((p2 - p1) / 1000) / 60).toFixed(2)} minutes`);

};

/**
 * This method will delete from ccsb_pass_nqc_summary_temp table.
 * It is required before starting processing to avoid duplidate entry error 
 * from the ccsb_pass_nqc_summary_temp table due to any existing matching record.
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line number from input
 * @param {*} connection - DB Connection to execute queries
 */
const deleteTempData = async (namcId, lineNumber, connection) => {
  let deleteSQL;
  if (lineNumber !== undefined) {
    console.log(`Deleting ccsb_pass_nqc_summary_temp Table Data for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    deleteSQL = `delete from tmm.ccsb_pass_nqc_summary_temp where namc_id = '${namcId}' and line_number='${lineNumber}';`;
  } else {
    console.log(`Deleting ccsb_pass_nqc_summary_temp Table Data for namcId: ${namcId}`);
    deleteSQL = `delete from tmm.ccsb_pass_nqc_summary_temp where namc_id = '${namcId}';`;
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
}

/**
 * This method will insert adjustment (difference in curent and previous file) as a new record into archive table.
 * * If there are more than one supplier for the specific Part/Dock, then the adjustment should be split based on the vendor share of each supplier as given in PRUKANB.
 * * The latest transaction for each Supplier/Part/Dock should be fetched using the Max(Archive_ID) for that Supplier/Part/Dock. Then the adjustment transaction should be inserted so that the latest countdown is adjusted.
 * * Requirement change will not be applied in the below cases -
 * 1. If the given Part/Dock is not in countdown data table.
 * 2. If delete_status=’Y’ for given PDS in countdown table.
 * 3. If IS-REQ-CHANGE-APPLY = 'N' in countdown data table.
 * 4. In case of NA parts, if the Supplier/Part/Dock is not effective in PRUKANB.
 * 5. In case of overseas parts, if the combination of Part/Dock from summary nqc along with Container code fetched from countdown data is not effective in PRUKANB.
 * 6. If the Latest_SV_Date for the buildout corresponding to the countdown < Current data.
 * * Carry Forward (CF) values- is_req_change_apply and fraction_flag, inventoryId, countdown
 * * Countdown = countdown(CF) + adjustment
 * * Set update_type_id = 4 (Requirement Change)
 * * Set is_init_countdown = 'N' as it is not an initial countdown
 * 
 * @param {*} namcId - Namc Id from Input
 * @param {*} maxLoDate - maxLineOff date
 * @param {*} fileNames - file names from s3 source
 * @param {*} connection - DB Connection to execute queries
 */
const insertAdjustmnetInArchive = async (namcId, maxLoDate, fileNames, connection) => {
  // Insert records in ccsb_countdown_data from summary_nqc and summary_nqc_temp
  const selectOSSql = SUMMARY_NQC_CONSTANTS.SELECT_OS_ARCHIVE_SQL;
  const selectNASql = SUMMARY_NQC_CONSTANTS.SELECT_NA_ARCHIVE_SQL;
  const t1 = performance.now();
  const queryParams = [namcId, maxLoDate];
  console.log('Params for select Archive query: ', queryParams);
  console.log(`Fetching::OS adjustments for ccsb_countdown_data Table for namcId: ${namcId}`);
  const archiveOSResult = await connection.query(selectOSSql, queryParams);
  console.log(`Fetching::NA adjustments for ccsb_countdown_data Table for namcId: ${namcId}`);
  const archiveNAResult = await connection.query(selectNASql, queryParams);
  const archiveList = archiveOSResult.rows.concat(archiveNAResult.rows);
  const archiveMap = new Map();
  let insertSql = SUMMARY_NQC_CONSTANTS.INSERT_ARCHIVE_SQL;
  archiveList.forEach(obj => {
    let container_code = 'null';
    const key = getPartKey(obj);
    if (archiveMap.has(key)) {
      const countdown = archiveMap.get(key);
      obj.countdown = countdown + obj.adjustment;
    }
    if (obj.supplier === '0091400') {
      container_code = `'${obj.container_code}'`;
    }
    archiveMap.set(key, obj.countdown);
    insertSql += `('${obj.namc_id}', ${obj.inventory_id}, '${obj.part_no}', '${obj.dock}', '${obj.supplier}', ${container_code}, '${obj.kanban}', ${obj.adjustment}, ${obj.update_type_id}, ${obj.countdown}, '${obj.is_req_change_apply}', ${obj.fraction_flag}, '${obj.is_init_countdown}', '${SUMMARY_NQC_CONSTANTS.jobCode}',current_timestamp, '${SUMMARY_NQC_CONSTANTS.jobCode}', current_timestamp,'${SUMMARY_NQC_CONSTANTS.jobCode}'),`;
  });

  if (archiveList.length > 0) {
    console.log(`Inserting adjustments in ccsb_countdown_data Table for namcId: ${namcId}`);
    const result = await connection.query(insertSql.substring(0, insertSql.length - 1));

    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    console.log(`Total Rows Inserted into Archive: ${result.rowCount} for namcId: ${namcId}`);
  } else {
    console.log(`Total Rows Inserted into Archive:0 for namcId: ${namcId}`);
  }

};

const getPartKey = (obj) => {
  if (obj.supplier === '0091400') {
    return obj.supplier + obj.part_no + obj.container_code;

  } else {
    return obj.supplier + obj.dock + obj.part_no;

  }
}

/**
 * Delete in original nqc pass summary and then Transfer from temp to original nqc summary table.
 * 1. Delete from nqcpass summary
 * 2. Shift data from nqc_summary_temp table to nqc_summary table
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - line number from input
 * @param {*} connection - DB Connection to execute queries
 */
const deleteExistingData = async (namcId, lineNumber, connection) => {
  let deleteSQL;
  if (lineNumber !== undefined) {
    console.log(`Deleting ccsb_pass_nqc_summary Table Data for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    deleteSQL = `delete from tmm.ccsb_pass_nqc_summary where namc_id = '${namcId}' and line_number='${lineNumber}';`;
  } else {
    console.log(`Deleting ccsb_pass_nqc_summary Table Data for namcId: ${namcId}`);
    deleteSQL = `delete from tmm.ccsb_pass_nqc_summary where namc_id = '${namcId}';`;
  }

  let t1 = performance.now();
  let result = await connection.query(deleteSQL);

  let t2 = performance.now();
  console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

  if (lineNumber !== undefined) {
    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId}`);
  }

  let shiftSQL = `insert into tmm.ccsb_pass_nqc_summary select * from tmm.ccsb_pass_nqc_summary_temp `;
  if (lineNumber !== undefined) {
    console.log(`Moving Table Data for namcId: ${namcId} and lineNumber: ${lineNumber} from ccsb_pass_nqc_summary_temp to ccsb_pass_nqc_summary`);
    shiftSQL += `where namc_id = '${namcId}' and line_number='${lineNumber}';`;
  } else {
    console.log(`Moving Table Data for namcId: ${namcId} from ccsb_pass_nqc_summary_temp to ccsb_pass_nqc_summary`);
    shiftSQL += `where namc_id = '${namcId}';`;
  }

  t1 = performance.now();
  result = await connection.query(shiftSQL);

  t2 = performance.now();
  console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

  if (lineNumber !== undefined) {
    console.log(`Total Rows inserted from ccsb_pass_nqc_summary_temp to ccsb_pass_nqc_summary: ${result.rowCount} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    console.log(`Total Rows inserted from ccsb_pass_nqc_summary_temp to ccsb_pass_nqc_summary: ${result.rowCount} for namcId: ${namcId}`);
  }
};

/**
 * This method will process file content. 
 * Based on file size, it will process in chunks if file size exceeds threshold limit.
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line Number from input
 * @param {*} fileContent - File content to process
 * @param {*} maxLoDate - maxLoDate from vehicle table
 * @param {*} params - Params used to log
 * @param {*} fileNames - file Name to move/copy for processed/unprocessed files in s3
 * @param {*} connection - DB Connection to execute queries
 */
const processFileContent = async (namcId, lineNumber, fileContent, maxLoDate, params, fileNames, connection) => {

  const fileRowsArr = fileContent.trim().split('\n');

  if (namcId === SUMMARY_NQC_CONSTANTS.TMMBC_NAMC_ID) {
    // Defining the column positions and lengths as per field mappings
    const columnPositions = [0, 13, 37];
    const columnLengths = [12, 2, 8];
    // sort the merged file Content so conflicts will be avoided among non-consequetive chunks
    // using part, dock, and lineOffDate combination as sort criteria
    fileRowsArr.sort((a, b) => {
      const aKey = columnPositions.map((pos, index) => a.substr(pos, columnLengths[index])).join('|');
      const bKey = columnPositions.map((pos, index) => b.substr(pos, columnLengths[index])).join('|');
      return aKey.localeCompare(bKey);
    });
  }

  const noOfLines = fileRowsArr.length;

  if (lineNumber !== undefined) {
    console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId}`);
  }

  // If the file is empty, skip processing and set status of job to success
  // This is done so that the Step Functions does not fail
  if (noOfLines === 0) {
    if (lineNumber !== undefined) {
      console.log(`No data to process in file ${params.Key} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    } else {
      console.log(`No data to process in file ${params.Key} for namcId: ${namcId}`);
    }
    await onJobSuccess(namcId, lineNumber, notificationData, null, connection);
  }

  await splitFileContent(namcId, lineNumber, fileRowsArr, maxLoDate, connection);

};

/**
 * This method will split the file into chunks and insert each chunk separately.
 * * Note: Last element in each chunk will be carry forwarded to next chunk to 
 * avoid processing duplicate record in multiple chunks
 * 
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line Number from input
 * @param {*} fileRowsArr - File data in array
 * @param {*} maxLoDate - maxLoDate from vehicle table
 * @param {*} connection - DB Connection to execute queries
 */
const splitFileContent = async (namcId, lineNumber, fileRowsArr, maxLoDate, connection) => {
  // Defining the column positions and lengths as per field mappings
  const columnPositions = [0, 13, 37];
  const columnLengths = [12, 2, 8];

  // Grouping the fileRowsArr by columns
  const groups = await groupRowsByColumns(fileRowsArr, columnPositions, columnLengths);
  const chunksOfMap = await splitIntoChunks(groups);
  let batchNum;
  for (let index = 0; index < chunksOfMap.length; index++) {
    batchNum = index + 1;
    console.log(`Processing Batch No: --> ${batchNum}`);

    const isLastChunk = index === chunksOfMap.size - 1 ? true : false;
    await insertTableData(namcId, lineNumber, chunksOfMap[index], maxLoDate, connection, batchNum, isLastChunk);
    console.log(`------------------------------------------------------`);
  }

};

/**
* Split array into chunks each with max size based on threshold
* 
* @param {*} groups - file array group
* @returns 
*/
const splitIntoChunks = async (groups) => {
  const res = [];
  const mapArr = Array.from(groups);
  while (mapArr.length > 0) {
    const chunk = mapArr.splice(0, SUMMARY_NQC_CONSTANTS.THRESHOLD_TO_SPLIT);
    res.push(new Map(chunk));
  }
  return res;
};

/**
 * This method will summarize records based on part, dock and lineOffDate and insert records into temporary nqc summary table.
 * 
 * @param {*} namcId - namc id from input
 * @param {*} lineNumber - line number from input
 * @param {*} groups - file records as map
 * @param {*} maxLoDate - maxLineOff Date from vehicle table
 * @param {*} connection - DB Connection to execute queries
 * @param {*} batchNum - batch number of chunk
 * @param {*} isLastChunk - Flag to determine if the method is for the last chunk or not
 * @returns maxLoDate
 */
const insertTableData = async (namcId, lineNumber, groups, maxLoDate, connection, batchNum, isLastChunk) => {

  console.log(`Batch Length --> ${groups.size}`);

  let output = '';
  groups.forEach(group => {
    const partNo = group[0].substring(0, 0 + 12).trim();
    const dock = group[0].substring(13, 13 + 2).trim();
    const sourceCode = group[0].substring(12, 12 + 1).trim();
    const lineOffDate = group[0].substring(37, 37 + 8).trim();
    const dailyRange = '1';

    let dailyQuantity;
    if (group.length > 1) {
      dailyQuantity = group.reduce((sum, row) => sum + parseInt(row.substring(23, 23 + 10).trim(), 10), 0);
    } else {
      dailyQuantity = parseInt(group[0].substring(23, 23 + 10).trim(), 10);
    }

    let values;

    if (lineNumber !== undefined) {
      values = `('${partNo}','${dock}','${namcId}','${sourceCode}','${lineOffDate}','${dailyRange}',${dailyQuantity},'${lineNumber}'),\n`;
      output += values;
    } else {
      values = `('${partNo}','${dock}','${namcId}','${sourceCode}','${lineOffDate}','${dailyRange}',${dailyQuantity}),\n`;
      output += values;
    }
  });

  let insertSQL;
  if (lineNumber !== undefined) {
    insertSQL = `insert into tmm.ccsb_pass_nqc_summary_temp(part_no, dock, namc_id, source_code, line_off_date, daily_range, daily_quantity, line_number) select part_no, dock, namc_id, source_code, line_off_date, daily_range,daily_quantity,line_number from( values ${output.substring(0, output.length - 2)}) AS data_to_insert(part_no, dock, namc_id, source_code, line_off_date, daily_range, daily_quantity, line_number) where data_to_insert.line_off_date > '${maxLoDate}';`;
  } else {
    insertSQL = `insert into tmm.ccsb_pass_nqc_summary_temp(part_no, dock, namc_id, source_code, line_off_date, daily_range, daily_quantity) select part_no, dock, namc_id, source_code, line_off_date, daily_range, daily_quantity from( values ${output.substring(0, output.length - 2)}) AS data_to_insert(part_no, dock, namc_id, source_code, line_off_date, daily_range, daily_quantity) where data_to_insert.line_off_date > '${maxLoDate}';`;
  }

  const t1 = performance.now();
  const result = await connection.query(insertSQL);

  const t2 = performance.now();
  console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

  if (lineNumber !== undefined) {
    console.log(`Rows Inserted: ${result.rowCount} in ccsb_pass_nqc_summary_temp for namcId: ${namcId} and lineNumber: ${lineNumber}`);
  } else {
    console.log(`Rows Inserted: ${result.rowCount} in ccsb_pass_nqc_summary_temp for namcId: ${namcId}`);
  }

  totalInsertedRow += result.rowCount;

  if (isLastChunk) {

    console.log(`------------------------------------------------------`);

    if (lineNumber !== undefined) {
      console.log(`Total Rows Inserted: ${totalInsertedRow} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    } else {
      console.log(`Total Rows Inserted: ${totalInsertedRow} for namcId: ${namcId}`);
    }
  }
};

/**
 * This method will fetch Galc Max Line off Date 
 * @param {*} namcId - namc id from input
 * @param {*} lineNumber - line number from input
 * @param {*} connection - DB Connection to execute queries
 * @returns 
 */
const getMaxLoDate = async (namcId, lineNumber, connection) => {

  let query;
  if (lineNumber !== undefined) {
    console.log(`Getting Max Line-Off-Date for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    query = `select max(lo_date) from tmm.ccsb_vehicle where vehicle_source_id='1' and namc_id='${namcId}' and line_number='${lineNumber}';`;
  } else {
    console.log(`Getting Max Line-Off-Date for namcId: ${namcId}`);
    query = `select max(lo_date) from tmm.ccsb_vehicle where vehicle_source_id='1' and namc_id='${namcId}';`;
  }
  const result = await connection.query(query);
  const maxLoDate = result.rows[0].max;
  console.log(`Max LoDate value: ${maxLoDate}`);
  return maxLoDate;

};

/**
 * Group array of lines into a map based on values using column position and length
 * @param {*} rows - Array of records
 * @param {*} columnPositions - column positions to extract values
 * @param {*} columnLengths - column values to extract values
 * @returns 
 */
const groupRowsByColumns = async (rows, columnPositions, columnLengths) => {

  const groups = new Map();

  rows.forEach(row => {
    const values = columnPositions.map((pos, index) => row.substr(pos, columnLengths[index]));
    const key = values.join('|');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  });

  return groups;

};

/**
 * This method will create DB connection pool
 * @returns 
 */
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

/**
 * This method will update status as success if the job was successfull.
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line Number from input
 * @param {*} notificationData - Notification Details
 * @param {*} filenames - s3 keyNames of the source file
 * @param {*} connection - DB Connection to execute queries
 */
const onJobSuccess = async (namcId, lineNumber, notificationData, fileNames, connection) => {

  if (lineNumber !== undefined) {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP, execution_flag='N' where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
    console.log(`Daily execution for the Summary NQC completed, execution flag status set to 'N`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_COMPLETED}`);
  } else {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP, execution_flag='N'  where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`Daily execution for the Summary NQC completed, execution flag status set to 'N`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_COMPLETED}`);
  }
  if (fileNames) {
    await moveFiles(
      new ArchiveDO(
        archiveConst.s3_bucket,
        fileNames,
        archiveConst.s3_bucket,
        `processed/${SUMMARY_NQC_CONSTANTS.objectPath.split('/').splice(1).join('/')}${notificationData.name}/${new Date().toISOString()}`,
        true,
        archiveConst.standard_storage_class
      )
    );
  }

  if (notificationData.success_notification === "Y" || notificationData.delayed === "Y") {
    await mailJobStatus(
      null,
      new MailReqDO(
        notificationData.name,
        process.env.appId,
        process.env.appName,
        process.env.moduleId,
        SUMMARY_NQC_CONSTANTS.jobCode,
        mailStatusConst.SUCCESS_STATUS
      )
    );
  }
};

/**
 * This method will update status as failure if the job was failed.
 * @param {*} error - error details
 * @param {*} namcId - Namc Id from input
 * @param {*} lineNumber - Line Number from input
 * @param {*} notificationData - Notification Details
 * @param {*} connection - DB Connection to execute queries
 */
const onJobFailure = async (error, namcId, lineNumber, notificationData, connection) => {

  if (lineNumber !== undefined) {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_FAILED}`);
  } else {
    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${SUMMARY_NQC_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_FAILED}`);
  }

  console.log(`------------------------------------------------------`);
  if (notificationData.failure_notification === "Y") {
    await mailJobStatus(
      error,
      new MailReqDO(
        notificationData.name,
        process.env.appId,
        process.env.appName,
        process.env.moduleId,
        SUMMARY_NQC_CONSTANTS.jobCode,
        mailStatusConst.FAILURE_STATUS
      )
    );
  }
  await connection.end();

};

/**
 * Handler method which will start the job to process the Summary Nqc
 * @param {*} event - input params
 */
exports.handler = async (event) => {

  const namcId = event.namcId;
  let lineNumber = event.lineNumber;

  if (lineNumber === '0') {
    lineNumber = undefined;
  }

  const connection = await connectToDatabase();

  if (lineNumber !== undefined) {
    console.log(`Processing Summary NQC file for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    await processSummaryNQCFile(namcId, lineNumber, connection);
  } else {
    console.log(`Processing Summary NQC file for namcId: ${namcId}`);
    await processSummaryNQCFile(namcId, lineNumber, connection);
  }

  await connection.end();

};
