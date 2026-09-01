import { Construct } from "constructs";
import { Stack, Stage } from "aws-cdk-lib";
import {
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep,
  CodeBuildStep,
} from "aws-cdk-lib/pipelines";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import {
  ASSET_NAME,
  BRANCH_NAME,
  PIPELINE_NAME,
  DEPENDENCY_TRACK_S3,
} from "./config";
import { MsOrderStackProps, MsOrderPipelineStackProps } from "./types";
import { BuildSpec, LinuxBuildImage } from "aws-cdk-lib/aws-codebuild";
import { MsOrderRootStack } from "./msorder-root-stack";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Vpc } from "aws-cdk-lib/aws-ec2";

export class MsOrderPipelineStage extends Stage {
  // PipelineStage would invoke the RootStack for 
  // provisioning AWS resources DynamoDbStack, SNSSQSTopicStack, LambdaStack and apiGateWayStack
  // in each stackEnv
  constructor(scope: Construct, id: string, props: MsOrderStackProps) {
    super(scope, id, props);
    new MsOrderRootStack(this, "msorder-stack", props);
    // id =>  
    // MS-microservice-dev-stack
    // MS-microservice-qa-stack
    // MS-microservice-qaauto-stack
    // MS-microservice-uat-stack
    // MS-microservice-prod-stack
  }
}

export class MsOrderPipelineStack extends Stack {
  // regarding PIPELINE_CONFIG
  // for all defined pipeline stages (stageName) in waves and each stage's environmnts (stackEnv) 
  // PipelineStage would invoke the RootStack for provisioning AWS resources DynamoDbStack, SNSSQSTopicStack, LambdaStack and apiGateWayStack
  constructor(scope: Construct, id: string, props: MsOrderPipelineStackProps) {
    super(scope, id, props);
    const { waves, vpcId } = props || {};
    const vpc = Vpc.fromLookup(this, 'vpc', { vpcId })

    const pipeline = new CodePipeline(this, "Pipeline", {
      selfMutation: true,
      pipelineName: PIPELINE_NAME,
      crossAccountKeys: true,
      codeBuildDefaults: {
        // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-msName
        // and doesn't exist in InfrastructurePipelineStack           
        buildEnvironment: {
          // see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
        },
      },
      synth: new CodeBuildStep("Synth", {
      // Synth => will take our codes then generate AWS CloudFormation templates 
      // => we can see the generated templates=> this happens always we deploy!        
        projectName: ASSET_NAME,
        input: CodePipelineSource.codeCommit(
          Repository.fromRepositoryName(this, "repo", ASSET_NAME),
          BRANCH_NAME
        ),
        commands: [
          "node -v",
          "npm ci",
          "npm test",
          "npm run build",
          "npx cdk synth",
        ],
        rolePolicyStatements: [
          // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-backend
          // and doesn't exist in InfrastructurePipelineStack             
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["s3:Put*"],
            // Built artifacts will be saved/put in S3 Bucket: DEPENDENCY_TRACK_S3
            resources: [`arn:aws:s3:::${DEPENDENCY_TRACK_S3}/*`],
          }),
        ],
        partialBuildSpec: BuildSpec.fromObject({
          // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-backend
          // and doesn't exist in InfrastructurePipelineStack   
          reports: {
            coverageReports: {
              files: "clover.xml",
              "file-format": "CLOVERXML",
              "base-directory": "coverage",
            },
            jestReports: {
              files: "unitTestReport.xml",
              "file-format": "JUNITXML",
              "base-directory": "coverage",
            },
          },
        }),
        // Built artifacts saved/put in DEPENDENCY_TRACK_S3 S3 Bucket will be put in 
        // each stage's (prod/nonprod) VPC
        vpc,
        // vpc: Vpc.fromLookup(this, "vpc", { vpcId }),
      }),
    });

    waves.forEach((w) => {
      const { environments, approval, stageName = "", ...common } = w;
      // Add stages (dev-stage, test-stage, qa-stage, ..., prod-stage) 
      // and their manual deploy approval to CodePipeline wave 
      const wave = pipeline.addWave(stageName, {
        pre: approval
          ? [new ManualApprovalStep(`promoteto${stageName}`)]
          : undefined,
      });

      environments.forEach((e) => {
        wave.addStage(
          // for all defined pipeline stages (stageName) in waves and each stage's environmnts (stackEnv) 
          // PipelineStage would invoke the RootStack for provisioning AWS resources DynamoDbStack, SNSSQSTopicStack, LambdaStack and apiGateWayStack

      // ${MS_NAME}-ui`
        // ${stackEnv} = dev, qa, qaauto, uat, prod
        // => ms-microservice-dev-stack          
          new MsOrderPipelineStage(this, `${ASSET_NAME}-${e.stackEnv}-stack`, {...common, ...e, })
        );
      });
    });
  }
}