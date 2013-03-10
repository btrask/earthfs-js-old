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

/*global query DOM io*/

var bt = {}; // TODO: Use separate file.
bt.has = function(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
};
bt.union = function(target, obj) {
	for(var prop in obj) if(bt.has(obj, prop)) target[prop] = obj[prop];
	return target;
};

function Stream(query) {
	var stream = this;
	stream.element = DOM.clone("stream", this);
	stream.searchText.value = query;
	stream.query = query;
	stream.editor = null;
	stream.socket = io.connect("/");
	stream.socket.emit("query", {"q": query});

	var editors = [TextEditor, FileEditor].map(function(Editor) {
		var editor = new Editor(stream);
		var button = editor.button = DOM.clone("modeButton");
		button.setAttribute("value", editor.label);
		button.onclick = function(event) {
			stream.setEditor(editor);
		};
		stream.toolbar.appendChild(button);
		return editor;
	});

	function submitQuery(event) {
		window.location = Stream.location({"q": stream.searchText.value});
	}
	stream.searchText.onkeypress = function(event) {
		var e = event || window.event;
		var keyCode = e.keyCode || e.which;
		if(13 === keyCode || 10 === keyCode) submitQuery();
	};
	stream.searchButton.onclick = submitQuery;

	stream.socket.on("entry", function(obj) {
		var entry = new Entry(obj);
		stream.entries.appendChild(entry.element);
		entry.load();
	});
}
Stream.location = function(params) {
	return "/"+query.stringify(params);
};
Stream.prototype.setEditor = function(editor) {
	var stream = this;
	if(stream.editor) {
		DOM.remove(stream.editor.element);
		DOM.classify(stream.editor.button, "selected", false);
	}
	if(stream.editor === editor) stream.editor = null;
	else stream.editor = editor;
	if(stream.editor) {
		stream.sidebar.appendChild(stream.editor.element);
		DOM.classify(stream.editor.button, "selected", true);
	}
};
Stream.prototype.upload = function(blob) {
	if(!blob) throw new Error("Bad upload");
	var stream = this;
	var form = new FormData();
	var req = new XMLHttpRequest();
	form.append("entry", blob);
	if(req.upload) req.upload.onprogress = function(event) {
		var complete = event.loaded / event.total;
		console.log("complete", complete);
	};
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		// TODO
		console.log("status", req.status);
	};
	req.open("POST", "/submit");
	req.send(form);
};

function TextEditor(stream) {
	var editor = this;
	editor.element = DOM.clone("textEditor", this);
	editor.label = "New Entry";
	var refresh = null, downloading = false;
	editor.textarea.oninput = editor.textarea.onpropertychange = function() {
		clearTimeout(refresh);
		refresh = setTimeout(function() {
			if(downloading) {
				refresh = setTimeout(arguments.callee, 1000);
				return;
			}
			var form = new FormData();
			var req = new XMLHttpRequest();
			form.append("entry", new Blob([editor.textarea.value], {"type": "text/markdown"}));
			req.onreadystatechange = function() {
				if(4 !== req.readyState) return;
				downloading = false;
				editor.preview.innerHTML = req.responseText;
			};
			req.open("POST", "/preview");
			req.setRequestHeader("Accept", "text/html");
			req.send(form);
			downloading = true;
		}, 1000);
	};
	editor.submitButton.onclick = function(event) {
		stream.upload(new Blob([editor.textarea.value], {"type": "text/markdown"}));
		// TODO: Selectable MIME types.
	};
}
function FileEditor(stream) {
	var editor = this;
	editor.element = DOM.clone("fileEditor", this);
	editor.label = "Upload File";
	editor.uploadButton.onclick = function(event) {
		stream.upload(editor.uploadInput.files[0]); // TODO: Disable button when no file selected.
	};
}

var IMAGE_TYPES = {
	"image/jpeg": 1,
	"image/jpg": 1,
	"image/png": 1,
	"image/gif": 1,
};
function Entry(obj) {
	var entry = this;
	entry.elems = {};
	entry.element = DOM.clone("entry", this.elems);
	entry.hash = obj["hash"];
	entry.type = obj["type"];
	entry.url = obj["url"];
	DOM.fill(entry.elems.hash, "#"+entry.hash);
	DOM.fill(entry.elems.content, "Loading…");
	entry.elems.hash.href = Stream.location({"q": entry.hash});
	entry.elems.raw.href = entry.url;
}
Entry.prototype.load = function() {
	var entry = this;
	var url = "/entry/"+encodeURIComponent(entry.hash);
	if(bt.has(IMAGE_TYPES, entry.type)) {
		var image = new Image();
		image.src = url;
		DOM.fill(entry.elems.content, image);
		return;
	}
	var req = new XMLHttpRequest();
	req.open("GET", url, true);
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		if(200 !== req.status) return; // TODO: Handle 406 Not Acceptable.
		entry.elems.content.innerHTML = req.responseText;
	};
	req.setRequestHeader("Accept", "text/html");
	req.send("");
};

var inputQuery = query.parse(window.location.search);
var stream = new Stream(undefined === inputQuery.q ? "" : inputQuery.q);
document.body.appendChild(stream.element);
