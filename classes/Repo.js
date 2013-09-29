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
module.exports = Repo;

var fs = require("fs");
var pathModule = require("path");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var crypto = require("crypto");
var urlModule = require("url");
var os = require("os");

var pg = require("pg");
var bcrypt = require("bcrypt");
var cookie = require("cookie");
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");
var has = require("../utilities/has");

var Session = require("./Session");

var queryF = Future.wrap(sql.debug);

var FORBIDDEN = {httpStatusCode: 403, message: "Forbidden"};

function Repo(path, config) {
	var repo = this;
	EventEmitter.call(this);
//	repo.setMaxListeners(0);
	// TODO: Enable this eventually.
	repo.config = config;
	repo.PATH = pathModule.resolve(path, config["path"] || "");
	repo.DATA = pathModule.resolve(repo.PATH, config["dataPath"] || "./entries");
	repo.TMP = os.tmpdir(); // TODO: Same volume as DATA?
	repo.KEY = pathModule.resolve(repo.PATH, config["keyPath"] || "./server.key");
	repo.CERT = pathModule.resolve(repo.PATH, config["certPath"] || "./server.crt");
	repo.db = new Error("Use `session.db` instead");
	repo.key = null;
	repo.cert = null;
}
util.inherits(Repo, EventEmitter);

Repo.prototype.internalPathForHash = function(internalHash) {
	var repo = this;
	return repo.DATA+"/"+internalHash.slice(0, 2)+"/"+internalHash;
};

Repo.prototype.auth = function(req, res, mode, callback/* (session) */) {
	var repo = this;
	var opts = urlModule.parse(req.url, true).query;
	var remember = has(opts, "r") && opts["r"];
	var db = dbClient(repo); // TODO: If the session fails, we just leak.
	if(has(opts, "u") && has(opts, "p")) {
		var username = opts["u"];
		var password = opts["p"];
		return repo.authUser(db, username, password, remember, mode, function(err, userID, session, mode) {
			if(err) return res.sendError(err);
			res.setHeader("Set-Cookie", cookie.serialize("s", session, {
				maxAge: remember ? 14 * 24 * 60 * 60 : 0,
				httpOnly: true,
				secure: repo.key && repo.cert, // TODO: Hack.
				path: "/",
			}));
			callback(null, new Session(repo, db, userID, mode));
		});
	}
	var cookies = cookie.parse(req.headers["cookie"] || "");
	if(has(cookies, "s")) {
		var session = cookies["s"];
		return repo.authSession(db, session, mode, function(err, userID, session, mode) {
			if(err) return res.sendError(err);
			callback(null, new Session(repo, db, userID, mode));
		});
	}
	repo.authPublic(db, mode, function(err, userID, session, mode) {
		if(err) return res.sendError(err);
		callback(null, new Session(repo, db, userID, mode));
	});
};
Repo.prototype.authUser = function(db, username, password, remember, mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	db.query(
		'SELECT "userID", "passwordHash", "tokenHash"\n'
		+'FROM "users" WHERE "username" = $1',
		[username],
		function(err, results) {
			var row = results.rows[0];
			if(err) return callback(FORBIDDEN, null, null, Session.O_NONE);
			if(results.rows.length < 1) return callback(FORBIDDEN, null, null, Session.O_NONE);
			if(bcrypt.compareSync(password, row.passwordHash)) {
				return createSession(repo, db, row.userID, Session.O_RDWR, remember, function(err, session, sessionMode) {
					if(err) return callback(err, null, null, Session.O_NONE);
					callback(null, row.userID, session, sessionMode);
				});
			}
			if((mode & Session.O_RDONLY) !== mode) return callback(FORBIDDEN, null, null, Session.O_NONE);
			if(bcrypt.compareSync(password, row.tokenHash)) {
				return createSession(repo, db, row.userID, Session.O_RDONLY, remember, function(err, session, sessionMode) {
					if(err) return callback(err, null, null, Session.O_NONE);
					callback(null, row.userID, session, sessionMode);
				});
			}
			callback(FORBIDDEN, null, null, Session.O_NONE);
		}
	);
};
Repo.prototype.authSession = function(db, sessionBlob, mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	var match = /(\d+):(.*)+/.exec(sessionBlob);
	if(!match) return callback(new Error("Invalid session"), null, null, Session.O_NONE);
	var sessionID = match[1];
	var session = match[2];
	db.query(
		'SELECT "sessionHash", "userID", "modeRead", "modeWrite" FROM "sessions"\n'
		+'WHERE "sessionID" = $1 AND "sessionTime" > NOW() - INTERVAL \'14 days\'',
		[sessionID],
		function(err, results) {
			if(err) return callback(err, null, null, Session.O_NONE);
			if(results.rows.length < 1) return callback(FORBIDDEN, null, null, Session.O_NONE);
			var row = results.rows[0];
			var sessionMode =
				(row.modeRead ? Session.O_RDONLY : 0) |
				(row.modeWrite ? Session.O_WRONLY : 0);
			// TODO: If FORBIDDEN, tell the client to clear the cookie?
			// Not in the case of insufficient mode though.
			if((mode & sessionMode) !== mode) return callback(FORBIDDEN, null, null, Session.O_NONE);
			if(bcrypt.compareSync(session, row.sessionHash)) {
				return callback(null, row.userID, sessionBlob, sessionMode);
			}
			callback(FORBIDDEN, null, null, Session.O_NONE);
		}
	);
};
Repo.prototype.authPublic = function(db, mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	var publicMode = Session.O_RDONLY; // TODO: Configurable.
	if((mode & publicMode) !== mode) return callback(FORBIDDEN, null, null, Session.O_NONE);
	callback(null, 0, null, publicMode);
};
function createSession(repo, db, userID, mode, remember, callback/* (err, session, mode) */) {
	crypto.randomBytes(20, function(err, buffer) {
		var session = buffer.toString("base64");
		var sessionHash = bcrypt.hashSync(session, 10);
		db.query(
			'INSERT INTO "sessions"\n\t'
				+'("sessionHash", "userID", "modeRead", "modeWrite")\n'
			+'VALUES ($1, $2, $3, $4)\n'
			+'RETURNING "sessionID"',
			[sessionHash, userID, Boolean(mode & Session.O_RDONLY), Boolean(mode & Session.O_WRONLY)],
			function(err, result) {
				var row = result.rows[0];
				if(err) return callback(err, null);
				callback(null, row.sessionID+":"+session, mode);
			}
		);
	});
}

Repo.prototype.loadPulls = function() {
	var repo = this;
	Fiber(function() {
		var db = dbClient(repo);
		var rows = queryF(db,
			'SELECT\n\t'
				+'"pullID",\n\t'
				+'"userID",\n\t'
				+'"targets",\n\t'
				+'"URI",\n\t'
				+'"queryString",\n\t'
				+'"queryLanguage",\n\t'
				+'"username",\n\t'
				+'"password"\n'
			+'FROM "pulls" WHERE TRUE',
			[]).wait().rows;
		rows.forEach(function(row) {
			var pull = repo.pulls[row.pullID];
			if(pull) pull.close();
			var session = new Session(repo, db, row.userID, Session.O_WRONLY);
			pull = new Pull(session, row);
			repo.pulls[row.pullID] = pull;
		});
		// On a big server this could be a ton of objects! Several per user on average.
		// Each pull is backed by a persistent HTTP request, so that is probably the bottleneck, if any.
	}).run();
};


Repo.load = function(path, callback/* (err, repo) */) {
	var configPath = pathModule.resolve(path, "./EarthFS.json");
	fs.readFile(configPath, "utf8", function(err, config) {
		if(err) return callback(err, null);
		var repo = new Repo(path, JSON.parse(config));
		var remaining = 2;
		fs.readFile(repo.KEY, function(err, data) {
			if(!err) repo.key = data;
			if(!--remaining) callback(null, repo);
		});
		fs.readFile(repo.CERT, function(err, data) {
			if(!err) repo.cert = data;
			if(!--remaining) callback(null, repo);
		});
	});
};
Repo.loadSync = function(path) {
	var configPath = pathModule.resolve(path, "./EarthFS.json");
	var repo = new Repo(path, JSON.parse(fs.readFileSync(configPath, "utf8")));
	try { repo.key = fs.readFileSync(repo.KEY); } catch(e) {}
	try { repo.cert = fs.readFileSync(repo.CERT); } catch(e) {}
	return repo;
};

function dbClient(repo) {
	var db = new pg.Client(repo.config["db"]);
	db.connect();
	return db;
}

