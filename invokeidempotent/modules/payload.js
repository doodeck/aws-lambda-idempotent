// payload.js

exports.handler = function() {
  var startingMoment = +new Date();
  console.log('payload: ', new Date(startingMoment).toString());
  var index = 0;
  /*
  This is very special payload, see the project:
  https://github.com/doodeck/life-after-life
  to understand the consequences
  setInterval(function() {
    var delta = +new Date() - startingMoment;
    console.log('index: ', index++, new Date(delta).toString());
  }, (10 * 100));
  */
}