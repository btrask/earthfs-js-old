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

var DATA = __dirname+"/../data";

if(process.argv.length < 3) {
	console.log("Usage: import.js path");
	process.exit();
}
var SRC = pathModule.resolve(process.cwd(), process.argv[2])+"/data";

var TAG_RX = /(^|[\s\(\)])#([\w\d\-_]{3,40})($|[\s\(\)])/g; // Captures 3 parts.

var db = new pg.Client(require("../secret.json").db);
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

var hashReplacements = {};
function processEntry(oldHash, callback) {
	var path = SRC+"/plain/"+oldHash.slice(0, 2).toLowerCase()+"/"+oldHash;
	fs.stat(path, function(err, stats) {
		fs.readFile(path, "utf8", function(err, data) {
			data = data.replace(TAG_RX, function(x, prev, hash, next) {
				return prev+"#"+(has(hashReplacements, hash) ? hashReplacements[hash] : hash)+next;
			});
			
			var sha1 = crypto.createHash("sha1");
			sha1.update(data, "utf8");
			var hash = sha1.digest("hex");
			hashReplacements[oldHash] = hash;
			var names = [hash].concat(allTags(data)).unique();

			fs.mkdirRecursive(DATA+"/"+hash.slice(0, 2), function(err) {
				fs.writeFile(DATA+"/"+hash.slice(0, 2)+"/"+hash+".badmarkup", data, "utf8", function(err) {
					db.query( // TODO: We can use a rule on SELECT instead of INSERT to make this even shorter.
						'INSERT INTO "names" ("name")'+
						' VALUES '+sql.list2D(names, 1)+'', names,
						function(err, result) {
							if(err) throw util.inspect(err);
							db.query(
								'SELECT "name", "nameID" FROM "names"'+
								' WHERE "name" IN ('+sql.list1D(names, 1)+')'+
								'', names, // TODO: It'd be nice if we could get the hashID so we don't have to search.
								function(err, result) {
									if(err) throw util.inspect(err);
									var hashID = result.rows.filter(function(row) {
										return row.name === hash;
									})[0].nameID;
									var tags = result.rows.slice(1).map(function(row) {
										return [hashID, row.nameID, true, 0];
									});
									if(tags.length) db.query(
										'INSERT INTO "tags" ("nameID", "impliedID", "direct", "indirect")'+
										' VALUES '+sql.list2D(tags, 1)+'', sql.flatten(tags),
										function(err, result) {
											if(err) throw util.inspect(err);
										}
									);
									db.query(
										'INSERT INTO "entries" ("nameID", "MIMEType", "time")'+
										' VALUES ($1, $2, $3)',
										[hashID, "text/x-bad-markup; charset=utf-8", stats.ctime],
										function(err, result) {
											if(err) throw util.inspect(err);
											callback();
										}
									);
								}
							);
						}
					);
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
