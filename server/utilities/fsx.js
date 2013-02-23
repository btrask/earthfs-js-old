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
var pathModule = require("path");

fs.mkdirRecursive = function(filename, callback/* (err) */) {
	fs.mkdir(filename, function(err) {
		if(!err || "EEXIST" === err.code) return callback(null);
		if("ENOENT" !== err.code) return callback(err);
		fs.mkdirRecursive(pathModule.dirname(filename), function(err) {
			if(err) return callback(err);
			fs.mkdir(filename, callback);
		});
	});
};
fs.rmRecursive = function(path, callback/* (err) */) {
	if("/" === path) return callback(new Error("Are you out of your mind?"));
	fs.readdir(path, function(err, files) {
		if(!err) {
			var remaining = files.length;
			for(var i = 0; i < files.length; ++i) {
				fs.rmRecursive(path+"/"+files[i], function(err) {
					if(err) {
						remaining = 0;
						callback(err);
						return;
					}
					if(!--remaining) fs.rmdir(path, callback);
				});
			}
		} else if("ENOTDIR" === err.code) {
			fs.unlink(path, callback);
		} else {
			callback(err);
		}
	});
};

module.exports = fs;
