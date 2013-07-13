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
var bt = require("../utilities/bt");

var SRC_TYPES = {
	"image/jpeg": true,
	"image/jpg": true,
	"image/png": true,
	"image/gif": true,
};

exports.acceptsType = function(type) {
	return bt.has(SRC_TYPES, type);
};
exports.format = function(srcPath, srcType, dstPath, callback) {
	fs.readFile(srcPath, "base64", function(err, buffer) {
		if(err) return callback(err);
		var html = "<img src=\"data:"+srcType+";base64,"+buffer+"\">";
		// TODO: This isn't optimal, but it makes sense for a couple reasons:
		// 1. We get the path but not the URI, so we don't know how to access the image
		// 2. If a formatter wants to use custom resources, it can't host them itself
		fs.writeFile(dstPath, html, "utf8", function(err) {
			callback(err);
		});
	});
};
