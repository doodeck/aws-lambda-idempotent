// payload.js

exports.handler = function() {
  var startingMoment = +new Date();
  console.log('payload: ', new Date(startingMoment).toString());
  var index = 0;
  setInterval(function() {
    var delta = +new Date() - startingMoment;
    console.log('index: ', index++, new Date(delta).toString());
  }, (10 * 100));
}