#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MacieDynamoS3ImportStack } from '../lib/macie-dynamo-s3-import-stack';

const app = new cdk.App();
new MacieDynamoS3ImportStack(app, 'MacieDynamoS3ImportStack', {
  env: {
    account: "ACCOUNT_ID",
    region: "eu-central-1"
  }
});