const { mailStatusConst, jobStatusConst, archiveConst } = require('./common/constants/constant')

module.exports = {
    ...require('./common/modules/email/email'),
    ...require('./common/modules/archiveFiles/archive'),
    ...require('./common/model/MailReqDO'),
    ...require('./common/model/ArchiveDO'),
    ...require('./common/modules/checkWeekend/checkWeekend'),
    mailStatusConst, jobStatusConst, archiveConst
}