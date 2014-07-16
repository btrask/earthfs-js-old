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
var util = require("util");

var client = require("efs-client");
var multiparty = require("multiparty");
var mkdirp = require("mkdirp");

var http = require("./utilities/httpx"); // TODO: Get rid of this...
var MIME = require("./utilities/mime");
var has = require("./utilities/has");
var cookieModule = require("./utilities/cookie");

var Repo = require("./classes/Repo");
var Session = require("./classes/Session");
var IncomingFile = require("./classes/IncomingFile");
var querystream = require("./classes/querystream");

var plugins = require("./plugins");
var formatters = plugins.formatters;

var METHOD_MODES = {
	"GET": Session.O_RDONLY,
	"POST": Session.O_WRONLY, // Technically could be O_RDWR.
};
var CLIENT = __dirname+"/build";

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
		if(handlers[i](req, res, url)) return;
	}
	res.sendError(httpError(404, url));
}
function registerExp(method, pathExp, func/* (req, res, url, arg1, arg2, etc) */) {
	handlers.push(function(req, res, url) {
		if(method !== req.method) {
			if("GET" !== method || "HEAD" !== req.method) return false;
		}
		var args = pathExp.exec(url.pathname);
		if(!args) return false;
		func.apply(null, [req, res, url].concat(args.slice(1)));
		return true;
	});
}
function registerExpAuth(method, pathExp, func/* (req, res, url, session, arg1, arg2, etc, done) */) {
	if(!has(METHOD_MODES, method)) throw new Error("Unrecognized method "+method);
	registerExp(method, pathExp, function(req, res, url, arg1, arg2, etc) {
		var args = Array.prototype.slice.call(arguments, 3);
		auth(req, res, url, METHOD_MODES[method], function(session, done) {
			func.apply(null, [req, res, url, session].concat(args).concat([done]));
		});
	});
}
function registerExpAuthQuery(method, pathExp, func/* (req, res, url, session, ast, arg1, arg2, etc, done) */) {
	registerExpAuth(method, pathExp, function(req, res, url, session, arg1, arg2, etc, done) {
		var args = Array.prototype.slice.call(arguments, 4);
		var queryString = decodeURIComponent(url.query["q"] || "");
		var queryLanguage = "simple"; // TODO: Configurable.
		session.parseQuery(queryString, queryLanguage, function(err, ast) {
			if(err) return done(err);
			func.apply(null, [req, res, url, session, ast].concat(args));
		});
	});
}

registerExpAuth("GET", /^\/efs\/html\/([^\/]+)\/([^\/]+)(\/.*)?$/, getFileHTML);
registerExpAuth("GET", /^\/efs\/html\/([^\/]+)\/([^\/]+)(\/.*)?$/, getFileHTML);
registerExpAuth("GET", /^\/efs\/html\/([^\/]+)\/([^\/]+)(\/.*)?$/, getFileHTML);
//registerExpAuth("GET", /^\/efs\/html\/submission\/(\d+)(\/.*)?$/, getSubmissionHTML);
registerExpAuth("GET", /^\/efs\/file\/([^\/]+)\/([^\/]+)\/?$/, getFile);
//registerExpAuth("GET", /^\/efs\/file\/submission\/(\d+)\/?$/, getSubmission);
registerExpAuth("GET", /^\/efs\/file\/list\/([^\/]+)\/([^\/]+)\/?$/, getFileList);
registerExpAuth("POST", /^\/efs\/file\/?$/, postFile);
registerExpAuthQuery("GET", /^\/efs\/query\/?$/, getQueryLatest);
//registerExpAuthQuery("GET", /^\/efs\/query\/history\/?$/, getQueryHistory);

// Last.
registerExp("GET", /.*/, getClient);


function getFileHTML(req, res, url, session, algo, hash, subpath, done) {
	submissionIDForFile(session, algo, hash, function(err, submissionID) {
		if(err) return done(err);
		getSubmissionHTML(req, res, url, session, submissionID, subpath, done);
	});
}
function getSubmissionHTML(req, res, url, session, submissionID, subpath, done) {
	session.fileForSubmissionID(submissionID, function(err, file) {
		if(err) return done(err);
		done();
		sendResource(req, res, url, session.repo, file, subpath);
	});
}
function getFile(req, res, url, session, algo, hash, done) {
	submissionIDForFile(session, algo, hash, function(err, submissionID) {
		getSubmission(req, res, url, session, submissionID, done);
	});
}
function getSubmission(req, res, url, session, submissionID, done) {
	session.fileForSubmissionID(submissionID, function(err, file) {
		if(err) return done(err);
		done();
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
	});
}
function getFileList(req, res, url, session, algo, hash, done) {
	var normalizedURI = parseArgs(encodedAlgorithm, encodedHash);
	session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
		if(err) return done(err);
		if(!submissions.length) return done(httpError(404));
		done();
		var buf = new Buffer(JSON.stringify(submissions), "utf8");
		res.writeHead(200, {
			"Content-Type": "text/json; charset=utf-8",
			"Content-Length": buf.length,
		});
		if("HEAD" === req.method) res.end();
		else res.end(buf);
	});
}
function postFile(req, res, url, session, done) {
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
}
function getQueryLatest(req, res, url, session, ast, done) {
	var count;
	if("all" === url.query["count"]) count = null;
	else count = parseInt(url.query["count"]) || 0;
	if(null !== count && count < 0) return done(httpError(400));
	res.writeHead(200, {
		"Content-Type": "text/x-uri-list; charset=utf-8",
	});
	if("HEAD" === req.method) { res.end(); done(); return; }
	var history = querystream.history(session, ast, count);
	var ongoing = querystream.ongoing(session, ast);
	res.write("\n", "utf8"); // Force Node to send headers.
	history.pipe(res, {end: false});
	history.on("end", function() {
		ongoing.pipe(res);
	});
	ongoing.on("end", function() {
		done(); // TODO: Keeping one connection per query open like this is not going to scale.
	});
	res.on("close", function() {
		history.end();
		ongoing.end();
	});
}
/*function getQueryHistory(req, res, url, session, ast, done) {
	var offset = parseInt(url.query["offset"], 10);
	var limit = parseInt(url.query["limit"], 10);
	if(isNaN(offset) || offset < 0) return done(httpError(400)); // TODO: Better errors?
	if(isNaN(limit) || limit <= 0) return done(httpError(400));
	res.writeHead(200, {
		"Content-Type": "text/x-uri-list; charset=utf-8",
	});
	if("HEAD" === req.method) { res.end(); done(); return; }
	var page = querystream.page(session, ast, offset, limit);
	res.write("\n", "utf8"); // Force Node to send headers.
	page.pipe(res);
	page.on("end", function() {
		done();
	});
}*/
function getClient(req, res, url) {
	if(-1 !== url.pathname.indexOf("..")) return res.sendMessage(400, "Bad Request");
	var path = CLIENT+url.pathname;
	fs.stat(path, function(err, stats) {
		if(err) return res.sendError(err);
		res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
	});
}


function sendResource(req, res, url, repo, file, subpath) {
	var x = file.internalHash;
	var dir = cacheDirForFile(file, repo);
	if(!subpath) subpath = "/";
	if("/" === subpath[subpath.length - 1]) subpath += "index.html";
	var path = dir+subpath;
	if(-1 !== path.indexOf("..")) return res.sendError(httpError(403));
	fs.stat(dir+"/.token", function(err, stats) {
		if(!err) return res.sendFile(path, false);
		if("ENOENT" !== err.code) return res.sendError(err);
		mkdirp(dir, function(err) {
			if(err) return res.sendError(err);
			var stream = fs.createReadStream(file.internalPath);
			var prefix = "/api/submission/"+encodeURIComponent(file.submissionID)+"/html";
			format(stream, file.type, dir, prefix, function(err) {
				if(err) return res.sendError(err);
				fs.writeFile(dir+"/.token", "", "utf8", function(err) {
					if(err) return res.sendError(err);
					res.sendFile(path, false);
				});
			});
		});
	});
}
function cacheDirForFile(file, repo) {
	var hasher = crypto.createHash("sha256");
	hasher.write(file.internalHash, "utf8");
	hasher.write(file.type, "utf8");
	hasher.end();
	var x = hasher.read().toString("hex");
	return repo.CACHE+"/"+x.slice(0, 2)+"/"+x;
}
function format(stream, type, dir, prefix, callback/* (err) */) {
	for(var i = 0; i < formatters.length; ++i) {
		if(!formatters[i].acceptsType(type)) continue;
		formatters[i].format(stream, type, dir, prefix, function(err) {
			if(err) return callback(err);
			callback(null);
		});
		return;
	}
	stream.destroy();
	callback(new Error("No available formatter"));
}
function submissionIDForFile(session, algo, hash, callback/* (err, submissionID) */) {
	var normalizedURI = parseURI(algo, hash);
	session.submissionsForNormalizedURI(normalizedURI, function(err, submissions) {
		if(err) return callback(err, null);
		if(!submissions.length) return callback(null, null);
		callback(null, submissions[0].submissionID);
	});
}
function auth(req, res, url, mode, callback/* (session, done) */) {
	var opts = url.query;
	var cookies = cookieModule.parseJar(req.headers["cookie"] || "");
	repo.auth({
		username: opts["u"] || null,
		password: opts["p"] || null,
		remember: opts["r"] || null,
		cookie: cookies["s"] || null,
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
function parseURI(encodedAlgorithm, encodedHash) {
	return client.formatHashURI({
		algorithm: decodeURIComponent(encodedAlgorithm),
		hash: decodeURIComponent(encodedHash),
	});
}
function httpError(statusCode, url) {
	var err = new Error("HTTP status code "+statusCode+(url ? " from "+urlModule.format(url) : ""));
	err.httpStatusCode = statusCode;
	return err;
}


var PORT = parseInt(repo.config["port"], 10) || 8001;
server.listen(PORT, function() {
	util.log(urlModule.format({
		protocol: server.protocol,
		hostname: "localhost",
		port: PORT,
		pathname: "/",
	}));
	// TODO: Optionally set up NAT traversal/UPnP.
});

repo.loadPulls();

