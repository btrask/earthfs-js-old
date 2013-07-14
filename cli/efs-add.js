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
var pathModule = require("path");

var bt = require("../server/utilities/bt"); // TODO: Move this module into a shared folder.
var shared = require("./shared");
var Repo = shared.Repo;

var args = process.argv;
if(args.length <= 2) { // TODO: Use node-optimist.
	console.error("Usage: efs-add [options] [path...]");
	console.error("Options:");
	console.error("\t--repo [url]");
	console.error("\t--user [user]");
	console.error("\t--pass [pass]");
	process.exit();
}
var cwd = process.cwd();
var paths = args.slice(2), i = 0;
var repo = Repo.load();

bt.asyncLoop(function(next) {
	if(i >= paths.length) return;
	repo.submit(pathModule.resolve(cwd, paths[i]), function(err, URN) {
		if(err) {
			console.error(paths[i], err);
			process.exit(1);
		} else {
			console.error(paths[i], URN);
			++i;
			next();
		}
	});
});
