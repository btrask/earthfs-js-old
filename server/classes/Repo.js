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
var EventEmitter = require("events").EventEmitter;
var util = require("util");

var pg = require("pg");
var mkdirp = require("mkdirp");

var bt = require("../utilities/bt");
var sql = require("../utilities/sql");
var fsx = require("../utilities/fsx");

var EXT = require("../utilities/ext.json");

var Hashers, Parsers; // Only loaded once the Repo.makeWriteable() is called.

function randomString(length, charset) { // TODO: Put this somewhere.
	var chars = [], i;
	for(i = 0; i < length; ++i) chars.push(charset[Math.floor(Math.random() * charset.length)]);
	return chars.join("");
}

function Repo(path, config) {
	var repo = this;
	EventEmitter.call(this);
	repo.PATH = path;
	repo.config = config;
	repo.DATA = pathModule.resolve(repo.PATH, config["dataPath"] || "./data");
	repo.CACHE = pathModule.resolve(repo.PATH, config["cachePath"] || "./cache");
	repo.LOG = pathModule.resolve(repo.PATH, config["logPath"] || "./entries.log");
	repo.KEY = pathModule.resolve(repo.PATH, config["keyPath"] || "./server.key");
	repo.CERT = pathModule.resolve(repo.PATH, config["certPath"] || "./server.crt");
	repo.log = fs.createWriteStream(repo.LOG, {flags: "a", encoding: "utf8"});
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
Repo.prototype.addEntryStream = function(stream, type, callback/* (err, primaryURN) */) {
	if(!Repo.writeable) throw new Error("Repo loaded in read-only mode");
	var repo = this;
	var tmp = pathModule.resolve(os.tmpDir(), randomString(32, "0123456789abcdef"));
	var h = new Hashers(type);
	var p = new Parsers(type);
	var f = fs.createWriteStream(tmp);
	var length = 0;
	stream.on("data", function(chunk) {
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
			var path = repo.pathForEntry(repo.DATA, h.internalHash, type);
			mkdirp(pathModule.dirname(path), function(err) {
				if(err) return callback(err, null);
				fsx.moveFile(tmp, path, function(err) {
					if(err) {
						if("EEXIST" === err.code) return callback(null, h.primaryURN);
						return callback(err, null);
					}
					addEntry(repo, null, type, h, p, callback);
				});
			});
		});
	});
};
function addEntry(repo, source, type, h, p, callback/* (err, primaryURN) */) {
	if(!Repo.writeable) throw new Error("Repo loaded in read-only mode");

	repo.log.write(JSON.stringify({
		"date": new Date().toISOString(),
		"internalHash": h.internalHash,
		"type": type,
		"source": source,
	})+"\n");

	sql.debug(repo.db,
		'INSERT INTO "entries" ("hash", "type", "fulltext")'+
		' VALUES ($1, $2, to_tsvector(\'english\', $3)) RETURNING "entryID"',
		[h.internalHash, type, p.fullText],
		function(err, results) {
			if(err) return callback(err, null);
			var entryID = results.rows[0].entryID;
			var allLinks = h.URNs.concat(p.links, p.metaEntries, p.metaLinks).unique();
			sql.debug(repo.db,
				'INSERT INTO "URIs" ("URI")'+
				' VALUES '+sql.list2D(allLinks, 1)+'', allLinks,
				function(err, results) {
					if(err) return callback(err, null);
					sql.debug(repo.db,
						'UPDATE "URIs" SET "entryID" = $1'+
						' WHERE "URI" IN ('+sql.list1D(h.URNs, 2)+')',
						[entryID].concat(h.URNs),
						function(err, results) {
							if(err) return callback(err, null);
							if(!p.links.length) {
								callback(null, h.primaryURN);
								repo.emit("entry", h.primaryURN, entryID);
								return;
							}
							sql.debug(repo.db,
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
									callback(null, h.primaryURN);
									repo.emit("entry", h.primaryURN, entryID);
								}
							);
						}
					);
				}
			);
		}
	);

}

Repo.writeable = false;
Repo.makeWriteable = function() {
	if(Repo.writeable) return;
	Repo.writeable = true;
	Hashers = require("../hashers");
	Parsers = require("../parsers");
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

module.exports = Repo;
