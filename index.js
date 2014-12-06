console.log('Loading event');

// config.js
var config = {
    functionName: 'invokeIdempotent',
    region: 'eu-west-1',
    idmptTableName: 'LambdaLocks',
    timeout: 5000,
    restartInterval: 100, // after how many invocations should the restart be forced
    lambdaTimeout: 16 // default value of the handler
};

// createTable.js
/*
var json =
{
    "Table": {
        "AttributeDefinitions": [
            {
                "AttributeName": "FunctionName",
                "AttributeType": "S"
            },
            {
                "AttributeName": "InstanceId",
                "AttributeType": "S"
            }
        ],
        "ProvisionedThroughput": {
            "NumberOfDecreasesToday": 0,
            "WriteCapacityUnits": 1,
            "ReadCapacityUnits": 1
        },
        "TableSizeBytes": 0,
        "TableName": "LambdaLocks",
        "TableStatus": "ACTIVE",
        "KeySchema": [
            {
                "KeyType": "HASH",
                "AttributeName": "FunctionName"
            },
            {
                "KeyType": "RANGE",
                "AttributeName": "InstanceId"
            }
        ],
        "ItemCount": 0,
        "CreationDateTime": 1417377988.61
    }
}
*/

// lambdaIdempotent.js
var AWS = require('aws-sdk');
AWS.config.update({region: config.region});
// not needed, embedded in lambda execution role ... AWS.config.update({accessKeyId: 'akid', secretAccessKey: 'secret'});

var lambda = new AWS.Lambda({});
var dynamodb = new AWS.DynamoDB({});

// lambdaIdempotent.js
// idempotent replacement of AWS.Lambda().invokeAsync()
var lambdaIdempotent = function(params, callback) {
    try {
        dynamodb.updateItem({
            Key: { /* required */
                FunctionName: {
                    S: config.functionName
                },
                InstanceId: {
                    S: params.InstanceId
                }
            },
            TableName: config.idmptTableName,
            ConditionExpression: 'Seq = :es',
            UpdateExpression: 'SET Seq = Seq + :one',
            ExpressionAttributeValues: {
                ":es" : { N: params.ExpectedSeq.toString() },
                ":one" : { N: "1" }
            } // data.Item.Seq.N }}
        }, function(err, data) {
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
exports.invokeIdempotent = function(event, context) {
  // vanillaTest(event,context);
  setTimeout(function() {
    var params = {
      // FunctionName: config.functionName,
      InstanceId: event.InstanceId, // multiple instances of the same function can be running simultaneously in different groups
      ExpectedSeq: event.ExpectedSeq, // Seq value currently in the database. If function is unable to retrieve and increment that value the lamdba recursive invocation will not take place
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
  }, config.timeout);
};

vanillaTest = function(event,context) {
    console.log(JSON.stringify(event));
    context.done(null, 'Hello World');
};