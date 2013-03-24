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

/*global query DOM io Text*/

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
	stream.pinned = true;
	stream.sidebarSize = 150;
	stream.editor = null;
	stream.socket = io.connect("/");
	stream.socket.on("connected", function(callback) {
		DOM.fill(stream.entries);
		callback({"q": query});
	});

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

	DOM.addListener(window, "resize", function(event) {
		stream.reflow();
	});
	DOM.addListener(stream.toolbar, "mousedown", function(event) {
		if(event.target !== stream.toolbar || !stream.editor) return;
		var cursor = stream.element.offsetHeight - event.clientY;
		var offset = stream.sidebarSize - cursor;
		var move, end;
		DOM.addListener(document, "mousemove", move = function(event) {
			var cursor = stream.element.offsetHeight - event.clientY;
			stream.setSidebarSize(cursor + offset);
			if(event.preventDefault) event.preventDefault();
			return false;
		});
		DOM.addListener(document, "mouseup", end = function(event) {
			DOM.removeListener(document, "mousemove", move);
			DOM.removeListener(document, "mouseup", end);
			if(event.preventDefault) event.preventDefault();
			return false;
		});
		if(event.preventDefault) event.preventDefault();
		return false;
	});
	DOM.addListener(stream.content, "scroll", function(event) {
		var c = stream.content;
		stream.pinned = c.scrollTop >= (c.scrollHeight - c.clientHeight);
	});

	stream.socket.on("entry", function(obj) {
		var entry = new Entry(obj);
		stream.entries.appendChild(entry.element);
		stream.keepPinned();
		entry.load(function() {
			stream.keepPinned();
		});
	});
}
Stream.prototype.reflow = function() {
	var stream = this;
	var toolbarHeight = stream.toolbar.offsetHeight;
	var windowHeight = stream.element.offsetHeight;
	var clamped = stream.editor ? Math.max(100, Math.min(stream.sidebarSize, windowHeight)) : toolbarHeight;
	stream.content.style.bottom = clamped+"px";
	stream.sidebar.style.height = clamped+"px";
	stream.keepPinned();
};
Stream.prototype.keepPinned = function() {
	var stream = this;
	if(stream.pinned) stream.content.scrollTop = stream.content.scrollHeight;
};
Stream.prototype.setSidebarSize = function(val) {
	var stream = this;
	stream.sidebarSize = val;
	stream.reflow();
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
		stream.editor.activate();
	}
	stream.reflow();
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
Stream.location = function(params) {
	return "/"+query.stringify(params);
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
				DOM.fill(editor.preview, Entry.parseHTML(req.responseText));
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
		editor.textarea.value = "";
		DOM.fill(editor.preview);
	};
}
TextEditor.prototype.activate = function() {
	var editor = this;
	editor.textarea.focus();
};
function FileEditor(stream) {
	var editor = this;
	editor.element = DOM.clone("fileEditor", this);
	editor.label = "Upload File";
	editor.uploadButton.onclick = function(event) {
		stream.upload(editor.uploadInput.files[0]); // TODO: Disable button when no file selected.
	};
}
FileEditor.prototype.activate = function() {};

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
	entry.URN = obj["URN"];
	entry.type = obj["type"];
	DOM.fill(entry.elems.URN, entry.URN);
	DOM.fill(entry.elems.content, "Loading…");
	entry.elems.URN.href = Stream.location({"q": entry.URN});
	entry.elems.raw.href = "/entry/"+entry.URN;
}
Entry.prototype.load = function(callback) {
	var entry = this;
	var url = "/entry/"+encodeURIComponent(entry.URN);
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
		DOM.fill(entry.elems.content, Entry.parseHTML(req.responseText));
		callback();
	};
	req.setRequestHeader("Accept", "text/html");
	req.send("");
};
Entry.parseHTML = function(html) {
	function linkifyTextNode(text) {
		// <http://daringfireball.net/2010/07/improved_regex_for_matching_urls>
		var exp = /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
		var x, unlinked, rest, link;
		while((x = exp.exec(text.data))) {
			link = document.createElement("a");
			link.appendChild(document.createTextNode(x[0]));
			link.href = x[0];
			unlinked = text.splitText(x.index);
			rest = unlinked.splitText(x[0].length);
			unlinked.parentNode.replaceChild(link, unlinked);
		}
	}
	function linkifyURNs(node) {
		if("A" === node.tagName) return;
		var a = node.childNodes;
		for(var i = 0; i < a.length; ++i) {
			if(a[i] instanceof Text) linkifyTextNode(a[i]);
			else linkifyURNs(a[i]);
		}
	}
	function convertURNs(node) {
		var a = node.childNodes, l = a.length, x;
		for(var i = 0; i < l; ++i) {
			if(!a[i].getAttribute) continue;
			x = a[i].getAttribute("href");
			if(x && /^urn:/.test(x)) {
				a[i].setAttribute("href", "/entry/"+encodeURIComponent(x));
				DOM.classify(a[i], "URN");
			}
			x = a[i].getAttribute("src");
			if(x && /^urn:/.test(x)) {
				a[i].setAttribute("src", "/entry/"+encodeURIComponent(x));
				// TODO: Use a query link instead.
			}
			convertURNs(a[i]);
		}
	}
	var elem = document.createElement("div");
	elem.innerHTML = html;
	linkifyURNs(elem);
	convertURNs(elem);
	return elem;
};



var inputQuery = query.parse(window.location.search);
var stream = new Stream(undefined === inputQuery.q ? "" : inputQuery.q);
document.body.appendChild(stream.element);
stream.reflow();
