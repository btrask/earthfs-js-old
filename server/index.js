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
var parsers = require("./parsers");
var Query = require("./classes/Query");
var Client = require("./classes/Client");

var CLIENT = __dirname+"/../build";
var DATA = __dirname+"/../data";
var CACHE = __dirname+"/../../cache";

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

function pathForEntry(dir, hash, type) {
	var t = type.split(";")[0];
	if(!bt.has(EXT, t)) throw new Error("Invalid MIME type "+type);
	return dir+"/"+hash.slice(0, 2)+"/"+hash+"."+EXT[t];
}
function tagSearch(query) {
	return db.query(
		'SELECT * FROM ('+
			' SELECT e."entryID", \'urn:sha1:\' || e."hash" AS "URN", e."type"'+
			' FROM "entries" AS e ORDER BY "entryID" DESC LIMIT 50'+
		') x ORDER BY "entryID" ASC'
	);
	// TODO: Update querying with the new schema.
	var tab = "\t", obj, sql, parameters;
	if(!query) {
		sql = tab+'\t"names"';
		parameters = [];
	} else {
		obj = query.SQL(0, tab+"\t");
		sql = obj.query;
		parameters = obj.parameters;
	}
	return db.query(
		'SELECT * FROM (\n'+
			tab+'SELECT e."entryID", n."nameID", n."name" AS "hash", e."MIMEType" AS "type", e."time"\n'+
			tab+'FROM\n'+
				sql+
			tab+'AS q\n'+
			tab+'INNER JOIN "entries" AS e ON (e."nameID" = q."nameID")\n'+
			tab+'LEFT JOIN "names" AS n ON (n."nameID" = q."nameID")\n'+
			tab+'ORDER BY e."entryID" DESC LIMIT 50\n'+
		') x ORDER BY "entryID" ASC',
		parameters
	);
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
	var imp = lookup(serve.root, first(components));
	if(!imp) {
		var path = CLIENT+root.path;
		fs.stat(path, function(err, stats) {
			if(err) return res.sendError(err);
			res.sendFile(stats.isDirectory() ? path+"/index.html" : path);
		});
		return;
	}
	imp(req, res, root, {
		"path": pathFromComponents(components),
		"components": rest(components),
		"options": options,
	});
};
serve.root.entry = function(req, res, root, entry) {
	var URN = first(entry.components);
	console.log(URN);
	if(!URN) {
		res.sendMessage(400, "Bad Request");
		return;
	}
	db.query(
		'SELECT e."entryID", e."hash", e."type"'+
		' FROM "entries" AS e'+
		' LEFT JOIN "URIs" AS u ON (u."entryID" = e."entryID")'+
		' WHERE u."URI" = $1', [URN],
		function(err, results) {
			if(err) {
				res.sendError(err);
				return;
			}
			if(!results.rows.length) {
				res.sendMessage(404, "Not Found");
				return;
			}
			var row = results.rows[0];
			var srcType = row.type;
			var srcPath = pathForEntry(DATA, row.hash, srcType);
			var dstTypes = req.headers.accept.split(",");
			sendFormatted(req, res, srcPath, srcType, dstTypes, row.hash);
		}
	);
};
function sendFormatted(req, res, srcPath, srcType, dstTypes, hash) {
	var obj = formatters.select(srcType, dstTypes);
	if(!obj) {
		res.sendMessage(406, "Not Acceptable");
		return;
	}
	var dstType = obj.dstType;
	var dstPath = dstType === srcType ? srcPath : pathForEntry(CACHE, hash, dstType);
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
				format(srcPath, dstPath, function(err) {
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
		var URN = "urn:sha1:"+file.hash;
		var type = file.type;
		console.log("Adding entry "+URN);
		importEntryFile(file.path, file.hash, type, function(err, path) {
			if(err) throw err;
			createEntry(path, type, file.hash, URN, function(err, entryID) {
				if(err) throw err;
				addEntryLinks(path, type, entryID, function(err) {
					console.log(err);
					if(err) throw err;
					res.writeHead(303, {"Location": "/entry/"+URN});
					res.end();
					Client.send({
						"URN": URN,
						"type": type,
					}, entryID);
				});
			});
		});
	});
};
function importEntryFile(path, hash, type, callback/* (err, path) */) {
	fs.chmod(path, 292 /*=0444*/, function(err) {
		if(err) return callback(err, null);
		var dst = pathForEntry(DATA, hash, type);
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
function createEntry(path, type, hash, URI, callback/* (err, entryID) */) {
	if("text/" === type.slice(0, 5)) {
		fs.readFile(pathForEntry(DATA, hash, type), "utf8", function(err, data) {
			insert(data);
		});
	} else {
		insert(null);
	}
	function insert(data) {
		sql.debug(db,
			'INSERT INTO "entries" ("hash", "type", "fulltext")'+
			' VALUES ($1, $2, to_tsvector(\'english\', $3)) RETURNING "entryID"',
			[hash, type, data],
			function(err, results) {
				if(err) return callback(err, null);
				var entryID = results.rows[0].entryID;
				sql.debug(db,
					'INSERT INTO "URIs" ("URI", "entryID") VALUES ($1, $2)', [URI, entryID],
					function(err, results) {
						callback(err, entryID);
					}
				);
			}
		);
	}
}
function addEntryLinks(path, type, entryID, callback/* (err) */) {
	parsers.parse(path, type, function(err, links) {
		if(err || !links.length) return callback(err);
		sql.debug(db,
			'INSERT INTO "URIs" ("URI")'+
			' VALUES '+sql.list1D(links, 1, true)+'', links,
			function(err, results) {
				if(err) return callback(err);
				sql.debug(db,
					'INSERT INTO "links" ("fromEntryID", "toUriID", "direct", "indirect")'+
					' SELECT $1, "uriID", true, 1'+
					' FROM "URIs" WHERE "URI" IN ('+sql.list1D(links, 2)+')', [entryID].concat(links),
					function(err, results) {
						callback(err);
					}
				);
			}
		);
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
		obj.format(srcPath, dstPath, function(err) {
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

var server = http.createServer(serve);
var io = require("socket.io").listen(server, {log: false});
server.listen(8001);

io.sockets.on("connection", function(socket) {
	socket.emit("connected", function(params) {
		var str = params["q"].split("+").map(function(tag) {
			return decodeURIComponent(tag);
		}).join(" ");
		var query = "" === str ? null : Query.parse(str);
		// TODO: Use some sort of global query that filters hidden posts, etc.
		// We shouldn't allow query to be null.
		var client = new Client(socket, query);
		var dbq = tagSearch(query);
		dbq.on("error", function(err) {
			console.log(err); // TODO
		});
		dbq.on("row", function(row) {
			client.send({
				"URN": row.URN,
				"type": row.type,
			}, null);
		});
		dbq.on("end", function() {
			if(client.connected) Client.all.push(client); // Start watching for new entries.
		});
	});
});
