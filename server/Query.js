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
var bt = require("./utilities/bt");
var sql = require("./utilities/sql");

function Query(parent) {
	var q = this;
	q.parent = parent;
}

function TagQuery(parent, tag) {
	var q = this;
	Query.call(q, parent);
	q.tag = tag;
	q.name = "tag-"+q.tag;
}
util.inherits(TagQuery, Query);
TagQuery.prototype.test = function(entry) {
	var q = this;
	return -1 !== entry.tags.indexOf(q.tag);
};
TagQuery.prototype.SQL = function(offset, tab) {
	var q = this;
	return {
		query:
			tab+'"queryTag"($'+(offset+1)+')\n',
/*			tab+'SELECT t."nameID"\n'+
			tab+'FROM "tags" AS t\n'+
			tab+'LEFT JOIN "names" AS n ON (t."impliedID" = n."nameID")\n'+
			tab+'WHERE "name" = $'+(offset+1)+'\n',*/
		parameters: [q.tag],
	};
};

function IntersectionQuery(parent, items) {
	var q = this;
	Query.call(q, parent);
	q.items = items;
	if(q.items.length < 2) throw new Error("Intersection requires at least two items");
	q.itemNames = q.items.map(function(query) { return query.name; });
	q.name = "intersection("+q.itemNames.join(",")+")";
}
util.inherits(IntersectionQuery, Query);
IntersectionQuery.prototype.test = function(entry) {
	var q = this;
	for(var i = 0; i < q.items.length; ++i) {
		if(!q.items[i].test(entry)) return false;
	}
	return true;
};
IntersectionQuery.prototype.SQL = function(offset, tab) {
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


Query.parse = function(str) {
	var tags = str.split(/\s+/).map(function(tag) { // TODO: Real parsing.
		return new TagQuery(null, tag);
	});
	if(1 === tags.length) return tags[0];
	return new IntersectionQuery(null, tags);
};
module.exports = Query;
