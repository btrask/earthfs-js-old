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
var http = require("http");
var https = require("https");
var urlModule = require("url");
var querystring = require("querystring");
var bt = require("../utilities/bt");

function Queue() { // TODO: Put this somewhere.
	var queue = this;
	queue.items = [];
	queue.active = false;
}
Queue.prototype.push = function(func/* (done) */) {
	var queue = this;
	queue.items.push(func);
	if(queue.active) return;
	queue.active = true;
	bt.asyncLoop(function(next) {
		queue.items.shift()(function() {
			if(queue.items.length) return next();
			queue.active = false;
		});
	});
};

function Remote(session, targets, url, query, username, password) {
	var remote = this;
	remote.session = session;
	remote.targets = targets;
	remote.url = url;
	remote.query = query;
	remote.username = username;
	remote.password = password;
	remote.pullQueue = new Queue;

	var protocol = urlModule.parse(remote.url).protocol;
	switch(protocol) {
		case "http:": remote.module = http; break;
		case "https:": remote.module = https; break;
		default: throw new Error("Unrecognized protocol "+protocol);
		// TODO: Plug-in architecture?
	}
	remote.pull();
}
Remote.prototype.pull = function() {
	var remote = this;
	var retried = false;
	function retry() {
		if(retried) return;
		retried = true;
		setTimeout(function() { remote.pull(); }, 1000 * 5);
		// TODO: Use a compromise between exponential backoff and constant polling.
		// We don't want to drain the batteries of mobile systems by checking too often.
	}
	var url = urlModule.parse(remote.url);
	var req = remote.module.get({
		hostname: url.hostname,
		port: url.port,
		path: "/api/latest/?"+querystring.stringify({
			"q": remote.query,
			"history": "all",
			"u": remote.username,
			"p": remote.password,
		}),
		agent: false,
		key: remote.session.repo.key,
		cert: remote.session.repo.cert,
//		ca: [], // TODO: I think remotes should have a cert that is known ahead of time.
		rejectUnauthorized: false, // TODO: Change this to true once we store the cert.
	}, function(res) {
		var last = "";
		res.setEncoding("utf8");
		res.on("readable", function() {
			var chunk = res.read();
			var data = last+chunk, i, j;
			// TODO: This is messy.
			for(; -1 !== (i = data.indexOf("\n", j)); j = i+1) {
				remote.addURN(data.slice(j, i).replace(/^ +/g, ""));
			}
			last = data.slice(j);
		});
		res.on("end", function() {
			retry();
		});
	});
	req.on("error", function(err) {
		retry();
	});
	req.setTimeout(1000 * 60, function() {
		req.destroy();
		retry();
	});
};
Remote.prototype.addURN = function(URN) {
	var remote = this;
	remote.pullQueue.push(function(done) {
		remote.session.db.query(
			'SELECT "uriID" FROM "URIs" WHERE'+
			' "URI" = $1 AND "entryID" IS NOT NULL', [URN],
			function(err, results) {
				if(results.rows.length) return done();
				addURN(URN, done);
			}
		);
	});
	function addURN(urn, callback) {
		var url = urlModule.parse(remote.url);
		var opts = {
			hostname: url.hostname,
			port: url.port,
			path: "/api/entry/"+encodeURIComponent(URN)+"/?"+querystring.stringify({
				"u": remote.username,
				"p": remote.password,
			}),
			agent: false,
			key: remote.session.repo.key,
			cert: remote.session.repo.cert,
//			ca: [], // TODO: I think remotes should have a cert that is known ahead of time.
			rejectUnauthorized: false, // TODO: Change this to true once we store the cert.
//			headers: {
//				"Accept": "*/*",
//			},
		};
		var req = remote.module.get(opts, function(res) {
			remote.session.addEntryStream(
				res, res.headers["content-type"], remote.targets.split("\n"),
				function(err, URN, entryID) {
					if(err) console.log(err);
					callback();
				}
			);
		});
		// TODO: Handle "error" event.
	}
};

module.exports = Remote;
