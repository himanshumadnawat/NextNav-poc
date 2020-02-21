'use strict';

/*
Lambda Code for DDB Get & Post Methods
 */

module.exports.post = async (event, context, callback) => {
    const response = {
        statusCode: 200,
        body: JSON.stringify(event),
    };
    return callback(response);
};
module.exports.get = async (event, context, callback) => {
    const response = {
        statusCode: 200,
        body: JSON.stringify(event),
    };
    return callback(response);
};
