var fs = require('fs'),
    jsxgettext = require('..'),
    utils = require('./utils');

module.exports["Creation date"] = {
    test: function(test){
        var result = jsxgettext.extract({
          'dummy.js' : ''
        });

        var header = result.slice(0, result.indexOf('\n\n')),
            timestamp = header.match(/POT-Creation-Date: (\d{4}-\d{2}-\d{2} \d{2}:\d{2}[+-]\d{4})/)[1];
        
        test.ok(timestamp.length > 0, 'Valid timestamp');
        test.ok(Date.now() - new Date(timestamp).valueOf() < 120000, 'Timestamp up-to-date');
        test.done();
    }
}