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
var fs = require("../server/utilities/fsx");

var DATA = __dirname+"/../data";
var CACHE = __dirname+"/../cache";

var db = new pg.Client(require("../secret.json").db);

var remaining = 0;
function dbErr() {
	++remaining;
	return function(err) {
		if(err) console.log(err);
		if(--remaining) db.end();
	};
}
function fsErr(err) {
	if(err && "ENOENT" !== err.code) console.log(err);
}

if("--seriously" !== process.argv[2]) {
	console.log("Usage: reset-all.js --seriously");
	console.log("\tAre you sure?");
} else {
	db.connect();
	db.query('TRUNCATE TABLE "names" CASCADE', dbErr());
	db.query('SELECT setval(\'public."entries_entryID_seq"\', 1, true)', dbErr());
	db.query('SELECT setval(\'public."names_nameID_seq"\', 1, true)', dbErr());
	db.query('SELECT setval(\'public."tags_tagID_seq"\', 1, true)', dbErr());
	fs.rmRecursive(DATA, fsErr);
	fs.rmRecursive(CACHE, fsErr);
}
