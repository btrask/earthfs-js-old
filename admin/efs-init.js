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
var crypto = require("crypto");
var fs = require("fs");
var pathModule = require("path");
var readline = require("readline");

var bcrypt = require("bcrypt");
var mkdirp = require("mkdirp");
var pg = require("pg");
var Fiber = require("fibers");
var Future = require("fibers/future");

var sql = require("../utilities/sql");

var schema = fs.readFileSync(__dirname+"/../schema.sql", {encoding: "utf8"});
var args = (require('optimist')
	.usage("Usage: efs-init [options] path")
	.describe("U", "Database admin username")
		.default("U", process.env["USER"] || "postgres")
	.describe("p", "Database admin password")
		.default("p", null)
	.describe("db-port", "Database port")
		.default("db-port", 5432)
	.describe("address", "Repository listen address")
		.default("address", "localhost")
	.describe("port", "Repository port")
		.default("port", 8001)
	.demand(1)
	.argv);

// Shared
var dbPort = args["db-port"];

// Repo
var path = pathModule.resolve(process.cwd(), args._[0]);
var reponame = pathModule.basename(path);
var repopass = crypto.randomBytes(24).toString("base64");
var config = {
	db: {
		user: reponame,
		password: repopass,
		port: dbPort,
		database: reponame,
	},
	address: args["address"],
	port: args["port"],
};
var json = JSON.stringify(config, null, '\t');

// Admin
var adminname = args["U"];
var adminpass = args["p"]; // TODO: Interactive prompt?

var connectF = Future.wrap(function(db, a) { db.connect(a); });
var queryF = Future.wrap(function(db, a, b, c) { sql.debug(db, a, b, c); });
var existsF = Future.wrap(exists);
var writeFileF = Future.wrap(fs.writeFile);
var mkdirpF = Future.wrap(mkdirp, 1);
var questionF = Future.wrap(question);

Fiber(function() {
	var db1, db2;
	try {
		if(existsF(path+"/EarthFS.json").wait()) throw new Error("Repo already exists at "+path);

		var rl = readline.createInterface({input: process.stdin, output: process.stdout});
		var username = questionF(rl, "Username (default: "+adminname+"): ").wait() || adminname;
		var password = questionF(rl, "Password: ").wait(); // TODO: Don't print pass while typing.
		if(!password) throw new Error("Empty password");
		rl.close();

		db1 = new pg.Client({
			user: adminname,
			password: adminpass,
			port: dbPort,
			database: "postgres",
		});
		connectF(db1).wait();
		var esc = queryF(db1,
			'SELECT quote_ident($1) AS "reponame",\n'
			+'quote_literal($2) AS "repopass"',
			[reponame, repopass]).wait().rows[0];
		queryF(db1,
			'CREATE ROLE '+esc.reponame+' WITH\n'
			+'LOGIN ENCRYPTED PASSWORD '+esc.repopass+'', []).wait();
		queryF(db1,
			'CREATE DATABASE '+esc.reponame+'\n'
			+'WITH OWNER = DEFAULT\n'
			+'ENCODING = \'UTF8\'\n'
			+'TABLESPACE = pg_default\n'
			+'LC_COLLATE = \'en_US.UTF-8\'\n'
			+'LC_CTYPE = \'en_US.UTF-8\'\n'
			+'CONNECTION LIMIT = -1',
			[]).wait();
		// TODO: I give up on this error handling.

		db2 = new pg.Client({
			user: adminname,
			password: adminpass,
			port: dbPort,
			database: reponame,
		});
		connectF(db2).wait();
		queryF(db2, schema, []).wait();
		queryF(db2,
			'GRANT SELECT, INSERT, UPDATE, DELETE\n'
			+'ON ALL TABLES IN SCHEMA "public" TO '+esc.reponame+'',
			[]).wait();
		queryF(db2,
			'GRANT USAGE\n'
			+'ON ALL SEQUENCES IN SCHEMA "public" TO '+esc.reponame+'',
			[]).wait();
		queryF(db2,
			'INSERT INTO "users" ("username", "passwordHash", "tokenHash")\n'
			+'VALUES ($1, $2, \'\')',
			[username, bcrypt.hashSync(password, 10)]).wait();

		mkdirpF(path).wait();
		writeFileF(path+"/EarthFS.json", json, {encoding: "utf8"}).wait();
		console.log("Repo written to path "+path);

	} catch(err) {
		if(err.query) console.error(err.query);
		if(err.args) console.error(err.args);
		console.error(err.stack);
		process.exit(1);
	} finally {
		db2.end();
		db1.end();
	}
}).run();

function exists(path, callback/* (err, flag) */) {
	fs.stat(path, function(err, stats) {
		if(!err) return callback(null, true);
		if("ENOENT" === err.code) return callback(null, false);
		callback(err, null);
	});
}
function question(rl, str, cb) {
	rl.question(str, function(answer) {
		cb(null, answer);
	});
}

