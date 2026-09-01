#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PIPELINE_NAME, PIPELINE_CONFIG } from '../lib/config';
import { InfrastructurePipelineStack } from '../lib/infrastructure-pipeline-stack';

const app = new cdk.App();
new InfrastructurePipelineStack(app, PIPELINE_NAME, PIPELINE_CONFIG);