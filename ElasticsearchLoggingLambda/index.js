// v1.1.2
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');

const endpoint = process.env.esdomainendpoint;
const regionname = process.env.region;

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function isValidJson(message) {
  try {
    JSON.parse(message);
  } catch (e) { return false; }
  return true;
}

function extractJson(message) {
  const jsonStart = message.indexOf('{');
  if (jsonStart < 0) return null;
  const jsonSubString = message.substring(jsonStart);
  return isValidJson(jsonSubString) ? jsonSubString : null;
}

function buildSource(message, extractedFields) {
  let jsonSubString;
  if (extractedFields) {
    const source = {};

    for (const key in extractedFields) {
      if (extractedFields.hasOwnProperty(key) && extractedFields[key]) {
        const value = extractedFields[key];

        if (isNumeric(value)) {
          source[key] = 1 * value;
          continue;
        }

        jsonSubString = extractJson(value);
        if (jsonSubString !== null) {
          source[`$${key}`] = JSON.parse(jsonSubString);
        }

        source[key] = value;
      }
    }
    return source;
  }

  jsonSubString = extractJson(message);
  if (jsonSubString !== null) {
    return JSON.parse(jsonSubString);
  }

  return {};
}

function transform(payload) {
  if (payload.messageType === 'CONTROL_MESSAGE') {
    return null;
  }

  let bulkRequestBody = '';

  payload.logEvents.forEach((logEvent) => {
    const timestamp = new Date(1 * logEvent.timestamp);

    // index name format: cwl-YYYY.MM.DD
    const indexName = [
      `cwl-${timestamp.getUTCFullYear()}`, // year
      (`0${timestamp.getUTCMonth() + 1}`).slice(-2), // month
      (`0${timestamp.getUTCDate()}`).slice(-2) // day
    ].join('.');

    const source = buildSource(logEvent.message, logEvent.extractedFields);
    source['@id'] = logEvent.id;
    source['@timestamp'] = new Date(1 * logEvent.timestamp).toISOString();
    source['@message'] = logEvent.message;
    source['@owner'] = payload.owner;
    source['@log_group'] = `${payload.logGroup} - ${regionname}`;
    source['@log_stream'] = payload.logStream;
    source['@requestId'] = logEvent.message.split('\t')[1];
    source['@region'] = regionname;

    const action = { index: {} };
    action.index._index = indexName;
    action.index._type = payload.logGroup;
    action.index._id = logEvent.id;

    bulkRequestBody += `${[
      JSON.stringify(action),
      JSON.stringify(source),
    ].join('\n')}\n`;
  });
  return bulkRequestBody;
}

function hmac(key, str, encoding) {
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest(encoding);
}

function hash(str, encoding) {
  return crypto.createHash('sha256').update(str, 'utf8').digest(encoding);
}

function buildRequest(body) {
  const endpointParts = endpoint.match(/^([^\.]+)\.?([^\.]*)\.?([^\.]*)\.amazonaws\.com$/);
  const region = endpointParts[2];
  const service = endpointParts[3];
  const datetime = (new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.substr(0, 8);
  const kDate = hmac(`AWS4${process.env.AWS_SECRET_ACCESS_KEY}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');

  const request = {
    host: endpoint,
    method: 'POST',
    path: '/_bulk',
    body,
    headers: {
      'Content-Type': 'application/json',
      Host: endpoint,
      'Content-Length': Buffer.byteLength(body),
      'X-Amz-Security-Token': process.env.AWS_SESSION_TOKEN,
      'X-Amz-Date': datetime
    }
  };

  const canonicalHeaders = Object.keys(request.headers)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map(k => `${k.toLowerCase()}:${request.headers[k]}`)
    .join('\n');

  const signedHeaders = Object.keys(request.headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(';');

  const canonicalString = [
    request.method,
    request.path, '',
    canonicalHeaders, '',
    signedHeaders,
    hash(request.body, 'hex'),
  ].join('\n');

  const credentialString = [date, region, service, 'aws4_request'].join('/');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialString,
    hash(canonicalString, 'hex')
  ].join('\n');

  request.headers.Authorization = [
    `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${credentialString}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${hmac(kSigning, stringToSign, 'hex')}`
  ].join(', ');

  return request;
}

function post(body, callback) {
  const requestParams = buildRequest(body);

  const request = https.request(requestParams, (response) => {
    let responseBody = '';
    response.on('data', (chunk) => {
      responseBody += chunk;
    });
    response.on('end', () => {
      const info = JSON.parse(responseBody);
      let failedItems;
      let success;

      if (response.statusCode >= 200 && response.statusCode < 299) {
        failedItems = info.items.filter(x => x.index.status >= 300);

        success = {
          attemptedItems: info.items.length,
          successfulItems: info.items.length - failedItems.length,
          failedItems: failedItems.length
        };
      }

      const error = response.statusCode !== 200 || info.errors === true ? {
        statusCode: response.statusCode,
        responseBody
      } : null;

      callback(error, success, response.statusCode, failedItems);
    });
  }).on('error', (e) => {
    callback(e);
  });
  request.end(requestParams.body);
}

exports.handler = function (input, context) {
  // decode input from base64
  const zippedInput = new Buffer(input.awslogs.data, 'base64');

  // decompress the input
  zlib.gunzip(zippedInput, (err, buffer) => {
    if (err) { context.fail(err); return; }

    // parse the input from JSON
    const awslogsData = JSON.parse(buffer.toString('utf8'));

    // transform the input to Elasticsearch documents
    const elasticsearchBulkData = transform(awslogsData);

    // skip control messages
    if (!elasticsearchBulkData) {
      console.log('Received a control message');
      context.succeed('Control message handled successfully');
      return;
    }

    // post documents to the Amazon Elasticsearch Service
    post(elasticsearchBulkData, (error, success, statusCode, failedItems) => {
      console.log(`Response: ${JSON.stringify({
        statusCode
      })}`);

      if (error) {
        console.log(`Error: ${JSON.stringify(error, null, 2)}`);

        if (failedItems && failedItems.length > 0) {
          console.log(`Failed Items: ${
            JSON.stringify(failedItems, null, 2)}`);
        }

        context.fail(JSON.stringify(error));
      } else {
        console.log(`Success: ${JSON.stringify(success)}`);
        context.succeed('Success');
      }
    });
  });
};
