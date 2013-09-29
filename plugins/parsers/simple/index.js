/* Copyright Ben Trask and other contributors. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE. */
var fs = require("fs");
var PEG = require("pegjs");
var parser = PEG.buildParser(fs.readFileSync(__dirname+"/parser.pegjs", "utf8"));
var AST = require("../../../classes/AST");

exports.acceptsLanguage = function(language) {
	return "simple" === language;
};
exports.parseQueryString = function(queryString, language, callback/* (err, AST) */) {
	setImmediate(function() {
		callback(null, translate(parser.parse(queryString)));
	});
};

function translate(x) {
	if("string" === typeof x) return x;
	if(Array.isArray(x)) return x.map(translate);
	return newApply(AST[x.type], translate(x.args));
}
function newApply(Class, args) {
	// http://stackoverflow.com/a/8843181
	// Use of .apply() with 'new' operator. Is this possible?
	return new (Function.prototype.bind.apply(Class, [null].concat(args)));
}

