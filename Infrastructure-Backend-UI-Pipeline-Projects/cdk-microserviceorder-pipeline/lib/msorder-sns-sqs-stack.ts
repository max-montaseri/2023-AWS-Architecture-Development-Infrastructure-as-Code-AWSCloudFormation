import { Duration, NestedStack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { BaseProps } from './types'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { KMS_ALIAS_NAME, LAMBDA_DEFAULT_TIMEOUT } from './config'

export class SNSSQSTopicStack extends NestedStack {
  // AWS Integration & Messaging (Decoupling applications: SQS, SNS, Kinesis, Active MQ)
  // SNSSQSTopicStack will send these SNS topica, SQS queues and CfnSubscription (CloudFormation Subscription) to LambdaStack
  orderUpdateTopic: sns.Topic
  orderUpdateQueue: sqs.Queue
  orderUpdateDeadLetterQ: sqs.Queue
  
  orderProcessorTopic: sns.Topic
  orderCompleteProcessorQueue: sqs.Queue
  streamProcessorDeadLetterQ: sqs.Queue
  
  stepCompleteQueue: sqs.Queue
  orderUpdateSubscription: sns.CfnSubscription

  constructor(scope: Construct, id: string, props: BaseProps) {
    super(scope, id, props)
    const { stackEnv } = props
    const orderKmsKey = kms.Key.fromLookup(this, 'orderKMS', { aliasName: KMS_ALIAS_NAME })
  
    // #region orderProcessorTopic has 2 SqsSubscription: orderCompleteProcessorQueue and stepCompleteQueue
      /* 1-orderCompleteProcessorQueue
          -orderCompleteProcessorQueue has filters: ORDER_COMPLETE and NOT_STARTED
          -orderCompleteProcessorQueue has orderCompleteProcessorDeadLetterQ
        
        2-stepCompleteQueue
          -stepCompleteQueue has filters: COMPLETED
          -stepCompleteQueue has stepCompleteDeadLetterQ
      */
    this.orderProcessorTopic = new sns.Topic(this, 'sns', {
      displayName: `Order Processor Topic - ${stackEnv}`,
      topicName: `${stackEnv}-process-orders`,
      masterKey: orderKmsKey,
    })

    // A dead-letter queue (DLQ) is a special type of message queue that temporarily stores messages that a software system cannot process due to errors.
    const orderCompleteProcessorDeadLetterQ = new sqs.Queue(this, `orderCompleteProcessorDeadLetterQ`, {
      // orderCompleteProcessorDeadLetterQ is used as deadLetterQueue in orderCompleteProcessorQueue
      queueName: `${stackEnv}-process-complete-order-deadletterq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
    })

    this.orderCompleteProcessorQueue = new sqs.Queue(this, 'orderCompleteProcessorQueue', {
      queueName: `${stackEnv}-process-complete-order`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
      deadLetterQueue: {
        // orderCompleteProcessorDeadLetterQ is used as deadLetterQueue in orderCompleteProcessorQueue
        queue: orderCompleteProcessorDeadLetterQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(LAMBDA_DEFAULT_TIMEOUT * 6),
    })

    this.orderProcessorTopic.addSubscription(
      new subscriptions.SqsSubscription(this.orderCompleteProcessorQueue, {
      /*  orderProcessorTopic has a SqsSubscription: orderCompleteProcessorQueue 
        with filters: ORDER_COMPLETE and NOT_STARTED
        If a subscription doesn’t have a filter policy, it receives every message */
        filterPolicyWithMessageBody: {
          currentStep: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ['ORDER_COMPLETE'],
            })
          ),
          stepStatus: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ['NOT_STARTED'],
            })
          ),
        },
        rawMessageDelivery: true,
      })
    )

    // A dead-letter queue (DLQ) is a special type of message queue that temporarily stores messages that a software system cannot process due to errors.
    const stepCompleteDeadLetterQ = new sqs.Queue(this, `stepCompleteDeadLetterQ`, {
      // stepCompleteDeadLetterQ is used as deadLetterQueue in stepCompleteQueue
      queueName: `${stackEnv}-complete-step-order-deadletterq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
    })

    this.stepCompleteQueue = new sqs.Queue(this, 'stepCompleteQueue', {
      queueName: `${stackEnv}-complete-step-order`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
      deadLetterQueue: {
        // stepCompleteDeadLetterQ is used as deadLetterQueue in stepCompleteQueue
        queue: stepCompleteDeadLetterQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(LAMBDA_DEFAULT_TIMEOUT * 6),
    })

    this.orderProcessorTopic.addSubscription(
    /*  orderProcessorTopic has a SqsSubscription: stepCompleteQueue 
        with filters: COMPLETED
        If a subscription doesn’t have a filter policy, it receives every message */
      new subscriptions.SqsSubscription(this.stepCompleteQueue, {
        filterPolicyWithMessageBody: {
          stepStatus: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ['COMPLETED'],
            })
          ),
        },
        rawMessageDelivery: true,
      })
    )    
    // #endregion orderProcessorTopic

    // #region orderUpdateTopic and orderUpdateSubscription
    this.orderUpdateTopic = new sns.Topic(this, 'sns-order-update-topic', {
      displayName: `Order Update Topic - ${stackEnv}`,
      topicName: `${stackEnv}-update-orders`,
      masterKey: orderKmsKey,
    })

    this.orderUpdateDeadLetterQ = new sqs.Queue(this, `orderUpdateDeadLetterQ`, {
      queueName: `${stackEnv}-process-update-order-deadletterq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
    })

    this.orderUpdateQueue = new sqs.Queue(this, 'orderUpdateQueue', {
      queueName: `${stackEnv}-process-update-order`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
      deadLetterQueue: {
        queue: this.orderUpdateDeadLetterQ,
        maxReceiveCount: 3,
      },
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(LAMBDA_DEFAULT_TIMEOUT * 6),
    })

    this.orderUpdateQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: [this.orderUpdateQueue.queueArn],
        principals: [new iam.ServicePrincipal('sns.amazonaws.com')],
        conditions: {
          ArnEquals: { 'aws:SourceArn': this.orderUpdateTopic.topicArn },
        },
      })
    )

    this.orderUpdateSubscription = new sns.CfnSubscription(this, 'updateOrderSubscription', {
      protocol: 'sqs',
      topicArn: this.orderUpdateTopic.topicArn,
      endpoint: this.orderUpdateQueue.queueArn,
      filterPolicy: { current: { status: ['PROCESSING'] } },
      filterPolicyScope: 'MessageBody',
      rawMessageDelivery: true,
    })
    // #endregion
    
    // #region streamProcessor
    this.streamProcessorDeadLetterQ = new sqs.Queue(this, 'stream-processor-dlq', {
      queueName: `${stackEnv}-process-streamsorder-deadletterq`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: orderKmsKey,
    })
    // #endregion
  
  }
}
