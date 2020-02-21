#!/bin/bash
set -vE
#
# Jenkins CI build file
# This shell script is responsible for Continuous Integration phase in Jenkins environment
#
# Setting AWS CLI in PATH if not available
export PATH=$HOME/.local/bin:$PATH
aws configure set default.region us-east-1

# Setting work directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" && cd $DIR

#Installing Dependencies
echo -e "Installing nodejs & npm: \n$(sudo apt update && sudo apt install -y nodejs && sudo apt install -y npm)"
echo -e "Installing cfn-lint: \n$(sudo pip install cfn-lint)"
echo -e "Checking awscli version: \n$(sudo aws --version)"
echo -e "Upgrading awscli version: \n$(sudo pip install --upgrade awscli)"
echo -e "Installing mocha: \n$(npm install -g mocha || exit 1)"
echo -e "Installing mochawesome: \n$(npm install -g mochawesome || exit 1)"
echo -e "Installing eslint detailed reporter: \n$(npm install eslint-detailed-reporter || exit 1)"

# Adding reports folder to work directory
mkdir -p ./report/ && touch ./report/cfn-lint-report.txt

# Validate CloudFormation Templates
for f in $(find -regex ".*\.\(yaml\|yml\)" -a -not -name ".eslintrc.*" -a -not -name "*buildspec.yml" -a -not -path "**/node_modules/**"); do
    echo -e "Validating template :: $f"
    aws cloudformation validate-template --region eu-west-1 --template-body file://$f || exit 1
    cfn-lint $f >>./report/cfn-lint-report.txt
done

# Install packages
echo -e "Installing node modules..."
npm install || exit 1

# Run test
echo -e "Running unit tests..."
npm test || exit 1

# Run lint
echo -e "Running lint..."
npm run lint || exit 1

# Run coverage
echo -e "Running coverage..."
npm run cover-report || exit 1
