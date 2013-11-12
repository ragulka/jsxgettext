var parser = require('esprima'),
    estraverse = require('estraverse'),
    _ = require('lodash');

/**
 * Scan Javascript sources and add it's translatable strings to translation table
 *
 * @param {Object} sources
 * @param {Object} table Translation table
 * @param {Object} options
 */

module.exports = function (sources, table, options) {
  var msgs = table.translations;
  
  Object.keys(sources).forEach(function (filename) {

    var source = sources[filename].replace(/^#.*/, ''); // strip leading hash-bang
    var tree = parser.parse(source, {
      comment: true,
      tokens: true,
      loc: true,
      range: true
    });
    
    tree = estraverse.attachComments( tree, tree.comments, tree.tokens );

    // Traverse the tree and scan for keywords
    estraverse.traverse(tree, {
      cursor: 0,
      enter: function (node, parent) {
        if (checkExpr(node, options.keyword)) {

          var key = extractStr(node.arguments[0]),
              context = "",
              line = node.loc.start.line;

          var message = {
            msgctxt: context,
            msgid: key,
            msgstr: ""
          };

          var referenceComments = [],
              translatorComments = [];

          // Get already existing data
          if (msgs[context][key]) {
            // Get existing reference and translator comments
            // and prepend them to the beginning of the respective array
            if (msgs[context][key].comments && msgs[context][key].comments.reference ) {
              referenceComments = msgs[context][key].comments.reference.split(' ');
            }
            if (msgs[context][key].comments && msgs[context][key].comments.translator )
              translatorComments = msgs[context][key].comments.translator.split('\n');

            // Merge existing translation data with the message
            message = _.merge( message, msgs[context][key] );
          }              

          // Extract comments
          if (options['add-comments'] && parent && parent.leadingComments) {
            parent.leadingComments.forEach( function (comment) {
              var commentValue;

              if (options['add-comments'].length > 0 && ~comment.value.indexOf(options['add-comments'])) {
                commentValue = comment.value.substring(1).trim();
              } else if( typeof options['add-comments'] === 'boolean' && options['add-comments'] === true ) {
                commentValue = comment.value.trim();
              }

              if (commentValue && !~translatorComments.indexOf(commentValue)) {
                translatorComments.push( commentValue );
              }
            });
          }

          // Add the reference to the current location
          var reference = filename + ':' + line;
          if (!~referenceComments.indexOf(reference)) {
            referenceComments.push(reference);
          }

          // Attach comments
          if (!message.comments) {
            message.comments = {};
          }

          message.comments.reference = referenceComments.join(' ');
          
          if (!_.isEmpty(translatorComments)) {
            message.comments.translator = translatorComments.join('\n');
          }

          msgs[context][key] = message;

        }
      }
    });

    function lineFromRange (range) {
      return source.slice(0, range[1]).split('\n').length;
    }

  });

  return table;
}


/**
 * Check if a node is a string literal
 */

function isStringLiteral(node) {
  return node.type === 'Literal' && (typeof node.value === 'string');
}


/**
 * Check if a node is a string concatenation expression
 */

function isStrConcatExpr(node) {
  var left = node.left,
      right = node.right;

  return node.type === "BinaryExpression" && node.operator === '+' && (
      (isStringLiteral(left) || isStrConcatExpr(left)) &&
      (isStringLiteral(right) || isStrConcatExpr(right))
  );
}


/**
 * Check if a node matches the keyword
 */

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


/**
 * Extract a node value
 * Assumes node is either a string literal or a strConcatExpression
 */

function extractStr(node) {
  if (isStringLiteral(node))
    return node.value;
  else
    return extractStr(node.left) + extractStr(node.right);
}