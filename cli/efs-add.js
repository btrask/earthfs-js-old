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
var http = require("http");
var https = require("https");
var pathModule = require("path");
var querystring = require("querystring");
var urlModule = require("url");
var util = require("util");

var args = process.argv;
if(args.length <= 2) {
	console.error("Usage: efs-add [options] [path]");
	console.error("Options:");
	console.error("\t--repo [url]");
	console.error("\t--user [user]");
	console.error("\t--pass [pass]");
	process.exit();
}
var path = pathModule.resolve(process.cwd(), args[2]);

var CONFIG_PATH = "~/.config/EarthFS.json".replace(/^~/, process.env.HOME);
var json, config;
try { json = fs.readFileSync(CONFIG_PATH, "utf8"); }
catch(e) {
	json = JSON.stringify({});
}
try { config = JSON.parse(json); }
catch(e) {
	console.error("Error: "+e);
	process.exit(1);
}

var repo = config["repo-url"]; // TODO: Read command line options.
var user = config["username"];
var pass = config["password"];

var url = urlModule.parse(repo);
var client;
switch(url.protocol) {
	case "http:": client = http; break;
	case "https:": client = https; break;
	default: throw new Error("Unknown protocol "+url.protocol);
}

var boundary = "----"+crypto.randomBytes(12).toString("base64");
var req = client.request({
	hostname: url.hostname,
	port: url.port,
	path: "/api/entry/?"+querystring.stringify({"u": user, "p": pass}),
	method: "POST",
	headers: {
		"Content-Type": "multipart/form-data; boundary="+boundary,
	},
	rejectUnauthorized: false, // TODO: HACK, INSECURE
});
//req.on("error", function(err) {
//	console.log(err);
//});
req.on("response", function(res) {
	var buf = "";
	res.setEncoding("utf8");
	res.on("readable", function() {
		buf += res.read();
	});
	res.on("end", function() {
		console.log(util.inspect(JSON.parse(buf)));
	});
});
req.write('--'+boundary+'\r\n', "utf8");
req.write('Content-Disposition: form-data; name="entry"; filename="'+escape(pathModule.basename(path))+'"\r\n', "utf8");
// TODO: Is this method of escaping the file name correct?
//req.write('Content-Type: text/markdown\r\n', "utf8");
// TODO: Should we guess the MIME type?
req.write('\r\n', "utf8");
var file = fs.createReadStream(path);
file.pipe(req, {end: false});
file.on("end", function() {
	req.write('\r\n', "utf8");
	req.write('\r\n', "utf8");
	req.write('--'+boundary+'--', "utf8");
	req.end();
});
