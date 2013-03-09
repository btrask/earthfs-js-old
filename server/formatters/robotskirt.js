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

function inject(obj, props, func) {
	props.forEach(function(prop) {
		obj[prop+"__OLD"] = obj[prop];
		obj[prop] = function(text, arg2, arg3) {
			try {
				return obj[prop+"__OLD"](func.call(obj, text), arg2, arg3);
				// Can't use call() or apply() on these stupid fake "native" functions.
				// Functions like header() take a second argument (e.g. for header rank).
				// I don't think any take 3.
			} catch(e) {
				console.log(e, prop, arguments);
			}
		};
	});
}
function parseTags(text) {
	var renderer = this;
	return text.replace(
		/(^|[\s\(\)\[\]])#(([\w\d\-_]+:)?([\w\d\-_]{3,40}))\b/g,
		function(ignored, before, full, namespace, tag) {
			renderer.tags.push([(namespace||":").slice(0, -1), tag]);
			return before+"<a href=\"?q="+tag+"\">#"+full+"</a>";
		}
	);
}

var renderer = new rs.HtmlRenderer([
	rs.HTML_HARD_WRAP,
	rs.HTML_ESCAPE,
	rs.HTML_EXPAND_TABS,
]);

// You'd think normal_text would let us catch all of the text anywhere...
// And it does, but it breaks it into little pieces and gives us no context so we can't parse anything.
// For example the string "\\#asdf" gets split into "#" and "asdf".
inject(renderer, [
//	"blockcode",
	"blockquote",
//	"blockhtml",
	"header",
//	"hrule",
//	"list",
	"listitem",
	"paragraph",
//	"table",
//	"table_row",
	"table_cell",
//	"autolink",
//	"codespan",
	"double_emphasis",
	"emphasis",
//	"image",
//	"linebreak",
//	"link",
//	"raw_html_tag",
	"triple_emphasis",
	"strikethrough",
	"superscript",
//	"entity",
//	"normal_text",
//	"doc_header",
//	"doc_footer",
], parseTags);

var parser = new rs.Markdown(renderer, [
	rs.EXT_FENCED_CODE,
	rs.EXT_NO_INTRA_EMPHASIS,
	rs.EXT_FENCED_CODE,
	rs.EXT_AUTOLINK
]);

exports.negotiateTypes = function(srcType, dstTypes) {
	if(!bt.negotiateTypes(["text/markdown"], [srcType])) return null;
	return bt.negotiateTypes(dstTypes, ["text/html"]);
};
exports.format = function(srcPath, srcType, dstPath, dstType, callback) {
	fs.readFile(srcPath, "utf8", function(err, str) {
		if(err) return callback(err, null);
		renderer.tags = [];
		var parsed = parser.render(str);
		var tags = renderer.tags;
		renderer.tags = null;
		fs.writeFile(dstPath, parsed, "utf8", function(err) {
			if(err) return callback(err, null);
			callback(null, tags);
		});
	});
};
