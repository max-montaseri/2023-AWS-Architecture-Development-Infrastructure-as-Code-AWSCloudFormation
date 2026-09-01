import { Construct } from 'constructs'
import { Stack, Stage } from 'aws-cdk-lib'
import { CodePipeline, CodePipelineSource, ManualApprovalStep, CodeBuildStep } from 'aws-cdk-lib/pipelines'
import { Repository } from 'aws-cdk-lib/aws-codecommit'
import { InfrastructureStack } from './infrastructure-stack'
import { InfrastructureStackProps, InfrastructurePipelineStackProps } from './types'
import { PIPELINE_NAME, ASSET_NAME } from './config'
import { Vpc } from 'aws-cdk-lib/aws-ec2'

export class InfrastructurePipelineStage extends Stage {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props)
    new InfrastructureStack(this, 'Infrastructure-stack', props)
  }
}
export class InfrastructurePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: InfrastructurePipelineStackProps) {
    super(scope, id, props)
    const { waves, vpcId } = props || {}
        // If your VPC is created outside your CDK app, you can use Vpc.fromLookup(). 
    // The CDK CLI will search for the specified VPC in the the stack’s region and account, 
    // and import the subnet configuration. Looking up can be done by VPC ID, 
    // but more flexibly by searching for a specific tag on the VPC.
    // const vpc = Vpc.fromLookup(this, 'vpc', {isDefault: true }) // => This imports the default VPC
    
    const vpc = Vpc.fromLookup(this, 'vpc',  {vpcId : vpcId })

    const pipeline = new CodePipeline(this, 'Pipeline', {
      selfMutation: false,
      pipelineName: PIPELINE_NAME,
      crossAccountKeys: true,
/*    codeBuildDefaults: { 
        // CodeBuild & Unit testing stage (BuildSpec) only used in UIPipelineStack and cdk-microservice-backend
        // and doesn't exist in InfrastructurePipelineStack
        buildEnvironment: {
          // see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_4,
        },
      }, */
  
      synth: new CodeBuildStep('Synth', {
      // Synth => will take our codes then generate AWS CloudFormation templates 
      // => we can see the generated templates=> this happens always we deploy!
        projectName: ASSET_NAME,
        input: CodePipelineSource.codeCommit(Repository.fromRepositoryName(this, 'repo', ASSET_NAME), 'master'),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
        vpc,
      }),
    })

    waves.forEach((w) => {
      const { environments, approval, name = '', ...common } = w
      const wave = pipeline.addWave(name, {
        pre: approval ? [new ManualApprovalStep(`promoteto${name}`)] : undefined,
      })

      environments.forEach((e) => {
        // for all defined pipeline stages (stageName) in waves and each stage's environmnts (stackEnv) 
        // InfrastructurePipelineStage would invoke the InfrastructureStack for provisioning         
        wave.addStage(new InfrastructurePipelineStage(this, `${ASSET_NAME}-${e.stackEnv}`, { ...common, ...e }))
      })
    })
  }
}
