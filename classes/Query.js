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
module.exports = Query;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var PassThroughStream = require("stream").PassThrough;
var client = require("efs-client");
var sql = require("../utilities/sql");

function Query(session, AST) {
	if(!AST) throw new Error("Invalid AST for Query");
	var query = this;
	EventEmitter.call(query);
	query.repo = session.repo;
	query.session = session;
	query.db = session.db;
	query.stream = new PassThroughStream; // Buffer until we're ready.
	query.AST = AST;
	query.cached = AST.SQL(2, "\t");
	query.open = false;
	query._stream = null;
	query.heartbeat = null;
}
util.inherits(Query, EventEmitter);
Query.prototype.open = function(stream, offset, limit) {
	var query = this;
	if(query.open) throw new Error("Query already open");
	query.open = true;
	query._stream = stream;
	query.heartbeat = setInterval(function() {
		query._stream.write("\n", "utf8");
	}, 1000 * 30);

	sendHistory(query, offset, limit, function(err) {
		if(err) return query.emit("error", err);
		query.stream.pipe(query._stream, {end: false});
		query.stream.end();
		query.stream = query._stream;
	});

	query.repo.on("submission", onsubmission);
	query._stream.on("close", onclose);
	query.once("close", function() {
		query.repo.removeListener("submission", onsubmission);
		query._stream.removeListener("close", onclose);
	});

	function onsubmission(obj) {
		sendSubmission(query, obj);
	}
	function onclose() {
		query.close();
	}
};
Query.prototype.send = function(URI) {
	var query = this;
	if(!query.open) return;
	query.stream.write(URI+"\n", "utf8");
};
Query.prototype.close = function() {
	var query = this;
	if(!query.open) return;
	query.open = false;
	clearInterval(query.heartbeat);
	query.heartbeat = null;
	query.emit("close");
	query._stream.end();
	query._stream = null;
	query.stream = new PassThroughStream;
};

function sendHistory(query, offset, limit, callback/* (err) */) {
	var obj, str, params = [];
	var lim = '';
	if(offset >= 0) {
		if(limit && limit > 0) {
			lim = 'LIMIT $'+(params.length+1)+'\n';
			params.push(limit);
		}
		obj = AST.SQL(params.length+1, tab+'\t');
		params = params.concat(obj.parameters);
		str =
			'SELECT "fileID", "internalHash"\n'+
			'FROM "files"\n'+
			'WHERE "fileID" IN\n'+
				obj.query+
			'ORDER BY "fileID" ASC\n'+
			'OFFSET $'+(params.length+1)+'\n'+
			lim;
		params.push(offset);
	} else {
		var tab = '\t';
		if(limit && limit > 0) {
			lim = tab+'LIMIT $'+(params.length+1)+'\n';
			params.push(limit);
		}
		obj = AST.SQL(params.length+1, tab+'\t');
		params = params.concat(obj.parameters);
		str =
			'SELECT * FROM (\n'+
				tab+'SELECT "fileID", "internalHash"\n'+
				tab+'FROM "files"\n'+
				tab+'WHERE "fileID" IN\n'+
					obj.query+
				tab+'ORDER BY "fileID" DESC\n'+
				tab+'OFFSET $'+(params.length+1)+'\n'+
				lim+
			') x ORDER BY "fileID" ASC';
		params.push(Math.abs(offset || 0));
	}
	var stream = sql.debug2(session.db, str, params);
	stream.on("row", function(row) {
		query._stream.write("earth://sha1/"+row.internalHash+"\n", "utf8");
	});
	stream.on("end", function() {
		callback(null);
	});
	stream.on("error", function(err) {
		callback(err);
	});
}
function sendSubmission(query, obj) {
	sql.debug(query.db,
		'SELECT $1 IN \n'+
			query.cached.query+
		'AS matches', [obj.fileID].concat(query.cached.parameters),
		function(err, results) {
			if(err) console.log(err);
			if(results.rows[0].matches) query.send(client.formatEarthURI({
				algorithm: "sha1",
				hash: obj.internalHash,
			}));
		}
	);
}

