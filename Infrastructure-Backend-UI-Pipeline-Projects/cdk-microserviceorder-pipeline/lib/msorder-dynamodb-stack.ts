import { NestedStack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BaseProps } from "./types";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import {
  DB_TABLE_ORDER,
  DB_TABLE_ORDER_INDEX_SALE_ORDERID,
  DB_TABLE_ORDER_INDEX_CUSTOMERID,
  DB_TABLE_ORDER_INDEX_CATEGORYID,
} from "./config";

export class DynamoDbStack extends NestedStack {
  // will create a DynamoDB table for each environmnts (stackEnv) defined in pipeline stages (stageName)'s waves
  // orderTableName = `${stackEnv}-${DB_TABLE_ORDER}`;

  // DynamoDB table has pointInTimeRecovery=true only for prod, DR and perf environments (config.ts), also timeToLiveAttribute for all envs
  // DynamoDB table has GlobalSecondaryIndex as indexes (config.ts): organize items on partitionKey (index) then sort by sortKey (salePeriod)
  
  orderTable: dynamodb.Table;
  constructor(scope: Construct, id: string, props: BaseProps) {
    super(scope, id, props);
    const { stackEnv, pitr } = props;
    const orderTableName = `${DB_TABLE_ORDER}-${stackEnv}`;

    this.orderTable = new dynamodb.Table(this, "table", {
      tableName: orderTableName,
      partitionKey: { 
        // Primary Key (PK)
        name: "orderId", 
        type: dynamodb.AttributeType.STRING 
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecovery: pitr,
      timeToLiveAttribute: "ttl",
    });

    this.orderTable.addGlobalSecondaryIndex({
      indexName: DB_TABLE_ORDER_INDEX_SALE_ORDERID,
      partitionKey: {
        name: "saleOrderId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "salePeriod",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.orderTable.addGlobalSecondaryIndex({
      indexName: DB_TABLE_ORDER_INDEX_CUSTOMERID,
      partitionKey: {
        name: "customerId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "salePeriod",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.orderTable.addGlobalSecondaryIndex({
      indexName: DB_TABLE_ORDER_INDEX_CATEGORYID,
      partitionKey: {
        name: "categoryId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "salePeriod",
        type: dynamodb.AttributeType.STRING,
      },
    });
  }
}