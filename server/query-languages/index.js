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
var query = require("../classes/query");

var disabled = {
};
var files = fs.readdirSync(__dirname).filter(function(name) {
	return !bt.has(disabled, name) && !name.match(/^index\.js$|^\./);
}).sort();
var modules = files.map(function(name) {
	var module = require(__dirname+"/"+name);
	module.path = __dirname+"/"+name;
	return module;
});
console.log("Query languages: "+files.join(", "));

exports.parse = function(str, language, callback/* (err, query) */) {
	for(var i = 0; i < modules.length; ++i) {
		if(!modules[i].supports(language)) continue;
		modules[i].parse(str, callback);
		return;
	}
	return callback(new Error("Invalid language"), null);
};
