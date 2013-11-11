var fs = require('fs');

exports.compareResultWithFile = function (result, filePath, assert, cb, msg) {
  // Ignore the header
  result = result.slice(result.indexOf('\n\n') + 2);

  fs.readFile(filePath, function (err, source) {
    assert.equal(result.trim(), source.toString('utf8').trim(), msg || 'Results match.');
    cb();
  });
};
