#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PIPELINE_NAME, PIPELINE_CONFIG } from '../lib/config';
import { UIPipelineStack } from '../lib/ui-pipeline-stack';

const app = new cdk.App();
new UIPipelineStack(app, PIPELINE_NAME, PIPELINE_CONFIG);
