# Export DynamoDB Tables to S3 for Macie analysis
This Repository is a CDK infrastructure made like the Cloudformation template displayed in the [AWS Guide Macie for Dynamo Tables](https://aws.amazon.com/de/blogs/security/detecting-sensitive-data-in-dynamodb-with-macie/).

## How To
- in `bin/macie-dynamo-s3-import.ts` set ACCOUNT_ID to your Account Id
- install your dependencies via `npm i`
- deploy your code `cdk deploy`

For additional info visit the AWS Guide.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
