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
var querystream = exports;

var Stream = require("stream").PassThrough;

var client = require("efs-client");
var sqlModule = require("../utilities/sql");

// TODO: Maybe we could simplify by giving AST its own session value and having it perform these methods directly. But maybe that's mixing concerns.

querystream.ongoing = function(session, ast) {
	var sql = ast.SQL(2, '\t');
	var stream = new Stream;
	session.repo.on("submission", onsubmission);
	stream.on("end", function() {
		session.repo.removeListener("submission", onsubmission);
	});
	return stream;

	function onsubmission(submission) {
		sqlModule.debug(session.db,
			'SELECT $1 IN \n'+
				sql.query+
			'AS matches', [submission.fileID].concat(sql.parameters),
			function(err, results) {
				if(err) console.log(err);
				if(!results.rows[0].matches) return;
				stream.write(client.formatEarthURI({
					algorithm: "sha1",
					hash: submission.internalHash,
				})+"\n", "utf8");
			}
		);
	}
};
querystream.history = function(session, ast, count) {
	if(null === count) return querystream.page(session, ast, 0, null);
	var sql = ast.SQL(2, '\t\t');
	var results = sqlModule.debug2(session.db,
		'SELECT * FROM (\n'
			+'\t'+'SELECT "fileID", "internalHash"\n'
			+'\t'+'FROM "files"\n'
			+'\t'+'WHERE "fileID" IN\n'
				+sql.query
			+'\t'+'ORDER BY "fileID" DESC\n'
			+'\t'+'LIMIT $1\n'
		+') x ORDER BY "fileID" ASC',
		[count].concat(sql.parameters));
	return wrap(results);
};
querystream.page = function(session, ast, offset, limit) {
	var params = null === limit ? [offset] : [offset, limit];
	var sql = ast.SQL(params.length+1, '\t');
	var results = sqlModule.debug2(session.db,
		'SELECT "fileID", "internalHash"\n'
		+'FROM "files"\n'
		+'WHERE "fileID" IN\n'
			+sql.query
		+'ORDER BY "fileID" ASC\n'
		+'OFFSET $1\n'
		+(null === limit ? 'LIMIT ALL' : 'LIMIT $2'),
		params.concat(sql.parameters));
	return wrap(results);
};

function wrap(results) {
	var stream = new Stream;
	results.on("row", onrow);
	results.on("end", onend);
	results.on("error", onerror);
	stream.on("end", function() {
		results.removeListener("row", onrow);
		results.removeListener("end", onend);
		results.removeListener("error", onerror);
	});
	return stream;

	function onrow(row) {
		stream.write(client.formatEarthURI({
			algorithm: "sha1",
			hash: row.internalHash,
		})+"\n", "utf8");
	}
	function onend() {
		stream.end();
	}
	function onerror(err) {
		stream.emit("error", err);
	}
}

