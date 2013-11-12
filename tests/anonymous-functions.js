var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

module.exports["Extracting from anonymous functions and method calls"] = {
    setUp: function(callback){
        this.po = fs.readFileSync(__dirname + "/fixtures/pot/anonymous-functions.pot", "utf8");
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/anonymous-functions.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/anonymous-functions.js' : this.source
        });
        test.isEqualToPO(result, this.po);
        test.done();
    }
}