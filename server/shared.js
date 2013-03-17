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
var pathModule = require("path");

var parsers = require("./parsers");

var bt = require("./utilities/bt");
var sql = require("./utilities/sql");

var EXT = require("./utilities/ext.json");

var shared = exports;

shared.db = null; // Set by the client.

shared.DATA = __dirname+"/../data";
shared.CACHE = __dirname+"/../cache";

shared.pathForEntry = function(dir, hash, type) {
	var t = type.split(";")[0];
	if(!bt.has(EXT, t)) throw new Error("Invalid MIME type "+type);
	return dir+"/"+hash.slice(0, 2)+"/"+hash+"."+EXT[t];
};

shared.moveEntryFile = function(srcPath, hash, type, callback/* (err, path) */) {
	fs.chmod(srcPath, 292 /*=0444*/, function(err) {
		if(err) return callback(err, null);
		var dstPath = shared.pathForEntry(shared.DATA, hash, type);
		fs.mkdirRecursive(pathModule.dirname(dstPath), function(err) {
			if(err) return callback(err, null);
			fs.link(srcPath, dstPath, function(err) { // TODO: Test this carefully to make sure we don't overwrite.
				if(err) console.log(srcPath, dstPath);
				if(err) return callback(err, null); // TODO: Clients should remove the file if there was an error.
				fs.unlink(srcPath);
				callback(null, dstPath);
			});
		});
	});
};
shared.copyEntryFile = function(srcPath, hash, type, callback/* (err, path) */) {
	var dstPath = shared.pathForEntry(shared.DATA, hash, type);
	var src = fs.createReadStream(srcPath);
	var dst = fs.createWriteStream(dstPath, {mode: 292/*=0444*/});
	src.pipe(dst);
	src.on("error", function(err) {
		callback(err, null);
	});
	dst.on("error", function(err) {
		callback(err, null);
	});
	dst.on("close", function() { // TODO: Might be broken in Node 0.10.
		callback(null, dstPath);
	});
};
shared.createEntry = function(path, type, hash, URI, callback/* (err, entryID) */) {
	if("text/" === type.slice(0, 5)) {
		fs.readFile(shared.pathForEntry(shared.DATA, hash, type), "utf8", function(err, data) {
			insert(data);
		});
	} else {
		insert(null);
	}
	function insert(data) {
		sql.debug(shared.db,
			'INSERT INTO "entries" ("hash", "type", "fulltext")'+
			' VALUES ($1, $2, to_tsvector(\'english\', $3)) RETURNING "entryID"',
			[hash, type, data],
			function(err, results) {
				if(err) return callback(err, null);
				var entryID = results.rows[0].entryID;
				sql.debug(shared.db,
					'INSERT INTO "URIs" ("URI", "entryID") VALUES ($1, $2)', [URI, entryID],
					function(err, results) {
						callback(err, entryID);
					}
				);
			}
		);
	}
};
shared.addEntryLinks = function(path, type, entryID, callback/* (err) */) {
	parsers.parse(path, type, function(err, links) {
		if(err || !links.length) return callback(err);
		links = links.unique();
		sql.debug(shared.db,
			'INSERT INTO "URIs" ("URI")'+
			' VALUES '+sql.list1D(links, 1, true)+'', links,
			function(err, results) {
				if(err) return callback(err);
				sql.debug(shared.db,
					'INSERT INTO "links" ("fromEntryID", "toUriID", "direct", "indirect")'+
					' SELECT $1, "uriID", true, 1'+
					' FROM "URIs" WHERE "URI" IN ('+sql.list1D(links, 2)+')', [entryID].concat(links),
					function(err, results) {
						callback(err);
					}
				);
			}
		);
	});
};
