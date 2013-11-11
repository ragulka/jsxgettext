#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs   = require('fs');
const path = require('path');

const parser     = require('esprima');
const escodegen  = require('escodegen');
const estraverse = require('estraverse');
const jade       = require('jade');

const generate = escodegen.generate;
const traverse = estraverse.traverse;

const gettextParser = require('gettext-parser');

const _ = require('lodash');

function isStringLiteral(node) {
  return node.type === 'Literal' && (typeof node.value === 'string');
}

function isStrConcatExpr(node) {
  var left = node.left;
  var right = node.right;

  return node.type === "BinaryExpression" && node.operator === '+' && (
      (isStringLiteral(left) || isStrConcatExpr(left)) &&
      (isStringLiteral(right) || isStrConcatExpr(right))
  );
}

function checkExpr(node, keyword) {
  var firstArg = node.arguments && node.arguments[0];
  return (node.type === "CallExpression" &&   // must be a call expression
            (
              node.callee.name &&  // Should not be an anonymous function call
              (node.callee.name === 'gettext' ||            // with a gettext call expr
              (node.callee.name === keyword))               // or keyword call expr
              ||
              (node.callee.type === 'MemberExpression' &&   // or a member expr
              (node.callee.property.name === 'gettext' ||
               node.callee.property.name === keyword))
            )
            &&
            firstArg && (isStrConcatExpr(firstArg) || isStringLiteral(firstArg))
  );
}

// Assumes node is either a string Literal or a strConcatExpression
function extractStr(node) {
  if (isStringLiteral(node))
    return node.value;
  else
    return extractStr(node.left) + extractStr(node.right);
}


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
 * Extract gettext strings from JS source and return PO data string
 *
 * Parses the source javascript files and traverses the AST to find
 * function calls matching the keyword. Found keywords are put into a
 * translation table, which in turn is used by gettex-parser to compile
 * it to PO data.
 */

function parseJS (sources, headers, messages, options) {
  Object.keys(sources).forEach(function (filename) {
    var source = sources[filename].replace(/^#.*/, ''); // strip leading hash-bang
    var ast    = parser.parse(source, {comment: true, tokens: true, loc: true, range: true, tokens: true, raw: false});
    
    ast = estraverse.attachComments( ast, ast.comments, ast.tokens );

    traverse(ast, {
      cursor: 0,
      enter: function (node, parent) {
        if (checkExpr(node, options.keyword)) {

          var key = extractStr(node.arguments[0]),
              line = node.loc.start.line;

          var message = {
            msgid: key,
            msgstr: ""
          };

          var referenceComments = [filename + ':' + line],
              translatorComments = [];

          // Extract comments
          if (options['add-comments'] && parent && parent.leadingComments) {
            parent.leadingComments.forEach( function (comment) {
              if (options['add-comments'].length > 0 && ~comment.value.indexOf(options['add-comments'])) {
                translatorComments.push(comment.value.substring(1).trim());
              } else if( typeof options['add-comments'] === 'boolean' && options['add-comments'] === true ) {
                translatorComments.push(comment.value.trim());
              }
            });
          }

          if (messages[key]) {
            // Get existing reference and translator comments
            // and prepend them to the beginning of the respective array
            if (messages[key].comments && messages[key].comments.reference )
              referenceComments.unshift( messages[key].comments.reference.split(' ') );
            if (messages[key].comments && messages[key].comments.translator )
              translatorComments.unshift( messages[key].comments.translator.split('\n') );

            // Merge existing translation data with the message
            message = _.merge( message, messages[key] );
          }

          // Attach comments
          if (!message.comments) {
            message.comments = {};
          }

          message.comments.reference = referenceComments.join(' ');
          
          if (!_.isEmpty(translatorComments)) {
            message.comments.translator = translatorComments.join('\n');
          }

          messages[key] = message;

        }
      }
    });

    function lineFromRange (range) {
      return source.slice(0, range[1]).split('\n').length;
    }

  });

  return { headers: headers, messages: messages };
}

/**
 * Extract gettext messages from sources
 */

function extract (sources, options) {
  var messages = {},
      headers = {};
  
  // Load existing messages from PO file, if required
  if (options['join-existing']) { 
    var buffer = fs.readFileSync( path.resolve(path.join(options['output-dir'] || '', options.output))),
        existing = gettextParser.po.parse(buffer);
    
    messages = existing.translations;
    headers = existing.headers;
  }

  // Load default headers
  headers = _.defaults(headers, {
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
  var result = parseJS(sources, headers, messages, options);

  // Return the compiled PO result
  return compile( result.headers, result.messages, options );
}


/**
 * Compile headers and messages to PO data
 */

function compile (headers, messages, options) {
  
  // Sort messages, if required
  var keys = Object.keys(messages);
  if (options.sort) keys.sort();

  var sortedMessages = keys.map(function (key) {
    return messages[key];
  });

  // Generate header comments, if they do not exist yet.
  if (!sortedMessages['']) {
    sortedMessages[''] = {
      comments: {
        translator: "SOME DESCRIPTIVE TITLE.\nCopyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER\nThis file is distributed under the same license as the PACKAGE package.\nFIRST AUTHOR <EMAIL@ADDRESS>, YEAR."
      }
    }
  }

  // Compile translation table to PO data buffer
  var result = gettextParser.po.compile({
    charset: 'utf-8',
    headers: headers,
    translations: { '': sortedMessages }
  });

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
