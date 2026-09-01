import { Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { REFERENCE_CDN_PREFIX, ZSCALER_IPSET_1, ZSCALER_IPSET_2 } from './config'
import { InfrastructureStackProps } from './types'
import {
  InterfaceVpcEndpoint,
  Vpc,
  Subnet,
  SecurityGroup,
  Peer,
  Port,
  GatewayVpcEndpoint,
  IVpc,
} from 'aws-cdk-lib/aws-ec2'
import { AccountRootPrincipal, PolicyDocument, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Key } from 'aws-cdk-lib/aws-kms'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { EndpointType } from 'aws-cdk-lib/aws-apigateway'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'

export class InfrastructureStack extends Stack {
  props: InfrastructureStackProps
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props)

    this.props = props
    const { stackEnv, vpcId } = props
    // If your VPC is created outside your CDK app, you can use Vpc.fromLookup(). 
    // The CDK CLI will search for the specified VPC in the the stack’s region and account, 
    // and import the subnet configuration. Looking up can be done by VPC ID, 
    // but more flexibly by searching for a specific tag on the VPC.
    // const vpc = Vpc.fromLookup(this, 'vpc', {isDefault: true }) // => This imports the default VPC
    
    const vpc = Vpc.fromLookup(this, 'vpc',  { vpcId: vpcId.toString() })

    this.createGatewayVPCEndpoint(vpc)

    this.createDynamoDbVPCEndpoint(vpc)

    this.createSecurityGroup(vpc, `vpcLambda-sg-${stackEnv}`) // security group (only allowAllOutbound rule) for triggering VPC lambda functions

    this.createKMSKey()

    this.createAPIGatewayCustomDomain(REFERENCE_CDN_PREFIX)

    // Create Database Migration Service (DMS) Role
    // TODO: Once migration is complete, should be removed

    // add a new DMS (dms.amazonaws.com) service role (dms-cloudwatch-logs-role) to IAM
    //  for sending database migration (only once) logs to CloudWatch 


    // o	IAM role (dms-cloudwatch-logs-role) assumed by database migration service (DMS)|dms.amazonaws.com 
    // with sending database migration logs to CloudWatch (only once) 
    // as IAM service role policy: service-role/AmazonDMSCloudWatchLogsRole
    
    const dmsCloudwatchLogRole = new iam.Role(this, 'dms-cloudwatch-logs-role', {
      assumedBy: new iam.ServicePrincipal('dms.amazonaws.com'),
      roleName: 'dms-cloudwatch-logs-role',
    })
    dmsCloudwatchLogRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonDMSCloudWatchLogsRole')
    )
  }

  // Methods //
  createSecurityGroup(vpc: IVpc, name: string, description?: string) {
    // Security Group be used in Interface VPC Endpoint for API Gateway regarding stackEnv (prod, nonprod)
   //  Will be used by Lambda
  return new SecurityGroup(this, `${name}`, {
    vpc,
    description,
    allowAllOutbound: true,
    securityGroupName: name,
    })
  }

  createGatewayVPCEndpoint(vpc: IVpc) {
    // https://repost.aws/knowledge-center/vpc-fix-gateway-or-interface-endpoint
    // Gateway VPC endpoints
    // Gateway VPC endpoints allow you to connect to Amazon Simple Storage Service (Amazon S3) and Amazon DynamoDB privately from your VPC.

    // When using gateway endpoints, there are four factors that affect connectivity to the respective services:

    // The endpoint policy,
    // The VPC subnet network access control list (ACL),
    // The source subnet route table,
    // The Source Amazon Elastic Compute Cloud (Amazon EC2) or AWS Lambda security groups

    // Interface VPC Endpoint for HTTPS (port 443) access | API Gateway??? regarding stackEnv (prod, nonprod)
    // => with a security group named base on stackEnv and add Ingress Rule 
    // for HTTPS access: Port.tcp(443) 
    // for nonprod environments adds Ingress Rule 
    // for HTTPS access: Port.tcp(443) from ZSCALER_IPSET_1 and ZSCALER_IPSET_2 declared in config.ts
    // and attached it to all environment's subnets and Availability Zones (AZ)
    const { subnets, stackEnv } = this.props
    const sg = this.createSecurityGroup(vpc, `vpcEndpoint-sg-${stackEnv}`)
    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(443))
    if(stackEnv === 'nonprod') {
      sg.addIngressRule(Peer.ipv4(ZSCALER_IPSET_1), Port.tcp(443))
      sg.addIngressRule(Peer.ipv4(ZSCALER_IPSET_2), Port.tcp(443))
    }

    new InterfaceVpcEndpoint(this, 'ApiVpcEndpoint-prod', {
      vpc,
      service: {
        // create an interface VPC endpoint for the API Gateway component service for API execution, 
        // known as execute-api, in your VPC

        // InterfaceVpcEndpoint as private DNS for API executing (for non-prod|prod VPC; 
        // add a non-prod|prod security group with port 443/HTTPS ingress rule and allowAllOutbound rule for VPC itself and its subnets|AZs)

        name: 'com.amazonaws.us-east-1.execute-api', // change to be dynamic??
        port: 443,
      },
      subnets: {
        subnets: subnets.map((s) =>
          Subnet.fromSubnetAttributes(this, `${s.zone.split('-').pop()?.toUpperCase()}Subnet`, {
            availabilityZone: s.zone,
            subnetId: s.subnet,
          })
        ),
      },
      privateDnsEnabled: true,
      securityGroups: [sg],
    })
  }

  createAPIGatewayCustomDomain(domainPrefix: string) {
    // provision an API Gateway for CloudFront Edge (CDN):
      // Create prod/nonprod custom domains (domainName & certificateArn) with EDGE type for provision an API Gateway domain name
      // domainName: APIGateway.domain.nonprod
      // domainName: APIGateway.domain.prod
      // certificateArn: arn:aws:acm:region:account:certificate/certId
    
    // Then add prod/nonprod alias records (APIGateway.domain.nonprod & APIGateway.domain.prod) 
    // to Route53 prod/nonprod hosted zones (domain.nonprod & domain.prod)

    // These prod/nonprod alias records target APIGateway regarding created custom domains (domainName & certificateArn) 

    // non-prod|prod ApiGateway for CloudFront edge (ACM certificate for each account/region, 
    // edge type and Route53 zone/alias record for non-prod|prod CloudFront edge ApiGateway) for each microservice 
    // and its domain (CloudFront-Edge-APIGateway.MS-prod.domain.org)
  
    const {
      domain: { certId, domainName },
    } = this.props
    const { region, account } = cdk.Stack.of(this)
    const certificateArn = `arn:aws:acm:${region}:${account}:certificate/${certId}`
    const name = `${domainPrefix}.${domainName}`
    // domainPrefix = CloudFront-Edge-APIGateWay
    // domainName = ${MS_NAME}-prod.domain.org

    // Important: https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html

    const customDomain = new apigateway.DomainName(this, domainPrefix, {
      domainName: name,
      // An API's custom domain name can be the name of a subdomain or the root domain 
      // (also known as "zone apex") of a registered internet domain.
      certificate: acm.Certificate.fromCertificateArn(this, 'cert', certificateArn),
      endpointType: EndpointType.EDGE,
      // When you create a custom domain name for an edge-optimized API, 
      // API Gateway sets up a CloudFront distribution. 
      // But you must set up a DNS record to map the custom domain name to the CloudFront 
      // distribution domain name. This mapping is for API requests that are bound for 
      // the custom domain name to be routed to API Gateway through the mapped CloudFront 
      // distribution. You must also provide a certificate for the custom domain name.
    })

    new route53.ARecord(this, 'Alias', {
      zone: route53.HostedZone.fromLookup(this, 'Zone', {
        domainName, // domainName = ${MS_NAME}-prod.domain.org
      }),
      recordName: name,
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
    })
  }

  createDynamoDbVPCEndpoint(vpc: IVpc) {
        // https://repost.aws/knowledge-center/vpc-fix-gateway-or-interface-endpoint
    // Gateway VPC endpoints
    // Gateway VPC endpoints allow you to connect to Amazon Simple Storage Service (Amazon S3) and Amazon DynamoDB privately from your VPC.
    // for DynamoDB in only one region AZ (com.amazonaws-us-east-1.dynamodb) as private connection from VPC

    // When using gateway endpoints, there are four factors that affect connectivity to the respective services:

    // The endpoint policy,
    // The VPC subnet network access control list (ACL),
    // The source subnet route table,
    // The Source Amazon Elastic Compute Cloud (Amazon EC2) or AWS Lambda security groups
    // DynamoDB VPC Endpoint
    return new GatewayVpcEndpoint(this, 'dynamodbVpcEndpoint', {
      vpc,
      service: { name: 'com.amazonaws.us-east-1.dynamodb'
     },
      
    })
  }

  createKMSKey() {
    // Create a KMS Key with key rotation with LMS policy for only Decrypting & generate DataKey actions in Order-microservice integration         
    // used by related SNS, SQS, S3 and CloudWatch services (principals)
    // also all KMS actions allowed only for AWS account root user for all resources 
    const kmsPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['kms:Decrypt', 'kms:GenerateDataKey*'],
          principals: [
            new ServicePrincipal('sqs.amazonaws.com'),
            new ServicePrincipal('sns.amazonaws.com'),
            new ServicePrincipal('s3.amazonaws.com'),
            new ServicePrincipal('cloudwatch.amazonaws.com'),
          ],
          resources: ['*'],
        }),
        new PolicyStatement({
          actions: ['kms:*'],
          principals: [new AccountRootPrincipal()],
          resources: ['*'],
        }),
      ],
    })

    const kmsKey = new Key(this, 'orderKMS', {
      enableKeyRotation: true,
      alias: 'order-kms',
      description: 'KMS key used to encrypt Reimagined ORDER data',
      policy: kmsPolicy,
    })

    return kmsKey
  }
}
