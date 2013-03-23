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
var plugins = require("../utilities/plugins");
var modules = plugins.load(__dirname, "Formatters");

var formatters = exports;

var EXT = require("../utilities/ext.json");


var waiting = [];
var queue = [];
function start(count) {
	for(var i = 0; i < count; ++i) (function() {
		var worker = cluster.fork();
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
	})();
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


cluster.setupMaster({
	exec: __filename,
});
start(2); // TODO: Detect number of CPUs.

formatters.select = function(srcType, dstTypes) {
	if(bt.negotiateTypes(dstTypes, [srcType])) return {
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
			format: function(srcPath, dstPath, callback/* (err) */) {
				enqueue([formatter.path, srcPath, srcType, dstPath, dstType], callback);
			},
		};
	}
	return null;
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
