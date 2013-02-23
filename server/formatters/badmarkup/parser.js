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
var parser = exports;
(function() {

var has = Object.prototype.hasOwnProperty;

function lineCount(str, i) {
	return str.slice(0, i+1).split(/\r\n|\r|\n/).length;
}
function repeat(str, count) {
	return new Array(count+1).join(str);
}
function err(val) {
	var a = [];
	var x = arguments.callee.caller;
	while(x && -1 === a.indexOf(x)) { a.push(x); x = x.caller; }
	return { stack: a.map(function(x) { return (x.label ? x.label+": " : "")+(x.code || x.name || "(func)")+(x.state || ""); }).join("\n"), i: val.i };
}
function toCode(func) {
	var f = arguments.callee.caller;
	var args = Array.isArray(f.arguments[0]) ? f.arguments[0] : f.arguments; // WTF?
	func.code = f.name+"("+Array.prototype.slice.call(args).map(function(arg) {
		if("string" === typeof arg) return JSON.stringify(arg);
		if("number" === typeof arg) return String(arg);
		if("function" === typeof arg) return arg.label || arg.code || arg.name || "[func]";
		return "___";
	}).join(", ")+")";
	return func;
}

parser.keep = function keep(str) {
	return toCode(function _keep(val) {
		var a = val.i, b = a+str.length;
		if(val.s.slice(a, b) !== str) throw err(val);
		val.i = b;
		return str;
	});
};
parser.skip = function skip(str) {
	return toCode(parser.ignore(parser.keep(str)));
};
parser.charset = function charset(str) {
	var l = str.length, set = Object.create(null);
	for(var i = 0; i < l; ++i) set[str[i]] = 1;
	return toCode(function _charset(val) {
		var c = val.s[val.i];
		if(!set[c]) throw err(val);
		++val.i;
		return c;
	});
};
parser.char = function char() {
	return toCode(function _char(val) {
		if(val.s.length === val.i) throw err(val);
		return val.s[val.i++];
	});
};
parser.dot = function dot() {
	return toCode(function _char(val) {
		var c = val.s[val.i];
		switch(c) {
			case "\n":
			case "\r":
			case undefined: throw err(val);
			default: ++val.i; return c;
		}
	});
};
parser.ignore = function ignore(func) {
	return toCode(function _ignore(val) {
		func(val);
		return undefined;
	});
};
parser.any = function any(arg1, arg2, etc) {
	var a = Array.prototype.slice.call(arguments), l = a.length;
	return toCode(function _any(val) {
		for(var i = 0, r; i < l; ++i) {
			try { return a[i](val); }
			catch(e) {}
		}
		throw err(val);
	});
};
parser.all = function all(arg1, arg2, etc) {
	var a = Array.prototype.slice.call(arguments), l = a.length;
	return toCode(function _all(val) {
		var r = [], o = val.i, t;
		try {
			for(var i = 0; i < l; ++i) {
				_all.state = ":"+i;
				t = a[i](val);
				if(undefined !== t) r.push(t);
			}
			return r;
		} catch(e) {
			val.i = o;
			throw e;
			// TODO: Store information on which one we were on.
		}
	});
};
parser.not = function not(bad, good) {
	return toCode(function _not(val) {
		var o = val.i;
		try { bad(val); val.i = o; }
		catch(e) { val.i = o; return good(val); }
		throw err(val);
	});
};
parser.range = function range(func, min, max) {
	return toCode(function _range(val) {
		var a = [], i = 0;
		for(; i < min; ++i) a.push(func(val));
		try { for(; i <= max; ++i) a.push(func(val)); }
		catch(e) { return a; }
	});
};
parser.star = function star(func) {
	return parser.range(func, 0, Infinity);
};
parser.plus = function plus(func) {
	return parser.range(func, 1, Infinity);
};
parser.maybe = function maybe(func, other) {
	if(arguments.length != 2) throw "maybe(func, other) invalid args";
	return toCode(function _maybe(val) {
		try { return func(val); }
		catch(e) { return other; }
	});
};
parser.replace = function replace(func, replacer) {
	return toCode(function _replace(val) {
		return replacer(func(val));
	});
};
parser.join = function join(func, glue) {
	glue = glue || "";
	return toCode(parser.replace(func, function(array) {
		return array.join(glue);
	}));
};
parser.flatten = function flatten(func) {
	return toCode(parser.replace(func, function(array) {
		if(1 !== array.length) console.log("Invalid length", err(array).stack);
		return array[0];
	}));
};
parser.unify = function unify(func) {
	return toCode(parser.replace(func, function(a) {
		var r = {}, l = a.length, o;
		for(var i = 0; i < l; ++i) {
			o = a[i];
			for(var p in o) if(has.call(o, p)) r[p] = o[p];
		}
		return r;
	}));
};
parser.name = function name(func, str) {
	return toCode(function _name(val) {
		var r = {};
		r[str] = func(val);
		return r;
	});
};
parser.eof = function eof() {
	return toCode(function _eof(val) {
		if(val.s.length !== val.i) throw err(val);
		return undefined;
	});
};
parser.log = function log(func, message) {
	return toCode(function _log(val) {
		var i = val.i, r, e;
		try { r = func(val); }
		catch(err) { e = err; }
		var j = e ? e.i : val.i;
		var a = JSON.stringify(val.s.slice(i-30, i)).slice(1, -1);
		var b = JSON.stringify(val.s.slice(i, j)).slice(1, -1);
		var c = JSON.stringify(val.s.slice(j, j+30)).slice(1, -1);
		console.log("\""+a+b+c+"\""+"\n"+repeat(" ", a.length+1)+repeat("^", Math.max(b.length, 0))+" "+(e ? "Unmatched" : "Matched")+"(line: "+lineCount(val.s, i)+")\n"+(e || err(val)).stack);
		if(e) throw e;
		return r;
	});
};
parser.assert = function assert(func, min, name) {
	var count = 0;
	min = min || 0;
	name = name || func.code || "(func)";
	var logger = parser.log(func);
	return toCode(function _assert(val) {
		var i = val.i;
		try { return func(val); }
		catch(e) {
			var j = e ? e.i : val.i;
			var a = JSON.stringify(val.s.slice(j-30, j)).slice(1, -1);
			var c = JSON.stringify(val.s.slice(j, j+30)).slice(1, -1);
			if(e && count >= min) console.log("\""+a+c+"\""+"\n"+repeat(" ", a.length+1)+"^ "+"Assertion failed (line: "+lineCount(val.s, j)+", hit: "+(count++)+")\n"+e.stack);
			throw e;
		}
	});
};

parser.define = function define(label, func) {
	this[label] = func;
	func.label = label;
};
parser.run = function run(func, s) {
	try { return func({s: s, i: 0}); }
	catch(e) {}
};

})();
