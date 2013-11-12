var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

module.exports["Comments"] = {
    setUp: function(callback){
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/test.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/test.js' : this.source
        });

        test.equal(typeof result, 'string', 'result is a string');
        test.ok(result.length > 0, 'result is not empty');
        test.done();
    }
}