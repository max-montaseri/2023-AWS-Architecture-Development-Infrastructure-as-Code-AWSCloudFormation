import { Construct } from 'constructs'
import { Stack, Stage } from 'aws-cdk-lib'
import { CodePipeline, CodePipelineSource, ManualApprovalStep, CodeBuildStep } from 'aws-cdk-lib/pipelines'
import { Repository } from 'aws-cdk-lib/aws-codecommit'
import { ASSET_NAME, BRANCH_NAME, PIPELINE_NAME, DEPENDENCY_TRACK_S3 } from './config'
import { UIStackProps, UIPipelineStackProps } from './types'
import { BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild'
import { UIStack } from './ui-stack'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Vpc } from 'aws-cdk-lib/aws-ec2'

export class UIPipelineStage extends Stage {
  // PipelineStage would invoke the UIStack for 
  // provisioning in each stackEnv
  constructor(scope: Construct, id: string, props: UIStackProps) {
    super(scope, id, props)
    new UIStack(this, id, props)
    // id =>  
    // MS-ui-dev-stack
    // MS-ui-qa-stack
    // MS-ui-qaauto-stack
    // MS-ui-uat-stack
    // MS-ui-prod-stack
  }
}

export class UIPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: UIPipelineStackProps) {
    super(scope, id, props)
    const { waves, vpcId } = props || {}
    const vpc = Vpc.fromLookup(this, 'vpc', { vpcId })

    const pipeline = new CodePipeline(this, 'Pipeline', {
      selfMutation: true,
      pipelineName: PIPELINE_NAME,
      crossAccountKeys: true,
      codeBuildDefaults: {
      /*  CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-msName
      and doesn't exist in InfrastructurePipelineStack    */    
        buildEnvironment: {
          // see => https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html

          /** The Amazon Linux 2 x86_64 standard image, version `4.0`. 
           * 
           * => Docker images provided by CodeBuild
           * A supported image is the latest major version of an image available in CodeBuild and is updated with minor and patch version updates. 
           * CodeBuild optimizes the provisioning duration of builds with supported images by caching them in the machine's Amazon Machine Images (AMI). 
           * 
           * If you want to benefit from caching and minimize the provisioning duration of your build, 
           * select Always use the latest image for this runtime version in the Image version section of the CodeBuild console instead of 
           * a more granular version, such as aws/codebuild/amazonlinux2-x86_64-standard:4.0-1.0.0.
           * 
           * 
           * CodeBuild frequently updates the list of Docker images to add the latest images and deprecate old images.
           * 
          */          

          // => Docker images provided by CodeBuild => EC2 compute images
          // AWS CodeBuild supports the following Docker images that are available for EC2 compute in CodeBuild.
          // Amazon Linux 2 platform => aws/codebuild/amazonlinux2-x86_64-standard:4.0

          buildImage: LinuxBuildImage.AMAZON_LINUX_2_4, // The Amazon Linux 2 x86_64 standard image, version 4.0.   
          
        //  LinuxBuildImage => A CodeBuild image running x86-64 Linux.
        // This class has a bunch of public constants that represent the most popular images.
        // You can also specify a custom image using one of the static methods:
        //    LinuxBuildImage.fromDockerRegistry(image[, { secretsManagerCredentials }])
        //    LinuxBuildImage.fromEcrRepository(repo[, tag])
        //    LinuxBuildImage.fromAsset(parent, id, props)

          // => static readonly AMAZON_LINUX_2_4: IBuildImage; => Represents a Docker image used for the CodeBuild Project builds. Use the concrete subclasses, either: LinuxBuildImage or WindowsBuildImage.
          
          // see => https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
          // => Docker images provided by CodeBuild => Lambda compute images
          // AWS CodeBuild supports the following Docker images that are available for AWS Lambda compute in CodeBuild.
          // aarch64 Architecture => Amazon Linux 2 platform => aws/codebuild/amazonlinux-aarch64-lambda-standard:dotnet6
          // x86_64 Architecture => Amazon Linux 2 platform => aws/codebuild/amazonlinux-x86_64-lambda-standard:dotnet6
          

        },
      },
      synth: new CodeBuildStep('Synth', {
      // Synth => will take our codes then generate AWS CloudFormation templates 
      // => we can see the generated templates=> this happens always we deploy!
        projectName: ASSET_NAME,
        input: CodePipelineSource.codeCommit(Repository.fromRepositoryName(this, 'repo', ASSET_NAME), BRANCH_NAME),
        commands: [
          // "node -v",
          "npm ci",
          "npm test",
          "npm run build",
          "npx cdk synth",
        ],
        rolePolicyStatements: [
        // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-msName
        // and doesn't exist in InfrastructurePipelineStack 
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:Put*'],
            // Built artifacts will be saved/put in S3 Bucket: DEPENDENCY_TRACK_S3
            // this UI Pipekine will save the UIPipelineStack built artifacts (by CodePipekine) for executing by AWS Cloudformation
            resources: [`arn:aws:s3:::${DEPENDENCY_TRACK_S3}/*`],
          }),
        ],

        partialBuildSpec: BuildSpec.fromObject({
        // https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html
        // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-msName
        // and doesn't exist in InfrastructurePipelineStack 
          reports: {
            coverageReports: {
              files: 'clover.xml',
              'file-format': 'CLOVERXML',
              'base-directory': 'coverage',
            },
            jestReports: {
              files: 'unitTestReport.xml',
              'file-format': 'JUNITXML',
              'base-directory': 'coverage',
            },
          },
        }),
        // Built artifacts saved/put in DEPENDENCY_TRACK_S3 S3 Bucket will be put in 
        // this UI Pipekine will save the UIPipelineStack built artifacts (by CodePipekine) for executing by AWS Cloudformation
        // each stage's (prod/nonprod) VPC        
        vpc,
        // vpc: Vpc.fromLookup(this, "vpc", { vpcId }),
      }),
    })

    waves.forEach((w) => {
      const { environments, approval, name = '', ...common } = w
      // Add stages (dev-stage, test-stage, qa-stage, ..., prod-stage) 
      // and their manual deploy approval to CodePipeline wave       
      const wave = pipeline.addWave(name, {
        pre: approval ? [new ManualApprovalStep(`promoteto${name}`)] : undefined,
      })

      environments.forEach((e) => {
        wave.addStage(
        /*  for all defined pipeline stages (stageName) in waves and each stage's environmnts (stackEnv) 
        PipelineStage would invoke the UIStack for provisioning  */

        // ${MS_NAME}-ui`
        // ${stackEnv} = dev, qa, qaauto, uat, prod
        // => ms-ui-dev-stack
          new UIPipelineStage(this, `${ASSET_NAME}-${e.stackEnv}-stack`, { ...common, ...e })
        )
      })
    })
  }
}
