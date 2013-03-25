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
var fs = require("fs");
var crypto = require("crypto");
//var encdec = require("encdec");
//var base32 = encdec.create("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
var bt = require("../utilities/bt");
var hashers = exports;

var plugins = require("../utilities/plugins");
var modules = plugins.load(__dirname, "Hashers");

function HasherCollection(type) {
	var hc = this;
	hc.internalHash = null;
	hc.URNs = null;

	hc._sha1 = crypto.createHash("sha1");
	hc._hashers = modules.map(function(Module) {
		return new Module(type);
	});
}
HasherCollection.prototype.update = function(chunk) {
	var hc = this;
	hc._sha1.update(chunk);
	hc._hashers.forEach(function(hasher) {
		hasher.update(chunk);
	});
};
HasherCollection.prototype.end = function() {
	var hc = this;
	var sha1 = new Buffer(hc._sha1.digest("binary"), "binary"); // Hack for 0.8.x.
	hc.internalHash = sha1.toString("hex");
	hc.primaryURN = "urn:sha1:"+hc.internalHash;
	hc.URNs = [
		hc.primaryURN,
//		"urn:sha1:"+base32.encode(sha1),
	];
	hc._hashers.forEach(function(hasher) {
		hasher.end();
		hc.URNs.push.apply(hc.URNs, hasher.URNs);
	});
};

module.exports = HasherCollection;
