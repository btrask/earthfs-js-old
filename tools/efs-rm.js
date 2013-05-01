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
if(process.argv.length < 4) exit("Usage: efs-rm [repo-path] [urn]");
var fs = require("fs");
var Repo = require("../server/classes/Repo");
var repo = Repo.loadSync(process.argv[2]);
var URN = process.argv[3];
function exit(msg) {
	console.error(msg);
	process.exit();
}
repo.db.query(
	'SELECT e."entryID", e."hash", e."type"'+
	' FROM "entries" AS e'+
	' LEFT JOIN "URIs" AS u ON (e."entryID" = u."entryID")'+
	' WHERE u."URI" = $1', [URN],
	function(err, results) {
		if(err) exit(err);
		if(!results.rows.length) exit("Entry not found");
		var entryID = results.rows[0].entryID;
		var hash = results.rows[0].hash;
		var type = results.rows[0].type;
		repo.db.query(
			'DELETE FROM "URIs" WHERE "entryID" = $1', [entryID],
			function(err, results) {
				if(err) exit(err);
				repo.db.query(
					'DELETE FROM "entries" WHERE "entryID" = $1', [entryID],
					function(err, results) {
						if(err) exit(err);
						var path = repo.pathForEntry(repo.DATA, hash, type);
						fs.unlink(path, function(err) {
							if(err) exit(err);
							repo.db.end();
						});
					}
				);
			}
		);
	}
);
