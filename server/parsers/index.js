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

function fallback(path, type, callback/* (err, links) */) {
	var stream = fs.createReadStream(path);
	var last = "";
	var links = [];
	stream.setEncoding("utf8");
	stream.on("data", function(chunk) {
			// <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
			var exp = /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
			var x;
			chunk = last + chunk;
			while((x = exp.exec(chunk))) links.push(x[0]);
			last = chunk.slice(exp.lastIndex);
	});
	stream.on("end", function() {
		callback(null, links);
	});
	stream.on("error", function(err) {
		callback(err, null);
	});
}

exports.parse = function(path, type, callback/* (err, links) */) {
	if("text/" !== type.slice(0, 5)) return callback(null, []); // TODO: Handle parsers for specific MIME types.
	fallback(path, type, callback);
};
