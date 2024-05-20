const { mailConst } = require('../../constants/constant');

const region = process.env.AWS_REGION;

const SSMClient = require("@aws-sdk/client-ssm");

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambdaClient = new LambdaClient({});

const ssm = new SSMClient.SSM();

const mailJobStatus = async (error, mailReqDO) => {

  console.log("In mailJobStatus method.");
  console.log('Params:', mailReqDO);

  let errorMsg = '';
  if (error) {
    // Add to email body
    errorMsg += mailConst.ERROR_MSG.replace("<errorMsg>", `<p><b>Error Message:</b> ${error.message}<br><b>Error Stack Trace:</b> ${error.stack}</p>`);
  }
  const moduleId = mailReqDO.moduleId ? "/" + mailReqDO.moduleId : '';
  const paramPrefix = "/" + mailReqDO.appId + "/" + process.env.environment + "/" + mailReqDO.appName + moduleId + "/";

  const data = await ssm
    .getParameters({
      Names: [
        paramPrefix + mailReqDO.namcName + "/to.email.address",
        paramPrefix + "from.email.address",
      ],
    });

  const toEmailAddresses = data.Parameters[0].Value.split(",");
  const fromEmailAddress = data.Parameters[1].Value;

  const mailDO = {
    subject: mailConst.SUBJECT.replace("<Status>", mailReqDO.status)
      .replace("<NAMCName>", mailReqDO.namcName)
      .replace("<job_code>", mailReqDO.jobCode),
    message: mailConst.BODY.replace("<Status>", mailReqDO.status)
      .replace("<NAMCName>", mailReqDO.namcName)
      .replace("<error>", errorMsg)
      .replace("<job_code>", mailReqDO.jobCode),
    to: toEmailAddresses,
    from: fromEmailAddress,
    altMessage: null,
    attachments: false,
  };

  await sendEmail(mailDO);

};

const sendEmail = async (mailDO) => {

  try {
    let emailResponse;

    const payloadForApiGatewayEvent = {
      httpMethod: "POST",
      body: JSON.stringify(mailDO),
    };

    const params = {
      FunctionName: `ccs-${process.env.environment}-send-email`,
      InvocationType: `RequestResponse`,
      Payload: `${JSON.stringify(payloadForApiGatewayEvent)}`,
    };
    console.log(`PAYLOAD : ${JSON.stringify(payloadForApiGatewayEvent)}`);

    const command = new InvokeCommand(params);

    const response = await lambdaClient.send(command);

    if (response.StatusCode === 200) {
      emailResponse = `Email Sent successfully`;
    } else {
      emailResponse = `Failed to send email!`;
    }
    console.log(emailResponse);
  } catch (err) {
    console.log(`Error sending email : ${err}`);
  }
};

exports.sendEmail = sendEmail;
exports.mailJobStatus = mailJobStatus;
