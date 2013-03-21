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
var util = require("util");
var bt = require("../utilities/bt");
var sql = require("../utilities/sql");

var query = exports;

query.Term = function TermQuery(tag) {
	var q = this;
	q.tag = tag;
};
query.Term.prototype.test = function(tags) {
	var q = this;
	return -1 !== tags.indexOf(q.tag);
};
query.Term.prototype.SQL = function(offset, tab) {
	var q = this;
	return {
		query:
			tab+'"queryTag"($'+(offset+1)+')\n',
		parameters: [q.tag],
	};
};
query.Term.prototype.toString = function() {
	return this.tag;
};

query.Intersection = function IntersectionQuery(items) {
	var q = this;
	q.items = items;
};
query.Intersection.prototype.test = function(tags) {
	var q = this;
	for(var i = 0; i < q.items.length; ++i) {
		if(!q.items[i].test(tags)) return false;
	}
	return true;
};
query.Intersection.prototype.SQL = function(offset, tab) {
	var q = this;
	var queries = [tab,'(SELECT x0."nameID"\n',tab,'FROM\n'];
	var parameters = [];
	q.items.forEach(function(q2, i) {
		var obj = q2.SQL(parameters.length, tab+"\t");
		if(0 !== i) queries.push(tab,'INNER JOIN\n');
		queries.push(obj.query);
		queries.push(tab,'AS x',i);
		if(0 !== i) queries.push(' ON (x',i,'."nameID" = x0."nameID")');
		if(q.items.length-1 === i) queries.push(")");
		queries.push("\n");
		parameters.push.apply(parameters, obj.parameters);
	});
	return {
		query: queries.join(""),
		parameters: parameters,
	};
};
query.Intersection.prototype.toString = function() {
	return "(* "+this.items.join(" ")+")";
};

// TODO
query.Union = function UnionQuery() {};
query.Negative = function NegativeQuery() {};
