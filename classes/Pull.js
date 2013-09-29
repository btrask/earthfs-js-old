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

var ClientSession = require("efs-client").Session;
var Queue = require("../utilities/Queue");

function Pull(session, obj) {
	var pull = this;
	pull.repo = session.repo;
	pull.pullID = obj.pullID;
	pull.targets = obj.targets;
	pull.queue = new Queue;
	pull.serverSession = session;
	pull.clientSession = new ClientSession(obj.URI, obj.username, obj.password);
	pull.query = pull.clientSession.query(obj.queryString, obj.queryLanguage);
	pull.query.on("URI", function(URIString) {
		var URI = client.parseEarthURI(URIString);
		if(URI) pull.enqueue(URI.algorithm, URI.hash);
	});
}
Pull.prototype.enqueue = function(algorithm, hash) {
	var pull = this;
	pull.queue.push(function(done) {
		// TODO: Error handling, retry?
		pull.serverSession.submissionsForHash(algorithm, hash, function(err, submissions) {
			if(err) throw err;
			if(submissions.length) return done();
			// TODO: Check per-remote ignored hashes.
			pull.fetch(algorithm, hash, function(err) {
				if(err) throw err;
				done();
			});
		});
	});
};
Pull.prototype.fetch = function(algorithm, hash, callback/* (err) */) {
	var pull = this;
	pull.clientSession.readFile({
		algorithm: algorithm,
		hash: hash,
	}, function(err, obj) {
		if(err) return callback(err);
		var file = new IncomingFile(pull.repo, obj.type, pull.targets);
		file.loadFromStream(obj.stream, function(err) {
			if(err) return callback(err);
			// TODO: The incoming algorithm may not be locally installed.
			// That means we would try downloading it every single time.
			// Simply trusting the provided hash is no good either.
			// We probably need to store ignored hashes per-remote.
			pull.serverSession.addIncomingFile(file, function(err, obj) {
				if(err) return callback(err);
				callback(null);
			});
		});
	});
};
Pull.prototype.close = function() {
	var pull = this;
	// TODO: Implement.
};

