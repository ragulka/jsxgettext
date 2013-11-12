var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

// Tests the --join-existing feature

/*
 * We use xgettext on files under inputs and save it's output
 * under fixtures. These tests run jsxgettext against the
 * same inputs and test for identical output.
 */

var sourceFirstPass;

module.exports["Join existing"] = {
    setUp: function(callback){
        this.po1 = fs.readFileSync(__dirname + "/fixtures/pot/messages-firstpass.pot", "utf8");
        this.source1 = fs.readFileSync(__dirname + "/fixtures/javascript/first.js", "utf8");

        this.po2 = fs.readFileSync(__dirname + "/fixtures/pot/messages-secondpass.pot", "utf8");
        this.source2 = fs.readFileSync(__dirname + "/fixtures/javascript/second.js", "utf8");
        callback();
    },

    first: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/first.js' : this.source1
        });
        test.isEqualToPO(result, this.po1);

        fs.writeFileSync(__dirname + '/fixtures/pot/_messages.pot', result, "utf8");
        test.done();
    },

    second: function(test) {
        var result = jsxgettext.extract({
          'fixtures/javascript/first.js' : this.source1,
          'fixtures/javascript/second.js' : this.source2
        }, { 'join-existing': true, 'output': __dirname + '/fixtures/pot/_messages.pot' });
        
        test.isEqualToPO(result, this.po2);

        fs.unlinkSync(__dirname + '/fixtures/pot/_messages.pot', result, "utf8");
        test.done();
    }
}