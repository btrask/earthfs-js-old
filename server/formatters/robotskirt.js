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
var util = require("util");
var rs = require("robotskirt");
var bt = require("../utilities/bt");

var renderer = new rs.HtmlRenderer([
	rs.HTML_HARD_WRAP,
	rs.HTML_ESCAPE,
	rs.HTML_EXPAND_TABS,
]);
var parser = new rs.Markdown(renderer, [
	rs.EXT_FENCED_CODE,
	rs.EXT_NO_INTRA_EMPHASIS,
	rs.EXT_FENCED_CODE,
	rs.EXT_AUTOLINK
]);

exports.acceptsType = function(type) {
	return "text/markdown" === type;
};
exports.format = function(srcPath, srcType, dstPath, callback) {
	fs.readFile(srcPath, "utf8", function(err, str) {
		if(err) return callback(err);
		var parsed = parser.render(str);
		fs.writeFile(dstPath, parsed, "utf8", function(err) {
			callback(err);
		});
	});
};
