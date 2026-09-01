import { StackProps, StageProps } from 'aws-cdk-lib'

export interface UIStackProps extends StackProps {
  stackEnv: string
  invalidate?: boolean
}

export interface UIStageProps extends StageProps {
  environments: Array<UIStackProps>
  approval?: boolean
  name: string
}

export interface UIPipelineStackProps extends StackProps {
  waves: Array<UIStageProps>
  vpcId: string
}
