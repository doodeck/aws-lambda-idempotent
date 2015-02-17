// invokeidempotent.js

'use strict';

console.log('Loading event');

var config = require('./config').config;
// lambdaIdempotent.js
var AWS = require('aws-sdk');
AWS.config.update({region: config.region});
// not needed, embedded in lambda execution role ... AWS.config.update({accessKeyId: 'akid', secretAccessKey: 'secret'});

var lambda = new AWS.Lambda({});
var dynamodb = new AWS.DynamoDB({});

// lambdaIdempotent.js
// idempotent replacement of AWS.Lambda().invokeAsync()
var lambdaIdempotent = function(params, callback) {
    console.log('config: ', config);
    try {
        var item = {
            Key: { /* required */
                FunctionName: {
                    S: config.functionName
                },
                InstanceId: {
                    S: params.InstanceId
                }
            },
            TableName: config.idmptTableName,
            ConditionExpression: 'Seq >= :es AND Seq < :rend',
            UpdateExpression: 'SET Seq = :es + :one, InvokeId = :invid',
            ExpressionAttributeValues: {
                ":es" : { N: params.ExpectedSeq.toString() },
                ":one" : { N: "1" },
                ":invid" : { S: params.InvokeId },
                ":rend" : { N: (params.ExpectedSeq + config.acceptRange).toString() }
            } // data.Item.Seq.N }}
        };
        console.log('update item: ', item);
        dynamodb.updateItem(item, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                callback(err, {});
            } else {
                var invokeSyncParams = {
                  FunctionName: config.functionName,
                  InvokeArgs: JSON.stringify({
                      InstanceId: params.InstanceId,
                      ExpectedSeq: params.ExpectedSeq + 1
                  })
                };
                console.log('Next gen: ', invokeSyncParams);           // successful response
                // params.ExpectedSeq++;
                lambda.invokeAsync(invokeSyncParams, function(err, data) {
                    console.log('lambda.invokeAsync: ', err, data);
                    callback(err, data);
                });
            }
        });
    } catch(e) {
        console.log('updateItem exception: ', e);
        callback(e, {});
    }
};

// perform an innocent function configuration change to prevent reusing the same runtime (memory leak workaround)
// for details see the following thread:
// https://forums.aws.amazon.com/message.jspa?messageID=587439
var forceRestart = function(callback) {
    var params = {
        FunctionName: config.functionName /* required */
    };
    lambda.getFunctionConfiguration(params, function(err, data) {
        if (err) {
            console.log(err, err.stack); // an error occurred
            callback(err, data);
        } else {
            // console.log(data);           // successful response
            var newTimeout = config.lambdaTimeout === data.Timeout ? config.lambdaTimeout + 1 : config.lambdaTimeout;
            var params = {
              FunctionName: config.functionName, /* required */
              Timeout: newTimeout
            };
            lambda.updateFunctionConfiguration(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack); // an error occurred
                    callback(err, data);
                } else {
                    console.log('Successfully updated timeout: ', data); // successful response
                    callback(err, data);
                }
            });
        }
    });
}

// invokeIdempotent.js
var vanillaTest;

/* invocation event:
{
    "InstanceId": "<instance_id_aka_groups_id>",
    "ExpectedSeq": <expected_seq>
}
*/
exports.handler = function(event, context) {
  // vanillaTest(event,context);
  var randomizedTimeout = Math.floor((Math.random() * config.timeoutDev) + config.timeout);
  console.log('Using timeout: ', randomizedTimeout);
  setTimeout(function() {
    var params = {
      // FunctionName: config.functionName,
      InstanceId: event.InstanceId, // multiple instances of the same function can be running simultaneously in different groups
      ExpectedSeq: event.ExpectedSeq, // Seq value currently in the database. If function is unable to retrieve and increment that value the lamdba recursive invocation will not take place
      InvokeId: context.invokeid
      // InvokeArgs: '{}'
    };

    console.log('On entry: ', params);
    /*lambda.invokeAsync(params, function(err, data) {*/
    lambdaIdempotent(params, function(err, data) {
        if (err) {
            console.log('lambdaIdempotent failed: ', err);
        }
        if (event.ExpectedSeq % config.restartInterval === 0)
            forceRestart(function(err, data) {
              context.done(null, 'Restarted InstanceId: ' + event.InstanceId + ', ExpectedSeq: ' + event.ExpectedSeq.toString());  // SUCCESS with message
            });
        else
            context.done(null, 'Exiting InstanceId: ' + event.InstanceId + ', ExpectedSeq: ' + event.ExpectedSeq.toString());  // SUCCESS with message
    });
  }, randomizedTimeout);
};

vanillaTest = function(event,context) {
    console.log(JSON.stringify(event));
    context.done(null, 'Hello World');
};
