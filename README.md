# About

This document would let you go through the deployment strategy for deployment via code pipeline
Make sure the Code pipeline is available on regions you want to deploy else. Else first create stack of code pipeline using
infrastructure directory in root project. This directory has the README.md document for deployment process.

## Dependencies

The following is required in order to run and deploy the project, on your AWS account.

- AWS CLI
- pip (The Python Package Installer)
- Python
- npm (Node package manager)
- Configure AWS CLI with AWS IAM User's Credentials, should be someone who can does have permission to assume role.
- Role ARN for S3 bucket upload (ROLE_ARN), can get this from the output of pipeline's stack

> `aws configure`

Enter following details bellow:

1. AWS Access Key ID
2. AWS Secret Access Key
3. Default region name
4. Default output format

## Invoking Pipeline

To invoke the pipeline and deploy the resources on your aws account you can use this script.

> `./artifact_upload.sh`

To deploy execute `./artifact_upload.sh -e <Environment> -a <ROLE_ARN>`

Example: `./artifact_upload.sh -e dev -a arn:aws:iam::123456789011:role/PipelineArtifactUploadRole-dev-us-west-2`

## Post Deployment

Once everything is deployed you can look at the output of the deployed stack and you'll find **ApiSecureURL**, which can be used to access the api.

This will deploy 2 APIs:

- <https://ApiSecureURL/ddbManager/get> (GET)
- <https://ApiSecureURL/ddbManager/put> (POST)
