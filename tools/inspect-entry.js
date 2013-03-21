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
var pg = require("pg");
var shared = require("../server/shared");
var db = shared.db = new pg.Client(require("../secret.json").db);
db.connect();

if("--help" === process.argv[2] || "-h" === process.argv[2]) {
	console.log("Usage: inspect-entry.js [hash|URN]");
	process.exit();
}

function print(err, results) {
	console.log(results.rows);
	db.end();
}

if(process.argv.length <= 2) {
	db.query(
		'SELECT e."entryID", e."hash", e."type", u."uriID", u."URI"'+
		' FROM "entries" AS e'+
		' LEFT JOIN "URIs" AS u ON (e."entryID" = u."entryID")'+
		' WHERE TRUE'+
		' ORDER BY e."entryID" DESC LIMIT 5', [], print
	);
} else {
	db.query(
		'SELECT e."entryID", e."hash", e."type", u."uriID", u."URI"'+
		' FROM "entries" AS e'+
		' LEFT JOIN "URIs" AS u ON (e."entryID" = u."entryID")'+
		' WHERE e."hash" = $1 OR u."URI" = $1'+
		' ORDER BY e."entryID" DESC', [process.argv[2]], print
	);
}
