/**
 * Constants for configuration file
 */
exports.configConstants = {
  DB_TIMESTAMP_FORMAT: 'yyyy-MM-dd HH:mm:ss.SSSSSS',
  Timezone: {
    EST_EDT: 'America/New_York',
    PST_PDT: 'America/Los_Angeles',
    CST_CDT: 'America/Chicago'
  }
}

const dbTable = {
  TMM_SCHEMA: 'tmm',
  tableNames: {
    BO_ARCHIVE: 'ccsb_countdown_data',
    BO_BUILDOUT: 'ccsb_buildout',
    BO_INVENTORY: 'ccsb_inventory',
    BO_PASS_NQC_SUMM_TEMP: 'ccsb_pass_nqc_summary_temp',
    BO_PASS_NQC_SUMM_MAIN: 'ccsb_pass_nqc_summary',
  },
  VIEWS: {
    STKPRUM: 'stkprum'
  }
}

/**
 * Constant for detailed NQC
 */
exports.DETAILED_NQC_CONSTANTS = {
  jobCode: "CCS_DETAILED_NQC",
  objectPath: "inbound/fod/detailed-nqc/"
}

/**
 * Constant for family codes
 */
exports.FAMILY_CODES_CONSTANTS = {
  jobCode: "CCS_FAMILY_CODES"
}

/**
 * Constant for pass vehicle
 */
exports.PASS_VEHICLE_CONSTANTS = {
  jobCode: "CCS_PASS_VEHICLE",
  objectPath: "inbound/fod/pass/"
}

/**
 * Constant for service parts
 */
exports.SERVICE_PARTS_CONSTANTS = {
  jobCode: "CCS_SERVICE_PARTS",
  objectPath: "inbound/fod/service-parts/"
}

/**
 * Constant for summary NQC
 */
exports.SUMMARY_NQC_CONSTANTS = {
  jobCode: 'CCS_NQC_SUMMARY',
  objectPath: 'inbound/fod/summary-nqc/',
  THRESHOLD_TO_SPLIT: 500000,
  TMMBC_NAMC_ID: '20',
  SELECT_OS_ARCHIVE_SQL: `select distinct curr.namc_id, arch.inventory_id, curr.part_no, '-' as dock, prt.supplier, arch.container_code, prt.kanban, (((curr.quantity - prev.quantity)* prt.vendor_share * 0.01)::INTEGER) as adjustment, 4 as update_type_id, (((curr.quantity - prev.quantity)* prt.vendor_share * 0.01 + arch.countdown)::INTEGER) as countdown, arch.is_req_change_apply, arch.fraction_flag , 'N' as is_init_countdown from ${dbTable.TMM_SCHEMA}.stkprum prt, ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_BUILDOUT} bout, ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_INVENTORY} inv, ( select t1.inventory_id, t1.part_no, t1.dock, t1.supplier, t1.container_code, t1.countdown, t1.is_req_change_apply, t1.fraction_flag from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_ARCHIVE} t1 where archive_id in ( select max(archive_id) from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_ARCHIVE} where delete_status = 'N' and namc_id = $1 and is_req_change_apply = 'Y' group by part_no,  supplier,container_code ) ) arch, ( select namc_id, part_no, dock, coalesce(sum(daily_quantity),0) as quantity from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_PASS_NQC_SUMM_TEMP} where namc_id = $1 group by namc_id, part_no, dock) curr left join ( select part_no, dock, coalesce(sum(daily_quantity),0) as quantity from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_PASS_NQC_SUMM_MAIN} where namc_id = $1 and line_off_date > $2 group by part_no, dock) prev on curr.part_no = prev.part_no and curr.dock = prev.dock where prt.business_entity = $1 and prt.part_no = curr.part_no and prt.dock = curr.dock and arch.part_no = curr.part_no and arch.supplier = prt.supplier and prt.supplier = '0091400' and arch.container_code = prt.container_code and inv.inventory_id = arch.inventory_id and bout.buildout_id = inv.buildout_id and bout.latest_sv_date >= current_date and (curr.quantity - prev.quantity) <> 0`,
  SELECT_NA_ARCHIVE_SQL: `select distinct curr.namc_id, arch.inventory_id, curr.part_no, curr.dock as dock, prt.supplier, coalesce(arch.container_code,'') as container_code, prt.kanban, (((curr.quantity - prev.quantity)* prt.vendor_share * 0.01)::INTEGER) as adjustment, 4 as update_type_id, (((curr.quantity - prev.quantity)* prt.vendor_share * 0.01 + arch.countdown)::INTEGER) as countdown, arch.is_req_change_apply, arch.fraction_flag , 'N' as is_init_countdown from ${dbTable.TMM_SCHEMA}.stkprum prt, ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_BUILDOUT} bout, ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_INVENTORY} inv, ( select t1.inventory_id, t1.part_no, t1.dock, t1.supplier, t1.container_code, t1.countdown, t1.is_req_change_apply, t1.fraction_flag from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_ARCHIVE} t1 where archive_id in ( select max(archive_id) from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_ARCHIVE} where delete_status = 'N' and namc_id = $1 and is_req_change_apply = 'Y' group by part_no, dock, supplier ) ) arch, ( select namc_id, part_no, dock, coalesce(sum(daily_quantity),0) as quantity from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_PASS_NQC_SUMM_TEMP} where namc_id = $1 group by namc_id, part_no, dock) curr left join ( select part_no, dock, coalesce(sum(daily_quantity),0) as quantity from ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_PASS_NQC_SUMM_MAIN} where namc_id = $1 and line_off_date > $2 group by part_no, dock) prev on curr.part_no = prev.part_no and curr.dock = prev.dock where prt.business_entity = $1 and prt.part_no = curr.part_no and prt.dock = curr.dock and arch.part_no = curr.part_no and arch.dock = curr.dock and arch.supplier = prt.supplier and prt.supplier <> '0091400' and inv.inventory_id = arch.inventory_id and bout.buildout_id = inv.buildout_id and bout.latest_sv_date >= current_date and (curr.quantity - prev.quantity) <> 0`,
  INSERT_ARCHIVE_SQL: `insert into ${dbTable.TMM_SCHEMA}.${dbTable.tableNames.BO_ARCHIVE} (namc_id, inventory_id, part_no, dock,supplier, container_code, kanban, adjustment, update_type_id, countdown,is_req_change_apply,fraction_flag,is_init_countdown,inserted_by,insert_timestamp,user_id,last_update_timestamp,last_updated_by) values `
}
