const { configConstants } = require('./../constants/constants');

/**
 * Method to get current timestamp based on namcId
 * @param {*} namcId - namc id from input
 * @param {*} connection - DB Connection to execute queries
 * @returns 
 */
exports.getNamcCurrentTs = async (namcId, connection) => {
    console.log(`Fetchig timezone for namcId: ${namcId}`);
    const selectSql = `select timezone from tmm.ccsb_namc where namc_id = '${namcId}';`;

    const t1 = performance.now();
    const result = await connection.query(selectSql);
    const timezone = result.rows[0].timezone;

    const t2 = performance.now();
    console.log(`Time Taken to get timezone from ccsb_namc: ${(t2 - t1) / 1000} seconds`);

    return getCurrentTsByTimezone(timezone);

}

/**
 * Get current timestamp based on timezone
 * @param {*} timezone - timezone based on namc
 * @returns 
 */
const getCurrentTsByTimezone = async (timezone) => {
    const location = configConstants.Timezone[timezone.replace('/', '_')];
    return toDBDateFormat(new Date(new Date().toLocaleString("en-US", { timeZone: location })));
}

/**
 * Convert dateTime to DB timestamp format
 * @param {*} date - timestamp
 * @returns 
 */
const toDBDateFormat = async (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(6, '0');

    const formattedDate = configConstants.DB_TIMESTAMP_FORMAT
        .replace('yyyy', year)
        .replace('MM', month)
        .replace('dd', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
        .replace('SSSSSS', milliseconds);

    return formattedDate;
}