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

function Remote(repo, url, query) {
	var remote = this;
	remote.repo = repo;
	remote.url = url;
	remote.query = query;
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
	var url = urlModule.parse(remote.url);
	var req = remote.module.get({
		hostname: url.hostname,
		port: url.port,
		path: "/latest/?"+querystring.stringify({"q": remote.query, "history": "all"}),
		agent: false,
	}, function(res) {
		var last = "";
		res.setEncoding("utf8");
		res.on("data", function(chunk) {
			var data = last+chunk, i, j;
			// TODO: This is messy.
			for(; -1 !== (i = data.indexOf("\n", j)); j = i+1) {
				remote.addURN(data.slice(j, i).replace(/^ +/g, ""));
			}
			last = data.slice(j);
		});
		res.on("end", function() {
			if(200 === res.status) return remote.pull();
			setTimeout(function() { remote.pull(); }, 1000 * 5);
		});
	});
	req.on("error", function(err) {
		setTimeout(function() { remote.pull(); }, 1000 * 5); // TODO: Something smarter?
	});
};
Remote.prototype.addURN = function(URN) {
	var remote = this;
	remote.pullQueue.push(function(done) {
		remote.repo.db.query(
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
			path: "/entry/"+encodeURIComponent(URN),
//			agent: false,
//			rejectUnauthorized: false, // TODO: Figure this out.
//			key: key,
//			cert: cert,
//			headers: {
//				"Accept": "*/*",
//			},
		};
		https.get(opts, function(res) {
			remote.repo.addEntryStream(
				res, res.headers["content-type"],
				function(err, URN, entryID) {
					if(err) console.log(err);
					callback();
				}
			);
		});
	}
};

module.exports = Remote;
