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

var bt = require("./utilities/bt");
var fsx = require("./utilities/fsx");
var http = require("./utilities/httpx");
var sql = require("./utilities/sql"); // TODO: We shouldn't be doing any DB access here.

var Client = require("./classes/Client"); // TODO: We shouldn't need this once we handle queries better.
var query = require("./classes/query");
var Repo = require("./classes/Repo");
var Session = require("./classes/Session"); // TODO: We shouldn't need this once we handle remotes better.

var MIME = require("./utilities/mime.json"); // TODO: It'd be nice to get rid of this.

var repo = Repo.loadSync(process.argv[2] || "/etc/earthfs");

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
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
		if(handler.method !== req.method) continue;
		path = handler.path.exec(url.pathname);
		if(!path) continue;
		handler.func.apply(this,
			[req, res, url]
			.concat(path.slice(1))
		);
		return;
	}
	res.sendMessage(404, "Not Found");
}
function register(method, path, func/* (req, res, url, arg1, arg2, etc) */) {
	handlers.push({method: method, path: path, func: func});
}

register("GET", /^\/api\/entry\/([\w\d:%]+)\/meta\/?$/, function(req, res, url, encodedURN) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		var URN = decodeURIComponent(encodedURN);
		session.metadataForURN(URN, function(err, info) {
			if(err) return res.sendError(err);
			res.sendJSON(200, "OK", info);
		});
	});
});
register("GET", /^\/api\/entry\/([\w\d:%]+)\/?$/, function(req, res, url, encodedURN) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		var URN = decodeURIComponent(encodedURN);
		session.entryForURN(URN, function(err, entryID, hash, path, type) {
			if(err) return res.sendError(err);
			sendFile(req, res, path, type, function(err) {
				if(err) res.sendError(err);
			});
		});
	});
});
register("POST", /^\/api\/entry\/?$/, function(req, res, url) {
	repo.auth(req, res, Repo.O_WRONLY, function(err, session) {
		if(err) return res.sendError(err);
		var targets = String(url.query["t"] || "").split("\n");
		var form = new multiparty.Form();
		form.on("part", function(part) {
			if("entry" !== part.name) return; // TODO: Is skipping other parts a good idea?
			var ext = pathModule.extname(part.filename);
			var type = bt.has(MIME, ext) ? MIME[ext] : part.headers["content-type"];
			// TODO: Keep charset if possible.
			session.addEntryStream(part, type, targets, function(err, primaryURN) {
				if(err) return res.sendError(err);
				res.sendJSON(200, "OK", {
					"urn": primaryURN,
				});
			});
		});
//		form.addListener("error", function(err) {
//			console.log("hmm", err);
//			res.sendMessage(500, "Internal Server Error");
//		});
		form.parse(req);
	});
});
register("GET", /^\/api\/latest\/?$/, function(req, res, url) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var string = decodeURIComponent(url.query["q"] || "");
		session.parseQuery(string, "simple", function(err, query) {
			if(err) return res.sendError(err);
			var client = new Client(repo, query, res);
			search(req, res, url, session, query, function(err) {
				if(err) return console.log(err);
				client.resume();
			});
		});
	});
});
register("GET", /^\/api\/history\/?$/, function(req, res, url) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var string = decodeURIComponent(url.query["q"] || "");
		session.parseQuery(string, "simple", function(err, query) {
			if(err) return res.sendError(err);
			// TODO: Parse pagination etc.
			search(req, res, url, session, query, function(err) {
				if(err) return console.log(err);
				res.end();
			});
		});
	});
});

function sendFile(req, res, path, type, callback/* (err) */) {
	fs.stat(path, function(err, stats) {
		if(err) return callback(err);
		var stream = fs.createReadStream(path);
		res.writeHead(200, {
			"Content-Type": type,
			"Content-Length": stats.size,
		});
		stream.pipe(res);
		stream.on("error", callback);
		stream.on("end", callback);
	});
}
function search(req, res, url, session, query, callback/* (err) */) {
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
		callback(null);
	});
	stream.on("error", function(err) {
		callback(err);
	});
}

var PORT = repo.config["port"] >>> 0 || 8001;
server.listen(PORT, function() {
	console.log(urlModule.format({
		protocol: server.protocol,
		hostname: "localhost",
		port: PORT,
		pathname: "/",
	}));
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

