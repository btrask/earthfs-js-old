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
var has = require("../../utilities/has");

var TYPES = {
	"image/png": "png",
	"image/jpg": "jpg",
	"image/jpeg": "jpg",
	"image/gif": "gif",
};

exports.acceptsType = function(type) {
	return has(TYPES, type);
};
exports.format = function(stream, type, dir, prefix, callback/* (err) */) {
//	stream.pipe(fs.createWriteStream(dir+"/image."+TYPES[type], {}));
	var bufs = [];
	stream.on("error", function(err) {
		callback(err);
	});
	stream.on("readable", function() {
		bufs.push(stream.read());
	});
	stream.on("end", function() {
		var buf = Buffer.concat(bufs).toString("base64")
		fs.writeFile(dir+"/index.html", imageHTML(type, buf), {encoding: "utf8"}, function(err) {
			callback(err);
		});
	});
};

// TODO: HACK. Gotta get sub-requests working instead of using data: URIs.
function imageHTML(type, buffer) {
	return "<!doctype html>\n<img src=\"data:"+type+";base64,"+buffer+"\">";
}

