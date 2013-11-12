var fs = require('fs'),
    jsxgettext = require('..');

module.exports["Quotes and newlines when folding msgid"] = {
    setUp: function(callback){
        this.source = fs.readFileSync(__dirname + "/fixtures/javascript/po-quotes.js", "utf8");
        callback();
    },

    extract: function(test){
        var result = jsxgettext.extract({
          'fixtures/javascript/po-quotes.js' : this.source
        });

        test.equal(typeof result, 'string', 'result is a string');
        test.ok(result.length > 0, 'result is not empty');

        // short line is escaped properly
        test.ok(result.indexOf('\nmsgid "Hello \\"World\\"\\n"\n')>=0, 'short line');
        
        // long folded line should also get escaped
        test.ok(result.indexOf('\n"This is a long string with \\"quotes\\", newlines \\n"\n" and such. The line should get folded"\n')>=0, 'long folded line');
        test.done();
    }
}
