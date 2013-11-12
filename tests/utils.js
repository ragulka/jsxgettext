var assert = require('nodeunit').assert;

assert.isEqualToPO = function (result, expected) {
  // Ignore the header
  result = result.slice(result.indexOf('\n\n') + 2);

  assert.equal(result.trim(), expected.trim(), 'Results match.');
};