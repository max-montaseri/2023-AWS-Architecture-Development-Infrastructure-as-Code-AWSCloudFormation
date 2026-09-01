const MS_NAME='order' // MicroserviceName (Exp. order)
const ENV_PROD = { account: '??????????????' , region: 'us-east-1' };
const PROD_VPCID = 'vpc-0867d01986b??????'; //'vpc-prod' // alreday should be created in account
const PROD_SG = 'vpcLambda-sg-prod'; // created by cdk-infrastructure-pipeline
const APIGW_VPC_ENDPID_PROD = 'ApiVpcEndpoint-prod'
//'vpce-094888fe6??????';// created by cdk-infrastructure-pipeline
export const REFERENCE_API_URL_BASE_PROD = 'company-private-url-prod';
//?? will be used in LambdaStack: new lambda.NodejsFunction

const ENV_NONPROD = { account: '??????????????' , region: 'us-east-1' };
const NONPROD_VPCID = 'vpc-0c8fa22dbb??????'; //'vpc-prod' // alreday should be created in account
const NONPROD_SG = 'vpcLambda-sg-nonprod'; // created by cdk-infrastructure-pipeline
const APIGW_VPC_ENDPID_NONPROD = 'ApiVpcEndpoint-nonprod'
//'vpce-0141e1b53??????'; // created by cdk-infrastructure-pipeline
export const REFERENCE_API_URL_BASE_NON_PROD = 'company-private-url-nonprod';
//?? will be used in LambdaStack: new lambda.NodejsFunction

export const IDENTITY_PROXY_API_URL = 'bsidentity/rest/identitys'; 
// will be used in LambdaStack: new lambda.NodejsFunction
export const REFERENCE_API_KEY_BASE = `${MS_NAME}-microservice-reference`;
// will be used in LambdaStack for Secrate Manager (SM): secretApiKeyArn = sm.Secret.fromSecretNameV2 and secretsmanagerPolicy configurations
export const DEPENDENCY_TRACK_S3 =`${MS_NAME}-microservice-pipeline-bucket-for-CloudFormation`; 
// will be used in MsOrderPipelineStack: CodeBuildStep

export const PIPELINE_NAME = `${MS_NAME.toUpperCase}-Microservice-Pipeline`
export const BRANCH_NAME = 'master'; 
// will be used in MsOrderPipelineStack: CodeBuildStep
export const ASSET_NAME = `${MS_NAME}-microservice`; 
/* will be used in MsOrderPipelineStage: stage name (id) and MsOrderPipelineStack: CodeBuildStep.projectName 
and APIGatewayStack: lambdaApi = new LambdaRestApi(this, `${stackEnv}-${ASSET_NAME}` */

export const DB_TABLE_ORDER = `table-${MS_NAME.toLowerCase}`;
// will be used in DynamoDbStack

// DEPARTMENT=SALE => department=sale
export const DB_TABLE_ORDER_INDEX_SALE_ORDERID = 'saleOrderId-salePeriod-index';
export const DB_TABLE_ORDER_INDEX_CATEGORYID = 'categoryId-salePeriod-index';
export const DB_TABLE_ORDER_INDEX_CUSTOMERID = 'customerId-salePeriod-index';

export const KMS_ALIAS_NAME = 'alias/r-kms'; 
/* Defined in Infrastructure Stack => will be used in LambdaStack: find kms.Key and KmsKey.keyArn will be used in KmsKeyPolicy 
and in SNSSQSTopicStack: as masterkey for creating sns.Topic and encryptionMasterKey in creating sqs.Queue */

// Used in SQS: visibilityTimeout: Duration.seconds(LAMBDA_DEFAULT_TIMEOUT * 6),
export const LAMBDA_DEFAULT_TIMEOUT = 30; // seconds;
/* will be used in LambdaStack as lambdaProps for new lambda.NodejsFunction
and in SNSSQSTopicStack: new sqs.Queue for visibilityTimeout */
export const LAMBDA_ORDER_PROCESSOR = `${MS_NAME.toLowerCase}-processor`; 
/* will be used in LambdaStack as part of entry path name for new lambda.NodejsFunction 
 entry: `src/${LAMBDA_ORDER_PROCESSOR}/create-order.js`,
=> cdk-microserviceorder-pipeline/src/order-processor/ => Javascript files */

export const SERVICE_REGISTRY_SECRET_KEY = `service-registry/${MS_NAME.toLowerCase}-microservice`;
/* will be used in LambdaStack as serviceRegistryProps in new lambda.NodejsFunction to detect the Lambda resgidters to which environment Emp. codeBaseEnv: 'devops-dev',
Also creating an IAM resource access permission in IAM policy: new iam.PolicyStatement 
 => resources: `arn:aws:secretsmanager:${region}:${account}:secret:${SERVICE_REGISTRY_SECRET_KEY}-*`
                actions: ["secretsmanager:GetSecretValue"]
 */
 

export const PAYMENT_URL = ''; // Private payment URL
/* will be used in LambdaStack: this.createOrder = new lambda.NodejsFunction(this, "createorder", { 
create-order.js => import { createOrder, getPaymentUrl } from '../services/order' */

export const getTags = (env: string) => ({
  asset_id: ASSET_NAME, 
  system_id: `${MS_NAME}`,
  accessibility: 'private',
  data_classification: 'proprietary',
  env_intent: env,
  engineer: 'backend@company.org',
});

export const getEnvironmentConfig = (env: string, codeBaseEnv: string) =>
/* LambdaStack and ApiGateWayStack will invoke getEnvironmentConfig(stackEnv, codeBaseEnv) => Exp. codeBaseEnv:'devops-dev'
      LambdaStack: for initialling identityProxyApiUrl and other infrustructure properties for prod/nonprod 
      APIGatewayStack: for creating LambdaRestApi and it's iam.PolicyDocument  */
env === 'prod'
    ? {
        apigw_vpcEndpoint: APIGW_VPC_ENDPID_PROD,
        vpcId: PROD_VPCID,
        sgName: PROD_SG,
        referenceApiBaseUrl: REFERENCE_API_URL_BASE_PROD,
        vpcEndpoint: `${APIGW_VPC_ENDPID_PROD}-r5v9nlms.execute-api.us-east-1.vpce.amazonaws.com`,
        // or 'https://vpce-094888fe6??????-r5v9nlms.execute-api.us-east-1.vpce.amazonaws.com',
        identityProxyApiUrl: IDENTITY_PROXY_API_URL,
        identityProxyEnv: 'prod',
      }
    : {
        apigw_vpcEndpoint: APIGW_VPC_ENDPID_NONPROD,
        vpcId: NONPROD_VPCID,
        sgName: NONPROD_SG,
        referenceApiBaseUrl: REFERENCE_API_URL_BASE_NON_PROD,
        vpcEndpoint: `${APIGW_VPC_ENDPID_NONPROD}-5habbhss.execute-api.us-east-1.vpce.amazonaws.com`,
        // or 'https://vpce-0141e1b53??????-5habbhss.execute-api.us-east-1.vpce.amazonaws.com',
        identityProxyApiUrl: `${codeBaseEnv}/${IDENTITY_PROXY_API_URL}`,
        identityProxyEnv: 'preprod', // preprod <=> Dev, Systest, QA, UAT, ...
      };

/*  *Type: MsOrderPipelineStackProps { 
   vpcId, 
   waves: 
     [
       *Type: MsOrderPipelineStageProps 
       environments: 
         [
              *other props from StackProps
           env:,
           tags:,    
           codeBaseEnv:,
           description:'',

           *Type: MsOrderStackProps
           stackEnv: string;
           stackEnvStage: string;
           logLevel?: string;
           pitr?: boolean;
           maxBatchingWindow?: Duration;
           voucherApiId: string;
           registrationApiId: string;
           customerApiId: string;
           categoryApiId: string;               
         ]
       
       name:string;
       stageName: string;
       tags: string,
       approval?: boolean;
       logLevel?: string; 
       *other props
       env: string;???
     ] 
} */


export const PIPELINE_CONFIG = {
  env: ENV_NONPROD,
  tags: getTags('nonprod'),
  vpcId: NONPROD_VPCID,
  waves: [
    {
      env: ENV_NONPROD,
      name: 'dev-stage',
      stageName: 'dev-stage',
      tags: getTags('dev'),
      approval: false,// doesn't need to be approved for dev environment in Pipeline 
      logLevel: 'debug',
      environments: [
      // * types => MsOrderPipelineStageProps
        {
          // *other props from StackProps
          env : ENV_NONPROD,
          tags: getTags('dev'),    
          codeBaseEnv: 'devops-dev',
          description : 'This is dev stage/env for developer testing', 

          // types => MsOrderStackProps
          stackEnv: 'dev',
          stackEnvStage: 'dev-stage',
          // logLevel?: string,
          // pitr?: boolean;
          // maxBatchingWindow?: Duration,
          
          // in none-prod environments => these ApiId are comming from GraphQL or we determined them randomly??
          voucherApiId: '1zm4g6uwawb',
          registrationApiId:'??????',
          customerApiId: '99a6zjede1',
          categoryApiId: 'o9t5skuigh',
          
        },
      ]
    },
    {
      env: ENV_NONPROD,
      name: 'qa-stage',
      stageName: 'qa-stage',
      tags: getTags('qa'),
      approval: true,
      logLevel: 'debug',
      environments: [
        {
          // *other props from StackProps
          env : ENV_NONPROD,
          tags: getTags('qa'),    
          codeBaseEnv: 'devops-qa',
          description : 'This is qa stage/env for deveoper testing', 

          stackEnv: 'qa',
          stackEnvStage: 'qa-stage',
          // logLevel?: string,
          // pitr?: boolean;
          // maxBatchingWindow?: Duration,

          // in none-prod environments => these ApiId are comming from GraphQL or we determined them randomly??      
          voucherApiId: '2zm4g6uwawb',
          registrationApiId: '??????',
          customerApiId: '99a6zjede1',
          categoryApiId: 'o9t5skuigh',
        },
      ]        
    },
    {
      env: ENV_NONPROD,
      // preprod stage contains two environment: qaauto and uat
      name: 'uat-stage',
      stageName: 'uat-stage', // or 'preprod-stage'
      tags: getTags('uat'), // or getTags('preprod'),
      approval: true, // needs to be approved in Pipeline for qa environment
      logLevel: 'debug',
      environments: [
        {          
          // *other props from StackProps
          env : ENV_NONPROD,
          tags: getTags('uat'),    
          codeBaseEnv: 'devops-uat',
          description : 'This is uat stage/env for test team and regression testing', 

          stackEnv: 'uat',
          stackEnvStage: 'uat-stage', // or 'preprod-stage'
          // logLevel?: string,
          // pitr?: boolean;
          // maxBatchingWindow?: Duration,

          // in none-prod environments => these ApiId are comming from GraphQL or we determined them randomly??          
          voucherApiId: '3bzebj??????',
          registrationApiId: 'g78fpv9i0f',
          customerApiId: '6cayezdyk3',
          categoryApiId: '797h5gjqzb',       
        },  
      ]       
    },
    {
      env: ENV_NONPROD,
      name: 'perf-stage',
      stageName: 'perf-stage',
      tags: getTags('perf'),
      approval: true,
      logLevel: 'info',
      environments: [
        {      
          // *other props from StackProps
          env : ENV_NONPROD,
          tags: getTags('perf'),    
          codeBaseEnv: 'devops-perf',
          description : 'This is performance stage/env for Web Site Reliability team testing', 

          stackEnv: 'perf',
          stackEnvStage: 'perf-stage',
          // logLevel?: string,
          pitr: true,
          // maxBatchingWindow?: Duration,

          // in none-prod environments => these ApiId are comming from GraphQL or we determined them randomly??          
          voucherApiId: '4bzebj??????',
          registrationApiId: '012345689',
          customerApiId: '012345689',
          categoryApiId: '012345689',
        },
      ]        
    },
    {
      env: ENV_NONPROD, // Disaster Recovery
      name: 'dr-stage',
      stageName: 'dr-stage',
      tags: getTags('dr'), 
      approval: true,      
      logLevel: 'info',   
      environments: [
        {       
          // *other props from StackProps
          env : ENV_NONPROD,
          tags: getTags('dr'),    
          codeBaseEnv: 'devops-dr',
          description : 'This is dr stage/env for disaster recovery backup', 

          stackEnv: 'dr',  
          stackEnvStage: 'dr-stage',        
          pitr: true,  

          // in none-prod environments => these ApiId are comming from GraphQL or we determined them randomly??          
          voucherApiId: '5bzebj??????',
          registrationApiId: '012345689',
          customerApiId: '012345689',
          categoryApiId: '012345689',
        }
      ]        
    },
    {
      env: ENV_PROD, // Production
      name: 'prod-stage',
      stageName: 'prod-stage',
      tags: getTags('prod'), 
      approval: true,      
      logLevel: 'info',   
      environments: [
        {       
          // *other props from StackProps
          env : ENV_PROD,
          tags: getTags('prod'),    
          codeBaseEnv: 'devops-prod',
          description : 'This is prod stage/env for end user', 

          stackEnv: 'prod',  
          stackEnvStage: 'prod-stage',        
          pitr: true,  
          
          // in prod environment => we don't have any piId??!!
        }
      ]        
    },
  ],
};

export const PROD_PIPELINE_CONFIG = {
  env: ENV_PROD,
  tags: getTags('prod'),
  vpcId: PROD_VPCID,
  waves: [
     {
      env: ENV_PROD, // Production
      name: 'prod-stage',
      stageName: 'prod-stage',
      tags: getTags('prod'), 
      approval: true,      
      logLevel: 'info',   
      environments: [
        {       
          // *other props from StackProps
          env : ENV_PROD,
          tags: getTags('prod'),    
          codeBaseEnv: 'devops-prod',
          description : 'This is prod stage/env for end user', 

          stackEnv: 'prod',  
          stackEnvStage: 'prod-stage',        
          pitr: true,  
        }
      ]        
    }
  ]
};

