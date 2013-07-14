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
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var crypto = require("crypto");

var pg = require("pg");
var bcrypt = require("bcrypt");

var bt = require("../utilities/bt");

var EXT = require("../utilities/ext.json");

var FORBIDDEN = {httpStatusCode: 403, message: "Forbidden"};

function Repo(path, config) {
	var repo = this;
	EventEmitter.call(this);
//	repo.setMaxListeners(0);
	repo.PATH = path;
	repo.config = config;
	repo.DATA = pathModule.resolve(repo.PATH, config["dataPath"] || "./data");
	repo.CACHE = pathModule.resolve(repo.PATH, config["cachePath"] || "./cache");
	repo.KEY = pathModule.resolve(repo.PATH, config["keyPath"] || "./server.key");
	repo.CERT = pathModule.resolve(repo.PATH, config["certPath"] || "./server.crt");
	repo.db = new pg.Client(repo.config.db); // TODO: Use client pool.
	repo.db.connect();
	repo.key = null;
	repo.cert = null;
	repo.clients = [];
}
util.inherits(Repo, EventEmitter);

Repo.prototype.pathForEntry = function(dir, hash, type) {
	var t = type.split(";")[0];
	if(!bt.has(EXT, t)) throw new Error("Invalid MIME type "+type);
	return dir+"/"+hash.slice(0, 2)+"/"+hash+"."+EXT[t];
};

Repo.prototype.authUser = function(username, password, remember, mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	repo.db.query(
		'SELECT "userID", "passwordHash", "tokenHash"'+
		' FROM "users" WHERE "username" = $1',
		[username],
		function(err, results) {
			var row = results.rows[0];
			if(err) return callback(FORBIDDEN, null, null, Repo.O_NONE);
			if(results.rows.length < 1) return callback(FORBIDDEN, null, null, Repo.O_NONE);
			if(bcrypt.compareSync(password, row.passwordHash)) {
				return createSession(repo, row.userID, Repo.O_RDWR, remember, function(err, session, sessionMode) {
					if(err) return callback(err, null, null, Repo.O_NONE);
					callback(null, row.userID, session, sessionMode);
				});
			}
			if((mode & Repo.O_RDONLY) !== mode) return callback(FORBIDDEN, null, null, Repo.O_NONE);
			if(bcrypt.compareSync(password, row.tokenHash)) {
				return createSession(repo, row.userID, Repo.O_RDONLY, remember, function(err, session, sessionMode) {
					if(err) return callback(err, null, null, Repo.O_NONE);
					callback(null, row.userID, session, sessionMode);
				});
			}
			callback(FORBIDDEN, null, null, Repo.O_NONE);
		}
	);
};
Repo.prototype.authSession = function(sessionBlob, mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	var match = /(\d+):(.*)+/.exec(sessionBlob);
	if(!match) return callback(new Error("Invalid session"), null, null, Repo.O_NONE);
	var sessionID = match[1];
	var session = match[2];
	repo.db.query(
		'SELECT "sessionHash", "userID", "modeRead", "modeWrite" FROM "sessions"'+
		' WHERE "sessionID" = $1 AND "sessionTime" > NOW() - INTERVAL \'14 days\'',
		[sessionID],
		function(err, results) {
			if(err) return callback(err, null, null, Repo.O_NONE);
			if(results.rows.length < 1) return callback(FORBIDDEN, null, null, Repo.O_NONE);
			var row = results.rows[0];
			var sessionMode =
				(row.modeRead ? Repo.O_RDONLY : 0) |
				(row.modeWrite ? Repo.O_WRONLY : 0);
			// TODO: If FORBIDDEN, tell the client to clear the cookie?
			// Not in the case of insufficient mode though.
			if((mode & sessionMode) !== mode) return callback(FORBIDDEN, null, null, Repo.O_NONE);
			if(bcrypt.compareSync(session, row.sessionHash)) {
				return callback(null, row.userID, sessionBlob, sessionMode);
			}
			callback(FORBIDDEN, null, null, Repo.O_NONE);
		}
	);
};
Repo.prototype.authPublic = function(mode, callback/* (err, userID, session, mode) */) {
	var repo = this;
	var publicMode = Repo.O_RDONLY; // TODO: Configurable.
	if((mode & publicMode) !== mode) return callback(FORBIDDEN, null, null, Repo.O_NONE);
	callback(null, 0, null, publicMode);
};
function createSession(repo, userID, mode, remember, callback/* (err, session, mode) */) {
	crypto.randomBytes(20, function(err, buffer) {
		var session = buffer.toString("base64");
		var sessionHash = bcrypt.hashSync(session, 10);
		repo.db.query(
			'INSERT INTO "sessions" ("sessionHash", "userID", "modeRead", "modeWrite")'+
			' VALUES ($1, $2, $3, $4) RETURNING "sessionID"',
			[sessionHash, userID, Boolean(mode & Repo.O_RDONLY), Boolean(mode & Repo.O_WRONLY)],
			function(err, result) {
				var row = result.rows[0];
				if(err) return callback(err, null);
				callback(null, row.sessionID+":"+session, mode);
			}
		);
	});
}

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

Repo.O_NONE = 0;
Repo.O_RDONLY = 1 << 0;
Repo.O_WRONLY = 1 << 1;
Repo.O_RDWR = Repo.O_RDONLY | Repo.O_WRONLY;

module.exports = Repo;
