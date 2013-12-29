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
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");
var has = require("../utilities/has");
var run = require("../utilities/fiber-helper").run;
var cookieModule = require("../utilities/cookie");

var Session = require("./Session");
var Pull = require("./Pull");

var queryF = Future.wrap(sql.debug);
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
	repo.DATA = pathModule.resolve(repo.PATH, config["dataPath"] || "./data");
	repo.CACHE = pathModule.resolve(repo.PATH, config["cachePath"] || "./cache");
	repo.TMP = os.tmpdir(); // TODO: Same volume as DATA?
	repo.KEY = pathModule.resolve(repo.PATH, config["keyPath"] || "./server.key");
	repo.CERT = pathModule.resolve(repo.PATH, config["certPath"] || "./server.crt");
	repo.db = new Error("Use `session.db` instead");
	repo.key = null;
	repo.cert = null;
	repo.pulls = {};
}
util.inherits(Repo, EventEmitter);

Repo.prototype.internalPathForHash = function(internalHash) {
	var repo = this;
	return repo.DATA+"/"+internalHash.slice(0, 2)+"/"+internalHash;
};

Repo.prototype.auth = function(opts, callback/* (err, session) */) {
	var repo = this;
	run(function() {
		if(isNaN(opts.mode)) throw new Error("Invalid mode");
		if(Session.O_NONE === opts.mode) throw new Error("Mode must be set");
		var db = dbClientF(repo).wait();
		try {
			if(opts.username && opts.password) return authUserF(repo, db, opts).wait();
			if(opts.cookie) return authSessionF(repo, db, opts).wait();
			return authPublicF(repo, db, opts).wait();
		} catch(err) {
			db.done();
			throw err;
		}
	}, callback);
};
Repo.prototype.authPull = function(pull, callback/* (err, session) */) {
	var repo = this;
	run(function() {
		if(repo.pulls[pull.userID] !== pull) throw new Error("Invalid pull");
		var db = dbClientF(repo).wait();
		return new Session(repo, db, pull.userID, Session.O_RDWR);
		// RDWR because we have to be able to check if the hash already exists.
	}, callback);
};

Repo.prototype.loadPulls = function() {
	var repo = this;
	Fiber(function() {
		var db = dbClientF(repo).wait();
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
		db.done();
		db = null;
		rows.forEach(function(row) {
			var pull = repo.pulls[row.pullID];
			if(pull) pull.close();
			pull = new Pull(repo, row);
			repo.pulls[row.pullID] = pull;
			pull.connect();
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


function dbClient(repo, callback) {
	pg.connect(repo.config["db"], function(err, db, done) {
		if(err) return callback(err, null);
		db.done = done; // Why is this not set up by default?
		callback(null, db);
	});
}
function authUser(repo, db, opts, callback) {
	run(function() {
		var row = queryF(db,
			'SELECT "userID", "passwordHash", "tokenHash"\n'
			+'FROM "users" WHERE "username" = $1',
			[opts.username]).wait().rows[0];
		if(!row) throw forbidden();
		if(bcrypt.compareSync(opts.password, row.passwordHash)) {
			return createSessionF(repo, db, row.userID, Session.O_RDWR, opts.remember).wait();
		}
		if((opts.mode & Session.O_RDONLY) !== opts.mode) throw forbidden();
		// TODO: Are these read-only tokens a good idea?
		// If so, maybe it should be null by default, in which case we should check.
		if(bcrypt.compareSync(opts.password, row.tokenHash)) {
			return createSessionF(repo, db, row.userID, Session.O_RDONLY, opts.remember).wait();
		}
		throw forbidden();
	}, callback);
};
function authSession(repo, db, opts, callback) {
	run(function() {
		var obj = /(\d+):(.*)+/.exec(opts.cookie);
		if(!obj) throw new Error("Invalid session "+opts.cookie);
		var sessionID = obj[1];
		var sessionKey = obj[2];
		var row = queryF(db,
			'SELECT "userID", "modeRead", "modeWrite" FROM "sessions"\n'
			+'WHERE "sessionID" = $1 AND "sessionKey" = $2\n'
				+'\t'+'AND "timestamp" > NOW() - INTERVAL \'14 days\'',
			[sessionID, sessionKey]).wait().rows[0];
		if(!row) throw forbidden();
		var sessionMode =
			(row.modeRead ? Session.O_RDONLY : 0) |
			(row.modeWrite ? Session.O_WRONLY : 0);
		if((opts.mode & sessionMode) !== opts.mode) throw forbidden();
		return new Session(repo, db, row.userID, sessionMode);
	}, callback);
};
function authPublic(repo, db, opts, callback) {
	run(function() {
		var publicMode = Session.O_RDONLY; // TODO: Configurable.
		if((opts.mode & publicMode) !== opts.mode) throw forbidden();
		return new Session(repo, db, 0, publicMode);
	}, callback);
};
function createSession(repo, db, userID, mode, remember, callback) {
	run(function() {
		var sessionKey = randomBytesF(20).wait().toString("base64");
		var modeRead = Boolean(mode & Session.O_RDONLY);
		var modeWrite = Boolean(mode & Session.O_WRONLY);
		var row = queryF(db,
			'INSERT INTO "sessions"\n'
				+'\t'+'("sessionKey", "userID", "modeRead", "modeWrite")\n'
			+'VALUES ($1, $2, $3, $4)\n'
			+'RETURNING "sessionID"',
			[sessionKey, userID, modeRead, modeWrite]).wait().rows[0];
		if(!row) throw new Error("Unable to create session");
		var cookie = cookieModule.formatSingle({
			name: "s",
			value: row.sessionID+":"+sessionKey,
			"MaxAge": remember ? 14 * 24 * 60 * 60 : 0,
			"HttpOnly": true,
			"Secure": Boolean(repo.key && repo.cert), // TODO: Hack.
			"Path": "/",
		});
		return new Session(repo, db, userID, mode, cookie);
	}, callback);
}
function forbidden() {
	var err = new Error("Forbidden");
	err.httpStatusCode = 403;
	return err;
}

