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
var formidable = require("formidable");
var mkdirp = require("mkdirp");
var bcrypt = require("bcrypt");

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
Repo.makeWriteable();

var CLIENT = __dirname+"/../build";

var EXT = require("./utilities/ext.json");
var MIME = require("./utilities/mime.json");
var QUERY_TYPES = ["text/html", "text/json"];

var repo = Repo.loadSync(process.argv[2]);

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function componentsFromPath(path) {
	var l = path.length;
	var a = "/" === path[0] ? 1 : 0;
	var b = "/" === path[l-1] ? 1 : 0;
	if(a+b >= l) return [];
	return path.slice(a, -b || undefined).split("/").map(function(x) {
		return decodeURIComponent(x);
	});
}
function pathFromComponents(components) {
	if(!components.length) return "";
	return "/"+components.map(function(x) {
		return encodeURIComponent(x);
	}).join("/");
}
function lookup(obj, prop) {
	if(!obj || !prop) return null; // TODO: Be more robust.
	if(has(obj, prop)) return obj[prop];
	return null;
}
function first(array) {
	return array.length ? array[0] : null;
}
function rest(array) {
	return array.slice(1);
}

var O_RDONLY = 1 << 1;
var O_WRONLY = 1 << 2;
var O_RDWR = O_RDONLY | O_WRONLY;
var O_MKUSER = 1 << 3; // TODO
function authenticate(username, password, mode, callback/* (err, userID) */) {
	var forbidden = {httpStatusCode: 403, message: "Forbidden"};
	if(!username) {
		var publicMode = O_RDONLY; // TODO: Configurable.
		if((mode & publicMode) !== mode) return callback(forbidden, null);
		return callback(null, 0);
	}
	repo.db.query(
		'SELECT "userID", "password", "token" FROM "users" WHERE "username" = $1',
		[username],
		function(err, results) {
			if(err) return callback(err, null);
			var row = results.rows[0];
			if(results.rows.length < 1) {
				return callback(forbidden, null);
			}
			if(bcrypt.compareSync(password, row.password)) {
				return callback(null, row.userID);
			}
			if((mode & O_RDONLY) !== mode) return callback(forbidden, null);
			if(bcrypt.compareSync(password, row.token)) {
				return callback(null, row.userID);
			}
			callback(forbidden, null);
		}
	);
}

var server;
(function() {
	if(repo.key && repo.cert) {
		server = https.createServer({
			key: repo.key,
			cert: repo.cert,
			honorCipherOrder: true,
		}, serve);
		server.protocol = "https:";
	} else {
		server = http.createServer(serve);
		server.protocol = "http:";
	}
})();
function serve(req, res) {
	var obj = urlModule.parse(req.url, true);
	var path = obj.pathname;
	var options = obj.query;
	var components = componentsFromPath(path);
	if(-1 !== components.indexOf("..")) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	serve.root(req, res, {
		"path": path,
		"components": components,
		"options": options,
	});
}
serve.root = function(req, res, root) {
	var components = root.components;
	var imp = lookup(serve.root, first(components));
	if(!imp) {
		var path = CLIENT+root.path;
		fs.stat(path, function(err, stats) {
			if(err) return res.sendError(err);
			res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
		});
		return;
	}
	imp(req, res, root, {
		"path": pathFromComponents(components),
		"components": rest(components),
		"options": root.options,
	});
};
serve.root.meta = function(req, res, root, entry) {
	var URN = first(entry.components);
	if(!URN) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	// TODO: Man these queries are redundant. We should probably look up the entry ID separately, at least.
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
						// TODO: Alternate URNs, earliest submission date?
					});
				}
			);
		}
	);
};
serve.root.entry = function(req, res, root, entry) {
	var URN = first(entry.components);
	if(!URN) {
		res.sendMessage(400, "Bad Request");
		return;
	}
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
};
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

serve.root.submit = function(req, res, root, submit) {
	if("POST" !== req.method) {
		res.sendMessage(405, "Method Not Allowed");
		return;
	}
	var opts = submit.options;
	var username = opts["u"];
	var password = opts["p"];
	authenticate(username, password, O_WRONLY, function(err, userID) {
		if(err) return res.sendError(err);
		var targets = String(opts["t"] || "").split("\n");
		addEntry(req, res, userID, targets);
	});
};
function addEntry(req, res, userID, targets) {
	var form = new formidable.IncomingForm({
		"keepExtensions": false,
	});
//	form.addListener("error", function(err) {
//		console.log("hmm", err);
//		res.sendMessage(500, "Internal Server Error");
//	});
	var hashes = {};
	form.onPart = function(part) {
		if("entry" !== part.name) return; // TODO: Is skipping other parts a good idea?
		var ext = pathModule.extname(part.filename);
		var type = bt.has(MIME, ext) ? MIME[ext] : part.mime; // TODO: Keep charset if possible.
		repo.addEntryStream(new ReadableStream().wrap(part), type, userID, targets, function(err, primaryURN) {
			if(err) return res.sendError(err);
			res.writeHead(303, {"Location": primaryURN});
			res.end();
		});
	};
	req.pause(); // HACK. Stream2 old-mode emits "data" before formidable is ready.
	form.parse(req);
	req.resume();
}

serve.root.latest = function(req, res, root, latest) {
	var opts = latest.options;
	var username = opts["u"];
	var password = opts["p"];
	authenticate(username, password, O_RDONLY, function(err, userID) {
		if(err) return res.sendError(err);
		var queryString = (opts["q"] || "").split("+").map(decodeURIComponent).join(" ");
		querylang.parse(queryString, "lispish", function(err, query) {
			query = new queryModule.User(userID, query); // TODO: Kind of ugly.
			var client = new Client(repo, query, res);
			var tab = "\t";
			var obj = query.SQL(1, tab+"\t");
			var history = opts["history"];
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
};

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
				repo,
				row.userID,
				row.targets,
				row.remoteURL,
				row.query,
				row.username,
				row.password
			); // TODO: These arguments are getting a little unwieldy...
		});
	}
);
