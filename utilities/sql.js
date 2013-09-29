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
var sql = exports;
var EventEmitter = require("events").EventEmitter;

sql.debug = function query(db, str, args, cb) {
	db.query(str, args, function(err, result) {
		if(err) {
			err.query = str;
			err.args = args;
		}
		cb(err, result);
	});
};
sql.debug2 = function(db, str, args) {
	var a = db.query(str, args);
	var b = new EventEmitter;
	a.on("error", function(err) {
		err.query = str;
		err.args = args;
		b.emit("error", err);
	});
	a.on("row", function(row) {
		b.emit("row", row);
	});
	a.on("end", function() {
		b.emit("end");
	});
	return b;
};
sql.list1D = function(a, offset, asRows) {
	var r = [];
	for(var i = offset; i < offset+a.length; ++i) r.push(asRows ? "($"+i+")" :"$"+i);
	return r.join(",");
};
sql.list2D = function(a, offset) {
	var r1 = [], r2, x = offset;
	for(var i = 0; i < a.length; ++i) {
		r2 = [];
		if(Array.isArray(a[i])) {
			for(var j = 0; j < a[i].length; ++j, ++x) r2.push("$"+x);
		} else {
			r2.push("$"+(x++));
		}
		r1.push("("+r2.join(", ")+")");
	}
	return r1.join(",");
};
sql.flatten = function(array) {
	var r = [];
	for(var i = 0; i < array.length; ++i) {
		if(Array.isArray(array[i])) r.push.apply(r, array[i]);
		else r.push(array[i]);
	}
	return r;
};

