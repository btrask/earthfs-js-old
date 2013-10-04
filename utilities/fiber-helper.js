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
var helper = exports;

var Fiber = require("fibers");
var Future = require("fibers/future");

helper.run = function(func, callback) {
	if("function" !== typeof callback) throw new Error("Bad callback arg "+callback);
	Fiber(function() {
		var val;
		try {
			val = func();
		} catch(err) {
			callback(err, null);
			return;
		}
		callback(null, val);
	}).run();
};
helper.wait = function(tasks) {
	Future.wait(tasks);
	var errors = [], error;
	var results = tasks.map(function(task) {
		try {
			return task.get();
		} catch(err) {
			// TODO: A little bit over-specific... But useful.
			var postgresAbortedTransaction = "25P02" === err.code;
			if(!postgresAbortedTransaction) errors.push(err);
		}
	});
	if(errors.length) throw errors[0]; // Other errors are ignored...
	return results;
	// TODO: It'd be nice if `Future.wait()` threw the first error encountered.
};

