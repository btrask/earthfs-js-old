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

var files = fs.readdirSync(__dirname).filter(function(name) {
	return !name.match(/^index\.js$|^\./);
});
var taggers = files.map(function(name) {
	return require("./"+name);
});
console.log("Taggers: "+files.concat(["fallback"]).join(", "));

exports.parse = function(path, hash, type, callback/* (err, tagsByTarget) */) {
	for(var i = 0; i < taggers.length; ++i) {
		if(!taggers[i].accept(type)) continue;
		return taggers[i].parse(path, hash, type, callback);
	}
	return callback(new Error("No tagger for type "+type), null);
};

var fallback = {};
fallback.accept = function(type) {
	return true;
};
fallback.parse = function(path, hash, type, callback/* (err, tagsByTarget) */) {
	var tagsByTarget = {};
	tagsByTarget[hash] = [hash];
	if("text/" !== type.slice(0, 5)) return callback(null, tagsByTarget);
	var stream = fs.createReadStream(path), tags = [], last = null;
	stream.setEncoding("utf8");
	stream.on("data", function(chunk) {
		var re = /(?:^|[\s(\\])#([\w\d\-_]+:)?([\w\d\-_]{3,40})\b/g;
		if(last) {
			chunk = last[0]+chunk;
			last = null;
		}
		for(var x; (x = re.exec(chunk));) {
			if(re.lastIndex >= chunk.length) last = x;
			else tags.push(x);
		}
	});
	stream.on("end", function() {
		if(last) tags.push(last);
		var tagsByType = {}, tag, type, i;
		for(i = 0; i < tags.length; ++i) {
			tag = tags[i];
			type = (tag[1] || ":").slice(0, -1).toLowerCase();
			if(!bt.has(tagsByType, type)) tagsByType[type] = [];
			tagsByType[type].push(tag[2].toLowerCase());
		}
		if(tagsByType.meta) {
			for(i = 0; i < tagsByType.meta.length; ++i) tagsByTarget[tagsByType.meta[i]] = tagsByType[""];
			tagsByTarget[hash] = ["__meta__"].concat(tagsByTarget[hash]).concat(tagsByType.meta);
		} else {
			tagsByTarget[hash] = tagsByTarget[hash].concat(tagsByType[""]);
		}
		callback(null, tagsByTarget);
	});
	stream.on("error", function(err) {
		callback(err, null);
	});
};
taggers.push(fallback);
