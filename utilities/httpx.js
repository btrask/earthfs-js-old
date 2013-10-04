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
var http = require("http");
var pathModule = require("path");
var fs = require("fs");

var has = require("./has");
var mime = require("./mime.json");

var stitchstack = require("stitchstack");

http.ServerResponse.prototype.sendMessage = function(status, message) {
	var res = this;
	var body = new Buffer(message, "utf8");
	res.writeHead(status, message, {
		"content-type": "text/plain; charset=utf-8",
		"content-length": body.length,
	});
	res.end(body);
};
http.ServerResponse.prototype.sendError = function(err) {
	var res = this;
	console.log(stitchstack(err).stack);
	if(has(err, "httpStatusCode")) {
		return res.sendMessage(err.httpStatusCode, http.STATUS_CODES[err.httpStatusCode]);
	}
	switch(err.code) {
		case "ENOENT": return res.sendMessage(404, "Not Found");
		default:
			throw err;
//			console.log(err, (new Error()).stack);
//			return res.sendMessage(500, "Internal Server Error");
	}
};
http.ServerResponse.prototype.sendJSON = function(status, message, obj) {
	var res = this;
	var body = new Buffer(JSON.stringify(obj) || "", "utf8");
	res.writeHead(status, message, {
		"content-type": "text/json; charset=utf-8",
		"content-length": body.length,
	});
	res.end(body);
};
http.ServerResponse.prototype.sendFile = function(path, compressed) {
	var res = this;
	var ext = pathModule.extname(path);
	var type = Object.prototype.hasOwnProperty.call(mime, ext) ? mime[ext] : "application/octet-stream";
	if("text/" === type.slice(0, 5)) type += "; charset=utf-8";
	function send(path, enc, failure/* (err) */) {
		fs.stat(path, function(err, stats) {
			if(err) return failure(err);
			res.writeHead(200, "OK", {
				"content-type": type,
				"content-length": stats.size,
				"content-encoding": enc,
			});
			fs.createReadStream(path).pipe(res);
		});
	}
	function sendCompressed() {
		send(path+".gz", "gzip", sendPlain);
	}
	function sendPlain() {
		send(path, "none", sendError);
	}
	function sendError(err) {
		res.sendError(err);
	}
	(false !== compressed ? sendCompressed : sendPlain)();
};

module.exports = http;
