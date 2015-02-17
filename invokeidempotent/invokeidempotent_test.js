// invokeidempotent_test.js
/*
This dummy Lambda "execution environment" is very handy
 in finding the syntactic error, which otherwise are usually
 not reported by the actual framework.
 */
var invokeidempotent = require('./invokeidempotent');

var event = {
  // "rmIds": [ "519", 520 ] obsolete
    "InstanceId": "666",
    "ExpectedSeq": 1
};

var context = {
  done: function() {
    console.log('context.done called: ', JSON.stringify(arguments));
  }
}
invokeidempotent.handler(event, context);
