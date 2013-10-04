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
var cookieModule = require("cookie");
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");
var has = require("../utilities/has");
var run = require("../utilities/fiber-helper").run;

var Session = require("./Session");

var queryF = Future.wrap(sql.debug);
var authF = Future.wrap(auth);
var authUserF = Future.wrap(authUser);
var authSessionF = Future.wrap(authSession);
var authPublicF = Future.wrap(authPublic);
var createSessionF = Future.wrap(createSession);
var dbClientF = Future.wrap(dbClient);
var randomBytesF = Future.wrap(crypto.randomBytes, 1);

function Repo(path, config) {
	var repo = this;
	EventEmitter.call(this);
//	repo.setMaxListeners(0);
	// TODO: Enable this eventually.
	repo.config = config;
	repo.PATH = pathModule.resolve(path, config["path"] || ".");
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

Repo.prototype.auth = function(req, res, url, mode, callback/* (err, session) */) {
	var repo = this;
	var db;
	run(function() {
		db = dbClientF(repo).wait();
		var session = authF(repo, db, req, res, url, mode).wait();
		if(session.cookie) res.setHeader("Set-Cookie", session.cookie);
		return session;
	}, function(err, session) {
		if(err && db) db.end();
		callback(err, session);
	});
};
function auth(repo, db, req, res, url, mode, callback) {
	run(function() {
		var opts = url.query;
		if(has(opts, "u") && has(opts, "p")) {
			var username = opts["u"];
			var password = opts["p"];
			var remember = has(opts, "r") && opts["r"];
			return authUserF(repo, db, username, password, mode, remember).wait();
		}
		var cookies = cookieModule.parse(req.headers["cookie"] || "");
		if(has(cookies, "s")) {
			var cookie = cookies["s"];
			return authSessionF(repo, db, cookie, mode).wait();
		}
		return authPublicF(repo, db, mode).wait();
	}, callback);
}
function authUser(repo, db, username, password, mode, remember, callback) {
	run(function() {
		var row = queryF(db,
			'SELECT "userID", "passwordHash", "tokenHash"\n'
			+'FROM "users" WHERE "username" = $1',
			[username]).wait().rows[0];
		if(!row) throw httpError(403);
		if(bcrypt.compareSync(password, row.passwordHash)) {
			return createSessionF(repo, db, row.userID, Session.O_RDWR, remember).wait();
		}
		if((mode & Session.O_RDONLY) !== mode) throw httpError(403);
		// TODO: Are these read-only tokens a good idea?
		// If so, maybe it should be null by default, in which case we should check.
		if(bcrypt.compareSync(password, row.tokenHash)) {
			return createSessionF(repo, db, row.userID, Session.O_RDONLY, remember).wait();
		}
		throw httpError(403);
	}, callback);
};
function authSession(repo, db, cookie, mode, callback) {
	run(function() {
		var obj = /(\d+):(.*)+/.exec(cookie);
		if(!obj) throw new Error("Invalid session");
		var sessionID = obj[1];
		var sessionKey = obj[2];
		var row = queryF(db,
			'SELECT "sessionHash", "userID", "modeRead", "modeWrite" FROM "sessions"\n'
			+'WHERE "sessionID" = $1 AND "sessionTime" > NOW() - INTERVAL \'14 days\'',
			[sessionID]).wait().rows[0];
		if(!row) throw httpError(403);
		var sessionMode =
			(row.modeRead ? Session.O_RDONLY : 0) |
			(row.modeWrite ? Session.O_WRONLY : 0);
		// TODO: If FORBIDDEN, tell the client to clear the cookie?
		// Not in the case of insufficient mode though.
		if((mode & sessionMode) !== mode) throw httpError(403);
		if(bcrypt.compareSync(sessionKey, row.sessionHash)) {
			return new Session(repo, db, row.userID, sessionMode);
		}
		throw httpError(403);
	}, callback);
};
function authPublic(repo, db, mode, callback) {
	run(function() {
		var publicMode = Session.O_RDONLY; // TODO: Configurable.
		if((mode & publicMode) !== mode) throw httpError(403);
		return new Session(repo, db, 0, publicMode);
	}, callback);
};
function createSession(repo, db, userID, mode, remember, callback) {
	run(function() {
		var sessionKey = randomBytesF(20).wait().toString("base64");
		var sessionHash = bcrypt.hashSync(sessionKey, 10); // TODO: Use async?
		var modeRead = Boolean(mode & Session.O_RDONLY);
		var modeWrite = Boolean(mode & Session.O_WRONLY);
		var row = queryF(db,
			'INSERT INTO "sessions"\n'
				+'\t'+'("sessionHash", "userID", "modeRead", "modeWrite")\n'
			+'VALUES ($1, $2, $3, $4)\n'
			+'RETURNING "sessionID"',
			[sessionHash, userID, modeRead, modeWrite]).wait().rows[0];
		if(!row) throw new Error("Unable to create session");
		var c = cookieModule.serialize("s", row.sessionID+":"+sessionKey, {
			maxAge: remember ? 14 * 24 * 60 * 60 : 0,
			httpOnly: true,
			secure: repo.key && repo.cert, // TODO: Hack.
			path: "/",
		});
		return new Session(repo, db, userID, mode, c);
	}, callback);
}

Repo.prototype.loadPulls = function() {
	var repo = this;
	var db;
	run(function() {
		db = dbClientF(repo).wait();
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
			// TODO: We can't just pass in the same DB to all of these!
			// But we also can't just open a million connections!
			// What to do?
			var session = new Session(repo, db, row.userID, Session.O_WRONLY);
			pull = new Pull(session, row);
			repo.pulls[row.pullID] = pull;
		});
		// On a big server this could be a ton of objects! Several per user on average.
		// Each pull is backed by a persistent HTTP request, so that is probably the bottleneck, if any.
	}, function(err) {
		if(err && db) db.end();
		if(err) throw err;
	});
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

function dbClient(repo, callback) {
	var db = new pg.Client(repo.config["db"]);
	db.connect(function(err) {
		if(err) return callback(err, null);
		callback(null, db);
	});
}
function httpError(statusCode) {
	var err = new Error("HTTP status code "+statusCode);
	err.httpStatusCode = statusCode;
	return err;
}

