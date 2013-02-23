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

/*global query DOM*/

function union(target, obj) {
	var has = Object.prototype.hasOwnProperty;
	for(var prop in obj) if(has.call(obj, prop)) target[prop] = obj[prop];
	return target;
}

function Stream(query) {
	var stream = this;
	stream.element = DOM.clone("stream", this);
	stream.searchText.value = query;
	stream.query = query;
	stream.editor = new Editor();

	function submitQuery(event) {
		window.location = Stream.location({"q": stream.searchText.value});
	}
	stream.searchText.onkeypress = function(event) {
		var e = event || window.event;
		var keyCode = e.keyCode || e.which;
		if(13 === keyCode || 10 === keyCode) submitQuery();
	};
	stream.searchButton.onclick = submitQuery;
	stream.element.appendChild(stream.editor.element);

	Stream.search({"q": query}, function(err, results) {
		var entry; // TODO: Handle errors.
		for(var i = 0; i < results.length; ++i) {
			entry = new Entry(results[i]);
			stream.entries.appendChild(entry.element);
			entry.load();
		}
	});
}
Stream.location = function(params) {
	return "/"+query.stringify(params);
};
Stream.search = function(params, callback/* (err, results) */) {
	var req = new XMLHttpRequest();
	req.open("GET", Stream.location(union({"view": "json"}, params)), true);
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		if(200 !== req.status) return; // TODO: Return errors.
		callback(null, JSON.parse(req.responseText));
	};
	req.setRequestHeader("Accept", "text/json");
	req.send("");
};

function Editor() {
	var editor = this;
	editor.element = DOM.clone("editor", this);
	editor.mode = new TagEditor();
	editor.element.appendChild(editor.mode.element);
}
function TagEditor() {
	var tagEditor = this;
	tagEditor.element = DOM.clone("tagEditor", this);
	tagEditor.searchButton.onclick = function(event) {
		Stream.search({"q": tagEditor.searchText.value, "direct": "0"}, function(err, results) {
			// TODO: Support "direct" server-side. Handle errors here.
			// TODO: We actually need a completely different lookup system. Return "name"s, not "hash"es.
			var tags = [];
			for(var i = 0; i < results.length; ++i) {
				tags.push("#"+results[i].hash);
			}
			DOM.fill(tagEditor.implications, tags.join(" "));
		});
	};
}

function Entry(obj) {
	var entry = this;
	entry.elems = {};
	entry.element = DOM.clone("entry", this.elems);
	entry.hash = obj["hash"];
	entry.type = obj["type"];
	entry.time = obj["time"];
	entry.url = obj["url"];
	DOM.fill(entry.elems.hash, "#"+entry.hash);
	DOM.fill(entry.elems.time, new Date(entry.time).toLocaleString());
	DOM.fill(entry.elems.content, "Loading…");
	entry.elems.hash.href = Stream.location({"q": entry.hash});
	entry.elems.raw.href = entry.url;
}
Entry.prototype.load = function() {
	var entry = this;
	var req = new XMLHttpRequest();
	req.open("GET", "/entry/"+encodeURIComponent(entry.hash), true);
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		if(200 !== req.status) return;
		entry.elems.content.innerHTML = req.responseText;
	};
	req.setRequestHeader("Accept", "text/html");
	req.send("");
};

var inputQuery = query.parse(window.location.search);
var stream = new Stream(undefined === inputQuery.q ? "" : inputQuery.q);
document.body.appendChild(stream.element);
