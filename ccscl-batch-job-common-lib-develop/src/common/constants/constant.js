exports.mailConst = {
    SUBJECT: `<job_code> status <Status> for NAMC <NAMCName>`,
    BODY: `Batch Job <job_code> status <Status> for NAMC <NAMCName>.<error>`,
    ERROR_MSG: `<br>Error Details:<br><errorMsg>`
}

exports.mailStatusConst = {
    SUCCESS_STATUS: "ran successfully",
    FAILURE_STATUS: "failed",
    DELAYED_STATUS: "was delayed"
}

exports.jobStatusConst = {
    STATUS_IN_PROGRESS: 'INPROGRESS',
    STATUS_FAILED: 'FAILED',
    STATUS_COMPLETED: 'COMPLETED'
}

exports.archiveConst = {
    s3_bucket: `ccs-${process.env.environment}-data-files`,
    s3_source_file_path_prefix: `inbound/`,
    standard_storage_class: 'STANDARD',
    standard_ia_storage_class: 'STANDARD_IA'
}