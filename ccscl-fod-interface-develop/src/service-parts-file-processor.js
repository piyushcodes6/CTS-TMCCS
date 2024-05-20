/*
FileName - service-parts-file-processor.js
Objective - To read data from FOD Service Parts text file and store the data in DB.
--------------------------------File History---------------------------------------
Date - 06/09/2023
By - Piyush Goswami
Modification - Initial creation of the script.
-----------------------------------------------------------------------------------
Date - 08/24/2023
By - Mayukh Ray
Modification - Code refactoring and Business logic update.
---------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to trigger status email. 
----------------------------------------------------------------------------------
Date - 11/21/2023
By - Anish Gupta
Modification - Updated the code to move/copy processed/unprocessed files in s3 onJobSuccess. 
----------------------------------------------------------------------------------
Date - 04/10/2024
By - Piyush Goswami
Modification - Updated the code to resolve sonar critical security fix. 
----------------------------------------------------------------------------------
*/

const AWS = require('aws-sdk');
const { Pool } = require("pg");
const { performance } = require("perf_hooks");
const { MailReqDO, jobStatusConst, mailJobStatus, mailStatusConst, ArchiveDO, moveFiles, archiveConst } = require('@tmna-devops/ccscl-batch-job-common-lib');
const { SERVICE_PARTS_CONSTANTS } = require('./constants/constants');

const secretName = process.env.DB_CONNECTION_PARAMS;
const region = process.env.AWS_REGION;

AWS.config.update({ region: `${region}` });

var s3 = new AWS.S3({ region: `${region}` });
const secretsManager = new AWS.SecretsManager();

const processServicePartsFile = async (params, connection) => {

    const file = await s3.getObject(params).promise();
    const fileContent = file.Body.toString('utf-8');
    const keyName = params.Key;
    await processFileContent(params.Key.split("/").pop(), fileContent, keyName, connection);
};

const processFileContent = async (fileName, fileData, keyName, connection) => {
    console.log(`Getting File Details from DB for fileName: ${fileName}`);

    const result = await connection.query(`select * from tmm.ccsb_batch_files where name='${fileName}';`);
    console.log(`Rows Affected: ${result.rowCount}`);

    const namcId = result.rows[0].namc_id;
    const jobCode = result.rows[0].job_code;

    const notificationResult = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification, t1.delayed from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}';`);
    const notificationData = notificationResult.rows[0];
    console.log('Notification:', notificationData);

    try {

        // Update Job Status
        await connection.query(`update tmm.ccsb_job_details set delayed='N', current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${jobCode}' and namc_id='${namcId}';`);
        console.log(`BATCH JOB_STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);

        await deleteExistingData(namcId, connection);
        await insertTableData(namcId, jobCode, fileData, notificationData, keyName, connection);

    } catch (error) {
        await onJobFailure(error, namcId, jobCode, notificationData, connection);
        throw error;

    }

};

const deleteExistingData = async (namcId, connection) => {

    console.log(`Deleting Exisiting Table Data for namcId: ${namcId}`);

    
    const deleteQuery = `delete from tmm.ccsb_service_parts_requirement where namc_id = '${namcId}';`;

    const t1 = performance.now();
    await connection.query('BEGIN');
    const result = await connection.query(deleteQuery);
    await connection.query('COMMIT');

    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId}`);

};

const insertTableData = async (namcId, jobCode, inputFile, notificationData, keyName, connection) => {

    console.log(`Inserting Table Data for namcId: ${namcId}`);

    const lines = inputFile.trim().split('\n');
    lines.shift();
    lines.pop();

    let output = '';
    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        if (line.trim() === '') {
            continue;
        }

        const supplier = line.substring(4, 4 + 5).trim() || null;
        const dock = line.substring(9, 9 + 2).trim() || null;
        const part = line.substring(11, 11 + 12).trim() || null;
        const prodDate = line.substring(29, 29 + 10).trim() || null;
        const quantity = parseInt(line.substring(39, 39 + 10).trim(), 10) || null;

        const values = `('${namcId}','00${supplier}','${dock}','${part}','${prodDate}',${quantity}),\n`;
        output += values;

    }

    const insertSQL = `insert into tmm.ccsb_service_parts_requirement (namc_id, supplier, dock, part, prod_date, quantity) values ${output.substring(0, output.length - 2)};`;

    const t1 = performance.now();
    await connection.query("BEGIN");
    const result = await connection.query(insertSQL);
    await connection.query("COMMIT");

    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    console.log(`Rows Inserted: ${result.rowCount} for namcId: ${namcId}`);

    await onJobSuccess(namcId, jobCode, notificationData, keyName, connection);

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

const onJobSuccess = async (namcId, jobCode, notificationData, fileName, connection) => {

    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_COMPLETED}`);
    
    if (fileName) {
        await moveFiles(
          new ArchiveDO(
            archiveConst.s3_bucket,
            [fileName],
            archiveConst.s3_bucket,
            `processed/${SERVICE_PARTS_CONSTANTS.objectPath.split('/').splice(1).join('/')}${notificationData.name}/${new Date().toISOString()}`,
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
                jobCode,
                mailStatusConst.SUCCESS_STATUS
            )
        );
    }
    await connection.end();

};

const onJobFailure = async (error, namcId, jobCode, notificationData, connection) => {

    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} ---> ${jobStatusConst.STATUS_FAILED}`);
    if (notificationData.failure_notification === "Y") {
        await mailJobStatus(
            error,
            new MailReqDO(
                notificationData.name,
                process.env.appId,
                process.env.appName,
                process.env.moduleId,
                jobCode,
                mailStatusConst.FAILURE_STATUS
            )
        );
    }
    await connection.end();

};

exports.handler = async (event) => {

    const bucketName = event.Records[0].s3.bucket.name;
    console.log("Bucket: " + bucketName);

    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    console.log("Key/File Name: " + key);

    const params = {
        Bucket: bucketName,
        Key: key
    };

    const connection = await connectToDatabase();

    await processServicePartsFile(params, connection);

};
