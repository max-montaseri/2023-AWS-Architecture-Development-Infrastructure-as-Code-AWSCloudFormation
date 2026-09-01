#!/usr/bin/env node
// import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
// import { CdkMicroserviceOrderStack } from '../lib/cdk-microservice-order-stack';
import { MsOrderPipelineStack } from '../lib/msorder-pipeline-stack';
import { PROD_PIPELINE_CONFIG, PIPELINE_CONFIG, PIPELINE_NAME, getTags } from '../lib/config';
import { MsOrderRootStack } from '../lib/msorder-root-stack';

const app = new cdk.App();

// Non-Production and Production Pileline Stack
  // for all defined pipeline stages (stageName) and their environmnts (stackEnv) in waves 
  // each PipelineStage would create the RootStack DynamoDbStack, SNSSQSTopicStack, LambdaStack and apiGateWayStack
  // in each stackEnv
new MsOrderPipelineStack(app, PIPELINE_NAME, PIPELINE_CONFIG);

// Production Pileline Stack
  // for all defined pipeline stages (stageName) and their environmnts (stackEnv) in waves 
  // each PipelineStage would create the RootStack DynamoDbStack, SNSSQSTopicStack, LambdaStack and apiGateWayStack
new MsOrderPipelineStack(app, PIPELINE_NAME, PROD_PIPELINE_CONFIG);


// Local test for provisioning infrustructure child stacks: snsSqsStack, lambdaStack and apiGateWayStack
const STACK_LOCAL_TEST_CONFIG = {   
// => For RootStack (MsOrderStackProps) local testing 
// will cretae it's infrustructure child stacks: snsSqsStack, lambdaStack and apiGateWayStack
    // *other props
    env : { account: '??????????????' , region: 'us-east-1' },
    tags: getTags('localtest'),    
    codeBaseEnv: 'localtest',
    description : 'This is only deploy root stack (MsOrderStackProps) and its child-stack regarding their dependencies', 
    
// *Type: MsOrderStackProps   
    stackEnv: 'localtest',
    stackEnvStage: 'localtest-stage',
    logLevel: 'debug',
    // pitr?: boolean,
    // maxBatchingWindow?: Duration;
    voucherApiId: '1zm4g???????',
    registrationApiId:'??????',
    customerApiId: '99a6???????',
    categoryApiId: 'o9t5???????',
    
    // *Type: MsOrderPipelineStageProps
    // environments: Array<MsOrderStackProps>; => we have only one env (stackEnv) for local test stack
    approval: false,// doesn't need to be approveed in Pipeline for dev environment in Pipeline 
    stageName: 'localtest-stage',
    // logLevel?: string;
}


new MsOrderRootStack(app, 'msorder-local-test', STACK_LOCAL_TEST_CONFIG);

// new CdkMicroserviceOrderStack(app, 'CdkMicroserviceOrderStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '??????????????' , region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });

