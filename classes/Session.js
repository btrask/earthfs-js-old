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
module.exports = Session;

var crypto = require("crypto");
var fs = require("fs");
var pathModule = require("path");
var os = require("os");

var mkdirp = require("mkdirp");

var sql = require("../utilities/sql");
var fsx = require("../utilities/fsx");

var Repo = require("./Repo");

var Hashers = require("../plugins/hashers");
var Parsers = require("../plugins/parsers");
var Queries = require("../plugins/queries");

function Session(repo, userID, mode) {
	var session = this;
	session.repo = repo;
	session.db = repo.db;
	session.userID = userID;
	session.mode = mode;
}
Session.prototype.addEntryStream = function(stream, type, targets, callback/* (err, primaryURN) */) {
	var session = this;
	if(!(session.mode & Repo.O_WRONLY)) return callback(new Error("No permission"), null);
	crypto.randomBytes(24, function(err, buf) {
		if(err) return callback(err, null);
		var tmp = pathModule.resolve(os.tmpDir(), buf.toString("hex"));
		addEntryStream(session, tmp, stream, type, targets, callback);
	});
};
function addEntryStream(session, tmp, stream, type, targets, callback/* (err, primaryURN) */) {
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
			var path = session.repo.pathForEntry(h.internalHash);
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
}
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

Session.prototype.entryForURN = function(URN, callback/* (err, entryID, hash, path, type) */) {
	var session = this;
	if(!(session.mode & Repo.O_RDONLY)) return callback(new Error("No permission"), null);
	sql.debug(session.db,
		'SELECT e."entryID", e."hash", e."type"'+
		' FROM "entries" AS e'+
		' LEFT JOIN "URIs" AS u ON (u."entryID" = e."entryID")'+
		' LEFT JOIN "targets" AS t ON (u."entryID" = t."entryID")'+
		' WHERE u."URI" = $1 AND t."userID" = $2', [URN, session.userID],
		function(err, results) {
			if(err) return callback(err, null, null, null);
			if(!results.rows.length) return callback({httpStatusCode: 404, message: "Not Found"}, null, null, null);
			var row = results.rows[0];
			var path = session.repo.pathForEntry(row.hash);
			callback(null, row.entryID, row.hash, path, row.type);
		}
	);
};
Session.prototype.metadataForURN = function(URN, callback/* (err, info) */) {
	var session = this;
	if(!(session.mode & Repo.O_RDONLY)) return callback(new Error("No permission"), null);
	// TODO: Reduce redundancy.
	sql.debug(session.db,
		'SELECT DISTINCT COALESCE(u."username", \'public\') AS "source"'+
		' FROM "sources" AS x'+
		' LEFT JOIN "users" AS u ON (u."userID" = x."userID")'+
		' LEFT JOIN "URIs" AS n ON (n."entryID" = x."entryID")'+
		' LEFT JOIN "targets" AS t ON (t."entryID" = x."entryID")'+
		' WHERE'+
			' (u."username" IS NOT NULL OR x."userID" = 0)'+
			' AND n."URI" = $1'+
			' AND t."userID" = $2',
		[URN, session.userID],
		function(err, results) {
			if(err) return callback(err, null);
			var sources = results.rows.map(function(row) {
				return row.source;
			});
			sql.debug(session.db,
				'SELECT DISTINCT COALESCE(u."username", \'public\') AS "target"'+
				' FROM "targets" AS x'+
				' LEFT JOIN "users" AS u ON (u."userID" = x."userID")'+
				' LEFT JOIN "URIs" AS n ON (n."entryID" = x."entryID")'+
				' LEFT JOIN "targets" AS t ON (t."entryID" = x."entryID")'+
				' WHERE'+
					' (u."username" IS NOT NULL OR x."userID" = 0)'+
					' AND n."URI" = $1'+
					' AND t."userID" = $2',
				[URN, session.userID],
				function(err, results) {
					if(err) return callback(err, null);
					var targets = results.rows.map(function(row) {
						return row.target;
					});
					callback({
						"sources": sources,
						"targets": targets,
						"URNs": [],
						// TODO: Alternate URNs, earliest submission date?
						// Possibly list of submission dates with full meta-data for each?
					});
				}
			);
		}
	);
};

var util = require("util");
Session.prototype.parseQuery = function(string, language, callback/* (err, query) */) {
	var session = this;
	if(!(session.mode & Repo.O_RDONLY)) return callback(new Error("No permission"), null);
	Queries.parse(string, language, session.userID, callback);
};

