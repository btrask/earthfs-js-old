#!/usr/bin/env node
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
var crypto = require("crypto");
var util = require("util");
var pathModule = require("path");
var pg = require("pg");

var bt = require("../server/utilities/bt");
var fs = require("../server/utilities/fsx");
var sql = require("../server/utilities/sql");

var shared = require("../server/shared");

if(process.argv.length < 3) {
	console.log("Usage: import.js path");
	process.exit();
}
var SRC = pathModule.resolve(process.cwd(), process.argv[2])+"/data";

var TAG_RX = /(^|[\s\(\)])#([\w\d\-_]{14})($|[\s\(\)])/g; // Captures 3 parts.

var db = shared.db = new pg.Client(require("../secret.json").db);
db.connect();

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function allTags(str) {
	var r = [];
	var rx = new RegExp(TAG_RX);
	for(;;) {
		var m = rx.exec(str);
		if(!m) break;
		r.push(m[2]);
		rx.lastIndex -= 1; // Scan the "trailer" of one tag as the "header" of the next.
	}
	return r;
}

var URNs = {};
function processEntry(oldHash, callback) {
	var srcPath = SRC+"/plain/"+oldHash.slice(0, 2).toLowerCase()+"/"+oldHash;
	fs.stat(srcPath, function(err, stats) {
		fs.readFile(srcPath, "utf8", function(err, data) {
			data = data.replace(TAG_RX, function(original, prev, hash, next) {
				if(!has(URNs, hash)) return original;
				return prev+URNs[hash]+next;
			});

			var sha1 = crypto.createHash("sha1");
			sha1.update(data, "utf8");
			var hash = sha1.digest("hex");
			var URN = "urn:sha1:"+hash;
			URNs[oldHash] = URN;

			var type = "text/x-bad-markup; charset=utf-8";
			var dstPath = shared.pathForEntry(shared.DATA, hash, type);

			fs.mkdirRecursive(pathModule.dirname(dstPath), function(err) {
				if(err) throw util.inspect(err);
				fs.writeFileReadOnly(dstPath, data, "utf8", function(err) {
					if(err) throw util.inspect(err);
					shared.createEntry(dstPath, type, hash, URN, function(err, entryID, data) {
						if(err) throw util.inspect(err);
						shared.addEntryLinks(data, type, entryID, function(err) {
							if(err) throw util.inspect(err);
							callback();
						});
					});
				});
			});
		});
	});
}

// Load old entries.
fs.readFile(SRC+"/tags/i/index", "ascii", function(err, data) {
	var count = data.length / 14;
	var i = 0;
	bt.asyncLoop(function(next) {
		if(i >= count) return process.exit();
		processEntry(data.slice(i*14, i*14+14), function() {
			++i;
			next();
		});
	});
});
