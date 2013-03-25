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

fs.rmRecursive = function(path, callback/* (err) */) {
	if("/" === path) return callback(new Error("Are you out of your mind?"));
	fs.readdir(path, function(err, files) {
		if(!err) {
			var remaining = files.length;
			if(!remaining) return fs.rmdir(path, callback);
			for(var i = 0; i < files.length; ++i) {
				fs.rmRecursive(path+"/"+files[i], function(err) {
					if(err) {
						remaining = 0;
						callback(err);
						return;
					}
					if(!--remaining) fs.rmdir(path, callback);
				});
			}
		} else if("ENOTDIR" === err.code) {
			fs.unlink(path, callback);
		} else {
			callback(err);
		}
	});
};
fs.moveFile = function(src, dst, callback/* (err) */) {
	fs.link(src, dst, function(err) {
		if(err) return callback(err, null);
		fs.unlink(src, callback);
	});
};
fs.copyFile = function(src, dst, callback/* (err) */) {
	var srcStream = fs.createReadStream(src);
	var dstStream = fs.createWriteStream(dst);
	srcStream.pipe(dstStream);
	// TODO: I'm not sure which of these error messages to listen on.
	srcStream.on("error", function(err) {
		callback(err);
	});
	dstStream.on("error", function(err) {
		callback(err);
	});
	dstStream.on("end", function() {
		callback(null);
	});
};

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

fs.writeAll = function(fd, buffer, offset, length, position, callback) {
  var callback_ = arguments[arguments.length - 1];
  callback = (typeof(callback_) == 'function' ? callback_ : null);

  // write(fd, buffer, offset, length, position, callback)
  fs.write(fd, buffer, offset, length, position, function(writeErr, written) {
    if (writeErr) {
      fs.close(fd, function() {
        if (callback) callback(writeErr);
      });
    } else {
      if (written === length) {
        fs.close(fd, callback);
      } else {
        offset += written;
        length -= written;
        position += written;
        fs.writeAll(fd, buffer, offset, length, position, callback);
      }
    }
  });
};

module.exports = fs;
