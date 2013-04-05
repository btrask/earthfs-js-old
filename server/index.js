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

var pg = require("pg");
var formidable = require("formidable");
var mkdirp = require("mkdirp");
var ioServer = require("socket.io");
var ioClient = require('socket.io-client');

var bt = require("./utilities/bt");
var fsx = require("./utilities/fsx");
var http = require("./utilities/httpx");
var sql = require("./utilities/sql");

var formatters = require("./formatters");
var querylang = require("./query-languages");

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

var server;
(function() {
	try {
		server = https.createServer({
			key: fs.readFileSync(repo.KEY),
			cert: fs.readFileSync(repo.CERT),
			honorCipherOrder: true,
		}, serve);
		server.scheme = "https";
	} catch(e) {
		server = http.createServer(serve);
		server.scheme = "http";
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
	if("127.0.0.1" !== req.connection.remoteAddress) {
		res.sendMessage(403, "Forbidden");
		return;
	}
	if("POST" !== req.method) {
		res.sendMessage(405, "Method Not Allowed");
		return;
	}
	function fail(err) {
		console.log(err);
		res.sendMessage(500, "Internal Server Error");
	}
	var form = new formidable.IncomingForm({
		"keepExtensions": false,
	});
	form.addListener("error", function(err) {
		fail(err);
	});
	var hashes = {};
	form.onPart = function(part) {
		if("entry" !== part.name) return; // TODO: Is skipping other parts a good idea?
		var ext = pathModule.extname(part.filename);
		var type = bt.has(MIME, ext) ? MIME[ext] : part.mime; // TODO: Keep charset if possible.
		repo.addEntryStream(part, type, function(err, primaryURN) {
			if(err) return res.sendError(err);
			res.writeHead(303, {"Location": primaryURN});
			res.end();
		});
	};
	form.parse(req);
};
repo.on("entry", function(URN, entryID) {
	Client.all.forEach(function(client) {
		var obj = client.query.SQL(2, "\t");
		sql.debug(repo.db,
			'SELECT $1 IN \n'+
				obj.query+
			'AS matches', [entryID].concat(obj.parameters),
			function(err, results) {
				if(err) console.log(err);
				if(results.rows[0].matches) client.send(URN);
			}
		);
	});
});

var ioOpts = {log: false};
ioServer.listen(server, ioOpts).sockets.on("connection", streamServe);
function streamServe(socket) {
	socket.emit("connected", function(params) {
		var str = params["q"].split("+").map(decodeURIComponent).join(" ");
		// TODO: Use some sort of global query that filters hidden posts, etc.
		querylang.parse(str, "lispish", function(err, query) {
			var client = new Client(socket, query);
			var tab, obj;
			if(params["all"]) { // TODO: I know this is really ugly.
				tab = "";
				obj = query.SQL(1, tab+"\t");
				var stream = repo.db.query(
					'SELECT e."entryID", \'urn:sha1:\' || e."hash" AS "URN"\n'+
					'FROM "entries" AS e\n'+
					'WHERE e."entryID" IN\n'+
						obj.query+
					'ORDER BY e."entryID" ASC',
					obj.parameters
				);
				stream.on("row", function(row) {
					socket.emit("entry", row.URN);
				});
				stream.on("end", function() {
					if(client.connected) Client.all.push(client);
					// Start watching for new entries.
				});
			} else {
				tab = "\t";
				obj = query.SQL(1, tab+"\t");
				repo.db.query(
					'SELECT * FROM (\n'+
						tab+'SELECT e."entryID", \'urn:sha1:\' || e."hash" AS "URN"\n'+
						tab+'FROM "entries" AS e\n'+
						tab+'WHERE e."entryID" IN\n'+
							obj.query+
						tab+'ORDER BY e."entryID" DESC LIMIT 50\n'+
					') x ORDER BY "entryID" ASC',
					obj.parameters,
					function(err, results) {
						if(err) console.log(err); // TODO
						socket.emit("entries", results.rows.map(function(row) {
							return row.URN;
						}));
						if(client.connected) Client.all.push(client);
						// Start watching for new entries.
					}
				);
			}
		});
	});
}

var PORT = repo.config.port >>> 0 || 8001;
server.listen(PORT, function() {
	console.log(""+server.scheme+"://localhost:"+PORT+"/");
	// TODO: Optionally set up NAT traversal/UPnP.
});

var Remote = require("./classes/Remote");
repo.db.query(
	'SELECT "remoteURL", "query" FROM "remotes" WHERE TRUE', [],
	function(err, results) {
		if(err) return console.log(err);
		results.rows.forEach(function(row) {
			var remote = new Remote(repo, row.remoteURL, row.query);
		});
	}
);
