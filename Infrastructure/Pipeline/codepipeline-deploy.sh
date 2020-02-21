#!/bin/bash

# This Shell script can be used to Deploy Codepipeline, which can be used for CD.

set -Ev

while [[ $# -gt 1 ]]; do
    key="$1"
    case $key in
    -e | --env)
        ENV="$2"
        shift
        ;;
    *) ;;
    esac
    shift
done

# Installing Dependencies for this script
# echo -e "Installing jq: \n$(sudo apt-get install -y jq)"
echo -e "Checking awscli version: \n$(aws --version)"
# echo -e "Upgrading awscli version: \n$(pip install --upgrade awscli)"

# Validating Inputs

if [[ $ENV =~ ^(dev|prod|test)$ ]]; then
    echo "$ENV provided is correct env"
else
    echo "$ENV is not correct environment"
    exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" && cd $DIR

# Building Deployment Parameters
echo "Building Deployment Parameters"

TEMPLATE=$(jq --raw-output ".$ENV.template" params.json) && echo "Selecting Template :: $TEMPLATE"
STACK=$(jq --raw-output ".$ENV.stackName" params.json) && echo "Selecting Stack Name :: $STACK"
CONF="configuration/$ENV/config.json" && echo "Selecting Config File :: $CONF"
REGION_LIST=$(jq --raw-output ".$ENV.regions[]" ./params.json | perl -pe 's/\r$//g') && echo "Building Region List :: $REGION_LIST"

for REGION in $REGION_LIST; do
    # Pipeline Deployment
    if ! aws cloudformation describe-stacks --region $REGION --stack-name $STACK &>/dev/null; then

        echo "$STACK does not exist, creating $STACK in $REGION"

        aws cloudformation create-stack --stack-name $STACK \
                                        --template-body "file://$TEMPLATE" \
                                        --parameters "file://$CONF" \
                                        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
                                        --region $REGION

        echo "Finished $STACK stack updation!"

    else

        echo "$STACK exists in $REGION, attempting update ..."

        aws cloudformation update-stack --stack-name $STACK \
                                        --template-body "file://$TEMPLATE" \
                                        --parameters "file://$CONF" \
                                        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
                                        --region $REGION

        echo "Finished $STACK stack updation!"

    fi

done
