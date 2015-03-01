// config.js

'use strict';

exports.config = {
    functionName: 'invokeidempotent',
    region: 'eu-west-1',
    idmptTableName: 'LambdaLocks',
    timeout: 4000, // timeout before function is invoked and content really executed
    timeoutDev: 2000, // random deviation from the timeout (to eliminate multiple instances accidentally running in parallel)
    restartInterval: 200, // after how many invocations should the restart be forced
    lambdaTimeout: 16, // default value of the handler
    acceptRange: 2, // range of accepted values in DynamoDB, in other words: retry count,
                   // should help in case Dynamo is updated but then the function freezes and the framework starts it again
    initialExpectedSeq: 1, // initial ExpectedSeq for cases when the DynamoDB item is to be created
    payloadModule: './modules/payload'
};
