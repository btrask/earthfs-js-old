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
var crypto = require("crypto");
var pathModule = require("path");
var urlModule = require("url");
var util = require("util");

var pg = require("pg");
var formidable = require("formidable");

var bt = require("./utilities/bt");
var fs = require("./utilities/fsx");
var http = require("./utilities/httpx");
var sql = require("./utilities/sql");

var formatters = require("./formatters");
var Query = require("./Query");

var CLIENT = __dirname+"/../build";
var DATA = __dirname+"/../data";

var EXT = require("./utilities/ext.json");
var QUERY_TYPES = ["text/html", "text/json"];

var db = new pg.Client(require("../secret.json").db);
db.connect();

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function componentsFromPath(path) {
	var l = path.length;
	var a = "/" === path[0] ? 1 : 0;
	var b = "/" === path[l-1] ? 1 : 0;
	if(a+b >= l) return [];
	return path.slice(a, -b || undefined).split("/");
}
function pathFromComponents(components) {
	if(!components.length) return "";
	return "/"+components.join("/");
}
function lookup(obj, prop) {
	if(!obj || !prop) return null; // TODO: Be more robust.
	if(has(obj, prop)) return obj[prop];
	return null;
}
function first(array) {
	return array.length ? array[0] : null;
}
function rest(array) {
	return array.slice(1);
}

function pathForEntry(hash, type) {
	var t = type.split(";")[0];
	if(!bt.has(EXT, t)) throw new Error("Invalid MIME type "+type);
	return DATA+"/"+hash.slice(0, 2)+"/"+hash+"."+EXT[t];
}

var serve = function(req, res) {
	var path = urlModule.parse(req.url).pathname;
	var components = componentsFromPath(path).map(function(x) {
		return decodeURIComponent(x);
	});
	if(-1 !== components.indexOf("..")) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	serve.root(req, res, {
		"path": path,
		"components": components,
	});
};
serve.root = function(req, res, root) {
	var components = root.components;
	var options = urlModule.parse(req.url, true).query;
	var imp = lookup(serve.root, first(components)) ||
		lookup(serve.root, EXT[bt.negotiateTypes(req.headers.accept.split(","), QUERY_TYPES)]);
	if(!imp) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	imp(req, res, root, {
		"path": pathFromComponents(components),
		"components": rest(components),
		"options": options,
	});
};
function tagSearch(input) {
	if(undefined === input || "" === input) {
		return db.query(
			'SELECT * FROM ('+
				'SELECT e."entryID", n."name" AS "hash", e."MIMEType" AS "type", e."time"'+
				' FROM "entries" AS e'+
				' LEFT JOIN "names" AS n ON (n."nameID" = e."nameID")'+
				' ORDER BY e."entryID" DESC LIMIT 50'+
			') x ORDER BY "entryID" ASC'
		);
	} else {
		var tags = input.split("+").map(function(tag) {
			return decodeURIComponent(tag);
		});
		// TODO: Parse input properly and perform real query. This doesn't work at all.
		return db.query(
			'SELECT * FROM ('+
				'SELECT DISTINCT e."entryID", n1."name" AS "hash", e."MIMEType" as "type", e."time" FROM "names" AS "n1"'+
				' LEFT JOIN "entries" AS "e" ON (n1."nameID" = e."nameID")'+
				' LEFT JOIN "tags" AS "t" ON (e."nameID" = t."nameID")'+
				' LEFT JOIN "names" AS "n2" ON (n2."nameID" = t."impliedID")'+
				' WHERE n2."name" IN ('+sql.list1D(tags, 1)+')'+
				' ORDER BY e."entryID" DESC LIMIT 50'+
			') x ORDER BY "entryID" ASC',
			tags
		);
	}
}
serve.root.html = function(req, res, root, html) {
	var path = CLIENT+html.path;
	fs.stat(path, function(err, stats) {
		if(err) return res.sendError(err);
		res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
	});
};
serve.root.json = function(req, res, root, json) {
	var query = tagSearch(json.options.q), started = false;
	query.on("error", function(err) {
		console.log("Error during query:", err);
		if(!started) {
			started = true;
			res.sendError(err);
		}
	});
	query.on("row", function(row) {
		if(!started) {
			started = true;
			res.writeHead(200, {
				"Content-Type": "text/json; charset=utf-8",
			});
			res.write("[", "utf8");
		} else {
			res.write(",", "utf8");
		}
		delete row.entryID; // We didn't want this in the first place, but Postgres made us ask for it.
		row.url = "/entry/"+row.hash;
		res.write(JSON.stringify(row));
	});
	query.on("end", function() {
		res.end("]", "utf8");
	});
};
serve.root.test = function(req, res, root, test) {
	var tab = "\t";
	var obj = Query.parse("").SQL(0, tab+"\t");
	sql.debug(db,
		'SELECT * FROM (\n'+
			tab+'SELECT e."entryID", n."name" AS "hash", e."MIMEType" AS "type", e."time"\n'+
			tab+'FROM (\n'+
				obj.query+
			tab+') AS q\n'+
			tab+'LEFT JOIN "entries" AS e ON (e."nameID" = q."nameID")\n'+
			tab+'LEFT JOIN "names" AS n ON (n."nameID" = q."nameID")\n'+
			tab+'ORDER BY e."entryID" DESC LIMIT 50\n'+
		') x ORDER BY "entryID" ASC',
		obj.parameters,
		function(err, results) {
			console.log(err, results);
		}
	);
};
serve.root.entry = function(req, res, root, entry) {
	var hash = first(entry.components);
	if(!hash) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	db.query(
		'SELECT "MIMEType", "time" FROM "entries"'+
		' LEFT JOIN "names" ON ("entries"."nameID" = "names"."nameID")'+
		' WHERE "names"."name" = $1', [hash],
		function(err, result) {
			if(err) {
				res.sendError(err);
				return;
			}
			var srcType = result.rows[0].MIMEType;
			var srcPath = pathForEntry(hash, srcType);
			var dstTypes = req.headers.accept.split(",");
			sendFormatted(req, res, srcPath, srcType, dstTypes, hash);
		}
	);
};
function sendFormatted(req, res, srcPath, srcType, dstTypes, hash) {
	var obj = formatters.select(srcType, dstTypes, true);
	if(!obj) {
		res.sendMessage(406, "Not Acceptable");
		return;
	}
	var dstType = obj.dstType;
	var dstPath = dstType === srcType ? srcPath : formatters.cachePath(hash, dstType);
	var format = obj.format;
	if("text/" === dstType.slice(0, 5)) dstType += "; charset=utf-8";

	function sendFile(path, stats) {
		var stream = fs.createReadStream(dstPath);
		res.writeHead(200, {
			"Content-Type": dstType,
			"Content-Length": stats.size,
		});
		stream.pipe(res);
	}

	fs.stat(dstPath, function(err, stats) {
		if(!err) {
			sendFile(dstPath, stats);
		} else if("ENOENT" === err.code) {
			if(!format) return res.sendError(err);
			fs.mkdirRecursive(pathModule.dirname(dstPath), function(err) {
				if(err) return res.sendError(err);
				format(srcPath, dstPath, function(err, tags) {
					if(err) return res.sendError(err);
					fs.stat(dstPath, function(err, stats) {
						if(err) return res.sendError(err);
						sendFile(dstPath, stats);
					});
				});
			});
		} else {
			res.sendError(err);
		}
	});
}

serve.root.submit = function(req, res, root, submit) {
	if("POST" !== req.method) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	function fail(err) {
		console.log(err);
		res.sendMessage(500, "Internal Server Error");
	}
	var form = new formidable.IncomingForm({
		"keepExtensions": false,
	});
	form.hash = "sha1";
	form.addListener("error", function(err) {
		fail(err);
	});
	form.parse(req, function(err, fields, fileByField) {
		if(err) return fail(err);
		if(!has(fileByField, "entry")) {
			res.sendMessage(400, "Bad Request");
			return;
		}
		var file = fileByField.entry;
		var hash = file.hash;
		var type = file.type;
		console.log("Adding entry "+hash);
		importEntryFile(file.path, hash, type, function(err, path) {
			if(err) throw err;
			formatters.parseTags(path, type, hash, function(names, tagMap) {
				if(err) throw err;
				// TODO: Use transactions?
				defineNames(names, function(err) {
					if(err) throw err;
					db.query(
						'SELECT "nameID" FROM "names"'+
						' WHERE "name" = $1', [hash],
						function(err, nameResult) {
							if(err) throw err;
							var nameID = nameResult.rows[0].nameID;
							db.query(
								'INSERT INTO "tags" ("nameID", "impliedID", "direct", "indirect")'+
								' SELECT a."nameID", b."nameID", TRUE, 1 FROM "names" a'+
								' JOIN "names" b ON (TRUE)'+
								' WHERE (a."name", b."name") IN ('+sql.list2D(tagMap, 1)+')', sql.flatten(tagMap),
								function(err, result) {
									if(err) return fail(err);
									db.query(
										'INSERT INTO "entries" ("entryID", "nameID", "MIMEType")'+
										' VALUES (DEFAULT, $1, $2)', [nameID, type],
										function(err, result) {
											if(err) return fail(err);
											res.writeHead(303, {"Location": "/tag/"+hash});
											res.end();
										}
									);
								}
							);
						}
					);
				});
			});
		});
	});
};
function defineNames(names, callback/* (err) */) {
	if(!names.length) return callback(null);
	db.query(
		'INSERT INTO "names" ("name")'+
		' VALUES '+sql.list2D(names, 1), names,
		function(err, result) { callback(err); }
	);
}
function importEntryFile(path, hash, type, callback/* (err, path) */) {
	fs.chmod(path, 292 /*=0444*/, function(err) {
		if(err) return callback(err, null);
		var dst = pathForEntry(hash, type);
		fs.mkdirRecursive(pathModule.dirname(dst), function(err) {
			if(err) return callback(err, null);
			fs.link(path, dst, function(err) { // TODO: Test this carefully to make sure we don't overwrite.
				fs.unlink(path);
				if(err) return callback(err, null);
				callback(null, dst);
			});
		});
	});
}

serve.root.preview = function(req, res, root, preview) {
	if("POST" !== req.method) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	function fail(err) {
		console.log(err);
		res.sendMessage(500, "Internal Server Error");
	}
	var form = new formidable.IncomingForm({
		"keepExtensions": false,
	});
	form.addListener("error", function(err) {
		fail(err);
	});
	form.parse(req, function(err, fields, fileByField) {
		var file = fileByField.entry;
		var srcPath = file.path;
		var srcType = file.type;
		var dstTypes = req.headers.accept.split(",");
		var obj = formatters.select(srcType, dstTypes, true);
		if(!obj) return res.sendMessage(406, "Not Acceptable");
		var dstPath = srcPath+".out";
		obj.format(srcPath, dstPath, function(err, tags) {
			fs.unlink(srcPath);
			if(err) return res.sendError(err);
			fs.stat(dstPath, function(err, stats) {
				if(err) return res.sendError(err);
				res.writeHead(200, {
					"Content-Type": obj.dstType,
					"Content-Length": stats.size,
				});
				var stream = fs.createReadStream(dstPath);
				stream.pipe(res);
				stream.on("end", function() {
					fs.unlink(dstPath);
				});
			});
		});
	});
};

http.createServer(serve).listen(8001);
