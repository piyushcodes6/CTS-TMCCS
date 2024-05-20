export const sqlStatements = {
    osContainerUpsertSql: {
        INSERT_OVERSEAS_CONTAINER: 'insert into %s.ccsb_overseas_container (container, namc_id, estgtn, actgtn, devanned) values ',
        UPDATE_OVERSEAS_CONTAINER: ` ON CONFLICT(container, namc_id) DO UPDATE SET estgtn = EXCLUDED.estgtn, actgtn = EXCLUDED.actgtn, devanned = EXCLUDED.devanned,last_updated_by='system',last_update_timestamp=CURRENT_TIMESTAMP;`,
    },
    osPartsUpsertSql: {
        INSERT_OVERSEAS_PARTS: 'insert into %s.ccsb_overseas_parts (container, namc_id, module, part_no, qty, sup_cd) values ',
        UPDATE_OVERSEAS_PARTS: ` ON CONFLICT(container, module, part_no) DO UPDATE SET qty = EXCLUDED.qty,sup_cd = EXCLUDED.sup_cd,last_updated_by='system',last_update_timestamp=CURRENT_TIMESTAMP;`,
    },
    NAMCQuery: {
        SELECT_QUERY: 'select namc_id,schema_name from tmm.ccsb_namc',
    }
}

export const commonLogs = {
    infos: {
        DB_POOL_INFO: { END: 'DB-Pool ended after returning result...' }
    },

    errors: {
        HANDLER_ERROR: 'While handling request: ',
        DATA_VALIDATION_ERROR: 'Data Validation failed, please check the data!',
        DATA_PROCESSING_ERROR: 'Missing Data or error occurred during deserialization!',
        DB_CONNECTION_ERROR: { CREATE: 'While connecting to the database: ', CLOSE: 'While closing database connection: ' },
        DB_EXEC_STATEMENT_ERROR: 'While executing sql command: ',
        SECRET_MGR_RETREIVE_ERROR: 'Failed to retrieve secret: ',
        SSM_FETCH_ERROR: 'While fetching SSM Parameters: ',
        SES_SEND_ERROR: 'While sending email: '
    }
}