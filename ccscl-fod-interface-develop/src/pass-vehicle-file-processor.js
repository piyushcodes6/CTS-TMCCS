/*
FileName - pass-vehicle-file-processor.js
Objective - To read data from FOD PASS Vehicle text file and store the data in DB.
--------------------------------File History--------------------------------------
Date - 06/21/2023
By - Piyush Goswami
Modification - Initial creation of the script.
----------------------------------------------------------------------------------
Date - 07/10/2023
By - Piyush Goswami
Modification - Updated the delete function to handle T26 and M26 Files.
----------------------------------------------------------------------------------
Date - 08/24/2023
By - Mayukh Ray
Modification - Code refactoring and Business logic update.
----------------------------------------------------------------------------------
Date - 10/04/2023
By - Piyush Goswami
Modification - Updated the code to exclude records where lo_date is greater then (current date -14 days).
----------------------------------------------------------------------------------
Date - 10/05/2023
By - Piyush Goswami
Modification - Updated the code to use postgres transactions.
----------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to trigger status email. 
----------------------------------------------------------------------------------
Date - 11/21/2023
By - Anish Gupta
Modification - Updated the code to move/copy processed/unprocessed files in s3 onJobSuccess. 
----------------------------------------------------------------------------------
Date - 02/05/2024
By - Anish Gupta
Modification - Process pass vehicle based on executionFlag from ccsb_job_details.
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
const moment = require('moment');
const { MailReqDO, jobStatusConst, mailJobStatus, mailStatusConst, ArchiveDO, moveFiles, archiveConst } = require('@tmna-devops/ccscl-batch-job-common-lib');
const { PASS_VEHICLE_CONSTANTS } = require('./constants/constants');

const bucketName = process.env.S3_BUCKET_NAME;
const secretName = process.env.DB_CONNECTION_PARAMS;
const region = process.env.AWS_REGION;

AWS.config.update({ region: `${region}` });

var s3 = new AWS.S3({ region: `${region}` });
const secretsManager = new AWS.SecretsManager();

const processPASSVehicleFile = async (namcId, lineNumber, connection) => {

    let notificationData = {};
    if (lineNumber !== undefined) {
        const notificationResult = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed, t1.execution_flag,t1.current_status from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${PASS_VEHICLE_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}' and line_number='${lineNumber}';`);
        notificationData = notificationResult.rows[0];
        console.log('Notification:', notificationData);
    } else {
        const notificationResult = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed, t1.execution_flag,t1.current_status from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${PASS_VEHICLE_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}';`);
        notificationData = notificationResult.rows[0];
        console.log('Notification:', notificationData);
    }

    try {
        // execute pass vehicle daily load based on execution flag
        if ('Y' === notificationData.execution_flag && notificationData.current_status !== 'INPROGRESS') {
        
            // Update Job Status
            if (lineNumber !== undefined) {
                await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
                console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
            } else {
                await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
                console.log(`BATCH JOB STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);
            }

            // Get File Details
            let query;
            if (lineNumber !== undefined) {
                console.log(`Getting File Details for namcId: ${namcId} and lineNumber: ${lineNumber}`);
                query = `select * from tmm.ccsb_batch_files where namc_id='${namcId}' and job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and line_number='${lineNumber}';`;
            } else {
                console.log(`Getting File Details for namcId: ${namcId}`);
                query = `select * from tmm.ccsb_batch_files where namc_id='${namcId}' and job_code='${PASS_VEHICLE_CONSTANTS.jobCode}';`;
            }
            const result = await connection.query(query);
            console.log(`Rows Affected: ${result.rowCount}`);
            const fileName = result.rows[0].name;

            const params = { Bucket: bucketName, Key: PASS_VEHICLE_CONSTANTS.objectPath + fileName.replace(/\+/g, ' ') };
            console.log(params);

            await connection.query("BEGIN");
            await retrieveFileFromS3Bucket(namcId, lineNumber, params, connection);
            await connection.query("COMMIT");

            await onJobSuccess(namcId, lineNumber, notificationData, params.Key, connection);
        } else {
            console.log('Skipped Pass Vehicle execution as it has already ran for the current day OR it is already in-progress.');
        }
    } catch (error) {
        await connection.query('ROLLBACK');
        await onJobFailure(error, namcId, lineNumber, notificationData, connection);
        throw error;
    }

};

const retrieveFileFromS3Bucket = async (namcId, lineNumber, params, connection) => {

    const file = await s3.getObject(params).promise();
    const fileContent = file.Body.toString('utf-8');
    await deleteExistingData(namcId, lineNumber, connection);
    await processFileContent(namcId, lineNumber, fileContent, params, connection);

};

const deleteExistingData = async (namcId, lineNumber, connection) => {

    let deleteSQL;
    if (lineNumber !== undefined) {
        console.log(`Deleting Exisiting Table Data for namcId: ${namcId} and lineNumber: ${lineNumber}`);
        deleteSQL = `delete from tmm.ccsb_vehicle where namc_id = '${namcId}' and vehicle_source_id='2' and line_number='${lineNumber}';`;
    } else {
        console.log(`Deleting Exisiting Table Data for namcId: ${namcId}`);
        deleteSQL = `delete from tmm.ccsb_vehicle where namc_id = '${namcId}' and vehicle_source_id='2';`;
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

};

const processFileContent = async (namcId, lineNumber, fileContent, params, connection) => {

    const fileRowsArr = fileContent.trim().split('\n');
    const noOfLines = fileRowsArr.length;

    if (lineNumber !== undefined) {
        console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
    } else {
        console.log(`Total Lines in file before processing: ${noOfLines} for namcId: ${namcId}`);
    }

    // If the file is empty, skip processing and set status of job to success
    // This is done so that the downstream jobs/lambdas in the Step Function can be processed
    if (noOfLines === 0) {
        if (lineNumber !== undefined) {
            console.log(`No data to process in file ${params.Key} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
        } else {
            console.log(`No data to process in file ${params.Key} for namcId: ${namcId}`);
        }
    } else {
        await insertTableData(namcId, lineNumber, fileRowsArr, connection);
    }

};

const insertTableData = async (namcId, lineNumber, fileRowsArr, connection) => {

    console.log(`Inserting Data for namcId: ${namcId}`);

    let output = '';

    for (let i = 0; i < fileRowsArr.length; i++) {

        const line = fileRowsArr[i];

        if (line.trim() === '') {
            continue;
        }

        const refno = line.substring(0, 0 + 7).trim();
        const vehicleSourceId = 2;
        const spec200 = line.substring(154, 154 + 200).trim() || null;
        const loDate = convertDateFormat(line.substring(77, 77 + 6).trim());
        const lineNumber1 = line.substring(83, 83 + 2).trim() || null;
        const ssn = line.substring(11, 11 + 2).trim() || null;
        const extCode = line.substring(58, 58 + 3).trim() || null;
        const intCode = line.substring(61, 61 + 4).trim() || null;
        const ctlkata = null;
        const seqno = null;
        const bdno = null;
        const prodWeek = line.substring(73, 73 + 4).trim() || null;
        const modelYear = null;
        const katashiki = line.substring(13, 13 + 14).trim() || null;
        const urn = line.substring(110, 110 + 10).trim();

        // Calculate the date 14 days ago
        const date14DaysAgo = moment().subtract(14, 'days');

        const loDateParsed = moment(loDate, 'YYYYMMDD');

        // Check if loDate is after last 14 days from current date
        if (loDateParsed.isSameOrAfter(date14DaysAgo, 'day')) {
            const values = `('${refno}','${namcId}',${vehicleSourceId},'${spec200}','${loDate}','${lineNumber1}','${ssn}','${extCode}','${intCode}',${ctlkata},${seqno},${bdno},'${prodWeek}',${modelYear},'${katashiki}','${urn}'),\n`;
            output += values;
        }
    }

    if (output) {
        const insertSQL = `insert into tmm.ccsb_vehicle(refno,namc_id,vehicle_source_id,spec200,lo_date,line_number,ssn,ext_code,int_code,ctlkata,seqno,bdno,prod_week,model_year,katashiki,urn) values ${output.substring(0, output.length - 2)} ON CONFLICT(urn) DO NOTHING;`;

        const t1 = performance.now();
        const result = await connection.query(insertSQL);


        const t2 = performance.now();
        console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

        if (lineNumber !== undefined) {
            console.log(`Rows Inserted: ${result.rowCount} for namcId: ${namcId} and lineNumber: ${lineNumber}`);
        } else {
            console.log(`Rows Inserted: ${result.rowCount} for namcId: ${namcId}`);
        }

    } else {
        console.log(`No record found with lo_dates after (current date -14) days`);
        throw Error(`No record found with lo_dates after (current date -14) days. Rolling back the deleted records!`);
    }
};

const convertDateFormat = dateString => `${new Date().getFullYear().toString().substring(0, 2)}${dateString.substring(0, 2)}${dateString.substring(2, 4)}${dateString.substring(4, 6)}`;

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

const onJobSuccess = async (namcId, lineNumber, notificationData, fileName, connection) => {

    if (lineNumber !== undefined) {
        await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP, execution_flag='N' where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
        console.log(`Daily execution for the Pass Vehicle completed, execution flag status set to 'N`);
        console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_COMPLETED}`);
    } else {
        await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP, execution_flag='N' where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
        console.log(`Daily execution for the Pass Vehicle completed, execution flag status set to 'N`);
        console.log(`BATCH JOB STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_COMPLETED}`);
    }
    if (fileName) {
        await moveFiles(
            new ArchiveDO(
                archiveConst.s3_bucket,
                [fileName],
                archiveConst.s3_bucket,
                `processed/${PASS_VEHICLE_CONSTANTS.objectPath.split('/').splice(1).join('/')}${notificationData.name}/${new Date().toISOString()}`,
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
                PASS_VEHICLE_CONSTANTS.jobCode,
                mailStatusConst.SUCCESS_STATUS
            )
        );
    }
    await connection.end();

};

const onJobFailure = async (error, namcId, lineNumber, notificationData, connection) => {

    if (lineNumber !== undefined) {
        await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}' and line_number='${lineNumber}';`);
        console.log(`BATCH JOB STATUS for namcId: ${namcId} and lineNumber: ${lineNumber} ---> ${jobStatusConst.STATUS_FAILED}`);
    } else {
        await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${PASS_VEHICLE_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
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
                PASS_VEHICLE_CONSTANTS.jobCode,
                mailStatusConst.FAILURE_STATUS
            )
        );
    }
    console.log(`------------------------------------------------------`);

    await connection.end();

};

exports.handler = async (event) => {

    const namcId = event.namcId;
    let lineNumber = event.lineNumber;

    if (lineNumber === '0') {
        lineNumber = undefined;
    }

    const connection = await connectToDatabase();

    if (lineNumber !== undefined) {
        console.log(`Processing PASS Vehicle file for namcId: ${namcId} and lineNumber: ${lineNumber}`);
        await processPASSVehicleFile(namcId, lineNumber, connection);
    } else {
        console.log(`Processing PASS Vehicle file for namcId: ${namcId}`);
        await processPASSVehicleFile(namcId, lineNumber, connection);
    }

}; 
