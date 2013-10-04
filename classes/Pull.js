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
module.exports = Pull;

var Fiber = require("fibers");
var Future = require("fibers/future");
var run = require("../utilities/fiber-helper").run;

var ClientSession = require("efs-client").Session;
var Queue = require("../utilities/Queue");

function Pull(repo, obj) {
	var pull = this;
	pull.repo = repo;
	pull.pullID = obj.pullID;
	pull.userID = obj.userID;
	pull.targets = obj.targets;
	pull.queue = new Queue;
	pull.remote = new ClientSession(obj.URI, obj.username, obj.password);
	// TODO: We should definitely use http://name:pass@host/ syntax.
	// We might want to accept either an object or a string in the client,
	// like http.request() does.
	pull.query = pull.remote.query(obj.queryString, obj.queryLanguage);
	pull.query.on("URI", function(URI) {
		pull.enqueue(client.normalizeURI(URI));
	});
}
Pull.prototype.close = function() {
	var pull = this;
	delete pull.repo.pulls[pull.pullID];
	pull.query.close();
};
Pull.prototype.enqueue = function(normalizedURI) {
	var pull = this;
	pull.queue.push(function(done) {
		pullNormalizedURI(pull, normalizedURI, function(err) {
			if(err) throw err; // TODO: Error handling, retry?
			done();
		});
	});
};

function pullNormalizedURI(pull, normalizedURI, callback) {
	run(function() {
		var local = authPullF(pull.repo, pull).wait();
		try {
			var remote = pull.remote;
			var submissions = submissionsForNormalizedURI(local, normalizedURI).wait();
			if(submissions.length) return; // Already have it.
			// TODO: Check per-remote ignored hashes.
			var obj = remote.readFile({normalizedURI: normalizedURI}).wait();
			var file = new IncomingFile(pull.repo, obj.type, pull.targets);
			loadFromStreamF(file, obj.stream).wait();
			// TODO: The incoming algorithm may not be locally installed.
			// That means we would try downloading it every single time.
			// Simply trusting the provided hash is no good either.
			// We probably need to store ignored hashes per-remote.
			// TODO: In fact, if the user deletes a file, we don't want
			// to pull it again. This might take a fair amount of logic.
			addIncomingFileF(local, file).wait();
		} catch(err) {
			local.close();
			throw err;
		}
	}, callback);
}

// TODO: Yes, these are ugly.
var authPullF = Future.wrap(function(repo, pull, cb) { repo.authPull(pull, cb); });
var submissionsForNormalizedURIF = Future.wrap(function(ses, URI, cb) { ses.submissionsForNormalizedURI(URI, cb); });
var loadFromStreamF = Future.wrap(function(file, stream, cb) { file.loadFromStream(stream, cb); });
var addIncomingFileF = Future.wrap(function(ses, file, cb) { ses.addIncomingFile(file, cb); });

