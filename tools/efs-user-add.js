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
if(process.argv.length < 5) exit("Usage: efs-user-add <repo> <name> <pass>"); // TODO: Insecure!
var crypto = require("crypto");
var bcrypt = require("bcrypt");
var Repo = require("../server/classes/Repo");
var repo = Repo.loadSync(process.argv[2]);
var URN = process.argv[3];
function exit(msg) {
	console.error(msg);
	process.exit();
}
var username = process.argv[3];
var password = bcrypt.hashSync(process.argv[4], 10);
var token = crypto.randomBytes(12).toString("base64");

repo.db.query(
	'INSERT INTO "users" ("username", "password", "token") VALUES ($1, $2, $3)',
	[username, password, token],
	function(err, results) {
		if(err) console.error(err);
		console.log(results);
		repo.db.end();
	}
);
