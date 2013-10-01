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
module.exports = Field;

var urlModule = require("url");
var client = require("efs-client");
var plugins = require("../plugins");
var datadetectors = plugins.datadetectors;

function Field(name, value) {
	var field = this;
	field.name = name;
	field.value = value;
	field.links = null;
	field.scalars = null;
}
Field.prototype.addLink = function(URI, relation) {
	var field = this;
	if(!field.links) field.links = [];
	var normalizedURI = client.normalizeURI(URI);
	var relations = (relation || "").trim().toLowerCase().split(/\s+/g);
	relations.filter(function(relation) {
		// TODO: Some relations like `nofollow` should apply to all of the other relations, but not count as relations themselves... For now just ignore them entirely.
		switch(relation) {
			case "nofollow":
				return false;
			default: return true;
		}
	}).forEach(function(relation) {
		fields._links.push({normalizedURI: normalizedURI, relation: relation});
	});
};
Field.prototype.addScalar = function(type, value) {
	var field = this;
	if(!field.scalars) field.scalars = [];
	if(isNaN(value)) throw new Error("Invalid value "+value);
	field.scalars.push({
		type: type,
		value: value,
	});
};

Field.prototype.parse = function(callback/* (err) */) {
	var field = this;
	var waiting = 2;
	parseLinks(field, function(err) {
		if(err) { waiting = 0; callback(err); }
		if(!--waiting) callback(null);
	});
	parseScalars(field, function(err) {
		if(err) { waiting = 0; callback(err); }
		if(!--waiting) callback(null);
	});
};

function parseLinks(field, callback/* (err) */) {
	if(field.links) return callback(null);
	field.links = [];
	// <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
	var exp = /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
	var obj;
	while(obj = exp.exec(field.value)) {
		field.addLink(obj[0]);
	}
	callback(null);
};
function parseScalars(field, callback/* (err) */) {
	if(field.scalars) return;
	field.scalars = [];
	var waiting = datadetectors.length;
	if(!waiting) return callback(null);
	datadetectors.forEach(function(detector) {
		detector.parseScalars(field, function(err) {
			if(!--waiting) callback(null);
		});
	});
};

