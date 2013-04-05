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
function Client(socket, query) {
	var client = this;
	client.socket = socket;
	client.query = query; // TODO: Don't use null as a valid query.
	client.connected = true;

	client.socket.on("disconnect", function() {
		client.connected = false;
		Client.all.splice(Client.all.indexOf(client), 1);
	});
}
Client.prototype.send = function(URN) {
	var client = this;
//	if(tags && client.query && !client.query.test(tags)) return;
	// TODO: We shouldn't have to check if client.query is null.
	// TODO: We have to hit the DB in order to perform full-text queries.
	client.socket.emit("entry", URN);
};

Client.all = []; // TODO: Clients should probably be tracked by the repo instead.

module.exports = Client;
