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
var markdown = require("markdown").markdown;
var bt = require("../utilities/bt");

function fixTags(ast, tags) {
	var str, rx, x;
	for(var i = 1; i < ast.length; ++i) {
		str = ast[i];
		if(Array.isArray(str)) { fixTags(str, tags); continue; }
		if("string" !== typeof str) continue;
		while((x = /(^|[\s\(\)\[\]])#(([\w\d\-_]+:)?([\w\d\-_]{3,40}))\b/.exec(str))) {
			ast.splice(i++, 0, str.slice(0, x.index)+x[1]);
			ast.splice(i++, 0, ["a", {href: "?q="+x[4]}, "#"+x[2]]);
			str = str.slice(x.index+x[0].length);
			tags.push([(x[3]||":").slice(0, -1), x[4]]);
		}
		if(str.length) ast[i] = str;
		else ast.splice(i--, 1);
	}
}

exports.negotiateTypes = function(srcType, dstTypes) {
	if(!bt.negotiateTypes(["text/markdown"], [srcType])) return null;
	return bt.negotiateTypes(dstTypes, ["text/html"]);
};
exports.format = function(srcPath, srcType, dstPath, dstType, callback) {
	fs.readFile(srcPath, "utf8", function(err, str) {
		if(err) return callback(err, null);
		var ast = markdown.toHTMLTree(str), tags = [];
		fixTags(ast, tags);
		fs.writeFile(dstPath, markdown.renderJsonML(ast), "utf8", function(err) {
			if(err) return callback(err, null);
			callback(null, tags);
		});
	});
};
