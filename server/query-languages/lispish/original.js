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
var p = require("../../utilities/bad-parser");
var q = require("../../classes/query.js");

// This custom parsing system is broken because it doesn't handle recursive
// definitions. See the use of `enum` in `list` below.
// I switched to Tolmasky's Language.js, but it's a lot harder to use
// because it doesn't let you define the transformations in-line.
// Maybe we should go back to OMeta.

var whitespace = p.define("whitespace", p.star(p.charset(" \n\r\t\v　")));
var token = p.define("token", p.replace(p.token(" \n\r\t\v　()"), function(x) {
	return new q.TagQuery(x);
}));
var list = p.define("list", p.replace(
	p.flatten(p.all(p.skip("("), p.plus(elem), p.skip(")"))),
	function(x) {
		switch(x[0]) {
			case "+": return new q.UnionQuery(x.slice(1));
			case "-": return new q.DifferenceQuery(x.slice(1));
			case "*": return new q.IntersectionQuery(x.slice(1));
			default: throw new Error("Invalid function: "+x[0]);
		}
	}
));
var elem = p.define("elem", p.flatten(p.all(
	p.ignore(whitespace),
	p.any(token, list)
)));
var lispish = p.define("lispy", p.replace(
	p.flatten(p.all(p.plus(elem))),
	function(x) {
		return new q.IntersectionQuery(x);
	}
));

exports.supports = function(language) {
	return "lispish" === language;
};
exports.parse = function(str, callback/* (err, query) */) {
	return p.run(lispish, str);
};
