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

var Parser = require("language").Parser;
var parser = new Parser(fs.readFileSync(__dirname+"/index.language", "utf8"));
var query = require("../../classes/query");

function condense(x) {
	if("string" === typeof x) return x;
	function nulls(x) { return null !== x; }
	function all() { return x.children.map(condense).filter(nulls); }
	function one() { return condense(x.children[0]); }
	function any() { var x = all(); if(!x.length) return null; return 1 === x.length ? x[0] : x; }
	switch(x.name) {
		case "Elements": return all();
		case "Term": return all().join("");
		case "List": return all().slice(1, -1);
		case "WhiteSpace": return null;
		default: return any();
	}
}
function translate(x) {
	if(!Array.isArray(x)) return new query.Term(x);
	var operator = x.shift();
	switch(operator) {
		case "*": return new query.Intersection(x.map(translate));
		case "+": return new query.Union(x.map(translate));
		case "-": return new query.Negative(translate(x[0]));
		default: throw new Error("Invalid operator: "+operator);
	}
}

exports.supports = function(language) {
	return "lispish" === language;
};
exports.parse = function(str, callback/* (err, query) */) {
	var ast = condense(parser.parse(str));
	if(ast) ast.unshift("*");
	callback(null, translate(ast));
};
