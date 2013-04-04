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
var util = require("util");
var pg = require("pg");

var bt = require("../server/utilities/bt");
var sql = require("../server/utilities/sql");

var DATA = __dirname+"/../data";

var db = new pg.Client(require("../secret.json").db);
db.connect();

db.query(
	'UPDATE "tags" SET "indirect" = 0 WHERE TRUE'
);

db.query(
	'CREATE TEMPORARY TABLE "relations" ('+
		'"relationID" bigserial NOT NULL,'+
		' "tagID" bigint NOT NULL,'+
		' "impliedID" bigint NOT NULL,'+
		' CONSTRAINT "relationsPrimaryKey" PRIMARY KEY ("relationID")'+
	') WITH (OIDS=FALSE)', [], function(err, result){ if(err) throw util.inspect(err); }
);
db.query(
	'CREATE RULE "uniqueRelations" AS ON INSERT TO "relations"'+
	' WHERE EXISTS ('+
		'SELECT 1 FROM "relations" WHERE relations."tagID" = new."tagID"'+
	') DO INSTEAD NOTHING', [], function(err, result){ if(err) throw util.inspect(err); }
);
db.query(
	'SELECT "nameID" FROM "names"', [],
	function(err, result) {
		var i = 0;
		bt.asyncLoop(function(next) {
			if(i >= result.rows.length) return process.exit();
			var tagID = result.rows[i].nameID;
			function recurse(err, result) {
				if(err) throw util.inspect(err);
				if(result.rowCount) {
					db.query(
						'INSERT INTO "relations" ("tagID", "impliedID")'+
						' SELECT tags."tagID", tags."impliedID" FROM "relations"'+
						' INNER JOIN "tags" ON (tags."nameID" = relations."impliedID")'+
						'', [], recurse
					);
				} else {
					db.query(
						'SELECT "impliedID", COUNT(*) AS "indirect"'+
						' FROM "relations" GROUP BY "impliedID"', [],
						function(err, result) {
							var tags = result.rows.map(function(row) {
								return [tagID, row.impliedID, false, row.indirect];
							});
							db.query(
								'INSERT INTO "tags" ("nameID", "impliedID", "direct", "indirect")'+
								' VALUES '+sql.list2D(tags, 1)+'', sql.flatten(tags),
								function(err, result) {
									++i;
									next();
								}
							);
						}
					);
				}
			}
			db.query('TRUNCATE TABLE "relations"');
			db.query(
				'INSERT INTO "relations" ("tagID", "impliedID")'+
				' SELECT "tagID", "impliedID" FROM "tags"'+
				' WHERE "nameID" = $1', [tagID], recurse
			);
			
		});
	}
);
