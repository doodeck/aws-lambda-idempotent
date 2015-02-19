// payload.js

exports.handler = function() {
  console.log('payload: ', new Date().toString());
  var index = 0;
  setInterval(function() {
    console.log('index: ', index++);
  }, (3 * 100));
}