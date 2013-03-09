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
var cluster = require("cluster");

if(cluster.isMaster) (function() {


var fs = require("fs");
var EventEmitter = require("events").EventEmitter;
var util = require("util");

var bt = require("../utilities/bt");

var formatters = exports;

var EXT = require("../utilities/ext.json");
var CACHE = __dirname+"/../../cache";

var files = fs.readdirSync(__dirname).filter(function(name) {
	return !name.match(/^index\.js$|^\./);
}).sort();
var modules = files.map(function(name) {
	var formatter = require(__dirname+"/"+name);
	formatter.path = __dirname+"/"+name;
	return formatter;
});
console.log("Formatters: "+files.join(", "));


var waiting = [];
var queue = [];
function start(count) {
	var worker;
	for(var i = 0; i < count; ++i) {
		worker = cluster.fork();
		worker.callback = null;
		worker.on("message", function(msg) {
			if(worker.callback) worker.callback.apply(this, msg);
			worker.callback = null;
			waiting.push(worker);
			dequeue();
		});
		worker.on("exit", function() {
			for(var i = 0; i < waiting.length; ++i) if(waiting[i] === worker) waiting.splice(i--, 1);
			start(1);
		});
		waiting.push(worker);
	}
}
function enqueue(msg, callback) {
	queue.push([msg, callback]);
	dequeue();
}
function dequeue() {
	if(!waiting.length || !queue.length) return;
	var worker = waiting.pop();
	var task = queue.pop();
	worker.callback = task[1];
	worker.send(task[0]);
}


start(2); // TODO: Detect number of CPUs.

formatters.select = function(srcType, dstTypes, allowNative) { // TODO: `allowNative` versus tagging, better distinction?
	if(allowNative && bt.negotiateTypes(dstTypes, [srcType])) return {
		dstType: srcType,
		format: null,
	};
	var formatter, dstType, dstPath;
	for(var i = 0; i < modules.length; ++i) {
		formatter = modules[i];
		dstType = formatter.negotiateTypes(srcType, dstTypes);
		if(null === dstType) continue;
		if(!bt.has(EXT, dstType)) continue;
		return {
			dstType: dstType,
			format: function(srcPath, dstPath, callback/* (err, tags) */) {
				enqueue([formatter.path, srcPath, srcType, dstPath, dstType], callback);
			},
		};
	}
	return null;
};
formatters.cachePath = function(hash, type) {
	return CACHE+"/"+EXT[type]+"/"+hash+"."+EXT[type];
};
formatters.parseTags = function(path, srcType, hash, callback/* (names, tagMap) */) {
	var obj = formatters.select(srcType, ["text/html", "*/*"], false);
	if(!obj) return callback([hash], []);
	var dstPath = formatters.cachePath(hash, obj.dstType);
	obj.format(path, dstPath, function(err, tags) {
		if(err) return callback([hash], []);
		var names = tags.map(function(tag) {
			return tag[1];
		}).concat([hash]).unique();
		var tagsByNamespace = {};
		tags.forEach(function(tag) {
			if(!bt.has(tagsByNamespace, tag[0])) tagsByNamespace[tag[0]] = [];
			tagsByNamespace[tag[0]].push(tag[1]);
		});
		var generalTags;
		if(bt.has(tagsByNamespace, "")) generalTags = tagsByNamespace[""].unique();
		else generalTags = [];
		var tagMap = [[hash, hash]];
		if(bt.has(tagsByNamespace, "meta")) {
			tagsByNamespace["meta"].unique().forEach(function(meta) {
				if(hash !== meta) tagMap.push([hash, meta]);
				generalTags.forEach(function(tag) {
					if(meta !== tag) tagMap.push([meta, tag]);
				});
			});
		} else {
			generalTags.forEach(function(tag) {
				if(hash !== tag) tagMap.push([hash, tag]);
			});
		}
		callback(names, tagMap);
	});
};


})(); else (function() {


process.on("message", function(msg) {
	(function(module, srcPath, srcType, dstPath, dstType) {
		var formatter = require(module);
		formatter.format(srcPath, srcType, dstPath, dstType, function(err, tags) {
			process.send([err, tags]);
		});
	}).apply(this, msg);
});


})();
