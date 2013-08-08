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

query.All = function AllQuery() {};
query.All.prototype.SQL = function(offset, tab) {
	return {
		query: tab+'(SELECT "entryID" FROM entries WHERE TRUE)\n',
		parameters: [],
	};
};

query.Term = function TermQuery(term) {
	if(null === term) return new query.All();
	var q = this;
	q.term = term;
};
query.Term.prototype.SQL = function(offset, tab) {
	var q = this;
	return {
		query:
			tab+'(SELECT "entryID" FROM "entries"\n'+
			tab+'WHERE "fulltext" @@ plainto_tsquery(\'english\', $'+offset+'))\n',
		parameters: [q.term],
	};
};
query.Term.prototype.toString = function() {
	return this.term;
};

query.Intersection = function IntersectionQuery(items) {
	if(1 === items.length) return items[0];
	if(0 === items.length) return new query.All();
	var q = this;
	q.items = items;
};
query.Intersection.prototype.SQL = function(offset, tab) {
	var q = this;
	var queries = [tab,'(SELECT x0."entryID"\n',tab,'FROM\n'];
	var parameters = [];
	q.items.forEach(function(q2, i) {
		var obj = q2.SQL(parameters.length+offset, tab+"\t");
		var first = 0 === i, last = q.items.length-1 === i;
		if(!first) queries.push(tab,'INNER JOIN\n');
		queries.push(obj.query);
		queries.push(tab,'AS x',i);
		if(!first) queries.push(' ON (x',i,'."entryID" = x0."entryID")');
		if(last) queries.push(")");
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

query.User = function UserQuery(userID, subquery) {
	if(null === userID) throw new Error("Invalid user ID");
	if(!subquery) subquery = new query.All();
	var q = this;
	q.userID = userID;
	q.subquery = subquery;
};
query.User.prototype.SQL = function(offset, tab) {
	var q = this;
	var obj = q.subquery.SQL(offset+1, tab+"\t");
	return {
		query:
			tab+'(SELECT "entryID" FROM "targets"\n'+
			tab+'WHERE "userID" IN (0, $'+offset+') AND "entryID" IN \n'+
				obj.query+
			tab+')\n',
		parameters: [q.userID].concat(obj.parameters),
	};
};
query.User.prototype.toString = function() {
	var q = this;
	return "(user "+q.userID+" "+q.subquery.toString()+")";
};

// TODO
query.Union = function UnionQuery(items) { return items[0]; }; // Hack.
query.Negative = function NegativeQuery(item) {};
