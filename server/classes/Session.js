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
var os = require("os");

var mkdirp = require("mkdirp");

var sql = require("../utilities/sql");
var fsx = require("../utilities/fsx");

var Hashers = require("../hashers");
var Parsers = require("../parsers");

// TODO: Put this somewhere.
// TODO: Use crypto module instead.
function randomString(length, charset) {
	var chars = [], i;
	for(i = 0; i < length; ++i) chars.push(charset[Math.floor(Math.random() * charset.length)]);
	return chars.join("");
}

function Session(repo, userID, mode) {
	var session = this;
	session.repo = repo;
	session.db = repo.db;
	session.userID = userID;
	session.mode = mode;
}
Session.prototype.addEntryStream = function(stream, type, targets, callback/* (err, primaryURN) */) {
	var session = this;
	var tmp = pathModule.resolve(os.tmpDir(), randomString(32, "0123456789abcdef"));
	var h = new Hashers(type);
	var p = new Parsers(type);
	var f = fs.createWriteStream(tmp);
	var length = 0;
	stream.on("readable", function() {
		var chunk = stream.read();
		h.update(chunk);
		p.update(chunk);
		f.write(chunk);
		length += chunk.length;
	});
	stream.on("end", function() {
		h.end();
		p.end();
		f.end();
		f.on("close", function() {
			if(!length) {
				// Silently ignore empty files.
				fs.unlink(tmp);
				callback(null, null);
				return;
			}
			var path = session.repo.pathForEntry(session.repo.DATA, h.internalHash, type);
			mkdirp(pathModule.dirname(path), function(err) {
				if(err) return callback(err, null);
				fsx.moveFile(tmp, path, function(err) {
					if(err) {
						if("EEXIST" === err.code) return callback(null, h.primaryURN);
						return callback(err, null);
					}
					addEntry(session, type, h, p, function(err, primaryURN, entryID) {
						if(err) return callback(err, null);
						addEntrySource(session, entryID, targets, function(err) {
							if(err) return callback(err, null);
							callback(null, primaryURN);
							session.repo.emit("entry", h.primaryURN, entryID);
						});
					});
				});
			});
		});
	});
	stream.read(0);
};
function addEntry(session, type, h, p, callback/* (err, primaryURN, entryID) */) {
	sql.debug(session.db,
		'INSERT INTO "entries" ("hash", "type", "fulltext")'+
		' VALUES ($1, $2, to_tsvector(\'english\', $3)) RETURNING "entryID"',
		[h.internalHash, type, p.fullText],
		function(err, results) {
			if(err) return callback(err, null);
			var entryID = results.rows[0].entryID;
			var allLinks = h.URNs.concat(p.links, p.metaEntries, p.metaLinks).unique();
			sql.debug(session.db,
				'INSERT INTO "URIs" ("URI")'+
				' VALUES '+sql.list2D(allLinks, 1)+'', allLinks,
				function(err, results) {
					if(err) return callback(err, null);
					sql.debug(session.db,
						'UPDATE "URIs" SET "entryID" = $1'+
						' WHERE "URI" IN ('+sql.list1D(h.URNs, 2)+')',
						[entryID].concat(h.URNs),
						function(err, results) {
							if(err) return callback(err, null);
							if(!p.links.length) {
								callback(null, h.primaryURN, entryID);
								return;
							}
							sql.debug(session.db,
								'INSERT INTO "links"'+
								' ("fromEntryID", "toUriID", "direct", "indirect")'+
								' SELECT $1, "uriID", true, 1'+
								' FROM "URIs" WHERE "URI" IN ('+sql.list1D(p.links, 2)+')',
								[entryID].concat(p.links),
								function(err, results) {
									if(err) return callback(err, null);
									// TODO
									// 1. Add meta-links to the meta-entries
									// 2. Recurse over links and add indirect rows
									callback(null, h.primaryURN, entryID);
								}
							);
						}
					);
				}
			);
		}
	);
}
function addEntrySource(session, entryID, targets, callback/* (err) */) {
	sql.debug(session.db,
		'INSERT INTO "sources" ("entryID", "userID")'+
		' VALUES ($1, $2)'+
		' RETURNING "sourceID"',
		[entryID, session.userID],
		function(err, results) {
			if(err) return callback(err, null);
			var sourceID = results.rows[0].sourceID;
			sql.debug(session.db,
				'SELECT "userID" FROM "users"'+
				' WHERE "username" IN ('+sql.list1D(targets, 1)+')'+
				' UNION'+
				' SELECT 0 WHERE \'public\' IN ('+sql.list1D(targets, targets.length+1)+')',
				targets.concat(targets),
				function(err, results) {
					if(err) return callback(err, null);
					var targetIDs = results.rows.map(function(row) {
						return row.userID;
					}).concat([session.userID]).unique();
					var params = targetIDs.map(function(targetID) {
						return [entryID, targetID, sourceID];
					});
					sql.debug(session.db,
						'INSERT INTO "targets" ("entryID", "userID", "sourceID")'+
						' VALUES '+sql.list2D(params, 1)+'',
						sql.flatten(params),
						function(err, results) {
							if(err) return callback(err, null);
							callback(null);
						}
					);
				}
			);
		}
	);
}

module.exports = Session;
