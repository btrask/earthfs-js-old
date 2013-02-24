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
var bt = require("../../utilities/bt");

var ometajs = require("ometajs");
var markup = require("./markup.ometajs").markup;

var EXIT_SUCCESS = 0;
var EXIT_FAILURE = 1;

var srcPath = process.argv[2];
var dstPath = process.argv[3];

fs.readFile(srcPath, "utf8", function(err, str) {
	if(err) return process.exit(EXIT_FAILURE);
	fs.writeFile(dstPath, markup.matchAll(str, "content"), "utf8", function(err) {
		if(err) return process.exit(EXIT_FAILURE);
		process.exit(EXIT_SUCCESS);
	});
});
