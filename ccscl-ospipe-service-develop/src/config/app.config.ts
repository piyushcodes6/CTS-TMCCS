export const AppConfig = {
    region: process.env.AWS_REGION,
    environment: process.env.ENVIRONMENT,
    ssm_prefix_name: process.env.SSM_PREFIX_NAME,
    secret_name: process.env.DB_SECRET_NAME,
    rds_resource_arn: process.env.DB_RESOURCE_ARN
};