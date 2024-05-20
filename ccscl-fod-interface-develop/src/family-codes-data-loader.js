/*
FileName - family-codes-data-loader.js
Objective - To fetch data from FOD Family code API and store the data in DB.
--------------------------------File History-------------------------------------
Date - 06/29/2023
By - Piyush Goswami
Modification - Initial creation of the script.
---------------------------------------------------------------------------------
Date - 07/14/2023
By - Piyush Goswami
Modification - Updated the code for qa environment
---------------------------------------------------------------------------------
Date - 07/23/2023
By - Piyush Goswami
Modification - Updated the code to update and delete by unitOnly.
---------------------------------------------------------------------------------
Date - 08/24/2023
By - Mayukh Ray
Modification - Code refactoring and Business logic update.
---------------------------------------------------------------------------------
Date - 10/30/2023
By - Anish Gupta
Modification - Updated the code to trigger status email. 
----------------------------------------------------------------------------------
Date - 04/10/2024
By - Piyush Goswami
Modification - Updated the code to resolve sonar critical security fix. 
----------------------------------------------------------------------------------
*/

const AWS = require("aws-sdk");
const { Pool } = require("pg");
const { performance } = require("perf_hooks");
const pgp = require("pg-promise")(/*options*/);
const axios = require("axios");
const { MailReqDO, jobStatusConst, mailJobStatus, mailStatusConst } = require('@tmna-devops/ccscl-batch-job-common-lib');
const { FAMILY_CODES_CONSTANTS } = require('./constants/constants');

const dbSecretName = process.env.DB_CONNECTION_PARAMS;
const fodSecretName = process.env.FOD_CONNECTION_PARAMS;
const hostName = process.env.HOSTNAME;
const env = process.env.environment;
const region = process.env.AWS_REGION;

AWS.config.update({ region: `${region}` });

const secretsManager = new AWS.SecretsManager();

const getFamilyCodes = async (namcId, unitOnly, connection) => {

    const notificationResult = await connection.query(`select t2.name, t1.success_notification, t1.failure_notification, t1.delayed_notification, t1.nodata_notification from tmm.ccsb_job_details t1, tmm.ccsb_namc t2 where t1.job_code ='${FAMILY_CODES_CONSTANTS.jobCode}' and t1.namc_id='${namcId}' and t2.namc_id='${namcId}';`);
    const notificationData = notificationResult.rows[0];
    console.log('Notification:', notificationData);

    try {

        // Update Job Status
        await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_IN_PROGRESS}', start_timestamp=CURRENT_TIMESTAMP where job_code='${FAMILY_CODES_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
        console.log(`BATCH JOB_STATUS for namcId: ${namcId} and unitOnly: ${unitOnly} ---> ${jobStatusConst.STATUS_IN_PROGRESS}`);

        // Call Auth endpoint and set Auth Header and Request Body
        const headers = await getFODAuthTokenAndSetAuthHeader();
        const reqBody = {
            business_entity: namcId,
            unit_only: unitOnly,
            family_code: "all",
            date: `${new Date().toISOString().slice(0, 10)}`,
            parts_master_data: "true",
            inactive_parts_pm: "true"
        };
        console.log(`Set Headers and Request Body for Family Codes Fetch Request for namcId: ${namcId} and unitOnly: ${unitOnly}`);

        const response = await axios.post(
            `https://${hostName}/${env}/partsmaster/familycode`,
            reqBody,
            {
                headers: headers,
            }
        );

        if (response.data.body.count === 0) {
            throw Error(`Received Empty Response for namcId: ${namcId} and unitOnly: ${unitOnly} from FOD Family Codes API!`);
        } else {
            const dataArr = response.data.body.list;

            const modifiedData = [];
            dataArr.forEach(element => {
                const data = {
                    part_no: `${element.part_no}`,
                    dock: `${element.dock}`,
                    family_code: `${element.family}`,
                    namc_id: `${namcId}`,
                };
                if (unitOnly === "true") {
                    data["is_unit"] = "Y";
                } else {
                    data["is_unit"] = "N";
                }
                modifiedData.push(data);
            });

            await deleteExistingData(namcId, unitOnly, connection);
            await insertTableData(namcId, unitOnly, modifiedData, notificationData, connection);
        }
    } catch (error) {
        await onJobFailure(error, namcId, unitOnly, notificationData, connection);
        throw error;

    }

};

const getFODAuthTokenAndSetAuthHeader = async () => {

    console.log('Getting Access Token from Azure AD Token endpoint...');
    const data = await secretsManager.getSecretValue({ SecretId: fodSecretName }).promise();
    const secretValue = JSON.parse(data.SecretString);

    const xApikey = secretValue.x_api_key;
    const params = {
        resource: secretValue.resource,
        client_id: secretValue.client_id,
        client_secret: secretValue.client_secret,
        grant_type: secretValue.grant_type,
    };

    const response = await axios.post(
        `${secretValue.token_endpoint}`,
        params,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    const accessToken = response.data.access_token;
    console.log('Access Token received Azure AD Token endpoint!');

    return {
        "x-api-key": `${xApikey}`,
        Authorization: `${accessToken}`,
    };

};

const deleteExistingData = async (namcId, unitOnly, connection) => {

    console.log(`Deleting Exisiting Table Data for namcId: ${namcId} and unitOnly: ${unitOnly}`);

    let deleteSQL;
    if (unitOnly === "true") {
        deleteSQL = `delete from tmm.ccsb_family_codes where namc_id = '${namcId}' and is_unit='Y';`;
    } else {
        deleteSQL = `delete from tmm.ccsb_family_codes where namc_id = '${namcId}' and is_unit='N';`;
    }

    const t1 = performance.now();
    await connection.query("BEGIN");
    const result = await connection.query(deleteSQL);
    await connection.query("COMMIT");

    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    console.log(`Total Rows Deleted: ${result.rowCount} for namcId: ${namcId} and unitOnly: ${unitOnly}`);

};

const insertTableData = async (namcId, unitOnly, modifiedData, notificationData, connection) => {

    let insertSQL = "";
    modifiedData.forEach((element) => {
        const query = pgp.helpers.insert(element, null, "tmm.ccsb_family_codes");
        insertSQL = insertSQL + `${query};\n`;
    });
    insertSQL = insertSQL.split('"tmm.ccsb_family_codes"').join("tmm.ccsb_family_codes");

    console.log(`\n\n Inserting Table Data for namcId: ${namcId}`);

    const t1 = performance.now();
    await connection.query("BEGIN");
    const result = await connection.query(insertSQL);
    await connection.query("COMMIT");

    const t2 = performance.now();
    console.log(`Time Taken: ${(t2 - t1) / 1000} seconds`);

    console.log(`Rows Inserted: ${Object.keys(result)[Object.keys(result).length - 1]} for namcId: ${namcId} and unitOnly: ${unitOnly}`);

    await onJobSuccess(namcId, unitOnly, notificationData, connection);

};

const connectToDatabase = async () => {
    const data = await secretsManager.getSecretValue({ SecretId: dbSecretName }).promise();
    const secret = JSON.parse(data.SecretString);
    return new Pool({
        host: secret.host,
        database: secret.database,
        port: secret.port,
        password: secret.password,
        user: secret.username,
    });
};

const onJobSuccess = async (namcId, unitOnly, notificationData, connection) => {

    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_COMPLETED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${FAMILY_CODES_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} and unitOnly: ${unitOnly} ---> ${jobStatusConst.STATUS_COMPLETED}`);
    if (notificationData.success_notification === "Y") {
        await mailJobStatus(
            null,
            new MailReqDO(
                notificationData.name,
                process.env.appId,
                process.env.appName,
                process.env.moduleId,
                FAMILY_CODES_CONSTANTS.jobCode,
                mailStatusConst.SUCCESS_STATUS
            )
        );
    }
    await connection.end();
};

const onJobFailure = async (error, namcId, unitOnly, notificationData, connection) => {

    await connection.query(`update tmm.ccsb_job_details set current_status='${jobStatusConst.STATUS_FAILED}', end_timestamp=CURRENT_TIMESTAMP where job_code='${FAMILY_CODES_CONSTANTS.jobCode}' and namc_id='${namcId}';`);
    console.log(`BATCH JOB_STATUS for namcId: ${namcId} and unitOnly: ${unitOnly} ---> ${jobStatusConst.STATUS_FAILED}`);
    if (notificationData.failure_notification === "Y") {
        await mailJobStatus(
            error,
            new MailReqDO(
                notificationData.name,
                process.env.appId,
                process.env.appName,
                process.env.moduleId,
                FAMILY_CODES_CONSTANTS.jobCode,
                mailStatusConst.FAILURE_STATUS
            )
        );
    }
    await connection.end();

};

exports.handler = async (event) => {

    const namcId = event.namcId;
    const unitOnly = event.unitOnly;

    const connection = await connectToDatabase();

    console.log(`Fetching Family Codes for namcId: ${namcId} and unitOnly: ${unitOnly}`);
    await getFamilyCodes(namcId, unitOnly, connection);

};
