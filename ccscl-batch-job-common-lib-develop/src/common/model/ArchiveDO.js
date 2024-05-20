class ArchiveDO {
    constructor(srcBucket, srcKeyNames, destBucket, destPath, moveFlag, storageClass) {
        this.srcBucket = srcBucket;
        // list of all he file key names in the source bucket
        this.srcKeyNames = srcKeyNames;
        this.destBucket = destBucket;
        // dest path - common for all the files
        this.destPath = destPath;
        // if moveFlag == true than move else copy (false)
        this.moveFlag = moveFlag ? true : false;
        // processed (storageClass - IA) or else default/unprocessed (storageClass - Standard)
        this.storageClass = storageClass ? storageClass : 'STANDARD';
    }
}

exports.ArchiveDO = ArchiveDO;