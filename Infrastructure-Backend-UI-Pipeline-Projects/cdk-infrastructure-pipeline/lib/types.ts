import { StackProps, StageProps } from 'aws-cdk-lib'

interface InfrastructureSubnetProps {
  subnet: string
  zone: string
}

interface InfrastructureDomainProps {
  domainName: string
  certId: string
}

export interface InfrastructureStackProps extends StackProps {
  stackEnv: string
  subnets: Array<InfrastructureSubnetProps>
  domain: InfrastructureDomainProps
  vpcId: string
}

export interface InfrastructurePipelineStageProps extends StageProps {
  environments: Array<InfrastructureStackProps>
  approval?: boolean
  name: string
}

export interface InfrastructurePipelineStackProps extends StackProps {
  waves: Array<InfrastructurePipelineStageProps>
  vpcId: string
}
