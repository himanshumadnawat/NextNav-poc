#!/bin/bash
set -e
echo "Creating OTA package for S3 Upload ..."
while [[ $# -gt 1 ]]; do
    key="$1"
    case $key in
    -e | --env)
        ENV="$2"
        shift
        ;;
    -a | --role-arn)
        ROLE_ARN="$2"
        shift
        ;;
    *) ;;

    esac
    shift
done

if [[ -z $ROLE_ARN ]]; then
    echo "ROLE_ARN role arn not provided by --role-arn using default dev"
    exit 1
fi
if [[ -z "$ENV" ]]; then
    echo "Environment to deploy not provided by --env, missing environment {values are dev, prod, beta, alpha}"
    exit 1
fi
if [[ $ENV =~ ^(dev|prod|test)$ ]]; then
    echo "$ENV provided is correct env"
else
    echo "$ENV is not correct environment"
    exit 1
fi
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" && cd $DIR
echo "Package source code"
ZIP_FILE=project.zip
echo -e "Packing source to ${ZIP_FILE}"
zip -r $ZIP_FILE .
echo "Assuming role $ROLE_ARN for bucket access"
sessionToken=($(aws sts assume-role --role-arn $ROLE_ARN \
    --role-session-name upload \
    --query '[Credentials.AccessKeyId,Credentials.SecretAccessKey,Credentials.SessionToken]' \
    --output text))
export AWS_ACCESS_KEY_ID="${sessionToken[0]}"
export AWS_SECRET_ACCESS_KEY="${sessionToken[1]}"
export AWS_SECURITY_TOKEN="${sessionToken[2]}"
bucketPrefix=$(jq --raw-output ".$ENV.bucketPrefix" ./Infrastructure/Pipeline/params.json)
REGION_LIST=$(jq --raw-output ".$ENV.regions[]" ./Infrastructure/Pipeline/params.json | perl -pe 's/\r$//g')
for REGION in $REGION_LIST; do
    bucketName=${bucketPrefix}-${ENV}-${REGION}
    echo "Source Artiface Bucket Name :: $bucketName"
    echo "Deployment Region :: $REGION"
    if aws s3api head-bucket --bucket "$bucketName" --region "$REGION" 2>/dev/null; then
        echo "$bucketName exist no need to create"
        echo -e "Pushing source to s3://${bucketName}"
        aws s3 cp $ZIP_FILE s3://$bucketName/ --region ${REGION}
    else
        echo "Bucket $bucketName does not exist in $REGION"
    fi
done
rm -rf $ZIP_FILE
#Unsetting Environment Variables
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SECURITY_TOKEN
