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
module.exports = IncomingFile;

var fs = require("fs");
var os = require("os");
var crypto = require("crypto");
var util = require("util");
var PassThroughStream = require("stream").PassThrough;

var plugins = require("../plugins");
var hashers = plugins.hashers;
var indexers = plugins.indexers;

var has = require("../utilities/has");

// TODO: Put this somewhere. Or use a real library that does the same thing.
function AsyncCollection() {
	var collection = this;
	collection.count = 0;
	collection.error = null;
	collection.waiter = null;
}
AsyncCollection.prototype.add = function(callback/* (arg1, arg2, etc) */) {
	var collection = this;
	++collection.count;
	return function(err, arg1, arg2, etc) {
		if(collection.count <= 0) return;
		if(!err && callback) {
			try { callback.apply(null, Array.prototype.slice.call(arguments, 1)); }
			catch(e) { err = e; }
		}
		if(err || !--collection.count) {
			if(collection.waiter) collection.waiter(err);
			else collection.error = err;
		}
		if(err) collection.count = 0;
	};
};
AsyncCollection.prototype.wait = function(callback/* (err) */) {
	var collection = this;
	if(!collection.count) callback(collection.error);
	else collection.waiter = callback;
};



function IncomingFile(repo, type, targets) {
	var file = this;
	// Set now.
	file.repo = repo;
	file.type = type;
	file.targets = targets;

	// Set by user (and by `loadFromStream()`).
	file.keepOriginal = true;

	// Set on `load()`.
	file.originalPath = null;
	file.size = null;
	file.hashes = null;
	file.internalHash = null;
	file.internalPath = null;
	file.index = null;
	file.links = null;
}
IncomingFile.prototype.loadFromFile = function(path, callback/* (err) */) {
	var file = this;
	file.load(path, fs.createReadStream(path), callback);
};
IncomingFile.prototype.loadFromStream = function(stream, callback/* (err) */) {
	var file = this;
	var repo = file.repo;
	crypto.randomBytes(24, function(err, buf) {
		if(err) return callback(err);
		var collection = new AsyncCollection;
		var path = repo.TMP+"/"+buf.toString("hex");
		var tmp = fs.createWriteStream(path, {
			flags: "w",
			mode: parseInt("600", 8),
		});
		file.keepOriginal = false;
		file.load(path, stream, collection.add());
		stream.pipe(tmp).on("close", collection.add());
		collection.wait(callback);
	});
};
IncomingFile.prototype.load = function(path, stream, callback/* (err) */) {
	// This method doesn't care if `stream` is being read from path, or `stream` is being written to `path`. That means it works equally for local or remote files. `loadFromFile()` or `loadFromStream()` might be more convenient.
	var file = this;
	var repo = file.repo;
	var collection = new AsyncCollection;
	file.originalPath = path;
	createHashes(stream, file.type, collection.add(function(hashes) {
		if(!has(hashes, "sha1") || !hashes["sha1"].length) throw new Error("Internal hash algorithm missing "+util.inspect(hashes));
		var internalHash = hashes["sha1"][0];
		file.hashes = hashes;
		file.internalHash = internalHash;
		file.internalPath = repo.internalPathForHash(internalHash);
	}));
	createIndex(streamCopy(stream), file.type, collection.add(function(index) {
		file.index = index;
		file.links = []; // TODO: Parse for links. Make sure to normalize them.
	}));
	streamLength(streamCopy(stream), collection.add(function(size) {
		file.size = size;
	}));
	collection.wait(callback);
};

function createHashes(stream, type, callback/* (err, hashes) */) {
	var hashes = {};
	var waiting = hashers.length;
	if(waiting <= 0) return callback(null, hashes);
	hashers.forEach(function(hasher) {
		var stream2 = streamCopy(stream);
		hasher.createHashes(stream2, type, function(err, array) {
			if(!err) hashes[hasher.algorithm] = array;
			if(!--waiting) callback(null, hashes);
		});
		stream2.on("error", function(err) {});
	});
	stream.on("error", function(err) {
		if(waiting <= 0) return;
		waiting = 0;
		callback(err, null);
	});
}
function createIndex(stream, type, callback/* (err, index) */) {
	for(var i = 0; i < indexers.length; ++i) {
		if(!indexers[i].acceptsType(type)) continue;
		return indexers[i].createIndex(stream, type, callback);
	}
	callback(null, "");
}

function streamCopy(stream) {
	var copy = new PassThroughStream;
	stream.pipe(copy);
	return copy;
}
function streamLength(stream, callback/* (err, length) */) {
	var length = 0;
	stream.on("readable", function() {
		var buf = stream.read();
		length += buf.length;
	});
	stream.on("end", function() {
		callback(null, length);
	})
	stream.on("error", function(err) {
		callback(err, null);
	});
}
