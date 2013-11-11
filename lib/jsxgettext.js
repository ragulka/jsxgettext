#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs   = require('fs');
const path = require('path');


const escodegen  = require('escodegen');
const estraverse = require('estraverse');
const jade       = require('jade');

const generate = escodegen.generate;

const gettextParser = require('gettext-parser');

const _ = require('lodash');

var parseJS = require('./scanners/javascript');


/**
 * Get current timestap for PO(T) file
 */

function getPOTTimeStamp() {
  // The format for POT timestamps is `YYYY-MM-DD HH:mm+0000` where +0000 part is the timezone offset, such as +0200 for
  // GMT+2. This format is quite similar to ISO8601 format produced by toISOString. Therefore we work our way from that
  // base string instead of dealing with JavaScript's horrendous date utilities (and avoid depending on an external date
  // utils library such as moment.js just for this simple task).
  return new Date().toISOString().replace('T', ' ').replace(/:\d{2}.\d{3}Z/, '+0000');
}

/**
 * Extract gettext messages from sources
 */

function extract (sources, options) {
  
  // Construct translation table skeleton
  // The empty message on teh empty (default)
  // context is used to print comments before PO header
  var table = {
    charset: 'utf-8',
    headers: {},
    translations: {
      "": {
        "": {
          comments: {
            translator: "SOME DESCRIPTIVE TITLE.\n" +
                        "Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER\n" +
                        "This file is distributed under the same license as" +
                        "the PACKAGE package.\n" +
                        "FIRST AUTHOR <EMAIL@ADDRESS>, YEAR."
          }
        }      
      }
    }
  };
  
  // Load existing headers and translations from PO file, if required
  if (options['join-existing']) { 
    var buffer = fs.readFileSync( path.resolve(path.join(options['output-dir'] || '', options.output))),
        existing = gettextParser.po.parse(buffer);
    
    table.translations = existing.translations;
    table.headers = existing.headers;
  }

  // Load default headers
  table.headers = _.defaults(table.headers, {
    'project-id-version'        : 'PACKAGE VERSION',
    'report-msgid-bugs-to'      : '',
    'pot-creation-date'         : getPOTTimeStamp(),
    'po-revision-date'          : 'YEAR-MO-DA HO:MI+ZONE',
    'last-translator'           : 'FULL NAME <EMAIL@ADDRESS>',
    'language-team'             : 'LANGUAGE <LL@li.org>',
    'language'                  : '',
    'mime-version'              : '1.0',
    'content-type'              : 'text/plain; charset=UTF-8',
    'content-transfer-encoding' : '8bit'
  });


  // Parse JS source and get messages
  table = parseJS(sources, table, options);

  // Return the compiled PO result
  return compile(table, options);
}


/**
 * Compile translation table into PO format
 */

function compile (table, options) {

  // Sort translations, if required
  if (options.sort) {
    var contexts = Object.keys(table.translations),
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

    table.translations = sortedContextTranslations;
  }

  // Compile translation table into PO data buffer
  var result = gettextParser.po.compile(table);

  return result.toString();
}

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

exports.generate         = extract;
exports.generateFromEJS  = genEJS;
exports.generateFromJade = genJade;
exports.generateFromJinja = genJinja;
