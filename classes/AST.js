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
var AST = exports;

var sql = require("../utilities/sql");

// TODO: Major rewrite needed.

AST.All = function AllAST() {};
AST.All.prototype.SQL = function(offset, tab) {
	return {
		query: tab+'(SELECT "fileID" FROM "files" WHERE TRUE)\n',
		parameters: [],
	};
};

AST.Term = function TermAST(term) {
	if(null === term) return new AST.All();
	var q = this;
	q.term = term;
};
AST.Term.prototype.SQL = function(offset, tab) {
	var q = this;
	return {
		query:
			tab+'(SELECT "fileID" FROM "fileIndexes"\n'+
			tab+'WHERE "index" @@ plainto_tsquery(\'english\', $'+offset+'))\n',
		parameters: [q.term],
	};
};
AST.Term.prototype.toString = function() {
	return this.term;
};

AST.Intersection = function IntersectionAST(items) {
	if(1 === items.length) return items[0];
	if(0 === items.length) return new AST.All();
	var q = this;
	q.items = items;
};
AST.Intersection.prototype.SQL = function(offset, tab) {
	var q = this;
	var queries = [tab,'(SELECT x0."fileID"\n',tab,'FROM\n'];
	var parameters = [];
	q.items.forEach(function(q2, i) {
		var obj = q2.SQL(parameters.length+offset, tab+"\t");
		var first = 0 === i, last = q.items.length-1 === i;
		if(!first) queries.push(tab,'INNER JOIN\n');
		queries.push(obj.query);
		queries.push(tab,'AS x',i);
		if(!first) queries.push(' ON (x',i,'."fileID" = x0."fileID")');
		if(last) queries.push(")");
		queries.push("\n");
		parameters.push.apply(parameters, obj.parameters);
	});
	return {
		query: queries.join(""),
		parameters: parameters,
	};
};
AST.Intersection.prototype.toString = function() {
	return "(* "+this.items.join(" ")+")";
};

AST.User = function UserAST(userID, subAST) {
	if(null === userID) throw new Error("Invalid user ID");
	if(!subAST) subAST = new AST.All();
	var q = this;
	q.userID = userID;
	q.subAST = subAST;
};
AST.User.prototype.SQL = function(offset, tab) {
	var q = this;
	var obj = q.subAST.SQL(offset+1, tab+"\t");
	return {
		query:
			tab+'(SELECT s."fileID" FROM "submissions" AS s\n'+
			tab+'LEFT JOIN "targets" AS t ON (t."submissionID" = s."submissionID")'+
			tab+'WHERE t."userID" IN (0, $'+offset+') AND "fileID" IN \n'+
				obj.query+
			tab+')\n',
		parameters: [q.userID].concat(obj.parameters),
	};
};
AST.User.prototype.toString = function() {
	var q = this;
	return "(user "+q.userID+" "+q.subquery.toString()+")";
};

// TODO
AST.Union = function UnionAST(items) { return items[0]; }; // Hack.
AST.Negative = function NegativeAST(item) {};

