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
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");
var fsx = require("../utilities/fsx");

var Repo = require("./Repo");
var IncomingFile = require("./IncomingFile");

var queryModule = require("./query");
var plugins = require("../plugins");
var parsers = plugins.parsers;

var queryF = Future.wrap(sql.debug);
var mkdirpF = Future.wrap(mkdirp);
var unlinkF = Future.wrap(fs.unlink);

var addFileRowF = Future.wrap(addFileRow);
var addFileSubmissionF = Future.wrap(addFileSubmission);
var addFileDataF = Future.wrap(addFileData);
var addFileHashesF = Future.wrap(addFileHashes);
var addFileIndexF = Future.wrap(addFileIndex);
var addFileLinksF = Future.wrap(addFileLinks);
var addFileSubmissionTargetsF = Future.wrap(addFileSubmissionTargets);

function run(func, callback) {
	Fiber(function() {
		var val;
		try { val = func(); } 
		catch(err) { return callback(err, null); }
		callback(null, val);
	}).run();
}

function Session(repo, db, userID, mode) {
	var session = this;
	session.repo = repo;
	session.db = db;
	session.userID = userID;
	session.mode = mode;
}
Session.prototype.close = function() {
	var session = this;
	session.repo = null;
	session.db.end();
	session.userID = null;
	session.mode = Session.O_NONE;
};

Session.prototype.parseQuery = function(string, language, callback/* (err, query) */) {
	var session = this;
	if(!(session.mode & Session.O_RDONLY)) return callback(new Error("No permission"), null);
	for(var i = 0; i < parsers.length; ++i) {
		if(!parsers[i].acceptsLanguage(language)) continue;
		return parsers[i].parseQuery(query, language, function(err, query) {
			if(err) return callback(err, null);
			callback(null, new queryModule.User(session.userID, query));
		});
	}
	callback(new Error("Invalid language"), null);
};
Session.prototype.addIncomingFile = function(file, targets, callback/* (err, fileID) */) {
	run(function() {
		var session = this;
		if(!(session.mode & Session.O_WRONLY)) throw new Error("No permission");
		if(!file.size) throw new Error("Empty file");
		queryF(session.db, "BEGIN TRANSACTION", []).wait();
		try {
			var fileID = addFileRowF(session, file).wait();
			var submissionID = addFileSubmissionF(session, fileID).wait();
			var tasks = [];
			tasks.push(addFileDataF(session, file));
			tasks.push(addFileHashesF(session, fileID, file));
			tasks.push(addFileIndexF(session, fileID, file));
			tasks.push(addFileLinksF(session, fileID, file));
			tasks.push(addFileSubmissionTargetsF(session, submissionID, file));
			Future.wait(tasks);
			queryF(session.db, "COMMIT", []).wait();
			file.fileID = fileID;
			return fileID;
		} catch(err) {
			var tasks = [];
			tasks.push(queryF(session.db, "ROLLBACK", []));
			if(file.internalPath) tasks.push(unlinkF(file.internalPath));
			Future.wait(tasks);
			return null;
		}
	}, function(err, fileID) {
		callback(err, fileID);
		if(!err) session.repo.emit("submission", file);
	});
};
Session.prototype.submissionsForHash = function(algorithm, hash, callback/* (err, submissions) */) {
	run(function() {
		var session = this;
		if(!(session.mode & Session.O_RDONLY)) throw new Error("No permission");
		return queryF(session.db,
			'SELECT s."submissionID, u."username", s."timestamp""\n'
			+'FROM "submissions" AS s\n'
			+'INNER JOIN "hashes" AS h ON (h."fileID" = s."fileID")\n'
			+'INNER JOIN "targets" AS t ON (t."submissionID" = s."submissionID")\n'
			+'INNER JOIN "users" AS u ON (u."userID" = s."userID")\n'
			+'WHERE\n\t'
				+'h."algorithm" = $1 AND h."hash" = $2\n'
			+'AND\n\t'
				+'t."userID" = $3\n'
			+'ORDER BY s."submissionID" ASC',
			[algorithm, hash, session.userID]).wait().rows;
	}, callback);
};
Session.prototype.fileForSubmissionID = function(submissionID, callback/* (err, file) */) {
	run(function() {
		var session = this;
		if(!(session.mode & Session.O_RDONLY)) throw new Error("No permission");
		var repo = session.repo;
		var file = queryF(session.db,
			'SELECT\n\t'
				+'f."fileID", f."type", f."internalHash", f."size",\n\t'
				+'s."timestamp"\n\t'
				+'u."username" AS "source"\n'
			+'FROM "files" AS f\n'
			+'INNER JOIN "submissions" AS s ON (s."fileID" = f."fileID")\n'
			+'INNER JOIN "targets" AS t ON (t."submissionID" = s."submissionID")\n'
			+'INNER JOIN "users" AS u ON (u."userID" = s."userID")\n'
			+'WHERE s."submissionID" = $1 AND t."userID" = $2',
			[submissionID, session.userID]).wait().rows[0];
		var URIs = queryF(session.db,
			'SELECT h."algorithm", h."hash"\n'
			+'FROM "hashes" AS h\n'
			+'INNER JOIN "fileHashes" AS f ON (f."hashID" = h."hashID")\n'
			+'WHERE f."fileID" = $1',
			[file.fileID]).wait().rows.map(function(row) {
				return "earth://"+row.algorithm+"/"+row.hash;
			});
		var targets = queryF(session.db,
			'SELECT u."username"\n'
			+'FROM "targets" AS t\n'
			+'INNER JOIN "users" AS u ON (u."userID" = t."userID")\n'
			+'WHERE t."submissionID" = $1 AND t."userID" != $2',
			[submissionID, session.userID]).wait().rows.map(function(row) {
				return row.username;
			});
		return {
			submissionID: submissionID,
			fileID: file.fileID,
			type: file.type,
			internalHash: file.internalHash,
			internalPath: repo.internalPathForHash(file.internalHash),
			size: file.size,
			source: file.source,
			targets: targets,
			URIs: URIs,
		};
	}, callback);
};

function addFileRow(session, file, callback/* (err, fileID) */) {
	run(function() {
		return queryF(session.db,
			'INSERT INTO "files" ("type", "internalHash", "size")\n'
			+'VALUES ($1, $2, $3)\n'
			+'RETURNING "fileID"',
			[file.type, file.internalHash, file.size]).wait().rows[0].fileID;
	}, callback);
}
function addFileSubmission(session, fileID, callback/* (err, submissionID) */) {
	run(function() {
		return queryF(session.db,
			'INSERT INTO "submissions" ("fileID", "userID")\n'
			+'VALUES ($1, $2)\n'
			+'RETURNING "submissionID"',
			[fileID, session.userID]).wait().rows[0].submissionID;
	}, callback);
}
function addFileData(session, file, callback) {
	run(function() {
		var src = file.originalPath;
		var dst = file.internalPath;
		mkdirpF(pathModule.dirname(dst)).wait();
		linkF(src, dst).wait(); // TODO: Try `renameF()` if this fails?
		if(!file.keepOriginal) unlinkF(src).wait();
	}, callback);
};
function addFileHashes(session, fileID, file, callback) {
	run(function() {
		var vals = [];
		Object.keys(file.hashes).forEach(function(algorithmCaseSensitive) {
			var algorithm = algorithmCaseSensitive.toLowerCase();
			file.hashes[algorithm].forEach(function(hash) {
				vals.push([algorithm, hash]);
			});
		});
		if(!vals.length) throw new Error("No hashes");
		queryF(session.db, 
			'INSERT INTO "hashes" ("algorithm", "hash")\n'
			+'VALUES '+sql.list2D(vals, 1)+'',
			sql.flatten(vals)).wait();
		queryF(session.db,
			'INSERT INTO "fileHashes" ("fileID", "hashID")\n'
			+'SELECT $1, "hashID" FROM "hashes"\n'
			+'WHERE ("algorithm", "hash") IN '+sql.list2D(vals, 2)+'',
			[fileID].concat(sql.flatten(vals))).wait();
	}, callback);
}
function addFileIndex(session, fileID, file, callback) {
	run(function() {
		queryF(session.db,
			'INSERT INTO "fileIndexes" ("fileID", "index")\n'
			+'VALUES ($1, to_tsvector(\'english\', $2)',
			[fileID, file.index]).wait();
	}, callback);
}
function addFileLinks(session, fileID, file, callback) {
	run(function() {
		var vals = file.links.map(function(link) {
			return [fileID, link];
		});
		if(!vals.length) return;
		queryF(session.db,
			'INSERT INTO "fileLinks" ("fileID", "link")\n'
			+'VALUES '+sql.list2D(vals, 1)+'',
			sql.flatten(vals)).wait();
	}, callback);
}
function addFileSubmissionTargets(session, submissionID, file, callback) {
	run(function() {
		var list = sql.list1D(file.targets, 3) || "null";
		queryF(session.db,
			'INSERT INTO "targets" ("submissionID", "userID")\n\t'
				+'SELECT $1, $2\n'
			+'UNION\n\t'
				+'SELECT $1, 0 WHERE 'public' IN ('+list+')\n'
			+'UNION\n\t'
				+'SELECT $1, "userID FROM "users"\n\t'
				+'WHERE "username" IN ('+list+')',
			[submissionID, session.userID].concat(targets)).wait();
	}, callback);
}

Session.O_NONE = 0;
Session.O_RDONLY = 1 << 0;
Session.O_WRONLY = 1 << 1;
Session.O_RDWR = Session.O_RDONLY | Session.O_WRONLY;

