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

var fs = require("fs");
var pathModule = require("path");

var client = require("efs-client");
var mkdirp = require("mkdirp");
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");
var run = require("../utilities/fiber-helper").run;
var wait = require("../utilities/fiber-helper").wait;

var Query = require("./Query");
var AST = require("./AST");
var plugins = require("../plugins");
var parsers = plugins.parsers;

var queryF = Future.wrap(sql.debug);
var mkdirpF = Future.wrap(mkdirp, 1);
var linkF = Future.wrap(fs.link);
var unlinkF = Future.wrap(fs.unlink);

var addFileRowF = Future.wrap(addFileRow);
var addFileSubmissionF = Future.wrap(addFileSubmission);
var addFileDataF = Future.wrap(addFileData);
var addFileURIsF = Future.wrap(addFileURIs);
var addFileFieldsF = Future.wrap(addFileFields);
var addFieldPartsF = Future.wrap(addFieldParts);
var addFileSubmissionTargetsF = Future.wrap(addFileSubmissionTargets);
var addURIsF = Future.wrap(addURIs);

function Session(repo, db, userID, mode, cookie) {
	var session = this;
	if(!repo) throw new Error("Invalid repo for session");
	if(!db) throw new Error("Invalid database for session");
	session.repo = repo;
	session.db = db;
	session.userID = userID;
	session.mode = mode;
	session.cookie = cookie;
}
Session.prototype.close = function() {
	var session = this;
	session.repo = null;
	session.db.done();
	session.db = null;
	session.userID = null;
	session.mode = Session.O_NONE;
};

Session.prototype.addIncomingFile = function(file, callback/* (err, outgoingFile) */) {
	var session = this;
	run(function() {
		if(!(session.mode & Session.O_WRONLY)) throw new Error("No permission");
		if(!file.size) throw new Error("Empty file");
		queryF(session.db, "BEGIN TRANSACTION", []).wait();
		try {
			var fileID = addFileRowF(session, file).wait();
			var submissionID = addFileSubmissionF(session, fileID).wait();
			var tasks = [];
			tasks.push(addFileDataF(session, file));
			tasks.push(addFileURIsF(session, fileID, file));
			tasks.push(addFileFieldsF(session, fileID, file));
			tasks.push(addFileSubmissionTargetsF(session, submissionID, file));
			wait(tasks);
			queryF(session.db, "COMMIT", []).wait();
			return {
				submissionID: submissionID,
				fileID: fileID,
				internalHash: file.internalHash,
				internalPath: file.internalPath, // TODO: Don't leak this.
				type: file.type,
				size: file.size,
				source: null, // TODO: Store our username when the session is created.
				targets: file.targets, // TODO: Add ourselves to this list.
				URIs: file.normalizedURIs,
			};
		} catch(err) {
			console.error("ROLLBACK");
			console.error(err.query);
			console.error(err.args);
			var tasks = [];
			tasks.push(queryF(session.db, "ROLLBACK", []));
//			if(file.internalPath) tasks.push(unlinkF(file.internalPath));
			// Blindly unlinking is NOT SAFE if the file was a duplicate.
			// TODO: A more reasoned appraoch.
			Future.wait(tasks);
			throw err;
			// TODO: Submit patch to node-fibers to preserve original error information. Normally it uses `Object.create(error)` which does not work very well.
		}
	}, function(err, outgoingFile) {
		var repo = session.repo;
		callback(err, outgoingFile);
		if(!err) repo.emit("submission", outgoingFile);
		// Calling `callback` might cause us to close,
		// so save the repo first. We just want the
		// original caller to be the first to know.
	});
};
Session.prototype.submissionsForNormalizedURI = function(normalizedURI, callback/* (err, submissions) */) {
	var session = this;
	run(function() {
		if(!(session.mode & Session.O_RDONLY)) throw new Error("No permission");
		var tab = '\t';
		return queryF(session.db,
			'SELECT\n'
				+tab+'s."submissionID",\n'
				+tab+'EXTRACT(EPOCH FROM s."timestamp") AS "timestamp",\n'
				+tab+'u."username"\n'
			+'FROM "submissions" AS s\n'
			+'INNER JOIN "fileURIs" AS f ON (f."fileID" = s."fileID")\n'
			+'INNER JOIN "URIs" AS i ON (i."URIID" = f."URIID")\n'
			+'INNER JOIN "targets" AS t ON (t."submissionID" = s."submissionID")\n'
			+'INNER JOIN "users" AS u ON (u."userID" = s."userID")\n'
			+'WHERE i."normalizedURI" = $1 AND t."userID" = $2\n'
			+'ORDER BY s."submissionID" ASC',
			[normalizedURI, session.userID]).wait().rows;
	}, callback);
};
Session.prototype.fileForSubmissionID = function(submissionID, callback/* (err, file) */) {
	var session = this;
	run(function() {
		if(!(session.mode & Session.O_RDONLY)) throw new Error("No permission");
		var tab = '\t';
		var repo = session.repo;
		var file = queryF(session.db,
			'SELECT\n'
				+tab+'f."fileID", f."internalHash", f."type", f."size",\n'
				+tab+'EXTRACT(EPOCH FROM s."timestamp") AS "timestamp",\n'
				+tab+'u."username" AS "source"\n'
			+'FROM "files" AS f\n'
			+'INNER JOIN "submissions" AS s ON (s."fileID" = f."fileID")\n'
			+'INNER JOIN "targets" AS t ON (t."submissionID" = s."submissionID")\n'
			+'INNER JOIN "users" AS u ON (u."userID" = s."userID")\n'
			+'WHERE s."submissionID" = $1 AND t."userID" = $2',
			[submissionID, session.userID]).wait().rows[0];
		var URIs = queryF(session.db,
			'SELECT i."normalizedURI"\n'
			+'FROM "URIs" AS i\n'
			+'INNER JOIN "fileURIs" AS f ON (f."URIID" = i."URIID")\n'
			+'WHERE f."fileID" = $1',
			[file.fileID]).wait().rows.map(function(row) {
				return row.normalizedURI;
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
			timestamp: file.timestamp,
			fileID: file.fileID,
			internalHash: file.internalHash,
			internalPath: repo.internalPathForHash(file.internalHash),
			type: file.type,
			size: file.size,
			source: file.source,
			targets: targets,
			URIs: URIs,
		};
	}, callback);
};
Session.prototype.query = function(queryString, queryLanguage, callback/* (err, query) */) {
	var session = this;
	if(!(session.mode & Session.O_RDONLY)) return callback(new Error("No permission"), null);
	parseQueryString(queryString, queryLanguage, function(err, rawAST) {
		if(err) return callback(err);
		var ast = new AST.User(session.userID, rawAST);
		var query = new Query(session, ast);
		callback(null, query);
	});
};

function addFileRow(session, file, callback/* (err, fileID) */) {
	run(function() {
		queryF(session.db,
			'INSERT INTO "files" ("internalHash", "type", "size")\n'
			+'VALUES ($1, $2, $3)',
			[file.internalHash, file.type, file.size]).wait();
		return queryF(session.db,
			'SELECT "fileID" FROM "files"\n'
			+'WHERE "internalHash" = $1 AND "type" = $2',
			[file.internalHash, file.type]).wait().rows[0].fileID;
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
		try {
			linkF(src, dst).wait();
		} catch(err) {
			if("EEXIST" !== err.code) throw err; // TODO: Try `renameF()`?
		}
		if(!file.keepOriginal) unlinkF(src).wait();
	}, callback);
};
function addFileURIs(session, fileID, file, callback) {
	run(function() {
		if(!file.normalizedURIs.length) throw new Error("No URIs");
		addURIsF(session, file.normalizedURIs).wait();
		queryF(session.db,
			'INSERT INTO "fileURIs" ("fileID", "URIID")\n'
			+'SELECT $1, "URIID" FROM "URIs"\n'
			+'WHERE "normalizedURI" IN ('+sql.list1D(file.normalizedURIs, 2)+')',
			[fileID].concat(file.normalizedURIs)).wait();
	}, callback);
}
function addFileFields(session, fileID, file, callback) {
	run(function() {
		if(!file.fields.length) return;
		var fieldItems = file.fields.map(function(field) {
			return [fileID, field.name, field.value];
		});
		var list = fieldItems.map(function(val, index) {
			var offset = index * 3;
			var x = offset + 1;
			var y = offset + 2;
			var z = offset + 3;
			return '($'+x+', $'+y+', $'+z+', to_tsvector(\'english\', $'+z+'))';
		}).join(", ");
		var rows = queryF(session.db,
			'INSERT INTO "fields" ("fileID", "name", "value", "index")\n'
			+'VALUES '+list+'\n'
			+'RETURNING "fieldID"',
			sql.flatten(fieldItems)).wait().rows;
		var tasks = rows.map(function(row, i) {
			return addFieldPartsF(session, row.fieldID, file.fields[i]);
		});
		wait(tasks);
	}, callback);
}
function addFieldParts(session, fieldID, field, callback) {
	run(function() {
		var links = field.links;
		var scalars = field.scalars;
		var URIs = links.map(function(link) {
			return link.normalizedURI;
		});
		addURIsF(session, URIs).wait();

		var tab = '\t';
		var tasks = [];
		var linkItems = links.map(function(link) {
			return [link.normalizedURI, link.relation];
		});
		if(linkItems.length) tasks.push(queryF(session.db,
			'INSERT INTO "fieldLinks" ("fieldID", "URIID", "relation")\n'
			+'SELECT $1, u."URIID", v."relation"\n'
			+'FROM VALUES ('+sql.list1D(linkItems, 2, true)+')\n'
				+tab+'AS v ("normalizedURI", "relation")\n'
			+'INNER JOIN "URIs" AS u ON (u."normalizedURI" = v."normalizedURI")\n'
			+'WHERE TRUE',
			[fieldID].concat(sql.flatten(linkItems))
		));
		var scalarItems = scalars.map(function(scalar) {
			return [fieldID, scalar.type, scalar.value];
		});
		if(scalarItems.length) tasks.push(queryF(session.db,
			'INSERT INTO "fieldScalars" ("fieldID", "type", "value")\n'
			+'VALUES '+sql.list2D(scalarItems, 1)+'',
			sql.flatten(scalarItems)
		));
		wait(tasks);
	}, callback);
}
function addFileSubmissionTargets(session, submissionID, file, callback) {
	run(function() {
		var tab = '\t';
		var list = file.targets.length ? sql.list1D(file.targets, 3) : 'NULL';
		queryF(session.db,
			'INSERT INTO "targets" ("submissionID", "userID")\n'
			+'SELECT $1::bigint, $2\n'
				+tab+'UNION\n'
			+'SELECT $1::bigint, 0\n'
			+'WHERE \'public\' IN ('+list+')\n'
				+tab+'UNION\n'
			+'SELECT $1::bigint, "userID" FROM "users"\n'
			+'WHERE "username" IN ('+list+')',
			[submissionID, session.userID].concat(file.targets)).wait();
	}, callback);
}
function addURIs(session, normalizedURIs, callback) {
	run(function() {
		if(!normalizedURIs.length) return;
		queryF(session.db,
			'INSERT INTO "URIs" ("normalizedURI")\n'
			+'VALUES '+sql.list1D(normalizedURIs, 1, true)+'',
			normalizedURIs).wait();
	}, callback);
}

function parseQueryString(queryString, language, callback/* (err, AST) */) {
	for(var i = 0; i < parsers.length; ++i) {
		if(!parsers[i].acceptsLanguage(language)) continue;
		return parsers[i].parseQueryString(queryString, language, function(err, AST) {
			if(err) return callback(err, null);
			callback(null, AST);
		});
	}
	callback(new Error("Invalid language"), null);
};

Session.O_NONE = 0;
Session.O_RDONLY = 1 << 0;
Session.O_WRONLY = 1 << 1;
Session.O_RDWR = Session.O_RDONLY | Session.O_WRONLY;

