import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { APIGatewayStack } from "./msorder-apigw-stack";
import { DynamoDbStack } from "./msorder-dynamodb-stack";
import { LambdaStack } from "./msorder-lambda-stack";
import { SNSSQSTopicStack } from "./msorder-sns-sqs-stack";
import { MsOrderStackProps } from "./types";

export class MsOrderRootStack extends Stack {
// PipelineStage would invoke the RootStack for 
// provisioning AWS resources using  DynamoDbStack, SNSSQSTopicStack, LambdaStack and ApiGateWayStack nested (child) stacks 
// in each stackEnv

/*   Why AWS CloudFormation nested stack? 
  in each AWS account there is limitation for creating resources per each CloudFormation stack */

/* RootStack: for make child stacke dependent to each other 
  RootStack will cretae it's infrastructure child (nested) stacks: DynamoDbStack, SNSSQSTopicStack, LambdaStack and ApiGateWayStack 
  one by one, then pass their output to next child stack (abstraction and easy understanding)

  SNSSQSTopicStack props and DynamoDbStack output (as a DynamoDB Table) => pass to => LambdaStack 
  => LambdaStack props => pass to => APIGatewayStack 
  
  Finally addDependency method should be invoked for the nested stack creation order */
  
  constructor(scope: Construct, id: string, props: MsOrderStackProps) {
    super(scope, id, props);
    // id =>  
    // MS-microservice-dev-stack
    // MS-microservice-qa-stack
    // MS-microservice-qaauto-stack
    // MS-microservice-uat-stack
    // MS-microservice-prod-stack
      
    const dynamoDbStack = new DynamoDbStack(this, "dynamodb-stack", props);
    const { orderTable } = dynamoDbStack;
    // AWS Integration & Messaging (Decoupling applications: SQS, SNS, Kinesis, Active MQ)
    const snsSqsStack = new SNSSQSTopicStack(this, "sns-sqs-stack", props);
    const {
      orderUpdateTopic,
      orderUpdateQueue,
      orderUpdateDeadLetterQ,
      
      orderProcessorTopic,
      orderCompleteProcessorQueue,
      streamProcessorDeadLetterQ,
      
      stepCompleteQueue, 
    } = snsSqsStack; 
    const lambdaStack = new LambdaStack(this, "lambda-stack", {
      // SNSSQSTopicStack props and DynamoDbStack output (as a DynamoDB Table) => pass to => LambdaStack
      ...props,
      codeBaseEnv: '', // Added for fix the error
      orderTable,

      orderUpdateTopic,
      orderUpdateQueue,
      orderUpdateDeadLetterQ,
      
      orderProcessorTopic,
      orderCompleteProcessorQueue,
      streamProcessorDeadLetterQ,
      
      stepCompleteQueue, 
    });
    const {
      streamProcessor,
      processStep,

      createOrder,
      updateOrder,
      completeOrder,
      cancelOrder,
      
      orderCompleteProcessor,
      processUpdateOrder,

      getOrder,
      getOrders,
      getSaleOrder,
      getPricing,
      
      createVoucherOrder,
      
      getVoucherOrder,
      getVoucherOrders,
      getVoucherOrderUpdatables,
    } = lambdaStack;                
    
    const apiGateWayStack = new APIGatewayStack(this, "apigw-stack", {
      ...props,
      codeBaseEnv: '', // Added for fix the error
      
      streamProcessor,
      processStep,
    
      createOrder,
      updateOrder,
      completeOrder,
      cancelOrder,
      
      orderCompleteProcessor,
      processUpdateOrder,
          
      getOrder,
      getOrders,
      getSaleOrder,
      getPricing,
      
      createVoucherOrder,
      
      getVoucherOrder,
      getVoucherOrders,
      getVoucherOrderUpdatables, 
    });

    snsSqsStack.addDependency(dynamoDbStack);
    lambdaStack.addDependency(snsSqsStack);
    apiGateWayStack.addDependency(lambdaStack);                                                                                           
  }                                                             
}
