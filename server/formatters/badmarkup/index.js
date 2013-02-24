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
var cp = require("child_process");
var fs = require("fs");
var bt = require("../../utilities/bt");

exports.negotiateTypes = function(srcType, dstTypes) {
	if(!bt.negotiateTypes([srcType], ["text/x-bad-markup"])) return null;
	return bt.negotiateTypes(dstTypes, ["text/html"]);
};
exports.format = function(srcPath, srcType, dstPath, dstType, callback/* (err) */) {
	// TODO: Use some sort of pool, possibly shared with other formatters.
	// Right now, we use as many Node instances simultaneously as needed, at 10MB of RAM a piece.
	var task = cp.fork(__dirname+"/worker.js", [srcPath, dstPath]);
	task.on("exit", function(status) {
		callback(status ? new Error(status) : null);
	});
};
