custom:
  sbxAccountType: sandbox
  devAccountType: nonprod
  uatAccountType: nonprod
  qaAccountType: nonprod
  prfAccountType: nonprod
  sitAccountType: nonprod
  prdAccountType: prod
  drAccountType: prod
  config: ${file(./deploy-configs/${self:custom.${opt:stage}AccountType}/${opt:stage}/config.yml)}
  vpc-config: ${file(./deploy-configs/${self:custom.${opt:stage}AccountType}/${opt:stage}/vpc.yml)}
 

service: ${self:custom.config.serviceName}
provider:
  name: aws
  runtime: ${self:custom.config.runtime}
  stage: ${self:custom.config.environment}
  region: ${self:custom.config.region}
  stackName: ${self:custom.config.appName}-${self:custom.config.environment}-${self:custom.config.serviceName}-npm-serverless
  memorySize: ${self:custom.config.memorySize}
  timeout: ${self:custom.config.timeout}
  logRetentionInDays: ${self:custom.config.logRetention}
  deploymentPrefix: serverless
  versionFunctions: ${self:custom.config.versionFunctions}
  architecture: ${self:custom.config.architecture}
  #stack-tags to be created
  stackTags:
    AppID: ${self:custom.config.appId}
    AppName: ${self:custom.config.appName}
    CreatedByEmail: ${self:custom.config.createdByEmail}
    CostCenter: ${self:custom.config.costCenter}
    Environment: ${self:custom.config.environment}
  #function-tags to be created
  tags:
    AppID: ${self:custom.config.appId}
    AppName: ${self:custom.config.appName}
    CreatedByEmail: ${self:custom.config.createdByEmail}
    CostCenter: ${self:custom.config.costCenter}
    Environment: ${self:custom.config.environment}
  #S3 bucket  
  deploymentBucket: ${self:custom.config.deploymentBucketName}
  #VPC configurations
  vpc: ${file(./deploy-configs/${self:custom.${opt:stage}AccountType}/${opt:stage}/vpc.yml)}
  #service wide environment variables
  environment: ${file(./deploy-configs/${self:custom.${opt:stage}AccountType}/${opt:stage}/environment.yml)}
  #Lambda-layers
  layers: ${file(./deploy-configs/${self:custom.${opt:stage}AccountType}/${opt:stage}/layers.yml)}
  iam:
    role: ${self:custom.config.iamrole}
  iamRoleStatements:
    - Effect: "Allow"
      Action:
        - "kms:DescribeKey"
        - "kms:GenerateDataKey"
        - "kms:Decrypt"
        - "kms:Describe*"
      Resource: ${self:custom.config.kmsKeyArn}
  
plugins:
  - serverless-plugin-ifelse
  - serverless-domain-manager

custom:
  serverlessIfElse:
    - If: '"${self:custom.config.isHTTPRequired}" == "NO"'
      Exclude:
        - functions.${self:custom.config.functionName}.events.0.http
    - If: '"${self:custom.config.isALBRequired}" == "NO"'
      Exclude:
        - functions.${self:custom.config.functionName}.events.1.alb
  #customDomain:
  #  domainName: ${self:custom.config.domainName}
  #  basePath: ''
  #  stage: ${self:custom.config.environment}
  #  createRoute53Record: true
       
functions:
  Example:
    handler: ${self:custom.config.functionName}.handler
    #function name
    name: ${self:custom.config.functionName}
    #function description
    description: ${self:custom.config.description}
    #X-ray configuration
    tracing: ${self:custom.config.tracing}
    #KMS-key
    kmsKeyArn: ${self:custom.config.kmsKeyArn}  
    #Dead-letter-Queue
    onError: ${self:custom.config.DLQ}
    #Concurrency variables
    reservedConcurrency: ${self:custom.config.reservedConcurrency}
    provisionedConcurrency: ${self:custom.config.provisionedConcurrency}
    events:      
      - http:         
          path: ${self:custom.config.path}
          method: ${self:custom.config.method}      
      - alb:          
          listenerArn: ${self:custom.config.listenerArn}
          priority: ${self:custom.config.priority}
          conditions:
            #host: <host name>
            path: /${self:custom.config.path}
          healthCheck:       
            path: /health
            intervalSeconds: ${self:custom.config.intervalSeconds}
            timeoutSeconds: ${self:custom.config.timeoutSeconds}
            healthyThresholdCount: ${self:custom.config.healthyThresholdCount}
            unhealthyThresholdCount: ${self:custom.config.unhealthyThresholdCount}
            matcher:
              httpCode: ${self:custom.config.httpCode}

resources:
  Parameters:
    Secrets:
      Type: String
      Default: ${self:custom.config.SecretArn}
    RDSPresent:
      Type: String
      Default: ${self:custom.config.RDSPresent}
    VPCPresent:
      Type: String
      Default: ${self:custom.config.VPCPresent}
    XrayPresent:
      Type: String
      Default: ${self:custom.config.tracing}
    DLQPresent:
      Type: String
      Default: ${self:custom.config.DLQPresent}
    CustomIAMPresent:
      Type: String
      Default: ${self:custom.config.CustomIAMPresent}
  
  Conditions:
    Isrdspresent: !Equals 
      - !Ref RDSPresent
      - YES
    Isvpcpresent: !Equals 
      - !Ref VPCPresent
      - YES
    IsXraypresent: !Equals 
      - !Ref XrayPresent
      - Active
    IsDLQpresent: !Equals
      - !Ref DLQPresent
      - YES
    IsCustomIAMPresent: !Equals
      - !Ref CustomIAMPresent
      - YES
    
      
  Resources: 
  #DB-Proxy                            
    DBProxy:
      Type: AWS::RDS::DBProxy
      Condition: Isrdspresent
      DependsOn:
        - SecretsAccessPolicy
      Properties:
        Auth: 
          - {AuthScheme: SECRETS, SecretArn: !Ref Secrets, IAMAuth: REQUIRED}
        DBProxyName: ${self:custom.config.appName}-${self:custom.config.environment}-${self:custom.config.serviceName}-DB-proxy
        EngineFamily: ${self:custom.config.RDSEngineFamily}
        RoleArn: 
          'Fn::If':
            - IsCustomIAMPresent
            - ${self:custom.config.iamrole}
            - !GetAtt IamRoleLambdaExecution.Arn
        DebugLogging: ${self:custom.config.RDSDebugLogging}
        IdleClientTimeout: ${self:custom.config.RDSIdleClienttimeout}
        RequireTLS: ${self:custom.config.RDSRequireTLS}
        VpcSubnetIds: ${self:custom.vpc-config.subnetIds,subnet-0ee8f720cc62a1004} 
  #DB-Target-Group
    DBProxyTargetGroup:
      Type: AWS::RDS::DBProxyTargetGroup
      Condition: Isrdspresent
      Properties:
        DBProxyName: !Ref DBProxy
        TargetGroupName: default

#Default Role
    IamRoleLambdaExecution:
      Type: AWS::IAM::Role
      Properties:
        Path: /
        RoleName: ${self:custom.config.appName}-${self:custom.config.environment}-${self:custom.config.serviceName}-lambda-execution-role
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
#Policies
    #VPC
    VPCToLambdaPolicy:
      Type: AWS::IAM::Policy
      Condition: Isvpcpresent
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: "Allow"
              Action:
                - "logs:CreateLogGroup"
                - "logs:CreateLogStream"
                - "logs:PutLogEvents"
                - "ec2:CreateNetworkInterface"
                - "ec2:DescribeNetworkInterfaces"
                - "ec2:DeleteNetworkInterface"
                - "ec2:AssignPrivateIpAddresses"
                - "ec2:UnassignPrivateIpAddresses"
              Resource: "*"  
        PolicyName: VPCToLambdaPolicy
        Roles:
          - !Ref IamRoleLambdaExecution
    #RDS
    DBProxyToLambdaPolicy:
      Type: AWS::IAM::Policy
      DependsOn:
        - DBProxy
        - IamRoleLambdaExecution
      Condition: Isrdspresent
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: "Allow"
              Action:
                - "rds-db:connect"
              Resource: !GetAtt DBProxy.DBProxyArn 
        PolicyName: DBProxyToLambdaPolicy
        Roles:
          - !Ref IamRoleLambdaExecution
    #SecretsManager
    SecretsAccessPolicy:
      Type: AWS::IAM::Policy
      DependsOn:
        - IamRoleLambdaExecution
      Condition: Isrdspresent
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: "Allow"
              Action:
                - "secretsmanager:GetResourcePolicy"
                - "secretsmanager:GetSecretValue"
                - "secretsmanager:DescribeSecret"
                - "secretsmanager:ListSecretVersionIds"
              Resource: ${self:custom.config.SecretArn}
            - Effect: Allow
              Action:
                - "secretsmanager:ListSecrets"
              Resource: "*"
        PolicyName: SecretsAccessPolicy
        Roles:
          - !Ref IamRoleLambdaExecution
    
      
  Outputs:
    UnQualifiedFunctionARN:
      Description: ARN of function without version suffix
      Value:
        'Fn::GetAtt': [ExampleLambdaFunction, Arn]
      Export:
        Name: UnQualifiedFunctionARN

    ExampleLambdaFunctionQualifiedArn:
      Description: ARN of function with version suffix
      Export:
        Name: QualifiedFunctionARN

    FunctionName:
      Description: Name of function
      Value: !Ref ExampleLambdaFunction
      Export:
        Name: FunctionName

    RDSProxyEndpoint:
      Description: Endpoint for RDS proxy connection (only if using RDS Proxy)
      Condition: Isrdspresent
      Value: !Ref DBProxy
      Export:
        Name: RDSProxyEndpoint

    IAMRoleArn:
      Description: The ARN of the IAM role
      Value:
        'Fn::If':
          - IsCustomIAMPresent
          - ${self:custom.config.iamrole}
          - 'Fn::GetAtt': [IamRoleLambdaExecution, Arn]   
      Export:
        Name: RoleARN

    IAMRoleName:
      Description: Name of exectuion role
      Value: 
        'Fn::If':
          - IsCustomIAMPresent
          - ${self:custom.config.iamrole}
          - !Ref IamRoleLambdaExecution
      Export:
        Name: RoleName
