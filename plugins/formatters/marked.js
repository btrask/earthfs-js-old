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
var marked = require("marked");

marked.setOptions({
	gfm: true,
	breaks: true,
	sanitize: true,
});

exports.acceptsType = function(type) {
	var x = type.toLowerCase();
	return (
		"text/markdown" === x ||
		"text/markdown; charset=utf-8" === x
	);
};
exports.format = function(stream, type, dir, prefix, callback/* (err) */) {
	var str = "";
	stream.setEncoding("utf8");
	stream.on("readable", function() {
		str += stream.read();
	});
	stream.on("error", function(err) {
		callback(err);
	});
	stream.on("end", function() {
		fs.writeFile(dir+"/index.html", marked(str), {encoding: "utf8"}, function(err) {
			callback(err);
		});
	});
};

