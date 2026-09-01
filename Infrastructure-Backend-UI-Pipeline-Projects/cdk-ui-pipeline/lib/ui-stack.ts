import { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { UIStackProps } from './types'
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront'
import { ASSET_NAME, getEnvironmentConfig } from './config'

export class UIStack extends cdk.Stack {
  // PipelineStage would invoke the UIStack for 
  // provisioning in each stackEnv

  /* UIStack will invoke getEnvironmentConfig(stackEnv) for each environment/stackEnv
  so certificateId, domain and vpcId would be set for that environment/stackEnv */
  constructor(scope: Construct, id: string, props: UIStackProps) {
    // id =>  
    // MS-ui-dev-stack
    // MS-ui-qa-stack
    // MS-ui-qaauto-stack
    // MS-ui-uat-stack
    // MS-ui-prod-stack
    super(scope, id, props)
    const { stackEnv, invalidate } = props // ${stackEnv} = dev, qa, qaauto, uat, prod
    const { domain, certificateId } = getEnvironmentConfig(stackEnv) // `${MS_NAME}-nonprod.domain.org` and `${MS_NAME}-prod.domain.org`
    const { region, account } = cdk.Stack.of(this) // only for creating ACM certificate for cloudfront.Distribution
    const URL = `${stackEnv}.${domain}`    
    // ${stackEnv} = dev, qa, qaauto, uat, prod
    // ${domain}= `${MS_NAME}-nonprod.domain.org` and `${MS_NAME}-prod.domain.org`

    // URL =>
    // dev.MS-nonprod.domain.org
    // qa.MS-nonprod.domain.org
    // qaauto.MS-nonprod.domain.org
    // uat.MS-nonprod.domain.org
    // * prod.MS-prod.domain.org

    const accessControlMaxAge = cdk.Duration.seconds(31536000)

    /*  Helper: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_CloudFront.html  
    Helper: https://www.pulumi.com/registry/packages/aws/api-docs/cloudfront/   */

    /*  Origin Access Identity (OAI):
    is a special CloudFront user that you can associate with Amazon S3 origins, 
    so that you can secure all or just some of your Amazon S3 content.  */
    
    /* Restricting Access to Amazon S3 Content by Using an Origin Access Identity
    Helper: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html */

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'oai')

    const appBucket = new s3.Bucket(this, 'appBucket', {
      /*  1- An S3 bucket will be created for each environment 
      => bucketName: `${ASSET_NAME}-${stackEnv}-bucket` */      
      versioned: true,
      bucketName: `${ASSET_NAME}-${stackEnv}-bucket`,  // ${ASSET_NAME} = MS-ui  // ${stackEnv} = dev, qa, qaauto, uat, prod  
      //      => MS-ui-dev-bucket
      //         MS-ui-qa-bucket
      //         MS-ui-qaauto-bucket
      //         MS-ui-uat-bucket   
      //         MS-ui-prod-bucket  

      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      /*  Cross-origin resource sharing (CORS): 
      defines a way for client web applications that are loaded in one domain to interact with resources in a different domain.
      https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html */
      cors: [{ allowedHeaders: ['*'], allowedMethods: [s3.HttpMethods.GET], allowedOrigins: ['*'] }],
    })

    // S3 bucket Policy for CloudFront
    const cloudFrontPolicy = new iam.PolicyStatement({      
    /*  2- for CloudFront's access/fetch requests, a S3 bucket access policy (principal: cloudFrontOriginAccessIdentityS3CanonicalUserId) 
    will be created for each environment's S3 bucket  */
      actions: ['s3:GetObject'],
      resources: [`${appBucket.bucketArn}/*`],
      principals: [
        new iam.CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId),
      ],
    })
    appBucket.addToResourcePolicy(cloudFrontPolicy)

    /*  CloudFront Response Header Policy
    Helper: https://www.pulumi.com/registry/packages/aws/api-docs/cloudfront/responseheaderspolicy/ */
    const responsePolicy = new cloudfront.ResponseHeadersPolicy(this, 'responseHeaderPolicy', {
    /*  3- A CloudFront ResponseHeadersPolicy will be created for each environment/stackEnv
    => responseHeadersPolicyName: `securityCacheControlPolicy-${stackEnv}`   */    
      responseHeadersPolicyName: `securityCacheControlPolicy-${stackEnv}`, // ${stackEnv} = dev, qa, qaauto, uat, prod  
      comment: 'Policy adds both security headers and well as cache-control headers',
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: `frame-ancestors 'none';`, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          // A number that CloudFront uses as the value for the max-age directive in the Strict-Transport-Security HTTP response header.
          accessControlMaxAge, 
          includeSubdomains: true,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Cache-Control', value: 'no-store', override: true },
          { header: 'Pragma', value: 'no-cache', override: true },
          { header: 'Expires', value: '0', override: true },
        ],
      },
    })

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'cloudfront', {
    /*  4- A CloudFront distribution will be created with each environment's S3 bucket as origin
    => origin: new origins.S3Origin(appBucket, { originAccessIdentity }), */     
      defaultBehavior: { 
        origin: new origins.S3Origin(appBucket, { originAccessIdentity }),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: responsePolicy,
      },
      defaultRootObject: 'index.html',
      domainNames: [URL],
      certificate: Certificate.fromCertificateArn(
        this,
        'certificate',
        `arn:aws:acm:${region}:${account}:certificate/${certificateId}`
      ),
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: `/index.html`,
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: `/index.html`,
        },
      ],
      priceClass: PriceClass.PRICE_CLASS_100, // Price Class 100 (Cheapest): US, Mexico, Canada, Europe and Israel
    })

    // Route53 Cname record creation for CloudFront distribution
    new route53.CnameRecord(this, 'alias', {
    /*  5- A Route53 Cname record in a private zone will be created for this CloudFront distribution 
        Zone name: `${stackEnv}.${domain}` 
        domain:
          config.NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`
          config.NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`   */    
      domainName: distribution.domainName,
      recordName: URL, // URL = `${stackEnv}.${domain}`
      zone: route53.HostedZone.fromLookup(this, 'base-domain', { domainName: domain }),
    })

    // Deploy built artifacts from S3 bucket to CloudFront
    new deploy.BucketDeployment(this, 'deployWithInvalidation', {
    /*  6- Deploying built artifacts from environment related S3 bucket to 
    CloudFront distribution regarding types.UIStackProps.invalidate  */     
      sources: [deploy.Source.asset('./dist')],
      destinationBucket: appBucket,
      distribution,
      distributionPaths: invalidate ? ['/*'] : undefined,
    })
  }
}
