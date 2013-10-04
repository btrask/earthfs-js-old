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

var client = require("efs-client");
var multiparty = require("multiparty");
var cookieModule = require("cookie");

var http = require("./utilities/httpx"); // TODO: Get rid of this...
var MIME = require("./utilities/mime");
var has = require("./utilities/has");

var Repo = require("./classes/Repo");
var Session = require("./classes/Session");
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
	res.sendError(httpError(404));
}
function register(method, path, func/* (req, res, url, arg1, arg2, etc) */) {
	handlers.push({method: method, path: path, func: func});
}


register("GET", /^\/api\/submission\/(\d+)\/?$/, function(req, res, url, submissionID) {
	auth(req, res, url, Session.O_RDONLY, function(session, done) {
		sendSubmission(req, res, session, submissionID, done);
	});
});
register("GET", /^\/api\/file\/([^\/]+)\/([^\/]+)\/([\w\d]+)\/?$/, function(req, res, url, encodedAlgorithm, encodedHash, submissionName) {
	auth(req, res, url, Session.O_RDONLY, function(session, done) {
		var normalizedURI = client.formatEarthURI({
			algorithm: decodeURIComponent(encodedAlgorithm),
			hash: decodeURIComponent(encodedHash),
		});
		session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
			if(err) return done(err);
			if(!submissions.length) return done(httpError(404));
			var index;
			switch(submissionName) {
				case "first": index = 0; break;
				case "latest": index = submissions.length - 1; break;
				default: return done(httpError(400));
			}
			sendSubmission(req, res, session, submissions[index]["submissionID"], done);
		});
	});
});
register("GET", /^\/api\/file\/([^\/]+)\/([^\/]+)\/?$/, function(req, res, url, encodedAlgorithm, encodedHash) {
	auth(req, res, url, Session.O_RDONLY, function(session, done) {
		var normalizedURI = client.formatEarthURI({
			algorithm: decodeURIComponent(encodedAlgorithm),
			hash: decodeURIComponent(encodedHash),
		});
		session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
			if(err) return done(err);
			if(!submissions.length) return done(httpError(404));
			var buf = new Buffer(JSON.stringify(submissions), "utf8");
			res.writeHead(200, {
				"Content-Type": "text/json; charset=utf-8",
				"Content-Length": buf.length,
			});
			if("HEAD" === req.method) res.end();
			else res.end(buf);
			done();
		});
	});
});

register("POST", /^\/api\/submission\/?$/, function(req, res, url) {
	auth(req, res, url, Session.O_WRONLY, function(session, done) {
		var targets = String(url.query["t"] || "").split("\n").filter(function(target) {
			return target != "";
		});
		var form = new multiparty.Form();
		var receivedValidPart = false;
		form.on("part", function(part) {
			if("file" !== part.name) return;
			receivedValidPart = true;
			var ext = part.filename ? pathModule.extname(part.filename) : "";
			var type = part.headers["content-type"] || (has(MIME, ext) && MIME[ext]);
			if(!type) return done(httpError(400)); // TODO: Something?
			var file = new IncomingFile(repo, type, targets);
			file.loadFromStream(part, function(err) {
				if(err) return done(err);
				session.addIncomingFile(file, function(err, outgoingFile) {
					if(err) return done(err);
					res.sendJSON(200, "OK", outgoingFile);
					done();
				});
			});
		});
		form.on("close", function() {
			if(receivedValidPart) return;
			done(httpError(400));
		});
		form.addListener("error", function(err) {
			done(err);
		});
		form.parse(req);
	});
});

register("GET", /^\/api\/query\/?$/, function(req, res, url) {
	auth(req, res, url, Session.O_RDONLY, function(session, done) {
		var queryString = decodeURIComponent(url.query["q"] || "");
		var queryLanguage = "simple"; // TODO: Configurable.
		session.query(queryString, queryLanguage, function(err, query) {
			if(err) return done(err);
			res.writeHead(200, {
				"Content-Type": "text/x-uri-list; charset=utf-8",
				"X-Results-Count": 500,
				// TODO: Send total count of results.
				// It'd be quite a trick to get this without performing the same query twice.
			});
			var offset = parseInt(url.query["offset"], 10) || null;
			var limit = parseInt(url.query["limit"], 10) || null;
			query.open(res, offset, limit, function(err) {
				done(err);
			});
		});
	});
});

function httpError(statusCode) {
	var err = new Error("HTTP status code "+statusCode);
	err.httpStatusCode = statusCode;
	return err;
}
function auth(req, res, url, mode, callback/* (session, done) */) {
	var opts = url.query;
	var cookies = cookieModule.parse(req.headers["cookie"] || "");
	repo.auth({
		username: opts["u"],
		password: opts["p"],
		remember: opts["r"],
		cookie: cookies["s"],
		mode: mode,
	}, function(err, session) {
		// TODO: If there's an error, clear the cookie?
		if(err) return res.sendError(err);
		if(session.cookie) res.setHeader("Set-Cookie", session.cookie);
		callback(session, function(err) {
			if(err) res.sendError(err);
			session.close();
		});
	});
}
function sendSubmission(req, res, session, submissionID, done) {
	session.fileForSubmissionID(submissionID, function(err, file) {
		if(err) return done(err);
		res.writeHead(200, {
			"Content-Type": file.type,
			"Content-Length": file.size,
			"X-Submission-ID": file.submissionID,
			"X-Internal-Hash": file.internalHash,
			"X-Source": file.source,
			"X-Targets": file.targets.join(", "),
			"X-Timestamp": file.timestamp,
			"X-URIs": file.URIs.join(", "),
		});
		if("HEAD" === req.method) res.end();
		else fs.createReadStream(file.internalPath).pipe(res);
		done();
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

