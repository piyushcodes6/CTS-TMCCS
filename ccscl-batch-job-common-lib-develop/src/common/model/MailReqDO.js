class MailReqDO {
    constructor(namcName, appId, appName, moduleId, jobCode, status) {
        this.namcName = namcName;
        this.appId = appId;
        this.appName = appName;
        this.moduleId = moduleId;
        this.jobCode = jobCode;
        this.status = status;
    }
}

exports.MailReqDO = MailReqDO