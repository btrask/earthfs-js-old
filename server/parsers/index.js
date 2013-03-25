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
var plugins = require("../utilities/plugins");
var modules = plugins.load(__dirname, "Parsers");

var parsers = exports;

function FallbackParser(type) {
	var p = this;
	p.links = null;
	p.metaEntries = null;
	p.metaLinks = null;
	p.fullText = null;
	p._buffers = []; // TODO: Use a streaming parser instead.
}
FallbackParser.prototype.update = function(chunk) {
	var p = this;
	p._buffers.push(chunk);
};
FallbackParser.prototype.end = function() {
	var p = this;
	var str = Buffer.concat(p._buffers).toString("utf8");
	// <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
	var exp = /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
	var x;
	p.links = [];
	while((x = exp.exec(str))) p.links.push(x[0]);
	p.metaEntries = [];
	p.metaLinks = []; // TODO: Implement.
	p.fullText = str;
};
FallbackParser.supports = function(type) {
	return "text/" === type.slice(0, 5);
};
modules.push(FallbackParser);

function ParserCollection(type) {
	for(var i = 0; i < modules.length; ++i) {
		if(modules[i].supports(type)) return new modules[i]();
	}
	var pc = this;
	pc.links = [];
	pc.metaEntries = [];
	pc.metaLinks = [];
}
ParserCollection.prototype.update = function(chunk) {};
ParserCollection.prototype.end = function() {};

module.exports = ParserCollection;
