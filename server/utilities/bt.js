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
var bt = exports;

bt.has = function(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
};
bt.negotiateTypes = function(a1, b1) { // TODO: Put this somewhere better. MIME module?
	var rx = /([\w*]+)\/([\w\d\-+*]+)/;
	var a2 = a1.map(function(x) { return rx.exec(x); });
	var b2 = b1.map(function(x) { return rx.exec(x); });
	for(var i = 0; i < b2.length; ++i) {
		for(var j = 0; j < a2.length; ++j) {
			if("*" === a2[j][1]) return b2[i][0];
			if(b2[i][1] !== a2[j][1]) continue;
			if("*" === a2[j][2]) return b2[i][0];
			if(b2[i][2] === a2[j][2]) return b2[i][0];
		}
	}
	return null;
};
bt.asyncLoop = function(func/* (next) */) {
	var called, finished;
	for(;;) {
		called = false;
		finished = false;
		func(function next() {
			called = true;
			if(finished) bt.asyncLoop(func);
		});
		finished = true;
		if(!called) break;
	}
};

Array.prototype.unique = function() {
	var r = [], l = this.length, x;
	for(var i = 0; i < l; ++i) {
		x = this[i];
		if(-1 === r.indexOf(x)) r.push(x);
	}
	return r;
};
