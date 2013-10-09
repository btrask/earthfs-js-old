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
var cookieModule = exports;

cookieModule.parseJar = function(cookies) {
	if("string" !== typeof cookies) throw new Error("Invalid cookie jar");
	var jar = {};
	cookies.split(/[;,] */).forEach(function(cookie) {
		var obj = /([^=]*)=(.*)/.exec(cookie);
		if(!obj) return;
		var name = cookieModule.decode(obj[1]);
		var value = cookieModule.decode(obj[2]);
		jar[name] = value;
	});
	return jar;
};
cookieModule.parseSet = function(cookies) {
	if(!cookies) return [];
	if(!Array.isArray(cookies)) throw new Error("Invalid set-cookie value");
	return cookies.map(function(cookie) {
		return cookieModule.parseSingle(cookie);
	});
};
cookieModule.parseSingle = function(cookie) {
	var opts = {};
	cookie.split(/[;,] */).forEach(function(param, i) {
		var obj = /([^=]*)=?(.+)?/.exec(param);
		if(!obj) return;
		var name = cookieModule.decode(obj[1]);
		var value = undefined === obj[2] ? true : cookieModule.decode(obj[2]);
		if(0 === i) {
			opts["name"] = name;
			opts["value"] = value;
		} else if(!has(obj, name)) {
			opts[name] = value;
		}
	});
	return opts;
};

cookieModule.formatJar = function(jar) {
	var cookies = [];
	Object.keys(jar).forEach(function(key) {
		cookies.push(cookieModule.encode(key)+"="+cookieModule.encode(jar[key]));
	});
	return cookies.join("; ");
};
cookieModule.formatSet = function(cookies) {
	return cookies.map(function(cookie) {
		return cookieModule.formatSingle(cookie);
	});
};
cookieModule.formatSingle = function(cookie) {
	var params = [cookieModule.encode(cookie["name"])+"="+cookieModule.encode(cookie["value"])];
	Object.keys(cookie).forEach(function(key) {
		if("name" === key || "value" === key) return;
		var value = cookie[key];
		if(true === value) {
			params.push(cookieModule.encode(key));
		} else if(false !== value) {
			params.push(cookieModule.encode(key)+"="+cookieModule.encode(value));
		}
	});
	return params.join("; ");
};

cookieModule.encode = encodeURIComponent;
cookieModule.decode = decodeURIComponent;

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

