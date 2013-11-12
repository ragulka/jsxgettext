var fs = require('fs'),
    jsxgettext = require('..');

module.exports["Files with leading hash (executable node files)"] = {
    setUp: function(callback){
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/hash.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/hash.js' : this.source
        });

        test.equal(typeof result, 'string', 'result is a string');
        test.ok(result.length > 0, 'result is not empty');
        test.done();
    }
}