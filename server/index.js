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
if(process.argv.length < 2) {
	console.error("Usage: earthfs [repo-path]");
	process.exit();
}

var crypto = require("crypto");
var pathModule = require("path");
var urlModule = require("url");
var util = require("util");
var os = require("os");
var fs = require("fs");
var https = require("https");
var ReadableStream = require("stream").Readable;

var pg = require("pg");
var multiparty = require("multiparty");
var mkdirp = require("mkdirp");
var bcrypt = require("bcrypt");
var cookie = require("cookie");

var bt = require("./utilities/bt");
var fsx = require("./utilities/fsx");
var http = require("./utilities/httpx");
var sql = require("./utilities/sql");

var formatters = require("./formatters");
var querylang = require("./query-languages");
var queryModule = require("./classes/query");

var Client = require("./classes/Client");
var query = require("./classes/query");
var Repo = require("./classes/Repo");
var Session = require("./classes/Session");

var CLIENT = __dirname+"/../build";

var EXT = require("./utilities/ext.json");
var MIME = require("./utilities/mime.json");
var QUERY_TYPES = ["text/html", "text/json"];

var repo = Repo.loadSync(process.argv[2]);

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function auth(req, res, repo, mode, callback/* (session) */) {
	var opts = urlModule.parse(req.url, true).query;
	var remember = bt.has(opts, "r") && opts["r"];
	if(bt.has(opts, "u") && bt.has(opts, "p")) {
		var username = opts["u"];
		var password = opts["p"];
		return repo.authUser(username, password, remember, mode, function(err, userID, session, mode) {
			if(err) return res.sendError(err);
			res.setHeader("Set-Cookie", cookie.serialize("s", session, {
				maxAge: remember ? 14 * 24 * 60 * 60 : 0,
				httpOnly: true,
				secure: "https:" === server.protocol, // TODO: Hack.
				path: "/",
			}));
			callback(null, new Session(repo, userID, mode));
		});
	}
	var cookies = cookie.parse(req.headers["cookie"] || "");
	if(bt.has(cookies, "s")) {
		var session = cookies["s"];
		return repo.authSession(session, mode, function(err, userID, session, mode) {
			if(err) return res.sendError(err);
			callback(null, new Session(repo, userID, mode));
		});
	}
	repo.authPublic(mode, function(err, userID, session, mode) {
		if(err) return res.sendError(err);
		callback(null, new Session(repo, userID, mode));
	});
}

var server;
if(repo.key && repo.cert) {
	server = https.createServer({
		key: repo.key,
		cert: repo.cert,
		honorCipherOrder: true,
	}, dispatch);
	server.protocol = "https:";
} else {
	server = http.createServer(dispatch);
	server.protocol = "http:";
}


var handlers = [];
function dispatch(req, res) {
	var url = urlModule.parse(req.url, true);
	var i, handler, method, path;
	for(i = 0; i < handlers.length; ++i) {
		handler = handlers[i];
		method = handler.method.exec(req.method);
		if(!method) continue;
		path = handler.path.exec(url.pathname);
		if(!path) continue;
		handler.func.apply(this,
			[req, res, url]
			.concat(method.slice(1))
			.concat(path.slice(1))
		);
		return;
	}
	res.sendMessage(404, "Not Found");
}
function register(method, path, func/* (req, res, url, arg1, arg2, etc) */) {
	handlers.push({method: method, path: path, func: func});
}

register(/^GET$/, /^\/api\/entry\/([\w\d:%]+)\/meta\/?$/, function(req, res, url, encodedURN) {
	var URN = decodeURIComponent(encodedURN);
	// TODO: Man these queries are redundant. We should probably look up the entry ID separately, at least.
	// TODO: Authenticate.
	repo.db.query(
		'SELECT DISTINCT COALESCE(u."username", \'public\') AS "source"'+
		' FROM "sources" AS s'+
		' LEFT JOIN "users" AS u ON (u."userID" = s."userID")'+
		' LEFT JOIN "URIs" AS n ON (n."entryID" = s."entryID")'+
		' WHERE (u."username" IS NOT NULL OR s."userID" = 0) AND n."URI" = $1', [URN],
		function(err, results) {
			if(err) return res.sendError(err);
			var sources = results.rows.map(function(row) {
				return row.source;
			});
			repo.db.query(
				'SELECT DISTINCT COALESCE(u."username", \'public\') AS "target"'+
				' FROM "targets" AS t'+
				' LEFT JOIN "users" AS u ON (u."userID" = t."userID")'+
				' LEFT JOIN "URIs" AS n ON (n."entryID" = t."entryID")'+
				' WHERE (u."username" IS NOT NULL OR t."userID" = 0) AND n."URI" = $1', [URN],
				function(err, results) {
					if(err) return res.sendError(err);
					var targets = results.rows.map(function(row) {
						return row.target;
					});
					res.sendJSON(200, "OK", {
						"sources": sources,
						"targets": targets,
						"URNs": [],
						// TODO: Alternate URNs, earliest submission date?
					});
				}
			);
		}
	);
});
register(/^GET$/, /^\/api\/entry\/([\w\d:%]+)\/?$/, function(req, res, url, encodedURN) {
	var URN = decodeURIComponent(encodedURN);
	// TODO: Authenticate.
	repo.db.query(
		'SELECT e."entryID", e."hash", e."type"'+
		' FROM "entries" AS e'+
		' LEFT JOIN "URIs" AS u ON (u."entryID" = e."entryID")'+
		' WHERE u."URI" = $1', [URN],
		function(err, results) {
			if(err) {
				res.sendError(err);
				return;
			}
			if(!results.rows.length) {
				res.sendMessage(404, "Not Found");
				return;
			}
			var row = results.rows[0];
			var srcType = row.type;
			var srcPath = repo.pathForEntry(repo.DATA, row.hash, srcType);
			var dstTypes = (req.headers.accept || "*/*").split(",");
			sendFormatted(req, res, srcPath, srcType, dstTypes, row.hash);
		}
	);
});
register(/^POST$/, /^\/api\/entry\/?$/, function(req, res, url) {
	auth(req, res, repo, Repo.O_WRONLY, function(err, session) {
		if(err) return res.sendError(err);
		var targets = String(url.query["t"] || "").split("\n");
		addEntry(req, res, session, targets);
	});
});
register(/^GET$/, /^\/api\/latest\/?$/, function(req, res, url) {
	auth(req, res, repo, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var queryString = (url.query["q"] || "").split("+").map(decodeURIComponent).join(" ");
		querylang.parse(queryString, "simple", function(err, query) {
			query = new queryModule.User(session.userID, query); // TODO: Kind of ugly.
			var client = new Client(repo, query, res);
			var tab = "\t";
			var obj = query.SQL(1, tab+"\t");
			var history = url.query["history"];
			var limit = "all" === history ? '' : tab+'LIMIT '+(history >>> 0)+'\n';
			var fullSQL =
				'SELECT * FROM (\n'+
					tab+'SELECT e."entryID", \'urn:sha1:\' || e."hash" AS "URN"\n'+
					tab+'FROM "entries" AS e\n'+
					tab+'WHERE e."entryID" IN\n'+
						obj.query+
					tab+'ORDER BY e."entryID" DESC\n'+
						limit+
				') x ORDER BY "entryID" ASC';
			var stream = sql.debug2(repo.db,
				fullSQL,
				obj.parameters
			);
			res.writeHead(200, {"Content-Type": "text/json; charset=utf-8"});
			stream.on("row", function(row) {
				res.write(row.URN+"\n", "utf8");
			});
			stream.on("end", function() {
				client.resume();
			});
			stream.on("error", function(err) {
				console.log(err);
			});
		});
	});
});

// Last
register(/^GET$/, /.*/, function(req, res, url) {
	if(-1 !== url.pathname.indexOf("..")) return res.sendMessage(400, "Bad Request");
	var path = CLIENT+url.pathname;
	fs.stat(path, function(err, stats) {
		if(err) return res.sendError(err);
		res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
	});
});

function sendFormatted(req, res, srcPath, srcType, dstTypes, hash) {
	var obj = formatters.select(srcType, dstTypes);
	if(!obj) {
		res.sendMessage(406, "Not Acceptable");
		return;
	}
	var dstType = obj.dstType;
	var dstPath = dstType === srcType ? srcPath : repo.pathForEntry(repo.CACHE, hash, dstType);
	var format = obj.format;
	if("text/" === dstType.slice(0, 5)) dstType += "; charset=utf-8";

	function sendFile(path, stats) {
		var stream = fs.createReadStream(dstPath);
		res.writeHead(200, {
			"Content-Type": dstType,
			"Content-Length": stats.size,
		});
		stream.pipe(res);
	}

	fs.stat(dstPath, function(err, stats) {
		if(!err) {
			sendFile(dstPath, stats);
		} else if("ENOENT" === err.code) {
			if(!format) return res.sendError(err);
			mkdirp(pathModule.dirname(dstPath), function(err) {
				if(err) return res.sendError(err);
				format(srcPath, dstPath, function(err) {
					if(err) return res.sendError(err);
					fs.stat(dstPath, function(err, stats) {
						if(err) return res.sendError(err);
						sendFile(dstPath, stats);
					});
				});
			});
		} else {
			res.sendError(err);
		}
	});
}
function addEntry(req, res, session, targets) {
	var form = new multiparty.Form();
	form.on("part", function(part) {
		if("entry" !== part.name) return; // TODO: Is skipping other parts a good idea?
		var ext = pathModule.extname(part.filename);
		var type = bt.has(MIME, ext) ? MIME[ext] : part.headers["content-type"];
		// TODO: Keep charset if possible.
		session.addEntryStream(part, type, targets, function(err, primaryURN) {
			if(err) return res.sendError(err);
			res.writeHead(303, {"Location": primaryURN});
			res.end();
		});
	});
//	form.addListener("error", function(err) {
//		console.log("hmm", err);
//		res.sendMessage(500, "Internal Server Error");
//	});
	form.parse(req);
}

var PORT = repo.config.port >>> 0 || 8001;
server.listen(PORT, function() {
	console.log(""+server.protocol+"//localhost:"+PORT+"/"); // TODO: Use urlModule.format()?
	// TODO: Optionally set up NAT traversal/UPnP.
});

var Remote = require("./classes/Remote");
repo.db.query(
	'SELECT "userID", "targets", "remoteURL", "query", "username", "password" FROM "remotes" WHERE TRUE', [],
	function(err, results) {
		if(err) return console.log(err);
		results.rows.forEach(function(row) {
			var remote = new Remote(
				new Session(repo, row.userID, Repo.O_WRONLY),
				row.targets,
				row.remoteURL,
				row.query,
				row.username,
				row.password
			); // TODO: These arguments are getting a little unwieldy...
		});
	}
);
