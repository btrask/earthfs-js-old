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
var P = require("../../utilities/bad-parser");

function parse(str) {
	function debug(obj, label) { obj.label = label; }

	var htmlEncGt = P.replace(P.keep(">"), function() { return "&gt;"; });
	var htmlEncLt = P.replace(P.keep("<"), function() { return "&lt;"; });
	var htmlEncApos = P.replace(P.keep("'"), function() { return "&apos;"; });
	var htmlEncQuot = P.replace(P.keep('"'), function() { return "&quot;"; });
	var htmlEncAmp = P.replace(P.keep("&"), function() { return "&amp;"; });
	var htmlEnc = P.any(htmlEncGt, htmlEncLt, htmlEncApos, htmlEncQuot, htmlEncAmp, P.dot()); debug(htmlEnc, "htmlEnc");

	var lower = P.charset("abcdefghijklmnopqrstuvwxyz"); debug(lower, "lower");
	var upper = P.charset("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); debug(upper, "upper");
	var letter = P.any(upper, lower); debug(letter, "letter");
	var digit = P.charset("0123456789"); debug(digit, "digit");

	var tagChar = P.any(lower, digit, P.charset("_-")); debug(tagChar, "tagChar");
	var tag = P.replace(P.flatten(P.all(P.skip("#"), P.join(P.range(tagChar, 3, 40)))), function(hash) {
		return "<a href=\"/?q="+hash+"\">#"+hash+"</a>";
	}); debug(tag, "tag");

	// TODO: Look up RFC spec.
	var urlScheme = P.join(P.plus(P.any(letter, digit, P.charset("-")))); debug(urlScheme, "urlScheme");
	var urlChar = P.any(letter, digit, P.charset(".,/-#_()?=:;~%{}+"), htmlEncAmp); debug(urlChar, "urlChar");
	var url = P.replace(P.join(P.all(urlScheme, P.keep("://"), P.join(P.plus(urlChar)))), function(url) {
		return "<a href=\""+url+"\">"+url+"</a>";
	}); debug(url, "url");

	var inlineMarkup = P.join(P.plus(P.any(url, tag, htmlEnc))); debug(inlineMarkup, "inlineMarkup");

	var lineQuote = P.replace(P.flatten(P.all(P.skip("> "), inlineMarkup, P.skip("\n"))), function(x) {
		return "<blockquote>"+x+"</blockquote>";
	}); debug(lineQuote, "lineQuote");

	// TODO: Can't figure this out, and this stupid markup format is not the most important thing to be working on.
/*	var namedURL = P.join(P.all(P.not(P.skip("<"), P.plus(htmlEnc)), P.skip("<"), url, P.skip(">"))); debug(namedURL, "namedURL");
	var attribution = P.any(namedURL, url); debug(attribution, "attribution");
	var blockQuote = P.replace(P.flatten(P.all(P.skip("Quote:\n\n"), P.assert(P.all(inlineMarkup, P.skip("\n\n"), namedURL)))), function(x) {
		return "<blockquote>"+x+"</blockquote>";
	});*/

	var markup = P.any(/*blockQuote, */lineQuote, P.join(P.all(inlineMarkup, P.maybe(P.keep("\n"), "")))); debug(markup, "markup");
	var line = P.any(markup, P.keep("\n")); debug(line, "line");

	return P.run(P.join(P.star(line)), str);
}
