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

start
	= space? x:union { return x; }

union
	= a:intersection b:unionPart* { return {type: "Union", args: [[a].concat(b)]}; }

unionPart
	= "or" space x:intersection { return x; }

intersection
	= a:unary space? b:intersectionPart* { return {type: "Intersection", args: [[a].concat(b)]}; }

intersectionPart
	= !("or" space) ("and" space)? x:unary space? { return x; }

unary
	= literal
	/ negation
	/ subexpression
	/ term

literal
	= x:literalPart { return {type: "Term", args: [x.join("")]}; }

literalPart
	= '"' x:[^"]+ '"' { return x; }
	/ "'" x:[^']+ "'" { return x; }

negation
	= "-" x:unary { return {type: "Negation", args: [x]}; }

subexpression
	= "(" space? x:union ")" { return x; }

term
	= x:[^()"'\- \n\r]+ { return {type: "Term", args: [x.join("")]}; }

space
	= [ \n\r]+ { return " "; }
