import {
  StackProps,
  StageProps,
  Duration,
  NestedStackProps,
  Environment,
} from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";

export interface MsOrderStackProps extends StackProps {
  stackEnv: string;
  stackEnvStage: string;
  logLevel?: string;
  pitr?: boolean;
  maxBatchingWindow?: Duration;
  voucherApiId?: string;
  registrationApiId?: string;
  customerApiId?: string;
  categoryApiId?: string;
}

export interface MsOrderPipelineStageProps extends StageProps {
  environments: Array<MsOrderStackProps>;
  name:string;
  stageName: string;
  tags?:{};
  approval?: boolean;
  logLevel?: string;
}

export interface MsOrderPipelineStackProps extends StackProps {
  vpcId: string;
  waves: Array<MsOrderPipelineStageProps>;
}

export interface BaseProps extends NestedStackProps {
  stackEnv: string;
  logLevel?: string;
  pitr?: boolean;
  maxBatchingWindow?: Duration;
  voucherApiId?: string;
  registrationApiId?: string;
  customerApiId?: string;
  categoryApiId?: string;
}

export interface LambdaStackProps extends BaseProps {
  codeBaseEnv: string;
  orderTable: dynamodb.Table;
  // AWS Integration & Messaging (Decoupling applications: SQS, SNS, Kinesis, Active MQ)
  orderUpdateTopic: sns.Topic;
  orderUpdateQueue: sqs.Queue;
  orderUpdateDeadLetterQ: sqs.Queue;
  
  orderProcessorTopic: sns.Topic;
  orderCompleteProcessorQueue: sqs.Queue;
  streamProcessorDeadLetterQ: sqs.Queue;
  
  stepCompleteQueue: sqs.Queue;  
}                                                    

export interface ApiGatewayStackProps  extends BaseProps {
  codeBaseEnv: string;
  /* streamProcessor Declares Lambda functions for handeling DynamoDB changes 
  and processing new records added to DynamoDB table
  event/trigger resource: DynamoDB but not a Lambda function */  
  streamProcessor: lambda.NodejsFunction;

  /* processStep will get data changes from DynamoDB table
   and publishes to SNS topics for subscribed services  */  
  processStep: lambda.NodejsFunction;

  // These Lambda functions will be sent to APIGatewayStack (msorder-apigw-stack.ts) for order entity 
  createOrder: lambda.NodejsFunction;
  updateOrder: lambda.NodejsFunction;
  completeOrder: lambda.NodejsFunction;
  cancelOrder: lambda.NodejsFunction;
  
  orderCompleteProcessor: lambda.NodejsFunction;
  processUpdateOrder: lambda.NodejsFunction; 
  
  getOrder: lambda.NodejsFunction;
  getOrders: lambda.NodejsFunction;
  getSaleOrder: lambda.NodejsFunction;
  getPricing: lambda.NodejsFunction;
  

  // These Lambda functions will be sent to APIGatewayStack (msorder-apigw-stack.ts) for voucher-order relationship entity
  createVoucherOrder: lambda.NodejsFunction;
  
  getVoucherOrder: lambda.NodejsFunction;
  getVoucherOrders: lambda.NodejsFunction;
  getVoucherOrderUpdatables: lambda.NodejsFunction; 
}

