import {
  Stack,
  StackProps,
  aws_kms as kms,
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_events as events,
  aws_events_targets as targets,
  Duration,
  RemovalPolicy,
  CfnOutput
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');

export class MacieDynamoS3ImportStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DynamoDB Key
    const dynamoDBMacieKMSKey = new kms.Key(this, 'DynamoDBMacieKMSKey', {
      description: 'Key used to decrypt data exported from DynamoDB to S3',
      enabled: true,
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow Macie Service Role to use the key',
            effect: iam.Effect.ALLOW,
            principals: [
              new iam.ArnPrincipal(
                `arn:aws:iam::${this.account}:role/aws-service-role/macie.amazonaws.com/AWSServiceRoleForAmazonMacie`
              ),
            ],
            actions: [
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
      // tags: {
      //   Name: 'DynamoMacieKey',
      //   Description: 'Key used to decrypt data exported from DynamoDB to S3',
      // },
    });

    // DynamoDB Key Alias
    const dynamoDBMacieKeyAlias = new kms.Alias(this, 'DynamoDBMacieKeyAlias', {
      aliasName: 'alias/DynamoDBMacieBlogKey',
      targetKey: dynamoDBMacieKMSKey,
    });

    // Export S3 Bucket for Macie
    const exportS3BucketMacie = new s3.Bucket(this, 'ExportS3BucketMacie', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dynamoDBMacieKeyAlias,
    });

    // Import S3 Bucket
    // const importS3Bucket = new s3.Bucket(this, 'ImportS3Bucket');

    // Export Lambda Role
    const exportLambdaRole = new iam.Role(this, 'ExportLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // Import Lambda Role
    // const importLambdaRole = new iam.Role(this, 'ImportLambdaRole', {
    //   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    // });

    // Export DynamoDB Lambda Policy
    exportLambdaRole.attachInlinePolicy(
      new iam.Policy(this, 'ExportDynamoDBLambdaPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey'],
            resources: [dynamoDBMacieKMSKey.keyArn],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['kms:ListKeys', 'kms:ListAliases'],
            resources: [dynamoDBMacieKMSKey.keyArn],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:PutObject', 's3:ListBucket'],
            resources: [exportS3BucketMacie.bucketArn, `${exportS3BucketMacie.bucketArn}/*`],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: [
              `arn:aws:logs:${this.region}:${this.account}:*`,
              `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*:*`,
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Scan'],
            resources: ['arn:aws:dynamodb:*:*:table/*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:GetItem'],
            resources: ['*'],
          }),
        ],
      })
    );

    // Import DynamoDB Lambda Policy
    // importLambdaRole.attachInlinePolicy(
    //   new iam.Policy(this, 'ImportDynamoDBLambdaPolicy', {
    //     statements: [
    //       new iam.PolicyStatement({
    //         effect: iam.Effect.ALLOW,
    //         actions: ['s3:ListBucket', 's3:GetObject'],
    //         resources: [
    //           `${importS3Bucket.bucketArn}/*`,
    //           `${importS3Bucket.bucketArn}`,
    //         ],
    //       }),
    //       new iam.PolicyStatement({
    //         effect: iam.Effect.ALLOW,
    //         actions: [
    //           'logs:CreateLogGroup',
    //           'logs:CreateLogStream',
    //           'logs:PutLogEvents',
    //         ],
    //         resources: [
    //           `arn:aws:logs:${this.region}:${this.account}:*`,
    //           `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*:*`,
    //         ],
    //       }),
    //       new iam.PolicyStatement({
    //         effect: iam.Effect.ALLOW,
    //         actions: ['dynamodb:BatchWriteItem'],
    //         resources: [
    //           `arn:aws:dynamodb:${this.region}:${this.account}:table/people-macie`,
    //           `arn:aws:dynamodb:${this.region}:${this.account}:table/accounts-info-macie`,
    //         ],
    //       }),
    //     ],
    //   })
    // );





    // DynamoDB Tables
    const employeeTable = dynamodb.Table.fromTableName(this, "EmployeeTable", "kloeher-serverless-app-NorthwindTable")

    // Lambda ExportDynamoDBDataToS3
    const exportDynamoDBDataToS3 = new lambda.Function(this, "ExportDynamoDBDataToS3", {
      functionName: "Export-DynamoDB-Data-To-S3",
      description: "Exports data from DynamoDB to S3 bucket",
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '/functions/index')),
      role: exportLambdaRole,
      timeout: Duration.minutes(120),
      environment: {
        bucket_to_export_to: exportS3BucketMacie.bucketName,
        dynamo_db_tables: employeeTable.tableName
      }
    });

    // Export DynamoDB Data Rule
    const exportDynamoDbDataRule = new events.Rule(this, 'ExportDynamoDBDataRule', {
      description: 'Exports DynamoDB data to S3',
      schedule: events.Schedule.rate(Duration.hours(1)),
      targets: [new targets.LambdaFunction(exportDynamoDBDataToS3)],
    });

    // Permission for Events to Invoke Dynamo Export
    const permission = new lambda.CfnPermission(this, 'PermissionForEventsToInvokeDynamoExport', {
      action: 'lambda:InvokeFunction',
      functionName: exportDynamoDBDataToS3.functionName,
      principal: 'events.amazonaws.com',
      sourceArn: exportDynamoDbDataRule.ruleArn,
    });

    // Outputs

    // new CfnOutput(this, 'ImportS3BucketName', {
    //   value: importS3Bucket.bucketName,
    //   description: 'S3 bucket to place test dataset CSV files to import into DynamoDB',
    // });

    // new CfnOutput(this, 'ImportS3BucketURL', {
    //   value: `https://console.aws.amazon.com/s3/buckets/${importS3Bucket.bucketName}/?region=${this.region}&tab=overview`,
    //   description: 'Import data S3 bucket location',
    // });

    new CfnOutput(this, 'ExportS3BucketName', {
      value: exportS3BucketMacie.bucketName,
      description: 'S3 bucket that DynamoDB data will be exported to for Macie to run a discovery job against',
    });

    new CfnOutput(this, 'ExportS3BucketURL', {
      value: `https://console.aws.amazon.com/s3/buckets/${exportS3BucketMacie.bucketName}/?region=${this.region}&tab=overview`,
      description: 'Export data S3 bucket location',
    });

    // new CfnOutput(this, 'AccountsDynamoDBTableName', {
    //   value: accountsInfoTable.tableName,
    //   description: 'DynamoDB table where account information will be stored',
    // });

    // new CfnOutput(this, 'AccountsDynamoDBTableURL', {
    //   value: `https://console.aws.amazon.com/dynamodb/home?region=${this.region}#tables:selected=${accountsInfoTable.tableName};tab=items`,
    //   description: 'Accounts DynamoDB table location',
    // });

    new CfnOutput(this, 'EmployeeDynamoDBTableName', {
      value: employeeTable.tableName,
      description: 'DynamoDB table where personal contact information will be stored',
    });

    new CfnOutput(this, 'EmployeeDynamoDBTableURL', {
      value: `https://console.aws.amazon.com/dynamodb/home?region=${this.region}#tables:selected=${employeeTable.tableName};tab=items`,
      description: 'Employee DynamoDB table location',
    });

    new CfnOutput(this, 'LambdaExportDynamoDBDataToS3', {
      value: exportDynamoDBDataToS3.functionName,
      description: 'Lambda function that will be used by EventBridge to export data to S3',
    });

    new CfnOutput(this, 'LambdaExportDynamoDBDataToS3URL', {
      value: `https://console.aws.amazon.com/lambda/home?region=${this.region}#/functions/${exportDynamoDBDataToS3.functionName}?tab=configuration`,
      description: 'Lambda function used to export data to S3',
    });

    // new CfnOutput(this, 'LambdaImportS3DataToDynamoDB', {
    //   value: importS3Bucket.functionName,
    //   description: 'Lambda function that will be used to seed test data in DynamoDB',
    // });

    // new CfnOutput(this, 'LambdaImportS3DataToDynamoURL', {
    //   value: `https://console.aws.amazon.com/lambda/home?region=${this.region}#/functions/${importS3Bucket.functionName}?tab=configuration`,
    //   description: 'DynamoDB Import data lambda function',
    // });

    new CfnOutput(this, 'EventBridgeRule', {
      value: `https://console.aws.amazon.com/events/home?region=${this.region}#/eventbus/default/rules/${exportDynamoDbDataRule.ruleName}`,
      description: 'The EventBridge Rule used to automatically export DynamoDB data to S3',
    });
  }
}
