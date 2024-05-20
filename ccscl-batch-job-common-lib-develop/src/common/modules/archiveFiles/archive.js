const {ListBucketsCommand, S3Client, CopyObjectCommand, DeleteObjectCommand}= require("@aws-sdk/client-s3")

const s3 = new S3Client({});

const moveFiles = async (archiveDO) => {
  try {
    for (let srcKeyName of archiveDO.srcKeyNames) {
      let copyParams = {
        Bucket: archiveDO.destBucket,
        CopySource: `${archiveDO.srcBucket}/${srcKeyName}`,
        Key: `${archiveDO.destPath}/${srcKeyName.split("/").pop()}`,
        StorageClass: archiveDO.storageClass,
      };
      console.log(copyParams);
      const copyCommand = new CopyObjectCommand(copyParams)
      const copyResult = await s3.send(copyCommand);
      console.log("Copied:", copyResult);

      // Delete the source file after copying if moveFlag == true
      if (archiveDO.moveFlag) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: archiveDO.srcBucket,
          Key: srcKeyName,
        });

        const deleteResult = await s3.send(deleteCommand);

        console.log("Deleted:", deleteResult);
      }
    }

    console.log("Copy Success");
  } catch (error) {
    console.error("Error:", error);
  }
};

exports.moveFiles = moveFiles;
