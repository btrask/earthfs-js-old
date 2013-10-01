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
var pathModule = require("path");
var urlModule = require("url");
var util = require("util");
var os = require("os");
var fs = require("fs");
var https = require("https");
var ReadableStream = require("stream").Readable;

var client = require("efs-client");
var multiparty = require("multiparty");

var http = require("./utilities/httpx"); // TODO: Get rid of this...
var MIME = require("./utilities/mime");
var has = require("./utilities/has");

var Repo = require("./classes/Repo");
var IncomingFile = require("./classes/IncomingFile");

var repo = Repo.loadSync(process.argv[2] || "/etc/earthfs"); // TODO: Is this really a good idea?

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
	var i, handler, path;
	for(i = 0; i < handlers.length; ++i) {
		handler = handlers[i];
		if(handler.method !== req.method) {
			if("GET" !== handler.method || "HEAD" !== req.method) continue;
		}
		path = handler.path.exec(url.pathname);
		if(!path) continue;
		handler.func.apply(this, [req, res, url].concat(path.slice(1)));
		return;
	}
	console.log("404", url.pathname);
	res.sendMessage(404, "Not Found");
}
function register(method, path, func/* (req, res, url, arg1, arg2, etc) */) {
	handlers.push({method: method, path: path, func: func});
}


register("GET", /^\/api\/submission\/(\d+)\/?$/, function(req, res, url, submissionID) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		sendSubmission(req, res, session, submissionID);
	});
});
register("GET", /^\/api\/file\/([^\/]+)\/([^\/]+)\/([\w\d]+)\/?$/, function(req, res, url, encodedAlgorithm, encodedHash, submissionName) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var normalizedURI = client.formatEarthURI({
			algorithm: decodeURIComponent(encodedAlgorithm),
			hash: decodeURIComponent(encodedHash),
		});
		session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
			if(err) return res.sendError(err);
			if(!submissions.length) return res.sendMessage(404, "Not Found");
			var index;
			switch(submissionName) {
				case "first": index = 0; break;
				case "latest": index = submissions.length - 1; break;
				default: return res.sendMessage(400, "Bad Request");
			}
			sendSubmission(req, res, session, submissions[index]["submissionID"]);
		});
	});
});
register("GET", /^\/api\/file\/([^\/]+)\/([^\/]+)\/?$/, function(req, res, url, encodedAlgorithm, encodedHash) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var normalizedURI = client.formatEarthURI({
			algorithm: decodeURIComponent(encodedAlgorithm),
			hash: decodeURIComponent(encodedHash),
		});
		session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
			if(err) return res.sendError(err);
			if(!submissions.length) return res.sendMessage(404, "Not Found");
			var buf = new Buffer(JSON.stringify(submissions), "utf8");
			res.writeHead(200, {
				"Content-Type": "text/json; charset=utf-8",
				"Content-Length": buf.length,
			});
			if("HEAD" === req.method) res.end();
			else res.end(buf);
		});
	});
});

register("POST", /^\/api\/submission\/?$/, function(req, res, url) {
	repo.auth(req, res, Repo.O_WRONLY, function(err, session) {
		if(err) return res.sendError(err);
		var targets = String(url.query["t"] || "").split("\n").filter(function(target) {
			return target != "";
		});
		var form = new multiparty.Form();
		form.on("part", function(part) {
			if("file" !== part.name) return;
			var ext = pathModule.extname(part.filename);
			var type = part.headers["content-type"] || (has(MIME, ext) && MIME[ext]);
			if(!type) return res.message(400, "Bad Request"); // TODO: Something?
			var file = new IncomingFile(repo, type, targets);
			file.loadFromStream(part, function(err) {
				if(err) return res.sendError(err);
				session.addIncomingFile(file, function(err, outgoingFile) {
					if(err) res.sendError(err);
					res.sendJSON(200, "OK", outgoingFile);
				});
			});
		});
		form.addListener("error", function(err) {
			console.log("hmm", err);
			res.sendError(err);
		});
		form.parse(req);
	});
});

register("GET", /^\/api\/query\/?$/, function(req, res, url) {
	repo.auth(req, res, Repo.O_RDONLY, function(err, session) {
		if(err) return res.sendError(err);
		var queryString = decodeURIComponent(url.query["q"] || "");
		var queryLanguage = "simple"; // TODO: Configurable.
		session.query(queryString, queryLanguage, function(err, query) {
			if(err) return res.sendError(err);
			res.writeHead(200, {
				"Content-Type": "text/x-uri-list; charset=utf-8",
				"X-Results-Count": 500,
				// TODO: Send total count of results.
				// It'd be quite a trick to get this without performing the same query twice.
			});
			var offset = parseInt(url.query["offset"], 10) || null;
			var limit = parseInt(url.query["limit"], 10) || null;
			query.open(res, offset, limit);
		});
	});
});

function sendSubmission(req, res, session, submissionID) {
	session.fileForSubmissionID(submissionID, function(err, file) {
		if(err) return res.sendError(err);
		res.writeHead(200, {
			"Content-Type": file.type,
			"Content-Length": file.size,
			"X-Internal-Hash": file.internalHash,
			"X-Source": file.source,
			"X-Targets": file.targets.join(", "),
			"X-Timestamp": file.timestamp,
			"X-URIs": file.URIs.join(", "),
		});
		if("HEAD" === req.method) res.end();
		else fs.createReadStream(file.internalPath).pipe(res);
	});
}

var PORT = parseInt(repo.config["port"], 10) || 8001;
server.listen(PORT, function() {
	console.log(urlModule.format({
		protocol: server.protocol,
		hostname: "localhost",
		port: PORT,
		pathname: "/",
	}));
	// TODO: Optionally set up NAT traversal/UPnP.
});

repo.loadPulls();

