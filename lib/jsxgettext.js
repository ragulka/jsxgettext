var fs   = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    gettextParser = require('gettext-parser');

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



module.exports = {
  extract: function(sources, options) {
    if (!this._xgt) {
      this._xgt = new XGT();
    }

    this._xgt.setSources(sources);
    this._xgt.setOptions(options);

    this._xgt.extract();
    return this._xgt.compile();
  },

  addScanner: function(scannerName, scanner) {
    if (!this._xgt) {
      this._xgt = new XGT();
    }
    this._xgt.addScanner(scannerName, scanner);
  }
}

/**
 * Creates a XGT object.
 *
 * @constructor
 * @param {Object} sources
 * @param {Object} options
 */

function XGT(sources, options) {
  this._initScanners();
}


XGT.prototype.setSources = function(sources) {
  this._sources = sources || {};
}


XGT.prototype.setOptions = function(options) {
  this._options = options || {};
  this._options = _.defaults(this._options, {
    'language': 'javascript',
    'add-location': true,
    'copyright-holder': "THE PACKAGE'S COPYRIGHT HOLDER",
    'package-name': 'PACKAGE',
    'package-version': 'VERSION',
    'msgid-bugs-address': ''
  });
}


/**
 * Extract gettext messages from sources
 */

XGT.prototype.extract = function() {
  this._initTable();

  if (this._options['join-existing'])
    this._loadExisting();

  this._drawHeaders();

  // Use the appropriate scanner to scan and extract messages
  if (!this._scanners[this._options.language])
    throw "Scanner for '" + this._options.language + "' is not defined!";

  this._table = this._scanners[this._options.language]( this._sources, this._table, this._options );

  // Sort translations, if required
  if (this._options['sort-output'])
    this._sortTranslations();

}


/**
 * Compile translation table into PO format
 */

XGT.prototype.compile = function() {

  // Compile translation table into PO data buffer
  var result = gettextParser.po.compile(this._table);

  return result.toString();
}


/**
 * Sort translatsions. First by context, then by msgid
 */

XGT.prototype._sortTranslations = function() {
  
  var table = this._table,
      contexts = Object.keys(table.translations),
      sortedContextTranslations = {};
  
  contexts.sort();

  contexts.forEach(function (context) {
    var keys = Object.keys(table.translations[context]),
        sortedTranslations = {};
    
    keys.sort();

    keys.forEach(function (key) {
      sortedTranslations[key] = table.translations[context][key];
    });

    sortedContextTranslations[context] = sortedTranslations;
  });

  this._table.translations = sortedContextTranslations; 
}


/**
 * Construct translation table skeleton
 *
 * Empty message on the empty (default)
 * context is used to print comments before PO header
 */

XGT.prototype._initTable = function() {
  this._table = {
    charset: 'utf-8',
    headers: {},
    translations: {
      "": {
        "": {
          comments: {
            translator: "SOME DESCRIPTIVE TITLE.\n" +
                        "Copyright (C) YEAR " + this._options['copyright-holder'] + "\n" +
                        "This file is distributed under the same license as" +
                        "the PACKAGE package.\n" +
                        "FIRST AUTHOR <EMAIL@ADDRESS>, YEAR."
          }
        }      
      }
    }
  };
}


/**
 * Load existing translations from a PO file
 *
 * Parses the target (output) po file for existing 
 * data and adds it to the translation table
 */

XGT.prototype._loadExisting = function() {
  var buffer = fs.readFileSync( path.resolve(path.join(this._options['output-dir'] || '', this._options.output))),
      existing = gettextParser.po.parse(buffer);
  
  this._table.translations = existing.translations;
  this._table.headers = existing.headers;
}


/**
 * Draw translation table headers
 *
 * Get header values from options or use defaults
 */

XGT.prototype._drawHeaders = function() {
  this._table.headers = _.defaults(this._table.headers, {
    'project-id-version'        : this._options['package-name'] + ' ' + this._options['package-version'],
    'report-msgid-bugs-to'      : this._options['msgid-bugs-address'],
    'pot-creation-date'         : this._getPOTTimeStamp(),
    'po-revision-date'          : 'YEAR-MO-DA HO:MI+ZONE',
    'last-translator'           : 'FULL NAME <EMAIL@ADDRESS>',
    'language-team'             : 'LANGUAGE <LL@li.org>',
    'language'                  : '',
    'mime-version'              : '1.0',
    'content-type'              : 'text/plain; charset=UTF-8',
    'content-transfer-encoding' : '8bit'
  });
}


/**
 * Get current timestap in suitable format for PO/POT
 */

XGT.prototype._getPOTTimeStamp = function() {
  // The format for POT timestamps is `YYYY-MM-DD HH:mm+0000` where +0000 part is the timezone offset, such as +0200 for
  // GMT+2. This format is quite similar to ISO8601 format produced by toISOString. Therefore we work our way from that
  // base string instead of dealing with JavaScript's horrendous date utilities (and avoid depending on an external date
  // utils library such as moment.js just for this simple task).
  return new Date().toISOString().replace('T', ' ').replace(/:\d{2}.\d{3}Z/, '+0000');
}


/**
 * Add a source scanner
 *
 * This method is an entry point for adding new scanners
 */

XGT.prototype.addScanner = function(scannerName, scanner) {

  if (this._scanners[scannerName]) {
      throw "Scanner '" + scannerName + "' is already defined!";
  }

  this._scanners[scannerName] = scanner;
}


/**
 * Load and attach built-in scanners
 */

XGT.prototype._initScanners = function() {
  var self = this;

  this._scanners = {};

  fs.readdirSync( path.join( __dirname, "scanners" ) ).forEach(function (fileName) {
    var scanner = require("./scanners/" + fileName);
    self.addScanner( path.basename( fileName, '.js' ) , scanner );
  });
}

const jade       = require('jade');






/**
 * Extract messages from EJS sources
 */
function genEJS (ejsSources, options) {
  Object.keys(ejsSources).forEach(function (filename) {
    ejsSources[filename] = parseEJS(ejsSources[filename]);
  });

  return extract(ejsSources, options);
}

/**
 * Extract messages from Jade sources
 */
function genJade (jadeSources, options) {
  Object.keys(jadeSources).forEach(function (filename) {
    jadeSources[filename] = parseJade(jadeSources[filename]);
  });
  return extract(jadeSources, options);
}

/**
 * Extract messages from Jinja2 sources
 */
function genJinja (jinjaSources, options) {
  Object.keys(jinjaSources).forEach(function (filename) {
      jinjaSources[filename] = parseEJS(jinjaSources[filename], {open: "{{", close: "}}"});
  });

  return extract(jinjaSources, options);
}


/**
 * Parse EJS into javascript source
 *
 * The resulting javascript source is handed to gen(), which in
 * turn parses it and extracts gettext messages.
 * Strips everything but the javascript bits
 */

function parseEJS (str, options){
  options = options || {};
  var open = options.open || '<%',
    close = options.close || '%>';

  var buf = [];
  var lineno = 1;

  for (var i = 0, len = str.length; i < len; ++i) {
    if (str.slice(i, open.length + i) == open) {
      i += open.length;
      switch (str.substr(i, 1)) {
        case '=':
        case '-':
          ++i;
          break;
      }

      var end = str.indexOf(close, i), js = str.substring(i, end), start = i, n = 0;
      if ('-' == js[js.length-1]){
        js = js.substring(0, js.length - 2);
      }
      while (~(n = js.indexOf("\n", n))) n++,buf.push("\n");
      // skip EJS include statements which are not valid javascript
      if (/^\s*include\s*[^\s]+\s*$/.test(js)) js = "";
      buf.push(js, ';');
      i += end - start + close.length - 1;

    } else if (str.substr(i, 1) == "\n") {
        buf.push("\n");
    }
  }

  return buf.join('');
}

function parseJade(str, options) {
  options = options || {};

  var buf = [];
  var lineno = 1;

  var parser = new jade.Parser(str);
  var lexer = parser.lexer;
  var token;

  function extractGettext(str) {
    if (typeof(str) !== 'string') return '';
    var tmp = str.match(/gettext\(\"[^"]+\"/ig) || [];
    tmp = tmp.concat(str.match(/gettext\(\'[^']+\'/ig) || [])
    return tmp.map(function(t) {
      return t + ')';
    }).join(';');
  }

  var buf = [], lineN;
  do {
    token = lexer.next();
    lineN = token.line - 1;
    switch(token.type) {
      case 'attrs':
        var tmp = [];
        Object.keys(token.attrs).forEach(function(key) {
          var r = extractGettext(token.attrs[key]);
          if (r.length) tmp.push(r);
        });
        if(tmp.length) buf[lineN] = tmp.join('') + ';';
        break;
      case 'text': 
      case 'code':
        tmp = extractGettext(token.val);
        if (tmp.length) buf[lineN] = tmp + ';';
        break;
    }
  } while(token.type != 'eos');

  return buf.join('\n');
}
