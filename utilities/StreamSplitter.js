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
module.exports = StreamSplitter;

var PassThroughStream = require("stream").PassThrough;

// Splitting streams is broken with Streams2.
// - Clients calling `stream.read()` on a single stream steal each other's data.
// - `stream.pipe()` shares data, but a client who doesn't read its pipe blocks all of the other clients forever.
// Thus, StreamSplitter() takes a stream and doles out piped streams to clients that are actually interested in them.
function StreamSplitter(stream) {
	var splitter = this;
	splitter._stream = stream;
}
StreamSplitter.prototype.stream = function() {
	var splitter = this;
	var stream = new PassThroughStream;
	splitter._stream.pipe(stream);
	return stream;
};
StreamSplitter.prototype.destroy = function(stream) {
	var splitter = this;
	splitter._stream.unpipe(stream);
};

