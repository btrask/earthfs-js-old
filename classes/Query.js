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

function Query(session, ast) {
	if(!ast) throw new Error("Invalid AST for Query");
	var query = this;
	EventEmitter.call(query);
	query.repo = session.repo;
	query.session = session;
	query.db = session.db;
	query.stream = new PassThroughStream; // Buffer until we're ready.
	query.ast = ast;
	query.cached = ast.SQL(2, "\t");
	query.streaming = false;
	query._stream = null;
	query.heartbeat = null;
}
util.inherits(Query, EventEmitter);
Query.prototype.open = function(stream, offset, limit, callback) {
	var query = this;
	if(query.streaming) throw new Error("Query already open");
	query.streaming = true;
	query._stream = stream;
	query.heartbeat = setInterval(function() {
		query._stream.write("\n", "utf8");
	}, 1000 * 30);

	sendHistory(query, offset, limit);

	query.repo.on("submission", onsubmission);
	query._stream.on("close", onclose);
	query.on("close", stop);
	query.on("error", stop);

	function onsubmission(obj) {
		sendSubmission(query, obj);
	}
	function onclose() {
		query.close();
	}
	function stop() {
		query.repo.removeListener("submission", onsubmission);
		query._stream.removeListener("close", onclose);
		query.removeListener("close", stop);
		query.removeListener("error", stop);
	}
};
Query.prototype.close = function() {
	var query = this;
	if(!query.open) return;
	query.streaming = false;
	clearInterval(query.heartbeat);
	query.heartbeat = null;
	query.emit("close");
	query._stream.end();
	query._stream = null;
	query.stream = new PassThroughStream;
};

function sendHistory(query, offset, limit) {
	var obj = SQL(query, offset, limit);
	var stream = sql.debug2(query.db, obj.query, obj.parameters);
	stream.on("row", onrow);
	stream.on("end", onend);
	stream.on("error", onerror);
	query.on("close", stop);
	query.on("error", stop);

	function onrow(row) {
		query._stream.write("earth://sha1/"+row.internalHash+"\n", "utf8");
	}
	function onend() {
		query.stream.pipe(query._stream, {end: false});
		query.stream.end();
		query.stream = query._stream;
		query.emit("streaming");
	}
	function onerror(err) {
		console.log(err.query);
		console.log(err.args);
		console.log(err.stack);
		query.emit("error", err);
	}
	function stop() {
		stream.removeListener("row", onrow);
		stream.removeListener("end", onend);
		stream.removeListener("error", onerror);
	}
}
function SQL(query, offset, limit) {
	var obj, str, params = [];
	var lim = '';
	if(offset >= 0) {
		if(limit && limit > 0) {
			lim = 'LIMIT $'+(params.length+1)+'\n';
			params.push(limit);
		}
		obj = query.ast.SQL(params.length+1, '\t');
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
		if(limit && limit > 0) {
			lim = '\t'+'LIMIT $'+(params.length+1)+'\n';
			params.push(limit);
		}
		obj = query.ast.SQL(params.length+1, '\t\t');
		params = params.concat(obj.parameters);
		str =
			'SELECT * FROM (\n'+
				'\t'+'SELECT "fileID", "internalHash"\n'+
				'\t'+'FROM "files"\n'+
				'\t'+'WHERE "fileID" IN\n'+
					obj.query+
				'\t'+'ORDER BY "fileID" DESC\n'+
				'\t'+'OFFSET $'+(params.length+1)+'\n'+
				lim+
			') x ORDER BY "fileID" ASC';
		params.push(Math.abs(offset || 0));
	}
	return { query: str, parameters: params };
}
function sendSubmission(query, obj) {
	sql.debug(query.db,
		'SELECT $1 IN \n'+
			query.cached.query+
		'AS matches', [obj.fileID].concat(query.cached.parameters),
		function(err, results) {
			if(err) console.log(err);
			if(results.rows[0].matches) query.stream.write(client.formatEarthURI({
				algorithm: "sha1",
				hash: obj.internalHash,
			})+"\n", "utf8");
		}
	);
}

