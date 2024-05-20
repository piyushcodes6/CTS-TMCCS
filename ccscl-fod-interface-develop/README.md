# AWS Serverless Lambda 
AWS Lambda is a serverless, event-driven compute service that lets you run code for virtually any type of application or backend service without provisioning or managing servers.

## Support/Features

This blueprint supports deploying AWS Lambda functions through the Serverless Framework using the Node.js runtime and TypeScript language. The Lambda functions will be deployed in a target account with Infrastructure as Code (IaC) based on requirements and inputs by teams and aligned to TMNA standards, policies, and AWS best practices.

* This blueprint will only create 1 Lambda function in order to keep inputs manageable. If teams need to add additional functions, they can modify the serverless.yml and config.yaml.

* The IAM execution role created will be given least privilege access. If teams need to add additional permissions, they can provide an existing IAM role ARN to use instead (or modify the serverless.yml after the Serverless project is created).

* This blueprint will only configure variables for 1 environment. If variables need to be configured for additional environments, they can be added to the respective config.yml file in the deploy-configs directory.


## Prerequisites

Required:
* `Deployment Bucket` - S3 bucket that will contain the deployed artifacts
* `KMS Key` - KMS key used for encryption (default KMS key can be used in lower envs, customer-managed KMS key should be used in prod)

Conditionally Required:
* If the Lambda will run inside a VPC:
  * `VPC` - VPC the Lambda will run in
  * `Subnets` - subnets within the VPC the Lambda will use
  * `Security Groups` - security groups within the VPC the Lambda will use
* If the Lambda will have a DLQ:
  * `DLQ` - SQS queue or SNS topic that will serve as the dead letter queue for the Lambda
* If the Lambda will connect to an RDS Database:
  * `RDS Database` - RDS Database (MySQL or PostgreSQL) the Lambda will connect to
  * `DB Credentials Secret` - secret in Secrets Manager that holds the database username and password Lambda will use for authentication
* If the ALB is enabled:
  * `Application load balancer` - needs to be created and the listener arn needs to be passed from config file
  * Refer doc: https://www.serverless.com/framework/docs/providers/aws/events/alb
* If `Custom domain` is enabled:
  * Refer doc: https://www.serverless.com/blog/serverless-api-gateway-domain/
  * If you need to remove the domain, simply run: `serverless delete_domain`

## Installing the Serverless Framework (local)

Open up a terminal and type `npm install -g serverless` to install Serverless.

Once the installation process is done you can verify that Serverless is installed successfully by running the following command in your terminal:

`serverless --version`

## Install the packages from package.json by running:

`npm install`

## Example Config 

Example config.yml file is present at ./example/ folder.


## Required Inputs

| NAME                           | TYPE            | DEFAULT         | COMMENTS                                             |
|--------------------------------|-----------------|-----------------|------------------------------------------------------|
| Application ID                 | string          |                 | As per CMDB                                          |
| Application Name               | string          |                 | As per CMDB                                          |
| Created By Email               | string          |                 |                                                      |
| Account Type                   | string          |                 | Allowed values: "sandbox", "nonprod", "prod"         |
| Account ID                     | string          |                 |                                                      |
| Cost Center                    | string          |                 |                                                      |
| Region                         | string          |                 |                                                      |
| Environment                    | string          |                 | Allowed values: see [Environment Abbreviations](https://confluence.sdlc.toyota.com/pages/viewpage.action?spaceKey=TCPT&title=Approved+environments)      |
| Runtime                        | string          |                 | Allowed vaules: "nodejs14.x", "nodejs12.x"           |
| KMS Key ARN                    | string          |                 |                                                      |
| Deployment Bucket Name         | string          |                 |                                                      |
| Service  Name                  | string          |                 |                                                      |
| Function Name                  | string          |                 |                                                      |

## Optional Inputs

### Lambda Function optional inputs
```
#config.yml

frameworkVersion: default
description: Default function description
architecture: arm64
memorySize: 1024
timeout: 6
logRetention: 30
versionFunctions: true
tracing: Active
```


### VPC input Configuration
```
#config.yml

VPCPresent: YES


#vpc.yml

securityGroupIds: 
   - sg-0594819b7ea1c4126
subnetIds: 
   - subnet-040f3cdca0cc9889c
   - subnet-0ba9478cdd396e352
```

### RDS input Configuration
```
#config.yml

VPCPresent: YES
RDSPresent: YES
SecretArn: arn:aws:secretsmanager:us-west-2:715662994982:secret:gauravtestdbsecret-iyXOeT
RDSDebugLogging: false
RDSEngineFamily: MYSQL #Valid values: MYSQL | POSTGRESQL
RDSIdleClienttimeout: 120
IAMAuth: REQUIRED #Valid Values: DISABLED | REQUIRED
RDSRequireTLS: true


#vpc.yml

securityGroupIds: 
   - sg-0594819b7ea1c4126
subnetIds: 
   - subnet-040f3cdca0cc9889c
   - subnet-0ba9478cdd396e352
```

### Dead-Letter-Queue input Configuration
```
#config.yml

DLQ: arn:aws:sqs:us-west-2:715662994982:MytestQueue
DLQPresent: YES
```

### Lambda-Layers input Configuration
```
#layers.yml

- arn:aws:lambda:us-west-2:715662994982:function:Helloworldzip:1
```

### Environment Variables input Configuration
```
#env.yml

test1: test1
test2: test2
test3: test3
test4: test4
test5: test5
```

### Custom IAM Role input Configuration
```
#config.yml

iamrole: arn:aws:iam::715662994982:role/LambdaAdminAcessTest
CustomIAMPresent: YES
```



## Outputs

| NAME                           | DESCRIPTION                                                                              |
|--------------------------------|------------------------------------------------------------------------------------------|
| Qualified Function ARN         | ARN of function with version suffix                                                      |
| Unqualified Function ARN       | ARN of function without version suffix                                                   |
| Function Name                  | Name of function                                                                         |
| Role ARN                       | ARN of execution role                                                                    |
| Role Name                      | Name of exectuion role                                                                   |
| RDS Proxy Endpoint             | Endpoint for RDS proxy connection (only if using RDS Proxy)                              |


