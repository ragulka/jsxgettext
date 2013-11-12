var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

module.exports["Sort output"] = {
    setUp: function(callback){
        this.po = fs.readFileSync(__dirname + "/fixtures/pot/sorted.pot", "utf8");
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/sorted.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/sorted.js' : this.source
        }, { 'sort-output': true });

        test.isEqualToPO(result, this.po);
        test.done();
    }
}