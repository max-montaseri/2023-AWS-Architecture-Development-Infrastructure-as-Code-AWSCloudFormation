const MS_NAME='order' // microservice_name (Exp. order) // Used in custom domain name => The custom domain name for your API. Uppercase letters are not supported
const ENV_PROD = { account: '??????????????', region: 'us-east-1' }
const PROD_ROOT_DOMAIN = `${MS_NAME}-prod.domain.org` // Used in custom domain name => The custom domain name for your API. Uppercase letters are not supported
// AWS Certificate Manager (ACM) // alreday should be created in account (free tire: first 30 days)
const PROD_ACM_CERT_ID = '8d9506d5-????-????-????-af2da2792e44'
const PROD_VPCID = 'vpc-0d9482e21bec2????'//'vpc-prod' // alreday should be created in account
const PROD_PRIV_SUBNET_1A = 'prod-subnet-1a'
const PROD_PRIV_SUBNET_1B = 'prod-subnet-1b'
const PROD_PRIV_SUBNET_1C = 'prod-subnet-1c'


const ENV_NONPROD = { account: '??????????????', region: 'us-east-1' }
const NONPROD_ROOT_DOMAIN = `${MS_NAME}-nonprod.domain.org`
const NONPROD_ACM_CERT_ID = '8d9506d5-????-????-????-af2da2792e44'
const NONPROD_VPCID = 'vpc-00409806b07be????'//'vpc-nonprod' // alreday should be created in account
const NONPROD_PRIV_SUBNET_1A = 'nonprod-subnet-1a'
const NONPROD_PRIV_SUBNET_1B = 'nonprod-subnet-1b'
const NONPROD_PRIV_SUBNET_1C = 'nonprod-subnet-1c'

export const ZSCALER_IPSET_1 = '10.132.8.0/21'
export const ZSCALER_IPSET_2 = '10.132.0.0/16'

export const PIPELINE_NAME = `${MS_NAME.toUpperCase}-InfrastructurePipeline`
export const ASSET_NAME = `${MS_NAME}-infrastructure`
export const REFERENCE_CDN_PREFIX = 'cloudfront-edge-apigateway' // Used in custom domain name => The custom domain name for your API. Uppercase letters are not supported

export const getTags = (env: string) => ({
  // only exists in cdk-infrastructure-pipeline
  asset_id: ASSET_NAME, 
  system_id: `${MS_NAME}`,
  accessibility: 'private',
  data_classification: 'proprietary',
  env_intent: env,
  engineer: 'devops@company.org',
})

export const PIPELINE_CONFIG = {
  env: ENV_NONPROD,
  tags: getTags('nonprod'),
  vpcId: NONPROD_VPCID,
  waves: [
    {
      environments: [
        {
          stackEnv: 'nonprod',
          subnets: [
            { subnet: NONPROD_PRIV_SUBNET_1A, zone: 'us-east-1a' },
            { subnet: NONPROD_PRIV_SUBNET_1B, zone: 'us-east-1b' },
            { subnet: NONPROD_PRIV_SUBNET_1C, zone: 'us-east-1c' },
          ],
          domain: {
            certId: NONPROD_ACM_CERT_ID,
            domainName: NONPROD_ROOT_DOMAIN,
          },
          vpcId: NONPROD_VPCID,
        },
      ],
      name: 'nonprod-stage',
      env: ENV_NONPROD,
      tags: getTags('nonprod'),
    },
    {
      environments: [
        {
          stackEnv: 'prod',
          subnets: [
            { subnet: PROD_PRIV_SUBNET_1A, zone: 'us-east-1a' },
            { subnet: PROD_PRIV_SUBNET_1B, zone: 'us-east-1b' },
            { subnet: PROD_PRIV_SUBNET_1C, zone: 'us-east-1c' },
          ],
          domain: {
            certId: PROD_ACM_CERT_ID,
            domainName: PROD_ROOT_DOMAIN,
          },
          vpcId: PROD_VPCID,
        },
      ],
      approval: true,
      name: 'prod-stage',
      env: ENV_PROD,
      tags: getTags('prod'),
    },
  ],
}
