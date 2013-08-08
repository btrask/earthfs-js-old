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
var bt = require("./bt");

exports.load = function(dir, label) {
	var disabled;
	try { disabled = require(dir+"/disabled.json"); }
	catch(e) { disabled = {}; }
	var files = fs.readdirSync(dir).filter(function(name) {
		if(/^\./.test(name)) return false;
		if("index.js" === name) return false;
		if("disabled.json" === name) return false;
		if(bt.has(disabled, name)) return false;
		return true;
	}).sort();
	if(label) console.log(label+": "+(files.join(", ") || "(none)"));
	return files.map(function(name) {
		var module = require(dir+"/"+name);
		module.path = dir+"/"+name;
		return module;
	});
};
