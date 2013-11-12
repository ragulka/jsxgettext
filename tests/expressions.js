var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

module.exports["Different expression contexts for gettext"] = {
    setUp: function(callback){
        this.po = fs.readFileSync(__dirname + "/fixtures/pot/expressions.pot", "utf8");
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/expressions.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/expressions.js' : this.source
        });
        test.isEqualToPO(result, this.po);
        test.done();
    }
}

module.exports['Issue #25 - files with leading hash'] = {
    setUp: function(callback){
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/pizza.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/pizza.js' : this.source
        });
        test.equal(typeof result, 'string', 'result is a string');
        test.ok(result.length > 0, 'result is not empty');
        test.done();
    }
}


module.exports['Issue #10 - concatenated string'] = {
    setUp: function(callback){
        this.po = fs.readFileSync(__dirname + "/fixtures/pot/concat.pot", "utf8");
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/concat.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/concat.js' : this.source
        });
        test.isEqualToPO(result, this.po);
        test.done();
    }
}