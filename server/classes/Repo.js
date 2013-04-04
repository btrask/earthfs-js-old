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
var pathModule = require("path");
var pg = require("pg");

var bt = require("../utilities/bt");
var sql = require("../utilities/sql");

var EXT = require("../utilities/ext.json");

function Repo(path) {
	var repo = this;
	repo.PATH = path;
	repo.DATA = pathModule.resolve(repo.PATH, "./data");
	repo.CACHE = pathModule.resolve(repo.PATH, "./cache");
	repo.LOG = pathModule.resolve(repo.DATA, "./hashes.log"); // TODO: Move to top level, rename.
	repo.CONFIG = pathModule.resolve(repo.PATH, "./secret.json"); // TODO: Move to EarthFS.json.
	repo.log = fs.createWriteStream(repo.LOG, {flags: "a", encoding: "utf8"});
	repo.config = JSON.parse(fs.readFileSync(repo.CONFIG, "utf8")); // TODO: Async?
	repo.db = new pg.Client(repo.config.db); // TODO: Use client pool.
	repo.db.connect();
}
Repo.prototype.pathForEntry = function(dir, hash, type) {
	var t = type.split(";")[0];
	if(!bt.has(EXT, t)) throw new Error("Invalid MIME type "+type);
	return dir+"/"+hash.slice(0, 2)+"/"+hash+"."+EXT[t];
};
Repo.prototype.addEntry = function(source, type, h, p, callback/* (err, entryID) */) {
	var repo = this;

	repo.log.write(JSON.stringify({
		"date": new Date().toISOString(),
		"internalHash": h.internalHash,
		"type": type,
		"source": source,
	})+"\n");

	sql.debug(repo.db,
		'INSERT INTO "entries" ("hash", "type", "fulltext")'+
		' VALUES ($1, $2, to_tsvector(\'english\', $3)) RETURNING "entryID"',
		[h.internalHash, type, p.fullText],
		function(err, results) {
			if(err) return callback(err, null);
			var entryID = results.rows[0].entryID;
			var allLinks = h.URNs.concat(p.links, p.metaEntries, p.metaLinks).unique();
			sql.debug(repo.db,
				'INSERT INTO "URIs" ("URI")'+
				' VALUES '+sql.list2D(allLinks, 1)+'', allLinks,
				function(err, results) {
					if(err) return callback(err, null);
					sql.debug(repo.db,
						'UPDATE "URIs" SET "entryID" = $1'+
						' WHERE "URI" IN ('+sql.list1D(h.URNs, 2)+')',
						[entryID].concat(h.URNs),
						function(err, results) {
							if(err) return callback(err, null);
							if(!p.links.length) return callback(null, entryID);
							sql.debug(repo.db,
								'INSERT INTO "links"'+
								' ("fromEntryID", "toUriID", "direct", "indirect")'+
								' SELECT $1, "uriID", true, 1'+
								' FROM "URIs" WHERE "URI" IN ('+sql.list1D(p.links, 2)+')',
								[entryID].concat(p.links),
								function(err, results) {
									if(err) return callback(err, null);
									// TODO
									// 1. Add meta-links to the meta-entries
									// 2. Recurse over links and add indirect rows
									callback(err, entryID);
								}
							);
						}
					);
				}
			);
		}
	);

};

module.exports = Repo;
