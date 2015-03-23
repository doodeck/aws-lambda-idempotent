// invokeidempotent.js

'use strict';

console.log('Loading event');

var config = require('./config').config;
// lambdaIdempotent.js
var AWS = require('aws-sdk');
AWS.config.update({region: config.region});
// not needed, embedded in lambda execution role ... AWS.config.update({accessKeyId: 'akid', secretAccessKey: 'secret'});
var payload = require(config.payloadModule);

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

// retrieve params for lambdaIdempotent either from event/context or my creating a new DynamoDB entry
var getParams = function(event, context, callback) {
  var params = {
    InvokeId: context.invokeid
  };
  if (!!event.InstanceId && !!event.ExpectedSeq) {
    params.InstanceId = event.InstanceId;
    params.ExpectedSeq = event.ExpectedSeq;
    callback(undefined /*err*/, params);
  } else {
    params.InstanceId = context.invokeid; // initialize it to unique value, not necessaily invokeid
    params.ExpectedSeq = config.initialExpectedSeq;

    // create the new item in the DB
    try {
        var item = {
          Item: { /* required */
            FunctionName: {
              S: config.functionName.toString()
            },
            InstanceId: {
              S: params.InstanceId.toString()
            },
            InvokeId: {
              S: params.InvokeId.toString()
            },
            Seq: {
              N: params.ExpectedSeq.toString()
            }
          },
          TableName: config.idmptTableName
        };
        console.log('putItem item: ', item);
        dynamodb.putItem(item, function(err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            callback(err, {});
          } else {
            callback(undefined, params);
          }
        });
    } catch(e) {
        console.log('putItem exception: ', e);
        callback(e, {});
    }
  }
}

// invokeIdempotent.js
var vanillaTest;

/* invocation event:
Now it's possible to invoke the function in two ways:
1. With the InstanceId/ExpectedSeq set like here:
{
    "InstanceId": "<instance_id_aka_groups_id>",
    "ExpectedSeq": <expected_seq>
}
 Then you must manually create a corresponding DynamoDB entry with matching values. Or
 2. Without the above field, e.g. with {} as a parameter. Then the corresponding DynamoDB entry is created
    automatically. Sure, you can create multiple function instances in this way, but you will easily notice it
    by scanning through the LambdaLocks table.
*/
exports.handler = function(event, context) {
  // vanillaTest(event,context);
  var randomizedTimeout = Math.floor((Math.random() * config.timeoutDev) + config.timeout);
  console.log('Using timeout: ', randomizedTimeout);
  setTimeout(function() {
    getParams(event, context, function(err, params) {
      console.log('gotParams: ', params);
      /*lambda.invokeAsync(params, function(err, data) {*/
      lambdaIdempotent(params, function(err, data) {
          if (err) {
              console.log('lambdaIdempotent failed: ', err);
              context.done(JSON.stringify(err), 'lambdaIdempotent failed: ' + params.InstanceId + ', ExpectedSeq: ' + params.ExpectedSeq.toString()); // ERROR!
          } else {
            var contextDoneWithRestart = function(event, context) {
              if (event.ExpectedSeq % config.restartInterval === 0)
                  forceRestart(function(err, data) {
                    context.done(null, 'Restarted InstanceId: ' + params.InstanceId + ', ExpectedSeq: ' + params.ExpectedSeq.toString());  // SUCCESS with message
                  });
              else
                  context.done(null, 'Exiting InstanceId: ' + params.InstanceId + ', ExpectedSeq: ' + params.ExpectedSeq.toString());  // SUCCESS with message
            }

            if (!!payload) {
              payload.handler(function(err, data) {
                if (err) {
                  console.log('payload.handler failed: ', err);
                }
                contextDoneWithRestart(event, context);
              });
            } else {
              contextDoneWithRestart(event, context);
            }
          }

      });
    });
  }, randomizedTimeout);
};

vanillaTest = function(event,context) {
    console.log(JSON.stringify(event));
    context.done(null, 'Hello World');
};
