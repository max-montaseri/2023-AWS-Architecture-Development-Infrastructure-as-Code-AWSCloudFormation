
const MS_NAME='order' // microservice_name (Exp. order) // Used in custom domain name => The custom domain name for your API. Uppercase letters are not supported
const ENV_PROD = { account: '??????????????', region: 'us-east-1' }
// region, account => only for creating ACM certificate for cloudfront.Distribution
const PROD_VPCID = 'vpc-?????2e21be?????'//'vpc-prod' // already should be created in account
const PROD_ACM_CERT_ID = '?????-dcdb-4625-bbb6-af2da27?????'
const PROD_ROOT_DOMAIN = `${MS_NAME}-prod.domain.org`

const ENV_NONPROD = { account: '??????????????', region: 'us-east-1' }
const NONPROD_VPCID = 'vpc-0c8fa22dbbd?????'
const NONPROD_ACM_CERT_ID = '?????-dcdb-4625-bbb6-af2da27?????'
const NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`

export const PIPELINE_NAME = `${MS_NAME.toUpperCase}-UIPipeline`
export const BRANCH_NAME = 'master'
export const ASSET_NAME = `${MS_NAME}-ui` // microservice_name (Exp. order) // Used in custom domain name => The custom domain name for your API. Uppercase letters are not supported
export const DEPENDENCY_TRACK_S3 = `${MS_NAME}-ui-pipeline-bucket-for-Cloudformation` // this UI Pipekine will save the UIPipelineStack built artifacts (by CodePipekine) for executing by AWS Cloudformation

export const getTags = (env: string) => ({
  asset_id: ASSET_NAME, //`${MS_NAME}-starterkit`
  system_id: `${MS_NAME}`,
  accessibility: 'private',
  data_classification: 'proprietary',
  env_intent: env,
  engineer: 'frontend@company.org',
})

export const getEnvironmentConfig = (env: string) =>
  env === 'prod'
    ? {
        certificateId: PROD_ACM_CERT_ID,
        domain: PROD_ROOT_DOMAIN,
        vpcId: PROD_VPCID,
      }
    : {
        certificateId: NONPROD_ACM_CERT_ID,
        domain: NONPROD_ROOT_DOMAIN,
        vpcId: NONPROD_VPCID,
      }

export const PIPELINE_CONFIG = {
  env: ENV_NONPROD,
  tags: getTags('nonprod'),
  vpcId: NONPROD_VPCID,
  waves: [
    /* UIStack.ts will invoke getEnvironmentConfig(stackEnv) for each environment/stackEnv
    so certificateId, domain and vpcId would be set for that environment/stackEnv */
    
    /* in UIStack.ts:
      1- A S3 bucket will be created for each environment 
        => bucketName: `${ASSET_NAME}-${stackEnv}`

      2- for CloudFront's access/fetch requests, a S3 bucket access policy (principal: cloudFrontOriginAccessIdentityS3CanonicalUserId) 
      will be created for each environment's S3 bucket 

      3- A CloudFront ResponseHeadersPolicy will be created for each environment/stackEnv
        => responseHeadersPolicyName: `securityCacheControlPolicy-${stackEnv}`

      4- only for Price Class 100 (least expensive regions): US, Mexico, Canada, Europe and Israel
        A CloudFront distribution will be created with each environment's S3 bucket as origin
        => origin: new origins.S3Origin(appBucket, { originAccessIdentity }),
        
      
      
      5- A Route53 Cname record in a private zone will be created for this CloudFront distribution 
        Zone name: `${stackEnv}.${domain}` 
        domain:
          NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`
          NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`

                
      6- Deploying built artifacts from environment related S3 bucket to 
      CloudFront distribution regarding types.UIStackProps.invalidate
     */
    {
      environments: [{ stackEnv: 'dev' }],
      logLevel: 'debug',
      name: 'dev-stage',
      env: ENV_NONPROD,
      tags: getTags('dev'),
    },
    {
      environments: [{ stackEnv: 'qa' }],
      logLevel: 'debug',
      approval: true,
      name: 'qa-stage',
      env: ENV_NONPROD,
      tags: getTags('qa'),
    },
    {
      environments: [{ stackEnv: 'qaauto' }, { stackEnv: 'uat' }],
      approval: true,
      name: 'preprod-stage',
      env: ENV_NONPROD,
      tags: getTags('preprod'),
    },
    {
      environments: [{ stackEnv: 'prod', pitr: true }],
      approval: true,
      name: 'prod-stage',
      env: ENV_PROD,
      tags: getTags('prod'),
    },
  ],
}