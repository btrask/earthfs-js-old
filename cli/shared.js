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

var CONFIG_PATH = "~/.config/EarthFS.json".replace(/^~/, process.env.HOME);
var config = (function() {
	var json;
	try { json = fs.readFileSync(CONFIG_PATH, "utf8"); }
	catch(e) { json = JSON.stringify({}); }
	return JSON.parse(json); // TODO: Read command line options.
})();

function Repo(urlString, user, pass) {
	var repo = this;
	repo.url = urlModule.parse(urlString, true);
	repo.user = user;
	repo.pass = pass;
	repo.client = clientForURL(repo.url);
}
Repo.prototype.submit = function(path, callback/* (err, URN) */) {
	var repo = this;
	var boundary = "----"+crypto.randomBytes(12).toString("base64");
	var req = repo.client.request({
		hostname: repo.url.hostname,
		port: repo.url.port,
		path: "/api/entry/?"+querystring.stringify({"u": repo.user, "p": repo.pass}),
		method: "POST",
		headers: {
			"Content-Type": "multipart/form-data; boundary="+boundary,
		},
		rejectUnauthorized: false, // TODO: HACK, INSECURE
	});
	req.on("error", function(err) {
		callback(err, null);
	});
	req.on("response", function(res) {
		var buf = "";
		res.setEncoding("utf8");
		res.on("readable", function() {
			buf += res.read();
		});
		res.on("end", function() {
			var obj = JSON.parse(buf);
			callback(null, obj["urn"]);
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
	file.on("error", function(err) {
		callback(err, null);
	});
	file.on("end", function() {
		req.write('\r\n', "utf8");
		req.write('\r\n', "utf8");
		req.write('--'+boundary+'--', "utf8");
		req.end();
	});
};
Repo.prototype.read = function(URN, callback/* (err, stream) */) {
	var repo = this;
	var req = repo.client.get({
		hostname: repo.url.hostname,
		port: repo.url.port,
		path: "/api/entry/"+encodeURIComponent(URN)+"/?"+querystring.stringify({"u": repo.user, "p": repo.pass}),
		rejectUnauthorized: false, // TODO: HACK, INSECURE
	});
	req.on("error", function(err) {
		callback(err, null);
	});
	req.on("response", function(res) {
		if(200 !== res.statusCode) return callback({httpStatusCode: res.statusCode}, null);
		callback(null, res);
	});
};

Repo.load = function() {
	return new Repo(config["repo-url"], config["username"], config["password"]);
};

function clientForURL(url) {
	switch(url.protocol) {
		case "http:": return http;
		case "https:": return https;
		default: throw new Error("Unknown protocol "+url.protocol);
	}
}

exports.config = config;
exports.Repo = Repo;
