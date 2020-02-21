# **Continuous Deployment Pipeline Creation**

This document will guide you through steps needed to create a continuous deployment delivery pipeline for this project. After following this you'll be able to create such pipelines for required aws regions in an AWS account.

## Prerequisite

---

You need to have these on machine from where you'll deploy delivey pipeline, on your AWS account.

- AWS CLI
- pip (The Python Package Installer)
- Python
- npm (Node package manager)
- Configure AWS CLI with AWS IAM User's Credentials, should be someone with Admin Rights or Full Access, you can do this by using this command on AWS CLI.

> `aws configure`

Enter following details bellow:

1. AWS Access Key ID
2. AWS Secret Access Key
3. Default region name
4. Default output format

## Understanding Environments & Parameters related to deployment

### Environments

We are assuming that we do have 3 environments here as:

- Development (dev)
- Testing (test)
- Production (prod)

_**NOTE**_: We are assuming that we are using seperate AWS accounts for creating these environmnets.

### Parameters

We can modify deployment parameters by modifing details in file located on path.

> ./Infrastructure/Pipeline/params.json

- regions: We can add more regions to this parameter, the script will deploy pipeline to these regions for respective environment.
- stackName: We can modify the name of stack or the name of pipeline by modifying this detail for respective environment.

## Continuous Delivery Pipeline Deployment

We need to deploy Code Pipeline, the script to deploy is located on this path.

> ./Infrastructure/Pipeline/codepipeline-deploy.sh

To deploy execute `./Infrastructure/Pipeline/codepipeline-deploy.sh -e <Environment>`

Example: `./Infrastructure/Pipeline/codepipeline-deploy.sh -e dev`

### Allowed values for environment are

_1._ dev
_2._ test
_3._ prod

### Environment Specific Parameters

These parameters can be changed on this path:

> ./Infrastructure/Pipeline/configuration/_**`environment`**_/config.json

**IsApprovalRequired** : If you want to have a stage with deployment approval then you may toggle this value , allowed values are 'True' or 'False'.

**MailId**: On this email you'll receive notification about pipleine for:

- Pipeline Status (Failure/Success).
- Deployment Approval
