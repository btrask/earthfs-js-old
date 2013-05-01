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
var sql = require("../utilities/sql");

function Client(repo, query, stream) {
	if(!query) throw new Error("Invalid query for Client");
	var client = this;
	client.repo = repo;
	client.query = query;
	client.stream = stream;
	client.open = true;
	client.paused = true;
	client.queue = [];

	var heartbeat = setInterval(function() {
		client.stream.write(" ", "utf8");
	}, 1000 * 30);
	repo.clients.push(client);
	client.stream.on("close", function() {
		client.open = false;
		repo.clients.splice(repo.clients.indexOf(client), 1);
		repo.removeListener("entry", sendEntry);
		clearInterval(heartbeat);
	});

	var cache = client.query.SQL(2, "\t");
	function sendEntry(URN, entryID) {
		sql.debug(repo.db,
			'SELECT $1 IN \n'+
				cache.query+
			'AS matches', [entryID].concat(cache.parameters),
			function(err, results) {
				if(err) console.log(err);
				if(results.rows[0].matches) client.send(URN);
			}
		);
	}
	repo.on("entry", sendEntry);
}
Client.prototype.send = function(URN) {
	var client = this;
	if(!client.open) throw new Error("Writing to closed client");
	client.queue.push(URN);
	client.flush();
};
Client.prototype.flush = function() {
	var client = this;
	if(!client.open) return;
	if(client.paused) return;
	if(!client.queue.length) return;
	client.stream.write(client.queue.join("\n")+"\n", "utf8");
	client.queue.length = 0;
};
Client.prototype.pause = function() {
	var client = this;
	client.paused = true;
};
Client.prototype.resume = function() {
	var client = this;
	client.paused = false;
	client.flush();
};

module.exports = Client;
