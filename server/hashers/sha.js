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
var encdec = require("encdec");
var base32 = encdec.create("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");

exports.create = function() {
	return new Hash();
};

function Hash() {
	var hash = this;
	hash.sha1 = crypto.createHash("sha1");
	hash.sha256 = crypto.createHash("sha256");
}
Hash.prototype.update = function(data, encoding) {
	this.sha1.update(data, encoding);
	this.sha256.update(data, encoding);
};
Hash.prototype.digests = function() {
	var sha1 = this.sha1.digest();
	var sha256 = this.sha256.digest();
	return [
		"urn:sha1:"+sha1.toString("hex"),
		"urn:sha1:"+base32.encode(sha1),
		"urn:sha256:"+sha1.toString("hex"),
		"urn:sha256:"+base32.encode(sha256),
	];
};
