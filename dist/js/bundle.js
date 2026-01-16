(function () {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var jqueryExports = {};
	var jquery$1 = {
	  get exports(){ return jqueryExports; },
	  set exports(v){ jqueryExports = v; },
	};

	/*!
	 * jQuery JavaScript Library v3.7.1
	 * https://jquery.com/
	 *
	 * Copyright OpenJS Foundation and other contributors
	 * Released under the MIT license
	 * https://jquery.org/license
	 *
	 * Date: 2023-08-28T13:37Z
	 */

	(function (module) {
		( function( global, factory ) {

			{

				// For CommonJS and CommonJS-like environments where a proper `window`
				// is present, execute the factory and get jQuery.
				// For environments that do not have a `window` with a `document`
				// (such as Node.js), expose a factory as module.exports.
				// This accentuates the need for the creation of a real `window`.
				// e.g. var jQuery = require("jquery")(window);
				// See ticket trac-14549 for more info.
				module.exports = global.document ?
					factory( global, true ) :
					function( w ) {
						if ( !w.document ) {
							throw new Error( "jQuery requires a window with a document" );
						}
						return factory( w );
					};
			}

		// Pass this if window is not defined yet
		} )( typeof window !== "undefined" ? window : commonjsGlobal, function( window, noGlobal ) {

		var arr = [];

		var getProto = Object.getPrototypeOf;

		var slice = arr.slice;

		var flat = arr.flat ? function( array ) {
			return arr.flat.call( array );
		} : function( array ) {
			return arr.concat.apply( [], array );
		};


		var push = arr.push;

		var indexOf = arr.indexOf;

		var class2type = {};

		var toString = class2type.toString;

		var hasOwn = class2type.hasOwnProperty;

		var fnToString = hasOwn.toString;

		var ObjectFunctionString = fnToString.call( Object );

		var support = {};

		var isFunction = function isFunction( obj ) {

				// Support: Chrome <=57, Firefox <=52
				// In some browsers, typeof returns "function" for HTML <object> elements
				// (i.e., `typeof document.createElement( "object" ) === "function"`).
				// We don't want to classify *any* DOM node as a function.
				// Support: QtWeb <=3.8.5, WebKit <=534.34, wkhtmltopdf tool <=0.12.5
				// Plus for old WebKit, typeof returns "function" for HTML collections
				// (e.g., `typeof document.getElementsByTagName("div") === "function"`). (gh-4756)
				return typeof obj === "function" && typeof obj.nodeType !== "number" &&
					typeof obj.item !== "function";
			};


		var isWindow = function isWindow( obj ) {
				return obj != null && obj === obj.window;
			};


		var document = window.document;



			var preservedScriptAttributes = {
				type: true,
				src: true,
				nonce: true,
				noModule: true
			};

			function DOMEval( code, node, doc ) {
				doc = doc || document;

				var i, val,
					script = doc.createElement( "script" );

				script.text = code;
				if ( node ) {
					for ( i in preservedScriptAttributes ) {

						// Support: Firefox 64+, Edge 18+
						// Some browsers don't support the "nonce" property on scripts.
						// On the other hand, just using `getAttribute` is not enough as
						// the `nonce` attribute is reset to an empty string whenever it
						// becomes browsing-context connected.
						// See https://github.com/whatwg/html/issues/2369
						// See https://html.spec.whatwg.org/#nonce-attributes
						// The `node.getAttribute` check was added for the sake of
						// `jQuery.globalEval` so that it can fake a nonce-containing node
						// via an object.
						val = node[ i ] || node.getAttribute && node.getAttribute( i );
						if ( val ) {
							script.setAttribute( i, val );
						}
					}
				}
				doc.head.appendChild( script ).parentNode.removeChild( script );
			}


		function toType( obj ) {
			if ( obj == null ) {
				return obj + "";
			}

			// Support: Android <=2.3 only (functionish RegExp)
			return typeof obj === "object" || typeof obj === "function" ?
				class2type[ toString.call( obj ) ] || "object" :
				typeof obj;
		}
		/* global Symbol */
		// Defining this global in .eslintrc.json would create a danger of using the global
		// unguarded in another place, it seems safer to define global only for this module



		var version = "3.7.1",

			rhtmlSuffix = /HTML$/i,

			// Define a local copy of jQuery
			jQuery = function( selector, context ) {

				// The jQuery object is actually just the init constructor 'enhanced'
				// Need init if jQuery is called (just allow error to be thrown if not included)
				return new jQuery.fn.init( selector, context );
			};

		jQuery.fn = jQuery.prototype = {

			// The current version of jQuery being used
			jquery: version,

			constructor: jQuery,

			// The default length of a jQuery object is 0
			length: 0,

			toArray: function() {
				return slice.call( this );
			},

			// Get the Nth element in the matched element set OR
			// Get the whole matched element set as a clean array
			get: function( num ) {

				// Return all the elements in a clean array
				if ( num == null ) {
					return slice.call( this );
				}

				// Return just the one element from the set
				return num < 0 ? this[ num + this.length ] : this[ num ];
			},

			// Take an array of elements and push it onto the stack
			// (returning the new matched element set)
			pushStack: function( elems ) {

				// Build a new jQuery matched element set
				var ret = jQuery.merge( this.constructor(), elems );

				// Add the old object onto the stack (as a reference)
				ret.prevObject = this;

				// Return the newly-formed element set
				return ret;
			},

			// Execute a callback for every element in the matched set.
			each: function( callback ) {
				return jQuery.each( this, callback );
			},

			map: function( callback ) {
				return this.pushStack( jQuery.map( this, function( elem, i ) {
					return callback.call( elem, i, elem );
				} ) );
			},

			slice: function() {
				return this.pushStack( slice.apply( this, arguments ) );
			},

			first: function() {
				return this.eq( 0 );
			},

			last: function() {
				return this.eq( -1 );
			},

			even: function() {
				return this.pushStack( jQuery.grep( this, function( _elem, i ) {
					return ( i + 1 ) % 2;
				} ) );
			},

			odd: function() {
				return this.pushStack( jQuery.grep( this, function( _elem, i ) {
					return i % 2;
				} ) );
			},

			eq: function( i ) {
				var len = this.length,
					j = +i + ( i < 0 ? len : 0 );
				return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
			},

			end: function() {
				return this.prevObject || this.constructor();
			},

			// For internal use only.
			// Behaves like an Array's method, not like a jQuery method.
			push: push,
			sort: arr.sort,
			splice: arr.splice
		};

		jQuery.extend = jQuery.fn.extend = function() {
			var options, name, src, copy, copyIsArray, clone,
				target = arguments[ 0 ] || {},
				i = 1,
				length = arguments.length,
				deep = false;

			// Handle a deep copy situation
			if ( typeof target === "boolean" ) {
				deep = target;

				// Skip the boolean and the target
				target = arguments[ i ] || {};
				i++;
			}

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && !isFunction( target ) ) {
				target = {};
			}

			// Extend jQuery itself if only one argument is passed
			if ( i === length ) {
				target = this;
				i--;
			}

			for ( ; i < length; i++ ) {

				// Only deal with non-null/undefined values
				if ( ( options = arguments[ i ] ) != null ) {

					// Extend the base object
					for ( name in options ) {
						copy = options[ name ];

						// Prevent Object.prototype pollution
						// Prevent never-ending loop
						if ( name === "__proto__" || target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
							( copyIsArray = Array.isArray( copy ) ) ) ) {
							src = target[ name ];

							// Ensure proper type for the source value
							if ( copyIsArray && !Array.isArray( src ) ) {
								clone = [];
							} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
								clone = {};
							} else {
								clone = src;
							}
							copyIsArray = false;

							// Never move original objects, clone them
							target[ name ] = jQuery.extend( deep, clone, copy );

						// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		};

		jQuery.extend( {

			// Unique for each copy of jQuery on the page
			expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

			// Assume jQuery is ready without the ready module
			isReady: true,

			error: function( msg ) {
				throw new Error( msg );
			},

			noop: function() {},

			isPlainObject: function( obj ) {
				var proto, Ctor;

				// Detect obvious negatives
				// Use toString instead of jQuery.type to catch host objects
				if ( !obj || toString.call( obj ) !== "[object Object]" ) {
					return false;
				}

				proto = getProto( obj );

				// Objects with no prototype (e.g., `Object.create( null )`) are plain
				if ( !proto ) {
					return true;
				}

				// Objects with prototype are plain iff they were constructed by a global Object function
				Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
				return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
			},

			isEmptyObject: function( obj ) {
				var name;

				for ( name in obj ) {
					return false;
				}
				return true;
			},

			// Evaluates a script in a provided context; falls back to the global one
			// if not specified.
			globalEval: function( code, options, doc ) {
				DOMEval( code, { nonce: options && options.nonce }, doc );
			},

			each: function( obj, callback ) {
				var length, i = 0;

				if ( isArrayLike( obj ) ) {
					length = obj.length;
					for ( ; i < length; i++ ) {
						if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
							break;
						}
					}
				} else {
					for ( i in obj ) {
						if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
							break;
						}
					}
				}

				return obj;
			},


			// Retrieve the text value of an array of DOM nodes
			text: function( elem ) {
				var node,
					ret = "",
					i = 0,
					nodeType = elem.nodeType;

				if ( !nodeType ) {

					// If no nodeType, this is expected to be an array
					while ( ( node = elem[ i++ ] ) ) {

						// Do not traverse comment nodes
						ret += jQuery.text( node );
					}
				}
				if ( nodeType === 1 || nodeType === 11 ) {
					return elem.textContent;
				}
				if ( nodeType === 9 ) {
					return elem.documentElement.textContent;
				}
				if ( nodeType === 3 || nodeType === 4 ) {
					return elem.nodeValue;
				}

				// Do not include comment or processing instruction nodes

				return ret;
			},

			// results is for internal usage only
			makeArray: function( arr, results ) {
				var ret = results || [];

				if ( arr != null ) {
					if ( isArrayLike( Object( arr ) ) ) {
						jQuery.merge( ret,
							typeof arr === "string" ?
								[ arr ] : arr
						);
					} else {
						push.call( ret, arr );
					}
				}

				return ret;
			},

			inArray: function( elem, arr, i ) {
				return arr == null ? -1 : indexOf.call( arr, elem, i );
			},

			isXMLDoc: function( elem ) {
				var namespace = elem && elem.namespaceURI,
					docElem = elem && ( elem.ownerDocument || elem ).documentElement;

				// Assume HTML when documentElement doesn't yet exist, such as inside
				// document fragments.
				return !rhtmlSuffix.test( namespace || docElem && docElem.nodeName || "HTML" );
			},

			// Support: Android <=4.0 only, PhantomJS 1 only
			// push.apply(_, arraylike) throws on ancient WebKit
			merge: function( first, second ) {
				var len = +second.length,
					j = 0,
					i = first.length;

				for ( ; j < len; j++ ) {
					first[ i++ ] = second[ j ];
				}

				first.length = i;

				return first;
			},

			grep: function( elems, callback, invert ) {
				var callbackInverse,
					matches = [],
					i = 0,
					length = elems.length,
					callbackExpect = !invert;

				// Go through the array, only saving the items
				// that pass the validator function
				for ( ; i < length; i++ ) {
					callbackInverse = !callback( elems[ i ], i );
					if ( callbackInverse !== callbackExpect ) {
						matches.push( elems[ i ] );
					}
				}

				return matches;
			},

			// arg is for internal usage only
			map: function( elems, callback, arg ) {
				var length, value,
					i = 0,
					ret = [];

				// Go through the array, translating each of the items to their new values
				if ( isArrayLike( elems ) ) {
					length = elems.length;
					for ( ; i < length; i++ ) {
						value = callback( elems[ i ], i, arg );

						if ( value != null ) {
							ret.push( value );
						}
					}

				// Go through every key on the object,
				} else {
					for ( i in elems ) {
						value = callback( elems[ i ], i, arg );

						if ( value != null ) {
							ret.push( value );
						}
					}
				}

				// Flatten any nested arrays
				return flat( ret );
			},

			// A global GUID counter for objects
			guid: 1,

			// jQuery.support is not used in Core but other projects attach their
			// properties to it so it needs to exist.
			support: support
		} );

		if ( typeof Symbol === "function" ) {
			jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
		}

		// Populate the class2type map
		jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
			function( _i, name ) {
				class2type[ "[object " + name + "]" ] = name.toLowerCase();
			} );

		function isArrayLike( obj ) {

			// Support: real iOS 8.2 only (not reproducible in simulator)
			// `in` check used to prevent JIT error (gh-2145)
			// hasOwn isn't used here due to false negatives
			// regarding Nodelist length in IE
			var length = !!obj && "length" in obj && obj.length,
				type = toType( obj );

			if ( isFunction( obj ) || isWindow( obj ) ) {
				return false;
			}

			return type === "array" || length === 0 ||
				typeof length === "number" && length > 0 && ( length - 1 ) in obj;
		}


		function nodeName( elem, name ) {

			return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

		}
		var pop = arr.pop;


		var sort = arr.sort;


		var splice = arr.splice;


		var whitespace = "[\\x20\\t\\r\\n\\f]";


		var rtrimCSS = new RegExp(
			"^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$",
			"g"
		);




		// Note: an element does not contain itself
		jQuery.contains = function( a, b ) {
			var bup = b && b.parentNode;

			return a === bup || !!( bup && bup.nodeType === 1 && (

				// Support: IE 9 - 11+
				// IE doesn't have `contains` on SVG.
				a.contains ?
					a.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			) );
		};




		// CSS string/identifier serialization
		// https://drafts.csswg.org/cssom/#common-serializing-idioms
		var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;

		function fcssescape( ch, asCodePoint ) {
			if ( asCodePoint ) {

				// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
				if ( ch === "\0" ) {
					return "\uFFFD";
				}

				// Control characters and (dependent upon position) numbers get escaped as code points
				return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
			}

			// Other potentially-special ASCII characters get backslash-escaped
			return "\\" + ch;
		}

		jQuery.escapeSelector = function( sel ) {
			return ( sel + "" ).replace( rcssescape, fcssescape );
		};




		var preferredDoc = document,
			pushNative = push;

		( function() {

		var i,
			Expr,
			outermostContext,
			sortInput,
			hasDuplicate,
			push = pushNative,

			// Local document vars
			document,
			documentElement,
			documentIsHTML,
			rbuggyQSA,
			matches,

			// Instance-specific data
			expando = jQuery.expando,
			dirruns = 0,
			done = 0,
			classCache = createCache(),
			tokenCache = createCache(),
			compilerCache = createCache(),
			nonnativeSelectorCache = createCache(),
			sortOrder = function( a, b ) {
				if ( a === b ) {
					hasDuplicate = true;
				}
				return 0;
			},

			booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|" +
				"loop|multiple|open|readonly|required|scoped",

			// Regular expressions

			// https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
			identifier = "(?:\\\\[\\da-fA-F]{1,6}" + whitespace +
				"?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",

			// Attribute selectors: https://www.w3.org/TR/selectors/#attribute-selectors
			attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +

				// Operator (capture 2)
				"*([*^$|!~]?=)" + whitespace +

				// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
				"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" +
				whitespace + "*\\]",

			pseudos = ":(" + identifier + ")(?:\\((" +

				// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
				// 1. quoted (capture 3; capture 4 or capture 5)
				"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +

				// 2. simple (capture 6)
				"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +

				// 3. anything else (capture 2)
				".*" +
				")\\)|)",

			// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
			rwhitespace = new RegExp( whitespace + "+", "g" ),

			rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
			rleadingCombinator = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" +
				whitespace + "*" ),
			rdescend = new RegExp( whitespace + "|>" ),

			rpseudo = new RegExp( pseudos ),
			ridentifier = new RegExp( "^" + identifier + "$" ),

			matchExpr = {
				ID: new RegExp( "^#(" + identifier + ")" ),
				CLASS: new RegExp( "^\\.(" + identifier + ")" ),
				TAG: new RegExp( "^(" + identifier + "|[*])" ),
				ATTR: new RegExp( "^" + attributes ),
				PSEUDO: new RegExp( "^" + pseudos ),
				CHILD: new RegExp(
					"^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
						whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" +
						whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
				bool: new RegExp( "^(?:" + booleans + ")$", "i" ),

				// For use in libraries implementing .is()
				// We use this for POS matching in `select`
				needsContext: new RegExp( "^" + whitespace +
					"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
					"*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
			},

			rinputs = /^(?:input|select|textarea|button)$/i,
			rheader = /^h\d$/i,

			// Easily-parseable/retrievable ID or TAG or CLASS selectors
			rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

			rsibling = /[+~]/,

			// CSS escapes
			// https://www.w3.org/TR/CSS21/syndata.html#escaped-characters
			runescape = new RegExp( "\\\\[\\da-fA-F]{1,6}" + whitespace +
				"?|\\\\([^\\r\\n\\f])", "g" ),
			funescape = function( escape, nonHex ) {
				var high = "0x" + escape.slice( 1 ) - 0x10000;

				if ( nonHex ) {

					// Strip the backslash prefix from a non-hex escape sequence
					return nonHex;
				}

				// Replace a hexadecimal escape sequence with the encoded Unicode code point
				// Support: IE <=11+
				// For values outside the Basic Multilingual Plane (BMP), manually construct a
				// surrogate pair
				return high < 0 ?
					String.fromCharCode( high + 0x10000 ) :
					String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
			},

			// Used for iframes; see `setDocument`.
			// Support: IE 9 - 11+, Edge 12 - 18+
			// Removing the function wrapper causes a "Permission Denied"
			// error in IE/Edge.
			unloadHandler = function() {
				setDocument();
			},

			inDisabledFieldset = addCombinator(
				function( elem ) {
					return elem.disabled === true && nodeName( elem, "fieldset" );
				},
				{ dir: "parentNode", next: "legend" }
			);

		// Support: IE <=9 only
		// Accessing document.activeElement can throw unexpectedly
		// https://bugs.jquery.com/ticket/13393
		function safeActiveElement() {
			try {
				return document.activeElement;
			} catch ( err ) { }
		}

		// Optimize for push.apply( _, NodeList )
		try {
			push.apply(
				( arr = slice.call( preferredDoc.childNodes ) ),
				preferredDoc.childNodes
			);

			// Support: Android <=4.0
			// Detect silently failing push.apply
			// eslint-disable-next-line no-unused-expressions
			arr[ preferredDoc.childNodes.length ].nodeType;
		} catch ( e ) {
			push = {
				apply: function( target, els ) {
					pushNative.apply( target, slice.call( els ) );
				},
				call: function( target ) {
					pushNative.apply( target, slice.call( arguments, 1 ) );
				}
			};
		}

		function find( selector, context, results, seed ) {
			var m, i, elem, nid, match, groups, newSelector,
				newContext = context && context.ownerDocument,

				// nodeType defaults to 9, since context defaults to document
				nodeType = context ? context.nodeType : 9;

			results = results || [];

			// Return early from calls with invalid selector or context
			if ( typeof selector !== "string" || !selector ||
				nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

				return results;
			}

			// Try to shortcut find operations (as opposed to filters) in HTML documents
			if ( !seed ) {
				setDocument( context );
				context = context || document;

				if ( documentIsHTML ) {

					// If the selector is sufficiently simple, try using a "get*By*" DOM method
					// (excepting DocumentFragment context, where the methods don't exist)
					if ( nodeType !== 11 && ( match = rquickExpr.exec( selector ) ) ) {

						// ID selector
						if ( ( m = match[ 1 ] ) ) {

							// Document context
							if ( nodeType === 9 ) {
								if ( ( elem = context.getElementById( m ) ) ) {

									// Support: IE 9 only
									// getElementById can match elements by name instead of ID
									if ( elem.id === m ) {
										push.call( results, elem );
										return results;
									}
								} else {
									return results;
								}

							// Element context
							} else {

								// Support: IE 9 only
								// getElementById can match elements by name instead of ID
								if ( newContext && ( elem = newContext.getElementById( m ) ) &&
									find.contains( context, elem ) &&
									elem.id === m ) {

									push.call( results, elem );
									return results;
								}
							}

						// Type selector
						} else if ( match[ 2 ] ) {
							push.apply( results, context.getElementsByTagName( selector ) );
							return results;

						// Class selector
						} else if ( ( m = match[ 3 ] ) && context.getElementsByClassName ) {
							push.apply( results, context.getElementsByClassName( m ) );
							return results;
						}
					}

					// Take advantage of querySelectorAll
					if ( !nonnativeSelectorCache[ selector + " " ] &&
						( !rbuggyQSA || !rbuggyQSA.test( selector ) ) ) {

						newSelector = selector;
						newContext = context;

						// qSA considers elements outside a scoping root when evaluating child or
						// descendant combinators, which is not what we want.
						// In such cases, we work around the behavior by prefixing every selector in the
						// list with an ID selector referencing the scope context.
						// The technique has to be used as well when a leading combinator is used
						// as such selectors are not recognized by querySelectorAll.
						// Thanks to Andrew Dupont for this technique.
						if ( nodeType === 1 &&
							( rdescend.test( selector ) || rleadingCombinator.test( selector ) ) ) {

							// Expand context for sibling selectors
							newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
								context;

							// We can use :scope instead of the ID hack if the browser
							// supports it & if we're not changing the context.
							// Support: IE 11+, Edge 17 - 18+
							// IE/Edge sometimes throw a "Permission denied" error when
							// strict-comparing two documents; shallow comparisons work.
							// eslint-disable-next-line eqeqeq
							if ( newContext != context || !support.scope ) {

								// Capture the context ID, setting it first if necessary
								if ( ( nid = context.getAttribute( "id" ) ) ) {
									nid = jQuery.escapeSelector( nid );
								} else {
									context.setAttribute( "id", ( nid = expando ) );
								}
							}

							// Prefix every selector in the list
							groups = tokenize( selector );
							i = groups.length;
							while ( i-- ) {
								groups[ i ] = ( nid ? "#" + nid : ":scope" ) + " " +
									toSelector( groups[ i ] );
							}
							newSelector = groups.join( "," );
						}

						try {
							push.apply( results,
								newContext.querySelectorAll( newSelector )
							);
							return results;
						} catch ( qsaError ) {
							nonnativeSelectorCache( selector, true );
						} finally {
							if ( nid === expando ) {
								context.removeAttribute( "id" );
							}
						}
					}
				}
			}

			// All others
			return select( selector.replace( rtrimCSS, "$1" ), context, results, seed );
		}

		/**
		 * Create key-value caches of limited size
		 * @returns {function(string, object)} Returns the Object data after storing it on itself with
		 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
		 *	deleting the oldest entry
		 */
		function createCache() {
			var keys = [];

			function cache( key, value ) {

				// Use (key + " ") to avoid collision with native prototype properties
				// (see https://github.com/jquery/sizzle/issues/157)
				if ( keys.push( key + " " ) > Expr.cacheLength ) {

					// Only keep the most recent entries
					delete cache[ keys.shift() ];
				}
				return ( cache[ key + " " ] = value );
			}
			return cache;
		}

		/**
		 * Mark a function for special use by jQuery selector module
		 * @param {Function} fn The function to mark
		 */
		function markFunction( fn ) {
			fn[ expando ] = true;
			return fn;
		}

		/**
		 * Support testing using an element
		 * @param {Function} fn Passed the created element and returns a boolean result
		 */
		function assert( fn ) {
			var el = document.createElement( "fieldset" );

			try {
				return !!fn( el );
			} catch ( e ) {
				return false;
			} finally {

				// Remove from its parent by default
				if ( el.parentNode ) {
					el.parentNode.removeChild( el );
				}

				// release memory in IE
				el = null;
			}
		}

		/**
		 * Returns a function to use in pseudos for input types
		 * @param {String} type
		 */
		function createInputPseudo( type ) {
			return function( elem ) {
				return nodeName( elem, "input" ) && elem.type === type;
			};
		}

		/**
		 * Returns a function to use in pseudos for buttons
		 * @param {String} type
		 */
		function createButtonPseudo( type ) {
			return function( elem ) {
				return ( nodeName( elem, "input" ) || nodeName( elem, "button" ) ) &&
					elem.type === type;
			};
		}

		/**
		 * Returns a function to use in pseudos for :enabled/:disabled
		 * @param {Boolean} disabled true for :disabled; false for :enabled
		 */
		function createDisabledPseudo( disabled ) {

			// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
			return function( elem ) {

				// Only certain elements can match :enabled or :disabled
				// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
				// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
				if ( "form" in elem ) {

					// Check for inherited disabledness on relevant non-disabled elements:
					// * listed form-associated elements in a disabled fieldset
					//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
					//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
					// * option elements in a disabled optgroup
					//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
					// All such elements have a "form" property.
					if ( elem.parentNode && elem.disabled === false ) {

						// Option elements defer to a parent optgroup if present
						if ( "label" in elem ) {
							if ( "label" in elem.parentNode ) {
								return elem.parentNode.disabled === disabled;
							} else {
								return elem.disabled === disabled;
							}
						}

						// Support: IE 6 - 11+
						// Use the isDisabled shortcut property to check for disabled fieldset ancestors
						return elem.isDisabled === disabled ||

							// Where there is no isDisabled, check manually
							elem.isDisabled !== !disabled &&
								inDisabledFieldset( elem ) === disabled;
					}

					return elem.disabled === disabled;

				// Try to winnow out elements that can't be disabled before trusting the disabled property.
				// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
				// even exist on them, let alone have a boolean value.
				} else if ( "label" in elem ) {
					return elem.disabled === disabled;
				}

				// Remaining elements are neither :enabled nor :disabled
				return false;
			};
		}

		/**
		 * Returns a function to use in pseudos for positionals
		 * @param {Function} fn
		 */
		function createPositionalPseudo( fn ) {
			return markFunction( function( argument ) {
				argument = +argument;
				return markFunction( function( seed, matches ) {
					var j,
						matchIndexes = fn( [], seed.length, argument ),
						i = matchIndexes.length;

					// Match elements found at the specified indexes
					while ( i-- ) {
						if ( seed[ ( j = matchIndexes[ i ] ) ] ) {
							seed[ j ] = !( matches[ j ] = seed[ j ] );
						}
					}
				} );
			} );
		}

		/**
		 * Checks a node for validity as a jQuery selector context
		 * @param {Element|Object=} context
		 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
		 */
		function testContext( context ) {
			return context && typeof context.getElementsByTagName !== "undefined" && context;
		}

		/**
		 * Sets document-related variables once based on the current document
		 * @param {Element|Object} [node] An element or document object to use to set the document
		 * @returns {Object} Returns the current document
		 */
		function setDocument( node ) {
			var subWindow,
				doc = node ? node.ownerDocument || node : preferredDoc;

			// Return early if doc is invalid or already selected
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( doc == document || doc.nodeType !== 9 || !doc.documentElement ) {
				return document;
			}

			// Update global variables
			document = doc;
			documentElement = document.documentElement;
			documentIsHTML = !jQuery.isXMLDoc( document );

			// Support: iOS 7 only, IE 9 - 11+
			// Older browsers didn't support unprefixed `matches`.
			matches = documentElement.matches ||
				documentElement.webkitMatchesSelector ||
				documentElement.msMatchesSelector;

			// Support: IE 9 - 11+, Edge 12 - 18+
			// Accessing iframe documents after unload throws "permission denied" errors
			// (see trac-13936).
			// Limit the fix to IE & Edge Legacy; despite Edge 15+ implementing `matches`,
			// all IE 9+ and Edge Legacy versions implement `msMatchesSelector` as well.
			if ( documentElement.msMatchesSelector &&

				// Support: IE 11+, Edge 17 - 18+
				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
				// two documents; shallow comparisons work.
				// eslint-disable-next-line eqeqeq
				preferredDoc != document &&
				( subWindow = document.defaultView ) && subWindow.top !== subWindow ) {

				// Support: IE 9 - 11+, Edge 12 - 18+
				subWindow.addEventListener( "unload", unloadHandler );
			}

			// Support: IE <10
			// Check if getElementById returns elements by name
			// The broken getElementById methods don't pick up programmatically-set names,
			// so use a roundabout getElementsByName test
			support.getById = assert( function( el ) {
				documentElement.appendChild( el ).id = jQuery.expando;
				return !document.getElementsByName ||
					!document.getElementsByName( jQuery.expando ).length;
			} );

			// Support: IE 9 only
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node.
			support.disconnectedMatch = assert( function( el ) {
				return matches.call( el, "*" );
			} );

			// Support: IE 9 - 11+, Edge 12 - 18+
			// IE/Edge don't support the :scope pseudo-class.
			support.scope = assert( function() {
				return document.querySelectorAll( ":scope" );
			} );

			// Support: Chrome 105 - 111 only, Safari 15.4 - 16.3 only
			// Make sure the `:has()` argument is parsed unforgivingly.
			// We include `*` in the test to detect buggy implementations that are
			// _selectively_ forgiving (specifically when the list includes at least
			// one valid selector).
			// Note that we treat complete lack of support for `:has()` as if it were
			// spec-compliant support, which is fine because use of `:has()` in such
			// environments will fail in the qSA path and fall back to jQuery traversal
			// anyway.
			support.cssHas = assert( function() {
				try {
					document.querySelector( ":has(*,:jqfake)" );
					return false;
				} catch ( e ) {
					return true;
				}
			} );

			// ID filter and find
			if ( support.getById ) {
				Expr.filter.ID = function( id ) {
					var attrId = id.replace( runescape, funescape );
					return function( elem ) {
						return elem.getAttribute( "id" ) === attrId;
					};
				};
				Expr.find.ID = function( id, context ) {
					if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
						var elem = context.getElementById( id );
						return elem ? [ elem ] : [];
					}
				};
			} else {
				Expr.filter.ID =  function( id ) {
					var attrId = id.replace( runescape, funescape );
					return function( elem ) {
						var node = typeof elem.getAttributeNode !== "undefined" &&
							elem.getAttributeNode( "id" );
						return node && node.value === attrId;
					};
				};

				// Support: IE 6 - 7 only
				// getElementById is not reliable as a find shortcut
				Expr.find.ID = function( id, context ) {
					if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
						var node, i, elems,
							elem = context.getElementById( id );

						if ( elem ) {

							// Verify the id attribute
							node = elem.getAttributeNode( "id" );
							if ( node && node.value === id ) {
								return [ elem ];
							}

							// Fall back on getElementsByName
							elems = context.getElementsByName( id );
							i = 0;
							while ( ( elem = elems[ i++ ] ) ) {
								node = elem.getAttributeNode( "id" );
								if ( node && node.value === id ) {
									return [ elem ];
								}
							}
						}

						return [];
					}
				};
			}

			// Tag
			Expr.find.TAG = function( tag, context ) {
				if ( typeof context.getElementsByTagName !== "undefined" ) {
					return context.getElementsByTagName( tag );

				// DocumentFragment nodes don't have gEBTN
				} else {
					return context.querySelectorAll( tag );
				}
			};

			// Class
			Expr.find.CLASS = function( className, context ) {
				if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
					return context.getElementsByClassName( className );
				}
			};

			/* QSA/matchesSelector
			---------------------------------------------------------------------- */

			// QSA and matchesSelector support

			rbuggyQSA = [];

			// Build QSA regex
			// Regex strategy adopted from Diego Perini
			assert( function( el ) {

				var input;

				documentElement.appendChild( el ).innerHTML =
					"<a id='" + expando + "' href='' disabled='disabled'></a>" +
					"<select id='" + expando + "-\r\\' disabled='disabled'>" +
					"<option selected=''></option></select>";

				// Support: iOS <=7 - 8 only
				// Boolean attributes and "value" are not treated correctly in some XML documents
				if ( !el.querySelectorAll( "[selected]" ).length ) {
					rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
				}

				// Support: iOS <=7 - 8 only
				if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
					rbuggyQSA.push( "~=" );
				}

				// Support: iOS 8 only
				// https://bugs.webkit.org/show_bug.cgi?id=136851
				// In-page `selector#id sibling-combinator selector` fails
				if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
					rbuggyQSA.push( ".#.+[+~]" );
				}

				// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
				// In some of the document kinds, these selectors wouldn't work natively.
				// This is probably OK but for backwards compatibility we want to maintain
				// handling them through jQuery traversal in jQuery 3.x.
				if ( !el.querySelectorAll( ":checked" ).length ) {
					rbuggyQSA.push( ":checked" );
				}

				// Support: Windows 8 Native Apps
				// The type and name attributes are restricted during .innerHTML assignment
				input = document.createElement( "input" );
				input.setAttribute( "type", "hidden" );
				el.appendChild( input ).setAttribute( "name", "D" );

				// Support: IE 9 - 11+
				// IE's :disabled selector does not pick up the children of disabled fieldsets
				// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
				// In some of the document kinds, these selectors wouldn't work natively.
				// This is probably OK but for backwards compatibility we want to maintain
				// handling them through jQuery traversal in jQuery 3.x.
				documentElement.appendChild( el ).disabled = true;
				if ( el.querySelectorAll( ":disabled" ).length !== 2 ) {
					rbuggyQSA.push( ":enabled", ":disabled" );
				}

				// Support: IE 11+, Edge 15 - 18+
				// IE 11/Edge don't find elements on a `[name='']` query in some cases.
				// Adding a temporary attribute to the document before the selection works
				// around the issue.
				// Interestingly, IE 10 & older don't seem to have the issue.
				input = document.createElement( "input" );
				input.setAttribute( "name", "" );
				el.appendChild( input );
				if ( !el.querySelectorAll( "[name='']" ).length ) {
					rbuggyQSA.push( "\\[" + whitespace + "*name" + whitespace + "*=" +
						whitespace + "*(?:''|\"\")" );
				}
			} );

			if ( !support.cssHas ) {

				// Support: Chrome 105 - 110+, Safari 15.4 - 16.3+
				// Our regular `try-catch` mechanism fails to detect natively-unsupported
				// pseudo-classes inside `:has()` (such as `:has(:contains("Foo"))`)
				// in browsers that parse the `:has()` argument as a forgiving selector list.
				// https://drafts.csswg.org/selectors/#relational now requires the argument
				// to be parsed unforgivingly, but browsers have not yet fully adjusted.
				rbuggyQSA.push( ":has" );
			}

			rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join( "|" ) );

			/* Sorting
			---------------------------------------------------------------------- */

			// Document order sorting
			sortOrder = function( a, b ) {

				// Flag for duplicate removal
				if ( a === b ) {
					hasDuplicate = true;
					return 0;
				}

				// Sort on method existence if only one input has compareDocumentPosition
				var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
				if ( compare ) {
					return compare;
				}

				// Calculate position if both inputs belong to the same document
				// Support: IE 11+, Edge 17 - 18+
				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
				// two documents; shallow comparisons work.
				// eslint-disable-next-line eqeqeq
				compare = ( a.ownerDocument || a ) == ( b.ownerDocument || b ) ?
					a.compareDocumentPosition( b ) :

					// Otherwise we know they are disconnected
					1;

				// Disconnected nodes
				if ( compare & 1 ||
					( !support.sortDetached && b.compareDocumentPosition( a ) === compare ) ) {

					// Choose the first element that is related to our preferred document
					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( a === document || a.ownerDocument == preferredDoc &&
						find.contains( preferredDoc, a ) ) {
						return -1;
					}

					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( b === document || b.ownerDocument == preferredDoc &&
						find.contains( preferredDoc, b ) ) {
						return 1;
					}

					// Maintain original order
					return sortInput ?
						( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
						0;
				}

				return compare & 4 ? -1 : 1;
			};

			return document;
		}

		find.matches = function( expr, elements ) {
			return find( expr, null, null, elements );
		};

		find.matchesSelector = function( elem, expr ) {
			setDocument( elem );

			if ( documentIsHTML &&
				!nonnativeSelectorCache[ expr + " " ] &&
				( !rbuggyQSA || !rbuggyQSA.test( expr ) ) ) {

				try {
					var ret = matches.call( elem, expr );

					// IE 9's matchesSelector returns false on disconnected nodes
					if ( ret || support.disconnectedMatch ||

							// As well, disconnected nodes are said to be in a document
							// fragment in IE 9
							elem.document && elem.document.nodeType !== 11 ) {
						return ret;
					}
				} catch ( e ) {
					nonnativeSelectorCache( expr, true );
				}
			}

			return find( expr, document, null, [ elem ] ).length > 0;
		};

		find.contains = function( context, elem ) {

			// Set document vars if needed
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( ( context.ownerDocument || context ) != document ) {
				setDocument( context );
			}
			return jQuery.contains( context, elem );
		};


		find.attr = function( elem, name ) {

			// Set document vars if needed
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( ( elem.ownerDocument || elem ) != document ) {
				setDocument( elem );
			}

			var fn = Expr.attrHandle[ name.toLowerCase() ],

				// Don't get fooled by Object.prototype properties (see trac-13807)
				val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
					fn( elem, name, !documentIsHTML ) :
					undefined;

			if ( val !== undefined ) {
				return val;
			}

			return elem.getAttribute( name );
		};

		find.error = function( msg ) {
			throw new Error( "Syntax error, unrecognized expression: " + msg );
		};

		/**
		 * Document sorting and removing duplicates
		 * @param {ArrayLike} results
		 */
		jQuery.uniqueSort = function( results ) {
			var elem,
				duplicates = [],
				j = 0,
				i = 0;

			// Unless we *know* we can detect duplicates, assume their presence
			//
			// Support: Android <=4.0+
			// Testing for detecting duplicates is unpredictable so instead assume we can't
			// depend on duplicate detection in all browsers without a stable sort.
			hasDuplicate = !support.sortStable;
			sortInput = !support.sortStable && slice.call( results, 0 );
			sort.call( results, sortOrder );

			if ( hasDuplicate ) {
				while ( ( elem = results[ i++ ] ) ) {
					if ( elem === results[ i ] ) {
						j = duplicates.push( i );
					}
				}
				while ( j-- ) {
					splice.call( results, duplicates[ j ], 1 );
				}
			}

			// Clear input after sorting to release objects
			// See https://github.com/jquery/sizzle/pull/225
			sortInput = null;

			return results;
		};

		jQuery.fn.uniqueSort = function() {
			return this.pushStack( jQuery.uniqueSort( slice.apply( this ) ) );
		};

		Expr = jQuery.expr = {

			// Can be adjusted by the user
			cacheLength: 50,

			createPseudo: markFunction,

			match: matchExpr,

			attrHandle: {},

			find: {},

			relative: {
				">": { dir: "parentNode", first: true },
				" ": { dir: "parentNode" },
				"+": { dir: "previousSibling", first: true },
				"~": { dir: "previousSibling" }
			},

			preFilter: {
				ATTR: function( match ) {
					match[ 1 ] = match[ 1 ].replace( runescape, funescape );

					// Move the given value to match[3] whether quoted or unquoted
					match[ 3 ] = ( match[ 3 ] || match[ 4 ] || match[ 5 ] || "" )
						.replace( runescape, funescape );

					if ( match[ 2 ] === "~=" ) {
						match[ 3 ] = " " + match[ 3 ] + " ";
					}

					return match.slice( 0, 4 );
				},

				CHILD: function( match ) {

					/* matches from matchExpr["CHILD"]
						1 type (only|nth|...)
						2 what (child|of-type)
						3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
						4 xn-component of xn+y argument ([+-]?\d*n|)
						5 sign of xn-component
						6 x of xn-component
						7 sign of y-component
						8 y of y-component
					*/
					match[ 1 ] = match[ 1 ].toLowerCase();

					if ( match[ 1 ].slice( 0, 3 ) === "nth" ) {

						// nth-* requires argument
						if ( !match[ 3 ] ) {
							find.error( match[ 0 ] );
						}

						// numeric x and y parameters for Expr.filter.CHILD
						// remember that false/true cast respectively to 0/1
						match[ 4 ] = +( match[ 4 ] ?
							match[ 5 ] + ( match[ 6 ] || 1 ) :
							2 * ( match[ 3 ] === "even" || match[ 3 ] === "odd" )
						);
						match[ 5 ] = +( ( match[ 7 ] + match[ 8 ] ) || match[ 3 ] === "odd" );

					// other types prohibit arguments
					} else if ( match[ 3 ] ) {
						find.error( match[ 0 ] );
					}

					return match;
				},

				PSEUDO: function( match ) {
					var excess,
						unquoted = !match[ 6 ] && match[ 2 ];

					if ( matchExpr.CHILD.test( match[ 0 ] ) ) {
						return null;
					}

					// Accept quoted arguments as-is
					if ( match[ 3 ] ) {
						match[ 2 ] = match[ 4 ] || match[ 5 ] || "";

					// Strip excess characters from unquoted arguments
					} else if ( unquoted && rpseudo.test( unquoted ) &&

						// Get excess from tokenize (recursively)
						( excess = tokenize( unquoted, true ) ) &&

						// advance to the next closing parenthesis
						( excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length ) ) {

						// excess is a negative index
						match[ 0 ] = match[ 0 ].slice( 0, excess );
						match[ 2 ] = unquoted.slice( 0, excess );
					}

					// Return only captures needed by the pseudo filter method (type and argument)
					return match.slice( 0, 3 );
				}
			},

			filter: {

				TAG: function( nodeNameSelector ) {
					var expectedNodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
					return nodeNameSelector === "*" ?
						function() {
							return true;
						} :
						function( elem ) {
							return nodeName( elem, expectedNodeName );
						};
				},

				CLASS: function( className ) {
					var pattern = classCache[ className + " " ];

					return pattern ||
						( pattern = new RegExp( "(^|" + whitespace + ")" + className +
							"(" + whitespace + "|$)" ) ) &&
						classCache( className, function( elem ) {
							return pattern.test(
								typeof elem.className === "string" && elem.className ||
									typeof elem.getAttribute !== "undefined" &&
										elem.getAttribute( "class" ) ||
									""
							);
						} );
				},

				ATTR: function( name, operator, check ) {
					return function( elem ) {
						var result = find.attr( elem, name );

						if ( result == null ) {
							return operator === "!=";
						}
						if ( !operator ) {
							return true;
						}

						result += "";

						if ( operator === "=" ) {
							return result === check;
						}
						if ( operator === "!=" ) {
							return result !== check;
						}
						if ( operator === "^=" ) {
							return check && result.indexOf( check ) === 0;
						}
						if ( operator === "*=" ) {
							return check && result.indexOf( check ) > -1;
						}
						if ( operator === "$=" ) {
							return check && result.slice( -check.length ) === check;
						}
						if ( operator === "~=" ) {
							return ( " " + result.replace( rwhitespace, " " ) + " " )
								.indexOf( check ) > -1;
						}
						if ( operator === "|=" ) {
							return result === check || result.slice( 0, check.length + 1 ) === check + "-";
						}

						return false;
					};
				},

				CHILD: function( type, what, _argument, first, last ) {
					var simple = type.slice( 0, 3 ) !== "nth",
						forward = type.slice( -4 ) !== "last",
						ofType = what === "of-type";

					return first === 1 && last === 0 ?

						// Shortcut for :nth-*(n)
						function( elem ) {
							return !!elem.parentNode;
						} :

						function( elem, _context, xml ) {
							var cache, outerCache, node, nodeIndex, start,
								dir = simple !== forward ? "nextSibling" : "previousSibling",
								parent = elem.parentNode,
								name = ofType && elem.nodeName.toLowerCase(),
								useCache = !xml && !ofType,
								diff = false;

							if ( parent ) {

								// :(first|last|only)-(child|of-type)
								if ( simple ) {
									while ( dir ) {
										node = elem;
										while ( ( node = node[ dir ] ) ) {
											if ( ofType ?
												nodeName( node, name ) :
												node.nodeType === 1 ) {

												return false;
											}
										}

										// Reverse direction for :only-* (if we haven't yet done so)
										start = dir = type === "only" && !start && "nextSibling";
									}
									return true;
								}

								start = [ forward ? parent.firstChild : parent.lastChild ];

								// non-xml :nth-child(...) stores cache data on `parent`
								if ( forward && useCache ) {

									// Seek `elem` from a previously-cached index
									outerCache = parent[ expando ] || ( parent[ expando ] = {} );
									cache = outerCache[ type ] || [];
									nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
									diff = nodeIndex && cache[ 2 ];
									node = nodeIndex && parent.childNodes[ nodeIndex ];

									while ( ( node = ++nodeIndex && node && node[ dir ] ||

										// Fallback to seeking `elem` from the start
										( diff = nodeIndex = 0 ) || start.pop() ) ) {

										// When found, cache indexes on `parent` and break
										if ( node.nodeType === 1 && ++diff && node === elem ) {
											outerCache[ type ] = [ dirruns, nodeIndex, diff ];
											break;
										}
									}

								} else {

									// Use previously-cached element index if available
									if ( useCache ) {
										outerCache = elem[ expando ] || ( elem[ expando ] = {} );
										cache = outerCache[ type ] || [];
										nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
										diff = nodeIndex;
									}

									// xml :nth-child(...)
									// or :nth-last-child(...) or :nth(-last)?-of-type(...)
									if ( diff === false ) {

										// Use the same loop as above to seek `elem` from the start
										while ( ( node = ++nodeIndex && node && node[ dir ] ||
											( diff = nodeIndex = 0 ) || start.pop() ) ) {

											if ( ( ofType ?
												nodeName( node, name ) :
												node.nodeType === 1 ) &&
												++diff ) {

												// Cache the index of each encountered element
												if ( useCache ) {
													outerCache = node[ expando ] ||
														( node[ expando ] = {} );
													outerCache[ type ] = [ dirruns, diff ];
												}

												if ( node === elem ) {
													break;
												}
											}
										}
									}
								}

								// Incorporate the offset, then check against cycle size
								diff -= last;
								return diff === first || ( diff % first === 0 && diff / first >= 0 );
							}
						};
				},

				PSEUDO: function( pseudo, argument ) {

					// pseudo-class names are case-insensitive
					// https://www.w3.org/TR/selectors/#pseudo-classes
					// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
					// Remember that setFilters inherits from pseudos
					var args,
						fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
							find.error( "unsupported pseudo: " + pseudo );

					// The user may use createPseudo to indicate that
					// arguments are needed to create the filter function
					// just as jQuery does
					if ( fn[ expando ] ) {
						return fn( argument );
					}

					// But maintain support for old signatures
					if ( fn.length > 1 ) {
						args = [ pseudo, pseudo, "", argument ];
						return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
							markFunction( function( seed, matches ) {
								var idx,
									matched = fn( seed, argument ),
									i = matched.length;
								while ( i-- ) {
									idx = indexOf.call( seed, matched[ i ] );
									seed[ idx ] = !( matches[ idx ] = matched[ i ] );
								}
							} ) :
							function( elem ) {
								return fn( elem, 0, args );
							};
					}

					return fn;
				}
			},

			pseudos: {

				// Potentially complex pseudos
				not: markFunction( function( selector ) {

					// Trim the selector passed to compile
					// to avoid treating leading and trailing
					// spaces as combinators
					var input = [],
						results = [],
						matcher = compile( selector.replace( rtrimCSS, "$1" ) );

					return matcher[ expando ] ?
						markFunction( function( seed, matches, _context, xml ) {
							var elem,
								unmatched = matcher( seed, null, xml, [] ),
								i = seed.length;

							// Match elements unmatched by `matcher`
							while ( i-- ) {
								if ( ( elem = unmatched[ i ] ) ) {
									seed[ i ] = !( matches[ i ] = elem );
								}
							}
						} ) :
						function( elem, _context, xml ) {
							input[ 0 ] = elem;
							matcher( input, null, xml, results );

							// Don't keep the element
							// (see https://github.com/jquery/sizzle/issues/299)
							input[ 0 ] = null;
							return !results.pop();
						};
				} ),

				has: markFunction( function( selector ) {
					return function( elem ) {
						return find( selector, elem ).length > 0;
					};
				} ),

				contains: markFunction( function( text ) {
					text = text.replace( runescape, funescape );
					return function( elem ) {
						return ( elem.textContent || jQuery.text( elem ) ).indexOf( text ) > -1;
					};
				} ),

				// "Whether an element is represented by a :lang() selector
				// is based solely on the element's language value
				// being equal to the identifier C,
				// or beginning with the identifier C immediately followed by "-".
				// The matching of C against the element's language value is performed case-insensitively.
				// The identifier C does not have to be a valid language name."
				// https://www.w3.org/TR/selectors/#lang-pseudo
				lang: markFunction( function( lang ) {

					// lang value must be a valid identifier
					if ( !ridentifier.test( lang || "" ) ) {
						find.error( "unsupported lang: " + lang );
					}
					lang = lang.replace( runescape, funescape ).toLowerCase();
					return function( elem ) {
						var elemLang;
						do {
							if ( ( elemLang = documentIsHTML ?
								elem.lang :
								elem.getAttribute( "xml:lang" ) || elem.getAttribute( "lang" ) ) ) {

								elemLang = elemLang.toLowerCase();
								return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
							}
						} while ( ( elem = elem.parentNode ) && elem.nodeType === 1 );
						return false;
					};
				} ),

				// Miscellaneous
				target: function( elem ) {
					var hash = window.location && window.location.hash;
					return hash && hash.slice( 1 ) === elem.id;
				},

				root: function( elem ) {
					return elem === documentElement;
				},

				focus: function( elem ) {
					return elem === safeActiveElement() &&
						document.hasFocus() &&
						!!( elem.type || elem.href || ~elem.tabIndex );
				},

				// Boolean properties
				enabled: createDisabledPseudo( false ),
				disabled: createDisabledPseudo( true ),

				checked: function( elem ) {

					// In CSS3, :checked should return both checked and selected elements
					// https://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
					return ( nodeName( elem, "input" ) && !!elem.checked ) ||
						( nodeName( elem, "option" ) && !!elem.selected );
				},

				selected: function( elem ) {

					// Support: IE <=11+
					// Accessing the selectedIndex property
					// forces the browser to treat the default option as
					// selected when in an optgroup.
					if ( elem.parentNode ) {
						// eslint-disable-next-line no-unused-expressions
						elem.parentNode.selectedIndex;
					}

					return elem.selected === true;
				},

				// Contents
				empty: function( elem ) {

					// https://www.w3.org/TR/selectors/#empty-pseudo
					// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
					//   but not by others (comment: 8; processing instruction: 7; etc.)
					// nodeType < 6 works because attributes (2) do not appear as children
					for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
						if ( elem.nodeType < 6 ) {
							return false;
						}
					}
					return true;
				},

				parent: function( elem ) {
					return !Expr.pseudos.empty( elem );
				},

				// Element/input types
				header: function( elem ) {
					return rheader.test( elem.nodeName );
				},

				input: function( elem ) {
					return rinputs.test( elem.nodeName );
				},

				button: function( elem ) {
					return nodeName( elem, "input" ) && elem.type === "button" ||
						nodeName( elem, "button" );
				},

				text: function( elem ) {
					var attr;
					return nodeName( elem, "input" ) && elem.type === "text" &&

						// Support: IE <10 only
						// New HTML5 attribute values (e.g., "search") appear
						// with elem.type === "text"
						( ( attr = elem.getAttribute( "type" ) ) == null ||
							attr.toLowerCase() === "text" );
				},

				// Position-in-collection
				first: createPositionalPseudo( function() {
					return [ 0 ];
				} ),

				last: createPositionalPseudo( function( _matchIndexes, length ) {
					return [ length - 1 ];
				} ),

				eq: createPositionalPseudo( function( _matchIndexes, length, argument ) {
					return [ argument < 0 ? argument + length : argument ];
				} ),

				even: createPositionalPseudo( function( matchIndexes, length ) {
					var i = 0;
					for ( ; i < length; i += 2 ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				odd: createPositionalPseudo( function( matchIndexes, length ) {
					var i = 1;
					for ( ; i < length; i += 2 ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				lt: createPositionalPseudo( function( matchIndexes, length, argument ) {
					var i;

					if ( argument < 0 ) {
						i = argument + length;
					} else if ( argument > length ) {
						i = length;
					} else {
						i = argument;
					}

					for ( ; --i >= 0; ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				gt: createPositionalPseudo( function( matchIndexes, length, argument ) {
					var i = argument < 0 ? argument + length : argument;
					for ( ; ++i < length; ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} )
			}
		};

		Expr.pseudos.nth = Expr.pseudos.eq;

		// Add button/input type pseudos
		for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
			Expr.pseudos[ i ] = createInputPseudo( i );
		}
		for ( i in { submit: true, reset: true } ) {
			Expr.pseudos[ i ] = createButtonPseudo( i );
		}

		// Easy API for creating new setFilters
		function setFilters() {}
		setFilters.prototype = Expr.filters = Expr.pseudos;
		Expr.setFilters = new setFilters();

		function tokenize( selector, parseOnly ) {
			var matched, match, tokens, type,
				soFar, groups, preFilters,
				cached = tokenCache[ selector + " " ];

			if ( cached ) {
				return parseOnly ? 0 : cached.slice( 0 );
			}

			soFar = selector;
			groups = [];
			preFilters = Expr.preFilter;

			while ( soFar ) {

				// Comma and first run
				if ( !matched || ( match = rcomma.exec( soFar ) ) ) {
					if ( match ) {

						// Don't consume trailing commas as valid
						soFar = soFar.slice( match[ 0 ].length ) || soFar;
					}
					groups.push( ( tokens = [] ) );
				}

				matched = false;

				// Combinators
				if ( ( match = rleadingCombinator.exec( soFar ) ) ) {
					matched = match.shift();
					tokens.push( {
						value: matched,

						// Cast descendant combinators to space
						type: match[ 0 ].replace( rtrimCSS, " " )
					} );
					soFar = soFar.slice( matched.length );
				}

				// Filters
				for ( type in Expr.filter ) {
					if ( ( match = matchExpr[ type ].exec( soFar ) ) && ( !preFilters[ type ] ||
						( match = preFilters[ type ]( match ) ) ) ) {
						matched = match.shift();
						tokens.push( {
							value: matched,
							type: type,
							matches: match
						} );
						soFar = soFar.slice( matched.length );
					}
				}

				if ( !matched ) {
					break;
				}
			}

			// Return the length of the invalid excess
			// if we're just parsing
			// Otherwise, throw an error or return tokens
			if ( parseOnly ) {
				return soFar.length;
			}

			return soFar ?
				find.error( selector ) :

				// Cache the tokens
				tokenCache( selector, groups ).slice( 0 );
		}

		function toSelector( tokens ) {
			var i = 0,
				len = tokens.length,
				selector = "";
			for ( ; i < len; i++ ) {
				selector += tokens[ i ].value;
			}
			return selector;
		}

		function addCombinator( matcher, combinator, base ) {
			var dir = combinator.dir,
				skip = combinator.next,
				key = skip || dir,
				checkNonElements = base && key === "parentNode",
				doneName = done++;

			return combinator.first ?

				// Check against closest ancestor/preceding element
				function( elem, context, xml ) {
					while ( ( elem = elem[ dir ] ) ) {
						if ( elem.nodeType === 1 || checkNonElements ) {
							return matcher( elem, context, xml );
						}
					}
					return false;
				} :

				// Check against all ancestor/preceding elements
				function( elem, context, xml ) {
					var oldCache, outerCache,
						newCache = [ dirruns, doneName ];

					// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
					if ( xml ) {
						while ( ( elem = elem[ dir ] ) ) {
							if ( elem.nodeType === 1 || checkNonElements ) {
								if ( matcher( elem, context, xml ) ) {
									return true;
								}
							}
						}
					} else {
						while ( ( elem = elem[ dir ] ) ) {
							if ( elem.nodeType === 1 || checkNonElements ) {
								outerCache = elem[ expando ] || ( elem[ expando ] = {} );

								if ( skip && nodeName( elem, skip ) ) {
									elem = elem[ dir ] || elem;
								} else if ( ( oldCache = outerCache[ key ] ) &&
									oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

									// Assign to newCache so results back-propagate to previous elements
									return ( newCache[ 2 ] = oldCache[ 2 ] );
								} else {

									// Reuse newcache so results back-propagate to previous elements
									outerCache[ key ] = newCache;

									// A match means we're done; a fail means we have to keep checking
									if ( ( newCache[ 2 ] = matcher( elem, context, xml ) ) ) {
										return true;
									}
								}
							}
						}
					}
					return false;
				};
		}

		function elementMatcher( matchers ) {
			return matchers.length > 1 ?
				function( elem, context, xml ) {
					var i = matchers.length;
					while ( i-- ) {
						if ( !matchers[ i ]( elem, context, xml ) ) {
							return false;
						}
					}
					return true;
				} :
				matchers[ 0 ];
		}

		function multipleContexts( selector, contexts, results ) {
			var i = 0,
				len = contexts.length;
			for ( ; i < len; i++ ) {
				find( selector, contexts[ i ], results );
			}
			return results;
		}

		function condense( unmatched, map, filter, context, xml ) {
			var elem,
				newUnmatched = [],
				i = 0,
				len = unmatched.length,
				mapped = map != null;

			for ( ; i < len; i++ ) {
				if ( ( elem = unmatched[ i ] ) ) {
					if ( !filter || filter( elem, context, xml ) ) {
						newUnmatched.push( elem );
						if ( mapped ) {
							map.push( i );
						}
					}
				}
			}

			return newUnmatched;
		}

		function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
			if ( postFilter && !postFilter[ expando ] ) {
				postFilter = setMatcher( postFilter );
			}
			if ( postFinder && !postFinder[ expando ] ) {
				postFinder = setMatcher( postFinder, postSelector );
			}
			return markFunction( function( seed, results, context, xml ) {
				var temp, i, elem, matcherOut,
					preMap = [],
					postMap = [],
					preexisting = results.length,

					// Get initial elements from seed or context
					elems = seed ||
						multipleContexts( selector || "*",
							context.nodeType ? [ context ] : context, [] ),

					// Prefilter to get matcher input, preserving a map for seed-results synchronization
					matcherIn = preFilter && ( seed || !selector ) ?
						condense( elems, preMap, preFilter, context, xml ) :
						elems;

				if ( matcher ) {

					// If we have a postFinder, or filtered seed, or non-seed postFilter
					// or preexisting results,
					matcherOut = postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

						// ...intermediate processing is necessary
						[] :

						// ...otherwise use results directly
						results;

					// Find primary matches
					matcher( matcherIn, matcherOut, context, xml );
				} else {
					matcherOut = matcherIn;
				}

				// Apply postFilter
				if ( postFilter ) {
					temp = condense( matcherOut, postMap );
					postFilter( temp, [], context, xml );

					// Un-match failing elements by moving them back to matcherIn
					i = temp.length;
					while ( i-- ) {
						if ( ( elem = temp[ i ] ) ) {
							matcherOut[ postMap[ i ] ] = !( matcherIn[ postMap[ i ] ] = elem );
						}
					}
				}

				if ( seed ) {
					if ( postFinder || preFilter ) {
						if ( postFinder ) {

							// Get the final matcherOut by condensing this intermediate into postFinder contexts
							temp = [];
							i = matcherOut.length;
							while ( i-- ) {
								if ( ( elem = matcherOut[ i ] ) ) {

									// Restore matcherIn since elem is not yet a final match
									temp.push( ( matcherIn[ i ] = elem ) );
								}
							}
							postFinder( null, ( matcherOut = [] ), temp, xml );
						}

						// Move matched elements from seed to results to keep them synchronized
						i = matcherOut.length;
						while ( i-- ) {
							if ( ( elem = matcherOut[ i ] ) &&
								( temp = postFinder ? indexOf.call( seed, elem ) : preMap[ i ] ) > -1 ) {

								seed[ temp ] = !( results[ temp ] = elem );
							}
						}
					}

				// Add elements to results, through postFinder if defined
				} else {
					matcherOut = condense(
						matcherOut === results ?
							matcherOut.splice( preexisting, matcherOut.length ) :
							matcherOut
					);
					if ( postFinder ) {
						postFinder( null, results, matcherOut, xml );
					} else {
						push.apply( results, matcherOut );
					}
				}
			} );
		}

		function matcherFromTokens( tokens ) {
			var checkContext, matcher, j,
				len = tokens.length,
				leadingRelative = Expr.relative[ tokens[ 0 ].type ],
				implicitRelative = leadingRelative || Expr.relative[ " " ],
				i = leadingRelative ? 1 : 0,

				// The foundational matcher ensures that elements are reachable from top-level context(s)
				matchContext = addCombinator( function( elem ) {
					return elem === checkContext;
				}, implicitRelative, true ),
				matchAnyContext = addCombinator( function( elem ) {
					return indexOf.call( checkContext, elem ) > -1;
				}, implicitRelative, true ),
				matchers = [ function( elem, context, xml ) {

					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					var ret = ( !leadingRelative && ( xml || context != outermostContext ) ) || (
						( checkContext = context ).nodeType ?
							matchContext( elem, context, xml ) :
							matchAnyContext( elem, context, xml ) );

					// Avoid hanging onto element
					// (see https://github.com/jquery/sizzle/issues/299)
					checkContext = null;
					return ret;
				} ];

			for ( ; i < len; i++ ) {
				if ( ( matcher = Expr.relative[ tokens[ i ].type ] ) ) {
					matchers = [ addCombinator( elementMatcher( matchers ), matcher ) ];
				} else {
					matcher = Expr.filter[ tokens[ i ].type ].apply( null, tokens[ i ].matches );

					// Return special upon seeing a positional matcher
					if ( matcher[ expando ] ) {

						// Find the next relative operator (if any) for proper handling
						j = ++i;
						for ( ; j < len; j++ ) {
							if ( Expr.relative[ tokens[ j ].type ] ) {
								break;
							}
						}
						return setMatcher(
							i > 1 && elementMatcher( matchers ),
							i > 1 && toSelector(

								// If the preceding token was a descendant combinator, insert an implicit any-element `*`
								tokens.slice( 0, i - 1 )
									.concat( { value: tokens[ i - 2 ].type === " " ? "*" : "" } )
							).replace( rtrimCSS, "$1" ),
							matcher,
							i < j && matcherFromTokens( tokens.slice( i, j ) ),
							j < len && matcherFromTokens( ( tokens = tokens.slice( j ) ) ),
							j < len && toSelector( tokens )
						);
					}
					matchers.push( matcher );
				}
			}

			return elementMatcher( matchers );
		}

		function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
			var bySet = setMatchers.length > 0,
				byElement = elementMatchers.length > 0,
				superMatcher = function( seed, context, xml, results, outermost ) {
					var elem, j, matcher,
						matchedCount = 0,
						i = "0",
						unmatched = seed && [],
						setMatched = [],
						contextBackup = outermostContext,

						// We must always have either seed elements or outermost context
						elems = seed || byElement && Expr.find.TAG( "*", outermost ),

						// Use integer dirruns iff this is the outermost matcher
						dirrunsUnique = ( dirruns += contextBackup == null ? 1 : Math.random() || 0.1 ),
						len = elems.length;

					if ( outermost ) {

						// Support: IE 11+, Edge 17 - 18+
						// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
						// two documents; shallow comparisons work.
						// eslint-disable-next-line eqeqeq
						outermostContext = context == document || context || outermost;
					}

					// Add elements passing elementMatchers directly to results
					// Support: iOS <=7 - 9 only
					// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching
					// elements by id. (see trac-14142)
					for ( ; i !== len && ( elem = elems[ i ] ) != null; i++ ) {
						if ( byElement && elem ) {
							j = 0;

							// Support: IE 11+, Edge 17 - 18+
							// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
							// two documents; shallow comparisons work.
							// eslint-disable-next-line eqeqeq
							if ( !context && elem.ownerDocument != document ) {
								setDocument( elem );
								xml = !documentIsHTML;
							}
							while ( ( matcher = elementMatchers[ j++ ] ) ) {
								if ( matcher( elem, context || document, xml ) ) {
									push.call( results, elem );
									break;
								}
							}
							if ( outermost ) {
								dirruns = dirrunsUnique;
							}
						}

						// Track unmatched elements for set filters
						if ( bySet ) {

							// They will have gone through all possible matchers
							if ( ( elem = !matcher && elem ) ) {
								matchedCount--;
							}

							// Lengthen the array for every element, matched or not
							if ( seed ) {
								unmatched.push( elem );
							}
						}
					}

					// `i` is now the count of elements visited above, and adding it to `matchedCount`
					// makes the latter nonnegative.
					matchedCount += i;

					// Apply set filters to unmatched elements
					// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
					// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
					// no element matchers and no seed.
					// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
					// case, which will result in a "00" `matchedCount` that differs from `i` but is also
					// numerically zero.
					if ( bySet && i !== matchedCount ) {
						j = 0;
						while ( ( matcher = setMatchers[ j++ ] ) ) {
							matcher( unmatched, setMatched, context, xml );
						}

						if ( seed ) {

							// Reintegrate element matches to eliminate the need for sorting
							if ( matchedCount > 0 ) {
								while ( i-- ) {
									if ( !( unmatched[ i ] || setMatched[ i ] ) ) {
										setMatched[ i ] = pop.call( results );
									}
								}
							}

							// Discard index placeholder values to get only actual matches
							setMatched = condense( setMatched );
						}

						// Add matches to results
						push.apply( results, setMatched );

						// Seedless set matches succeeding multiple successful matchers stipulate sorting
						if ( outermost && !seed && setMatched.length > 0 &&
							( matchedCount + setMatchers.length ) > 1 ) {

							jQuery.uniqueSort( results );
						}
					}

					// Override manipulation of globals by nested matchers
					if ( outermost ) {
						dirruns = dirrunsUnique;
						outermostContext = contextBackup;
					}

					return unmatched;
				};

			return bySet ?
				markFunction( superMatcher ) :
				superMatcher;
		}

		function compile( selector, match /* Internal Use Only */ ) {
			var i,
				setMatchers = [],
				elementMatchers = [],
				cached = compilerCache[ selector + " " ];

			if ( !cached ) {

				// Generate a function of recursive functions that can be used to check each element
				if ( !match ) {
					match = tokenize( selector );
				}
				i = match.length;
				while ( i-- ) {
					cached = matcherFromTokens( match[ i ] );
					if ( cached[ expando ] ) {
						setMatchers.push( cached );
					} else {
						elementMatchers.push( cached );
					}
				}

				// Cache the compiled function
				cached = compilerCache( selector,
					matcherFromGroupMatchers( elementMatchers, setMatchers ) );

				// Save selector and tokenization
				cached.selector = selector;
			}
			return cached;
		}

		/**
		 * A low-level selection function that works with jQuery's compiled
		 *  selector functions
		 * @param {String|Function} selector A selector or a pre-compiled
		 *  selector function built with jQuery selector compile
		 * @param {Element} context
		 * @param {Array} [results]
		 * @param {Array} [seed] A set of elements to match against
		 */
		function select( selector, context, results, seed ) {
			var i, tokens, token, type, find,
				compiled = typeof selector === "function" && selector,
				match = !seed && tokenize( ( selector = compiled.selector || selector ) );

			results = results || [];

			// Try to minimize operations if there is only one selector in the list and no seed
			// (the latter of which guarantees us context)
			if ( match.length === 1 ) {

				// Reduce context if the leading compound selector is an ID
				tokens = match[ 0 ] = match[ 0 ].slice( 0 );
				if ( tokens.length > 2 && ( token = tokens[ 0 ] ).type === "ID" &&
						context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[ 1 ].type ] ) {

					context = ( Expr.find.ID(
						token.matches[ 0 ].replace( runescape, funescape ),
						context
					) || [] )[ 0 ];
					if ( !context ) {
						return results;

					// Precompiled matchers will still verify ancestry, so step up a level
					} else if ( compiled ) {
						context = context.parentNode;
					}

					selector = selector.slice( tokens.shift().value.length );
				}

				// Fetch a seed set for right-to-left matching
				i = matchExpr.needsContext.test( selector ) ? 0 : tokens.length;
				while ( i-- ) {
					token = tokens[ i ];

					// Abort if we hit a combinator
					if ( Expr.relative[ ( type = token.type ) ] ) {
						break;
					}
					if ( ( find = Expr.find[ type ] ) ) {

						// Search, expanding context for leading sibling combinators
						if ( ( seed = find(
							token.matches[ 0 ].replace( runescape, funescape ),
							rsibling.test( tokens[ 0 ].type ) &&
								testContext( context.parentNode ) || context
						) ) ) {

							// If seed is empty or no tokens remain, we can return early
							tokens.splice( i, 1 );
							selector = seed.length && toSelector( tokens );
							if ( !selector ) {
								push.apply( results, seed );
								return results;
							}

							break;
						}
					}
				}
			}

			// Compile and execute a filtering function if one is not provided
			// Provide `match` to avoid retokenization if we modified the selector above
			( compiled || compile( selector, match ) )(
				seed,
				context,
				!documentIsHTML,
				results,
				!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
			);
			return results;
		}

		// One-time assignments

		// Support: Android <=4.0 - 4.1+
		// Sort stability
		support.sortStable = expando.split( "" ).sort( sortOrder ).join( "" ) === expando;

		// Initialize against the default document
		setDocument();

		// Support: Android <=4.0 - 4.1+
		// Detached nodes confoundingly follow *each other*
		support.sortDetached = assert( function( el ) {

			// Should return 1, but returns 4 (following)
			return el.compareDocumentPosition( document.createElement( "fieldset" ) ) & 1;
		} );

		jQuery.find = find;

		// Deprecated
		jQuery.expr[ ":" ] = jQuery.expr.pseudos;
		jQuery.unique = jQuery.uniqueSort;

		// These have always been private, but they used to be documented as part of
		// Sizzle so let's maintain them for now for backwards compatibility purposes.
		find.compile = compile;
		find.select = select;
		find.setDocument = setDocument;
		find.tokenize = tokenize;

		find.escape = jQuery.escapeSelector;
		find.getText = jQuery.text;
		find.isXML = jQuery.isXMLDoc;
		find.selectors = jQuery.expr;
		find.support = jQuery.support;
		find.uniqueSort = jQuery.uniqueSort;

			/* eslint-enable */

		} )();


		var dir = function( elem, dir, until ) {
			var matched = [],
				truncate = until !== undefined;

			while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
				if ( elem.nodeType === 1 ) {
					if ( truncate && jQuery( elem ).is( until ) ) {
						break;
					}
					matched.push( elem );
				}
			}
			return matched;
		};


		var siblings = function( n, elem ) {
			var matched = [];

			for ( ; n; n = n.nextSibling ) {
				if ( n.nodeType === 1 && n !== elem ) {
					matched.push( n );
				}
			}

			return matched;
		};


		var rneedsContext = jQuery.expr.match.needsContext;

		var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



		// Implement the identical functionality for filter and not
		function winnow( elements, qualifier, not ) {
			if ( isFunction( qualifier ) ) {
				return jQuery.grep( elements, function( elem, i ) {
					return !!qualifier.call( elem, i, elem ) !== not;
				} );
			}

			// Single element
			if ( qualifier.nodeType ) {
				return jQuery.grep( elements, function( elem ) {
					return ( elem === qualifier ) !== not;
				} );
			}

			// Arraylike of elements (jQuery, arguments, Array)
			if ( typeof qualifier !== "string" ) {
				return jQuery.grep( elements, function( elem ) {
					return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
				} );
			}

			// Filtered directly for both simple and complex selectors
			return jQuery.filter( qualifier, elements, not );
		}

		jQuery.filter = function( expr, elems, not ) {
			var elem = elems[ 0 ];

			if ( not ) {
				expr = ":not(" + expr + ")";
			}

			if ( elems.length === 1 && elem.nodeType === 1 ) {
				return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
			}

			return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
				return elem.nodeType === 1;
			} ) );
		};

		jQuery.fn.extend( {
			find: function( selector ) {
				var i, ret,
					len = this.length,
					self = this;

				if ( typeof selector !== "string" ) {
					return this.pushStack( jQuery( selector ).filter( function() {
						for ( i = 0; i < len; i++ ) {
							if ( jQuery.contains( self[ i ], this ) ) {
								return true;
							}
						}
					} ) );
				}

				ret = this.pushStack( [] );

				for ( i = 0; i < len; i++ ) {
					jQuery.find( selector, self[ i ], ret );
				}

				return len > 1 ? jQuery.uniqueSort( ret ) : ret;
			},
			filter: function( selector ) {
				return this.pushStack( winnow( this, selector || [], false ) );
			},
			not: function( selector ) {
				return this.pushStack( winnow( this, selector || [], true ) );
			},
			is: function( selector ) {
				return !!winnow(
					this,

					// If this is a positional/relative selector, check membership in the returned set
					// so $("p:first").is("p:last") won't return true for a doc with two "p".
					typeof selector === "string" && rneedsContext.test( selector ) ?
						jQuery( selector ) :
						selector || [],
					false
				).length;
			}
		} );


		// Initialize a jQuery object


		// A central reference to the root jQuery(document)
		var rootjQuery,

			// A simple way to check for HTML strings
			// Prioritize #id over <tag> to avoid XSS via location.hash (trac-9521)
			// Strict HTML recognition (trac-11290: must start with <)
			// Shortcut simple #id case for speed
			rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

			init = jQuery.fn.init = function( selector, context, root ) {
				var match, elem;

				// HANDLE: $(""), $(null), $(undefined), $(false)
				if ( !selector ) {
					return this;
				}

				// Method init() accepts an alternate rootjQuery
				// so migrate can support jQuery.sub (gh-2101)
				root = root || rootjQuery;

				// Handle HTML strings
				if ( typeof selector === "string" ) {
					if ( selector[ 0 ] === "<" &&
						selector[ selector.length - 1 ] === ">" &&
						selector.length >= 3 ) {

						// Assume that strings that start and end with <> are HTML and skip the regex check
						match = [ null, selector, null ];

					} else {
						match = rquickExpr.exec( selector );
					}

					// Match html or make sure no context is specified for #id
					if ( match && ( match[ 1 ] || !context ) ) {

						// HANDLE: $(html) -> $(array)
						if ( match[ 1 ] ) {
							context = context instanceof jQuery ? context[ 0 ] : context;

							// Option to run scripts is true for back-compat
							// Intentionally let the error be thrown if parseHTML is not present
							jQuery.merge( this, jQuery.parseHTML(
								match[ 1 ],
								context && context.nodeType ? context.ownerDocument || context : document,
								true
							) );

							// HANDLE: $(html, props)
							if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
								for ( match in context ) {

									// Properties of context are called as methods if possible
									if ( isFunction( this[ match ] ) ) {
										this[ match ]( context[ match ] );

									// ...and otherwise set as attributes
									} else {
										this.attr( match, context[ match ] );
									}
								}
							}

							return this;

						// HANDLE: $(#id)
						} else {
							elem = document.getElementById( match[ 2 ] );

							if ( elem ) {

								// Inject the element directly into the jQuery object
								this[ 0 ] = elem;
								this.length = 1;
							}
							return this;
						}

					// HANDLE: $(expr, $(...))
					} else if ( !context || context.jquery ) {
						return ( context || root ).find( selector );

					// HANDLE: $(expr, context)
					// (which is just equivalent to: $(context).find(expr)
					} else {
						return this.constructor( context ).find( selector );
					}

				// HANDLE: $(DOMElement)
				} else if ( selector.nodeType ) {
					this[ 0 ] = selector;
					this.length = 1;
					return this;

				// HANDLE: $(function)
				// Shortcut for document ready
				} else if ( isFunction( selector ) ) {
					return root.ready !== undefined ?
						root.ready( selector ) :

						// Execute immediately if ready is not present
						selector( jQuery );
				}

				return jQuery.makeArray( selector, this );
			};

		// Give the init function the jQuery prototype for later instantiation
		init.prototype = jQuery.fn;

		// Initialize central reference
		rootjQuery = jQuery( document );


		var rparentsprev = /^(?:parents|prev(?:Until|All))/,

			// Methods guaranteed to produce a unique set when starting from a unique set
			guaranteedUnique = {
				children: true,
				contents: true,
				next: true,
				prev: true
			};

		jQuery.fn.extend( {
			has: function( target ) {
				var targets = jQuery( target, this ),
					l = targets.length;

				return this.filter( function() {
					var i = 0;
					for ( ; i < l; i++ ) {
						if ( jQuery.contains( this, targets[ i ] ) ) {
							return true;
						}
					}
				} );
			},

			closest: function( selectors, context ) {
				var cur,
					i = 0,
					l = this.length,
					matched = [],
					targets = typeof selectors !== "string" && jQuery( selectors );

				// Positional selectors never match, since there's no _selection_ context
				if ( !rneedsContext.test( selectors ) ) {
					for ( ; i < l; i++ ) {
						for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

							// Always skip document fragments
							if ( cur.nodeType < 11 && ( targets ?
								targets.index( cur ) > -1 :

								// Don't pass non-elements to jQuery#find
								cur.nodeType === 1 &&
									jQuery.find.matchesSelector( cur, selectors ) ) ) {

								matched.push( cur );
								break;
							}
						}
					}
				}

				return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
			},

			// Determine the position of an element within the set
			index: function( elem ) {

				// No argument, return index in parent
				if ( !elem ) {
					return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
				}

				// Index in selector
				if ( typeof elem === "string" ) {
					return indexOf.call( jQuery( elem ), this[ 0 ] );
				}

				// Locate the position of the desired element
				return indexOf.call( this,

					// If it receives a jQuery object, the first element is used
					elem.jquery ? elem[ 0 ] : elem
				);
			},

			add: function( selector, context ) {
				return this.pushStack(
					jQuery.uniqueSort(
						jQuery.merge( this.get(), jQuery( selector, context ) )
					)
				);
			},

			addBack: function( selector ) {
				return this.add( selector == null ?
					this.prevObject : this.prevObject.filter( selector )
				);
			}
		} );

		function sibling( cur, dir ) {
			while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
			return cur;
		}

		jQuery.each( {
			parent: function( elem ) {
				var parent = elem.parentNode;
				return parent && parent.nodeType !== 11 ? parent : null;
			},
			parents: function( elem ) {
				return dir( elem, "parentNode" );
			},
			parentsUntil: function( elem, _i, until ) {
				return dir( elem, "parentNode", until );
			},
			next: function( elem ) {
				return sibling( elem, "nextSibling" );
			},
			prev: function( elem ) {
				return sibling( elem, "previousSibling" );
			},
			nextAll: function( elem ) {
				return dir( elem, "nextSibling" );
			},
			prevAll: function( elem ) {
				return dir( elem, "previousSibling" );
			},
			nextUntil: function( elem, _i, until ) {
				return dir( elem, "nextSibling", until );
			},
			prevUntil: function( elem, _i, until ) {
				return dir( elem, "previousSibling", until );
			},
			siblings: function( elem ) {
				return siblings( ( elem.parentNode || {} ).firstChild, elem );
			},
			children: function( elem ) {
				return siblings( elem.firstChild );
			},
			contents: function( elem ) {
				if ( elem.contentDocument != null &&

					// Support: IE 11+
					// <object> elements with no `data` attribute has an object
					// `contentDocument` with a `null` prototype.
					getProto( elem.contentDocument ) ) {

					return elem.contentDocument;
				}

				// Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
				// Treat the template element as a regular one in browsers that
				// don't support it.
				if ( nodeName( elem, "template" ) ) {
					elem = elem.content || elem;
				}

				return jQuery.merge( [], elem.childNodes );
			}
		}, function( name, fn ) {
			jQuery.fn[ name ] = function( until, selector ) {
				var matched = jQuery.map( this, fn, until );

				if ( name.slice( -5 ) !== "Until" ) {
					selector = until;
				}

				if ( selector && typeof selector === "string" ) {
					matched = jQuery.filter( selector, matched );
				}

				if ( this.length > 1 ) {

					// Remove duplicates
					if ( !guaranteedUnique[ name ] ) {
						jQuery.uniqueSort( matched );
					}

					// Reverse order for parents* and prev-derivatives
					if ( rparentsprev.test( name ) ) {
						matched.reverse();
					}
				}

				return this.pushStack( matched );
			};
		} );
		var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



		// Convert String-formatted options into Object-formatted ones
		function createOptions( options ) {
			var object = {};
			jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
				object[ flag ] = true;
			} );
			return object;
		}

		/*
		 * Create a callback list using the following parameters:
		 *
		 *	options: an optional list of space-separated options that will change how
		 *			the callback list behaves or a more traditional option object
		 *
		 * By default a callback list will act like an event callback list and can be
		 * "fired" multiple times.
		 *
		 * Possible options:
		 *
		 *	once:			will ensure the callback list can only be fired once (like a Deferred)
		 *
		 *	memory:			will keep track of previous values and will call any callback added
		 *					after the list has been fired right away with the latest "memorized"
		 *					values (like a Deferred)
		 *
		 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
		 *
		 *	stopOnFalse:	interrupt callings when a callback returns false
		 *
		 */
		jQuery.Callbacks = function( options ) {

			// Convert options from String-formatted to Object-formatted if needed
			// (we check in cache first)
			options = typeof options === "string" ?
				createOptions( options ) :
				jQuery.extend( {}, options );

			var // Flag to know if list is currently firing
				firing,

				// Last fire value for non-forgettable lists
				memory,

				// Flag to know if list was already fired
				fired,

				// Flag to prevent firing
				locked,

				// Actual callback list
				list = [],

				// Queue of execution data for repeatable lists
				queue = [],

				// Index of currently firing callback (modified by add/remove as needed)
				firingIndex = -1,

				// Fire callbacks
				fire = function() {

					// Enforce single-firing
					locked = locked || options.once;

					// Execute callbacks for all pending executions,
					// respecting firingIndex overrides and runtime changes
					fired = firing = true;
					for ( ; queue.length; firingIndex = -1 ) {
						memory = queue.shift();
						while ( ++firingIndex < list.length ) {

							// Run callback and check for early termination
							if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
								options.stopOnFalse ) {

								// Jump to end and forget the data so .add doesn't re-fire
								firingIndex = list.length;
								memory = false;
							}
						}
					}

					// Forget the data if we're done with it
					if ( !options.memory ) {
						memory = false;
					}

					firing = false;

					// Clean up if we're done firing for good
					if ( locked ) {

						// Keep an empty list if we have data for future add calls
						if ( memory ) {
							list = [];

						// Otherwise, this object is spent
						} else {
							list = "";
						}
					}
				},

				// Actual Callbacks object
				self = {

					// Add a callback or a collection of callbacks to the list
					add: function() {
						if ( list ) {

							// If we have memory from a past run, we should fire after adding
							if ( memory && !firing ) {
								firingIndex = list.length - 1;
								queue.push( memory );
							}

							( function add( args ) {
								jQuery.each( args, function( _, arg ) {
									if ( isFunction( arg ) ) {
										if ( !options.unique || !self.has( arg ) ) {
											list.push( arg );
										}
									} else if ( arg && arg.length && toType( arg ) !== "string" ) {

										// Inspect recursively
										add( arg );
									}
								} );
							} )( arguments );

							if ( memory && !firing ) {
								fire();
							}
						}
						return this;
					},

					// Remove a callback from the list
					remove: function() {
						jQuery.each( arguments, function( _, arg ) {
							var index;
							while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
								list.splice( index, 1 );

								// Handle firing indexes
								if ( index <= firingIndex ) {
									firingIndex--;
								}
							}
						} );
						return this;
					},

					// Check if a given callback is in the list.
					// If no argument is given, return whether or not list has callbacks attached.
					has: function( fn ) {
						return fn ?
							jQuery.inArray( fn, list ) > -1 :
							list.length > 0;
					},

					// Remove all callbacks from the list
					empty: function() {
						if ( list ) {
							list = [];
						}
						return this;
					},

					// Disable .fire and .add
					// Abort any current/pending executions
					// Clear all callbacks and values
					disable: function() {
						locked = queue = [];
						list = memory = "";
						return this;
					},
					disabled: function() {
						return !list;
					},

					// Disable .fire
					// Also disable .add unless we have memory (since it would have no effect)
					// Abort any pending executions
					lock: function() {
						locked = queue = [];
						if ( !memory && !firing ) {
							list = memory = "";
						}
						return this;
					},
					locked: function() {
						return !!locked;
					},

					// Call all callbacks with the given context and arguments
					fireWith: function( context, args ) {
						if ( !locked ) {
							args = args || [];
							args = [ context, args.slice ? args.slice() : args ];
							queue.push( args );
							if ( !firing ) {
								fire();
							}
						}
						return this;
					},

					// Call all the callbacks with the given arguments
					fire: function() {
						self.fireWith( this, arguments );
						return this;
					},

					// To know if the callbacks have already been called at least once
					fired: function() {
						return !!fired;
					}
				};

			return self;
		};


		function Identity( v ) {
			return v;
		}
		function Thrower( ex ) {
			throw ex;
		}

		function adoptValue( value, resolve, reject, noValue ) {
			var method;

			try {

				// Check for promise aspect first to privilege synchronous behavior
				if ( value && isFunction( ( method = value.promise ) ) ) {
					method.call( value ).done( resolve ).fail( reject );

				// Other thenables
				} else if ( value && isFunction( ( method = value.then ) ) ) {
					method.call( value, resolve, reject );

				// Other non-thenables
				} else {

					// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
					// * false: [ value ].slice( 0 ) => resolve( value )
					// * true: [ value ].slice( 1 ) => resolve()
					resolve.apply( undefined, [ value ].slice( noValue ) );
				}

			// For Promises/A+, convert exceptions into rejections
			// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
			// Deferred#then to conditionally suppress rejection.
			} catch ( value ) {

				// Support: Android 4.0 only
				// Strict mode functions invoked without .call/.apply get global-object context
				reject.apply( undefined, [ value ] );
			}
		}

		jQuery.extend( {

			Deferred: function( func ) {
				var tuples = [

						// action, add listener, callbacks,
						// ... .then handlers, argument index, [final state]
						[ "notify", "progress", jQuery.Callbacks( "memory" ),
							jQuery.Callbacks( "memory" ), 2 ],
						[ "resolve", "done", jQuery.Callbacks( "once memory" ),
							jQuery.Callbacks( "once memory" ), 0, "resolved" ],
						[ "reject", "fail", jQuery.Callbacks( "once memory" ),
							jQuery.Callbacks( "once memory" ), 1, "rejected" ]
					],
					state = "pending",
					promise = {
						state: function() {
							return state;
						},
						always: function() {
							deferred.done( arguments ).fail( arguments );
							return this;
						},
						"catch": function( fn ) {
							return promise.then( null, fn );
						},

						// Keep pipe for back-compat
						pipe: function( /* fnDone, fnFail, fnProgress */ ) {
							var fns = arguments;

							return jQuery.Deferred( function( newDefer ) {
								jQuery.each( tuples, function( _i, tuple ) {

									// Map tuples (progress, done, fail) to arguments (done, fail, progress)
									var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

									// deferred.progress(function() { bind to newDefer or newDefer.notify })
									// deferred.done(function() { bind to newDefer or newDefer.resolve })
									// deferred.fail(function() { bind to newDefer or newDefer.reject })
									deferred[ tuple[ 1 ] ]( function() {
										var returned = fn && fn.apply( this, arguments );
										if ( returned && isFunction( returned.promise ) ) {
											returned.promise()
												.progress( newDefer.notify )
												.done( newDefer.resolve )
												.fail( newDefer.reject );
										} else {
											newDefer[ tuple[ 0 ] + "With" ](
												this,
												fn ? [ returned ] : arguments
											);
										}
									} );
								} );
								fns = null;
							} ).promise();
						},
						then: function( onFulfilled, onRejected, onProgress ) {
							var maxDepth = 0;
							function resolve( depth, deferred, handler, special ) {
								return function() {
									var that = this,
										args = arguments,
										mightThrow = function() {
											var returned, then;

											// Support: Promises/A+ section 2.3.3.3.3
											// https://promisesaplus.com/#point-59
											// Ignore double-resolution attempts
											if ( depth < maxDepth ) {
												return;
											}

											returned = handler.apply( that, args );

											// Support: Promises/A+ section 2.3.1
											// https://promisesaplus.com/#point-48
											if ( returned === deferred.promise() ) {
												throw new TypeError( "Thenable self-resolution" );
											}

											// Support: Promises/A+ sections 2.3.3.1, 3.5
											// https://promisesaplus.com/#point-54
											// https://promisesaplus.com/#point-75
											// Retrieve `then` only once
											then = returned &&

												// Support: Promises/A+ section 2.3.4
												// https://promisesaplus.com/#point-64
												// Only check objects and functions for thenability
												( typeof returned === "object" ||
													typeof returned === "function" ) &&
												returned.then;

											// Handle a returned thenable
											if ( isFunction( then ) ) {

												// Special processors (notify) just wait for resolution
												if ( special ) {
													then.call(
														returned,
														resolve( maxDepth, deferred, Identity, special ),
														resolve( maxDepth, deferred, Thrower, special )
													);

												// Normal processors (resolve) also hook into progress
												} else {

													// ...and disregard older resolution values
													maxDepth++;

													then.call(
														returned,
														resolve( maxDepth, deferred, Identity, special ),
														resolve( maxDepth, deferred, Thrower, special ),
														resolve( maxDepth, deferred, Identity,
															deferred.notifyWith )
													);
												}

											// Handle all other returned values
											} else {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Identity ) {
													that = undefined;
													args = [ returned ];
												}

												// Process the value(s)
												// Default process is resolve
												( special || deferred.resolveWith )( that, args );
											}
										},

										// Only normal processors (resolve) catch and reject exceptions
										process = special ?
											mightThrow :
											function() {
												try {
													mightThrow();
												} catch ( e ) {

													if ( jQuery.Deferred.exceptionHook ) {
														jQuery.Deferred.exceptionHook( e,
															process.error );
													}

													// Support: Promises/A+ section 2.3.3.3.4.1
													// https://promisesaplus.com/#point-61
													// Ignore post-resolution exceptions
													if ( depth + 1 >= maxDepth ) {

														// Only substitute handlers pass on context
														// and multiple values (non-spec behavior)
														if ( handler !== Thrower ) {
															that = undefined;
															args = [ e ];
														}

														deferred.rejectWith( that, args );
													}
												}
											};

									// Support: Promises/A+ section 2.3.3.3.1
									// https://promisesaplus.com/#point-57
									// Re-resolve promises immediately to dodge false rejection from
									// subsequent errors
									if ( depth ) {
										process();
									} else {

										// Call an optional hook to record the error, in case of exception
										// since it's otherwise lost when execution goes async
										if ( jQuery.Deferred.getErrorHook ) {
											process.error = jQuery.Deferred.getErrorHook();

										// The deprecated alias of the above. While the name suggests
										// returning the stack, not an error instance, jQuery just passes
										// it directly to `console.warn` so both will work; an instance
										// just better cooperates with source maps.
										} else if ( jQuery.Deferred.getStackHook ) {
											process.error = jQuery.Deferred.getStackHook();
										}
										window.setTimeout( process );
									}
								};
							}

							return jQuery.Deferred( function( newDefer ) {

								// progress_handlers.add( ... )
								tuples[ 0 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onProgress ) ?
											onProgress :
											Identity,
										newDefer.notifyWith
									)
								);

								// fulfilled_handlers.add( ... )
								tuples[ 1 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onFulfilled ) ?
											onFulfilled :
											Identity
									)
								);

								// rejected_handlers.add( ... )
								tuples[ 2 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onRejected ) ?
											onRejected :
											Thrower
									)
								);
							} ).promise();
						},

						// Get a promise for this deferred
						// If obj is provided, the promise aspect is added to the object
						promise: function( obj ) {
							return obj != null ? jQuery.extend( obj, promise ) : promise;
						}
					},
					deferred = {};

				// Add list-specific methods
				jQuery.each( tuples, function( i, tuple ) {
					var list = tuple[ 2 ],
						stateString = tuple[ 5 ];

					// promise.progress = list.add
					// promise.done = list.add
					// promise.fail = list.add
					promise[ tuple[ 1 ] ] = list.add;

					// Handle state
					if ( stateString ) {
						list.add(
							function() {

								// state = "resolved" (i.e., fulfilled)
								// state = "rejected"
								state = stateString;
							},

							// rejected_callbacks.disable
							// fulfilled_callbacks.disable
							tuples[ 3 - i ][ 2 ].disable,

							// rejected_handlers.disable
							// fulfilled_handlers.disable
							tuples[ 3 - i ][ 3 ].disable,

							// progress_callbacks.lock
							tuples[ 0 ][ 2 ].lock,

							// progress_handlers.lock
							tuples[ 0 ][ 3 ].lock
						);
					}

					// progress_handlers.fire
					// fulfilled_handlers.fire
					// rejected_handlers.fire
					list.add( tuple[ 3 ].fire );

					// deferred.notify = function() { deferred.notifyWith(...) }
					// deferred.resolve = function() { deferred.resolveWith(...) }
					// deferred.reject = function() { deferred.rejectWith(...) }
					deferred[ tuple[ 0 ] ] = function() {
						deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
						return this;
					};

					// deferred.notifyWith = list.fireWith
					// deferred.resolveWith = list.fireWith
					// deferred.rejectWith = list.fireWith
					deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
				} );

				// Make the deferred a promise
				promise.promise( deferred );

				// Call given func if any
				if ( func ) {
					func.call( deferred, deferred );
				}

				// All done!
				return deferred;
			},

			// Deferred helper
			when: function( singleValue ) {
				var

					// count of uncompleted subordinates
					remaining = arguments.length,

					// count of unprocessed arguments
					i = remaining,

					// subordinate fulfillment data
					resolveContexts = Array( i ),
					resolveValues = slice.call( arguments ),

					// the primary Deferred
					primary = jQuery.Deferred(),

					// subordinate callback factory
					updateFunc = function( i ) {
						return function( value ) {
							resolveContexts[ i ] = this;
							resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
							if ( !( --remaining ) ) {
								primary.resolveWith( resolveContexts, resolveValues );
							}
						};
					};

				// Single- and empty arguments are adopted like Promise.resolve
				if ( remaining <= 1 ) {
					adoptValue( singleValue, primary.done( updateFunc( i ) ).resolve, primary.reject,
						!remaining );

					// Use .then() to unwrap secondary thenables (cf. gh-3000)
					if ( primary.state() === "pending" ||
						isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

						return primary.then();
					}
				}

				// Multiple arguments are aggregated like Promise.all array elements
				while ( i-- ) {
					adoptValue( resolveValues[ i ], updateFunc( i ), primary.reject );
				}

				return primary.promise();
			}
		} );


		// These usually indicate a programmer mistake during development,
		// warn about them ASAP rather than swallowing them by default.
		var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

		// If `jQuery.Deferred.getErrorHook` is defined, `asyncError` is an error
		// captured before the async barrier to get the original error cause
		// which may otherwise be hidden.
		jQuery.Deferred.exceptionHook = function( error, asyncError ) {

			// Support: IE 8 - 9 only
			// Console exists when dev tools are open, which can happen at any time
			if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
				window.console.warn( "jQuery.Deferred exception: " + error.message,
					error.stack, asyncError );
			}
		};




		jQuery.readyException = function( error ) {
			window.setTimeout( function() {
				throw error;
			} );
		};




		// The deferred used on DOM ready
		var readyList = jQuery.Deferred();

		jQuery.fn.ready = function( fn ) {

			readyList
				.then( fn )

				// Wrap jQuery.readyException in a function so that the lookup
				// happens at the time of error handling instead of callback
				// registration.
				.catch( function( error ) {
					jQuery.readyException( error );
				} );

			return this;
		};

		jQuery.extend( {

			// Is the DOM ready to be used? Set to true once it occurs.
			isReady: false,

			// A counter to track how many items to wait for before
			// the ready event fires. See trac-6781
			readyWait: 1,

			// Handle when the DOM is ready
			ready: function( wait ) {

				// Abort if there are pending holds or we're already ready
				if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
					return;
				}

				// Remember that the DOM is ready
				jQuery.isReady = true;

				// If a normal DOM Ready event fired, decrement, and wait if need be
				if ( wait !== true && --jQuery.readyWait > 0 ) {
					return;
				}

				// If there are functions bound, to execute
				readyList.resolveWith( document, [ jQuery ] );
			}
		} );

		jQuery.ready.then = readyList.then;

		// The ready event handler and self cleanup method
		function completed() {
			document.removeEventListener( "DOMContentLoaded", completed );
			window.removeEventListener( "load", completed );
			jQuery.ready();
		}

		// Catch cases where $(document).ready() is called
		// after the browser event has already occurred.
		// Support: IE <=9 - 10 only
		// Older IE sometimes signals "interactive" too soon
		if ( document.readyState === "complete" ||
			( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

			// Handle it asynchronously to allow scripts the opportunity to delay ready
			window.setTimeout( jQuery.ready );

		} else {

			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", completed );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", completed );
		}




		// Multifunctional method to get and set values of a collection
		// The value/s can optionally be executed if it's a function
		var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
			var i = 0,
				len = elems.length,
				bulk = key == null;

			// Sets many values
			if ( toType( key ) === "object" ) {
				chainable = true;
				for ( i in key ) {
					access( elems, fn, i, key[ i ], true, emptyGet, raw );
				}

			// Sets one value
			} else if ( value !== undefined ) {
				chainable = true;

				if ( !isFunction( value ) ) {
					raw = true;
				}

				if ( bulk ) {

					// Bulk operations run against the entire set
					if ( raw ) {
						fn.call( elems, value );
						fn = null;

					// ...except when executing function values
					} else {
						bulk = fn;
						fn = function( elem, _key, value ) {
							return bulk.call( jQuery( elem ), value );
						};
					}
				}

				if ( fn ) {
					for ( ; i < len; i++ ) {
						fn(
							elems[ i ], key, raw ?
								value :
								value.call( elems[ i ], i, fn( elems[ i ], key ) )
						);
					}
				}
			}

			if ( chainable ) {
				return elems;
			}

			// Gets
			if ( bulk ) {
				return fn.call( elems );
			}

			return len ? fn( elems[ 0 ], key ) : emptyGet;
		};


		// Matches dashed string for camelizing
		var rmsPrefix = /^-ms-/,
			rdashAlpha = /-([a-z])/g;

		// Used by camelCase as callback to replace()
		function fcamelCase( _all, letter ) {
			return letter.toUpperCase();
		}

		// Convert dashed to camelCase; used by the css and data modules
		// Support: IE <=9 - 11, Edge 12 - 15
		// Microsoft forgot to hump their vendor prefix (trac-9572)
		function camelCase( string ) {
			return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
		}
		var acceptData = function( owner ) {

			// Accepts only:
			//  - Node
			//    - Node.ELEMENT_NODE
			//    - Node.DOCUMENT_NODE
			//  - Object
			//    - Any
			return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
		};




		function Data() {
			this.expando = jQuery.expando + Data.uid++;
		}

		Data.uid = 1;

		Data.prototype = {

			cache: function( owner ) {

				// Check if the owner object already has a cache
				var value = owner[ this.expando ];

				// If not, create one
				if ( !value ) {
					value = {};

					// We can accept data for non-element nodes in modern browsers,
					// but we should not, see trac-8335.
					// Always return an empty object.
					if ( acceptData( owner ) ) {

						// If it is a node unlikely to be stringify-ed or looped over
						// use plain assignment
						if ( owner.nodeType ) {
							owner[ this.expando ] = value;

						// Otherwise secure it in a non-enumerable property
						// configurable must be true to allow the property to be
						// deleted when data is removed
						} else {
							Object.defineProperty( owner, this.expando, {
								value: value,
								configurable: true
							} );
						}
					}
				}

				return value;
			},
			set: function( owner, data, value ) {
				var prop,
					cache = this.cache( owner );

				// Handle: [ owner, key, value ] args
				// Always use camelCase key (gh-2257)
				if ( typeof data === "string" ) {
					cache[ camelCase( data ) ] = value;

				// Handle: [ owner, { properties } ] args
				} else {

					// Copy the properties one-by-one to the cache object
					for ( prop in data ) {
						cache[ camelCase( prop ) ] = data[ prop ];
					}
				}
				return cache;
			},
			get: function( owner, key ) {
				return key === undefined ?
					this.cache( owner ) :

					// Always use camelCase key (gh-2257)
					owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
			},
			access: function( owner, key, value ) {

				// In cases where either:
				//
				//   1. No key was specified
				//   2. A string key was specified, but no value provided
				//
				// Take the "read" path and allow the get method to determine
				// which value to return, respectively either:
				//
				//   1. The entire cache object
				//   2. The data stored at the key
				//
				if ( key === undefined ||
						( ( key && typeof key === "string" ) && value === undefined ) ) {

					return this.get( owner, key );
				}

				// When the key is not a string, or both a key and value
				// are specified, set or extend (existing objects) with either:
				//
				//   1. An object of properties
				//   2. A key and value
				//
				this.set( owner, key, value );

				// Since the "set" path can have two possible entry points
				// return the expected data based on which path was taken[*]
				return value !== undefined ? value : key;
			},
			remove: function( owner, key ) {
				var i,
					cache = owner[ this.expando ];

				if ( cache === undefined ) {
					return;
				}

				if ( key !== undefined ) {

					// Support array or space separated string of keys
					if ( Array.isArray( key ) ) {

						// If key is an array of keys...
						// We always set camelCase keys, so remove that.
						key = key.map( camelCase );
					} else {
						key = camelCase( key );

						// If a key with the spaces exists, use it.
						// Otherwise, create an array by matching non-whitespace
						key = key in cache ?
							[ key ] :
							( key.match( rnothtmlwhite ) || [] );
					}

					i = key.length;

					while ( i-- ) {
						delete cache[ key[ i ] ];
					}
				}

				// Remove the expando if there's no more data
				if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

					// Support: Chrome <=35 - 45
					// Webkit & Blink performance suffers when deleting properties
					// from DOM nodes, so set to undefined instead
					// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
					if ( owner.nodeType ) {
						owner[ this.expando ] = undefined;
					} else {
						delete owner[ this.expando ];
					}
				}
			},
			hasData: function( owner ) {
				var cache = owner[ this.expando ];
				return cache !== undefined && !jQuery.isEmptyObject( cache );
			}
		};
		var dataPriv = new Data();

		var dataUser = new Data();



		//	Implementation Summary
		//
		//	1. Enforce API surface and semantic compatibility with 1.9.x branch
		//	2. Improve the module's maintainability by reducing the storage
		//		paths to a single mechanism.
		//	3. Use the same single mechanism to support "private" and "user" data.
		//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
		//	5. Avoid exposing implementation details on user objects (eg. expando properties)
		//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

		var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
			rmultiDash = /[A-Z]/g;

		function getData( data ) {
			if ( data === "true" ) {
				return true;
			}

			if ( data === "false" ) {
				return false;
			}

			if ( data === "null" ) {
				return null;
			}

			// Only convert to a number if it doesn't change the string
			if ( data === +data + "" ) {
				return +data;
			}

			if ( rbrace.test( data ) ) {
				return JSON.parse( data );
			}

			return data;
		}

		function dataAttr( elem, key, data ) {
			var name;

			// If nothing was found internally, try to fetch any
			// data from the HTML5 data-* attribute
			if ( data === undefined && elem.nodeType === 1 ) {
				name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
				data = elem.getAttribute( name );

				if ( typeof data === "string" ) {
					try {
						data = getData( data );
					} catch ( e ) {}

					// Make sure we set the data so it isn't changed later
					dataUser.set( elem, key, data );
				} else {
					data = undefined;
				}
			}
			return data;
		}

		jQuery.extend( {
			hasData: function( elem ) {
				return dataUser.hasData( elem ) || dataPriv.hasData( elem );
			},

			data: function( elem, name, data ) {
				return dataUser.access( elem, name, data );
			},

			removeData: function( elem, name ) {
				dataUser.remove( elem, name );
			},

			// TODO: Now that all calls to _data and _removeData have been replaced
			// with direct calls to dataPriv methods, these can be deprecated.
			_data: function( elem, name, data ) {
				return dataPriv.access( elem, name, data );
			},

			_removeData: function( elem, name ) {
				dataPriv.remove( elem, name );
			}
		} );

		jQuery.fn.extend( {
			data: function( key, value ) {
				var i, name, data,
					elem = this[ 0 ],
					attrs = elem && elem.attributes;

				// Gets all values
				if ( key === undefined ) {
					if ( this.length ) {
						data = dataUser.get( elem );

						if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
							i = attrs.length;
							while ( i-- ) {

								// Support: IE 11 only
								// The attrs elements can be null (trac-14894)
								if ( attrs[ i ] ) {
									name = attrs[ i ].name;
									if ( name.indexOf( "data-" ) === 0 ) {
										name = camelCase( name.slice( 5 ) );
										dataAttr( elem, name, data[ name ] );
									}
								}
							}
							dataPriv.set( elem, "hasDataAttrs", true );
						}
					}

					return data;
				}

				// Sets multiple values
				if ( typeof key === "object" ) {
					return this.each( function() {
						dataUser.set( this, key );
					} );
				}

				return access( this, function( value ) {
					var data;

					// The calling jQuery object (element matches) is not empty
					// (and therefore has an element appears at this[ 0 ]) and the
					// `value` parameter was not undefined. An empty jQuery object
					// will result in `undefined` for elem = this[ 0 ] which will
					// throw an exception if an attempt to read a data cache is made.
					if ( elem && value === undefined ) {

						// Attempt to get data from the cache
						// The key will always be camelCased in Data
						data = dataUser.get( elem, key );
						if ( data !== undefined ) {
							return data;
						}

						// Attempt to "discover" the data in
						// HTML5 custom data-* attrs
						data = dataAttr( elem, key );
						if ( data !== undefined ) {
							return data;
						}

						// We tried really hard, but the data doesn't exist.
						return;
					}

					// Set the data...
					this.each( function() {

						// We always store the camelCased key
						dataUser.set( this, key, value );
					} );
				}, null, value, arguments.length > 1, null, true );
			},

			removeData: function( key ) {
				return this.each( function() {
					dataUser.remove( this, key );
				} );
			}
		} );


		jQuery.extend( {
			queue: function( elem, type, data ) {
				var queue;

				if ( elem ) {
					type = ( type || "fx" ) + "queue";
					queue = dataPriv.get( elem, type );

					// Speed up dequeue by getting out quickly if this is just a lookup
					if ( data ) {
						if ( !queue || Array.isArray( data ) ) {
							queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
						} else {
							queue.push( data );
						}
					}
					return queue || [];
				}
			},

			dequeue: function( elem, type ) {
				type = type || "fx";

				var queue = jQuery.queue( elem, type ),
					startLength = queue.length,
					fn = queue.shift(),
					hooks = jQuery._queueHooks( elem, type ),
					next = function() {
						jQuery.dequeue( elem, type );
					};

				// If the fx queue is dequeued, always remove the progress sentinel
				if ( fn === "inprogress" ) {
					fn = queue.shift();
					startLength--;
				}

				if ( fn ) {

					// Add a progress sentinel to prevent the fx queue from being
					// automatically dequeued
					if ( type === "fx" ) {
						queue.unshift( "inprogress" );
					}

					// Clear up the last queue stop function
					delete hooks.stop;
					fn.call( elem, next, hooks );
				}

				if ( !startLength && hooks ) {
					hooks.empty.fire();
				}
			},

			// Not public - generate a queueHooks object, or return the current one
			_queueHooks: function( elem, type ) {
				var key = type + "queueHooks";
				return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
					empty: jQuery.Callbacks( "once memory" ).add( function() {
						dataPriv.remove( elem, [ type + "queue", key ] );
					} )
				} );
			}
		} );

		jQuery.fn.extend( {
			queue: function( type, data ) {
				var setter = 2;

				if ( typeof type !== "string" ) {
					data = type;
					type = "fx";
					setter--;
				}

				if ( arguments.length < setter ) {
					return jQuery.queue( this[ 0 ], type );
				}

				return data === undefined ?
					this :
					this.each( function() {
						var queue = jQuery.queue( this, type, data );

						// Ensure a hooks for this queue
						jQuery._queueHooks( this, type );

						if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
							jQuery.dequeue( this, type );
						}
					} );
			},
			dequeue: function( type ) {
				return this.each( function() {
					jQuery.dequeue( this, type );
				} );
			},
			clearQueue: function( type ) {
				return this.queue( type || "fx", [] );
			},

			// Get a promise resolved when queues of a certain type
			// are emptied (fx is the type by default)
			promise: function( type, obj ) {
				var tmp,
					count = 1,
					defer = jQuery.Deferred(),
					elements = this,
					i = this.length,
					resolve = function() {
						if ( !( --count ) ) {
							defer.resolveWith( elements, [ elements ] );
						}
					};

				if ( typeof type !== "string" ) {
					obj = type;
					type = undefined;
				}
				type = type || "fx";

				while ( i-- ) {
					tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
					if ( tmp && tmp.empty ) {
						count++;
						tmp.empty.add( resolve );
					}
				}
				resolve();
				return defer.promise( obj );
			}
		} );
		var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

		var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


		var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

		var documentElement = document.documentElement;



			var isAttached = function( elem ) {
					return jQuery.contains( elem.ownerDocument, elem );
				},
				composed = { composed: true };

			// Support: IE 9 - 11+, Edge 12 - 18+, iOS 10.0 - 10.2 only
			// Check attachment across shadow DOM boundaries when possible (gh-3504)
			// Support: iOS 10.0-10.2 only
			// Early iOS 10 versions support `attachShadow` but not `getRootNode`,
			// leading to errors. We need to check for `getRootNode`.
			if ( documentElement.getRootNode ) {
				isAttached = function( elem ) {
					return jQuery.contains( elem.ownerDocument, elem ) ||
						elem.getRootNode( composed ) === elem.ownerDocument;
				};
			}
		var isHiddenWithinTree = function( elem, el ) {

				// isHiddenWithinTree might be called from jQuery#filter function;
				// in that case, element will be second argument
				elem = el || elem;

				// Inline style trumps all
				return elem.style.display === "none" ||
					elem.style.display === "" &&

					// Otherwise, check computed style
					// Support: Firefox <=43 - 45
					// Disconnected elements can have computed display: none, so first confirm that elem is
					// in the document.
					isAttached( elem ) &&

					jQuery.css( elem, "display" ) === "none";
			};



		function adjustCSS( elem, prop, valueParts, tween ) {
			var adjusted, scale,
				maxIterations = 20,
				currentValue = tween ?
					function() {
						return tween.cur();
					} :
					function() {
						return jQuery.css( elem, prop, "" );
					},
				initial = currentValue(),
				unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

				// Starting value computation is required for potential unit mismatches
				initialInUnit = elem.nodeType &&
					( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
					rcssNum.exec( jQuery.css( elem, prop ) );

			if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

				// Support: Firefox <=54
				// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
				initial = initial / 2;

				// Trust units reported by jQuery.css
				unit = unit || initialInUnit[ 3 ];

				// Iteratively approximate from a nonzero starting point
				initialInUnit = +initial || 1;

				while ( maxIterations-- ) {

					// Evaluate and update our best guess (doubling guesses that zero out).
					// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
					jQuery.style( elem, prop, initialInUnit + unit );
					if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
						maxIterations = 0;
					}
					initialInUnit = initialInUnit / scale;

				}

				initialInUnit = initialInUnit * 2;
				jQuery.style( elem, prop, initialInUnit + unit );

				// Make sure we update the tween properties later on
				valueParts = valueParts || [];
			}

			if ( valueParts ) {
				initialInUnit = +initialInUnit || +initial || 0;

				// Apply relative offset (+=/-=) if specified
				adjusted = valueParts[ 1 ] ?
					initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
					+valueParts[ 2 ];
				if ( tween ) {
					tween.unit = unit;
					tween.start = initialInUnit;
					tween.end = adjusted;
				}
			}
			return adjusted;
		}


		var defaultDisplayMap = {};

		function getDefaultDisplay( elem ) {
			var temp,
				doc = elem.ownerDocument,
				nodeName = elem.nodeName,
				display = defaultDisplayMap[ nodeName ];

			if ( display ) {
				return display;
			}

			temp = doc.body.appendChild( doc.createElement( nodeName ) );
			display = jQuery.css( temp, "display" );

			temp.parentNode.removeChild( temp );

			if ( display === "none" ) {
				display = "block";
			}
			defaultDisplayMap[ nodeName ] = display;

			return display;
		}

		function showHide( elements, show ) {
			var display, elem,
				values = [],
				index = 0,
				length = elements.length;

			// Determine new display value for elements that need to change
			for ( ; index < length; index++ ) {
				elem = elements[ index ];
				if ( !elem.style ) {
					continue;
				}

				display = elem.style.display;
				if ( show ) {

					// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
					// check is required in this first loop unless we have a nonempty display value (either
					// inline or about-to-be-restored)
					if ( display === "none" ) {
						values[ index ] = dataPriv.get( elem, "display" ) || null;
						if ( !values[ index ] ) {
							elem.style.display = "";
						}
					}
					if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
						values[ index ] = getDefaultDisplay( elem );
					}
				} else {
					if ( display !== "none" ) {
						values[ index ] = "none";

						// Remember what we're overwriting
						dataPriv.set( elem, "display", display );
					}
				}
			}

			// Set the display of the elements in a second loop to avoid constant reflow
			for ( index = 0; index < length; index++ ) {
				if ( values[ index ] != null ) {
					elements[ index ].style.display = values[ index ];
				}
			}

			return elements;
		}

		jQuery.fn.extend( {
			show: function() {
				return showHide( this, true );
			},
			hide: function() {
				return showHide( this );
			},
			toggle: function( state ) {
				if ( typeof state === "boolean" ) {
					return state ? this.show() : this.hide();
				}

				return this.each( function() {
					if ( isHiddenWithinTree( this ) ) {
						jQuery( this ).show();
					} else {
						jQuery( this ).hide();
					}
				} );
			}
		} );
		var rcheckableType = ( /^(?:checkbox|radio)$/i );

		var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]*)/i );

		var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



		( function() {
			var fragment = document.createDocumentFragment(),
				div = fragment.appendChild( document.createElement( "div" ) ),
				input = document.createElement( "input" );

			// Support: Android 4.0 - 4.3 only
			// Check state lost if the name is set (trac-11217)
			// Support: Windows Web Apps (WWA)
			// `name` and `type` must use .setAttribute for WWA (trac-14901)
			input.setAttribute( "type", "radio" );
			input.setAttribute( "checked", "checked" );
			input.setAttribute( "name", "t" );

			div.appendChild( input );

			// Support: Android <=4.1 only
			// Older WebKit doesn't clone checked state correctly in fragments
			support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

			// Support: IE <=11 only
			// Make sure textarea (and checkbox) defaultValue is properly cloned
			div.innerHTML = "<textarea>x</textarea>";
			support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;

			// Support: IE <=9 only
			// IE <=9 replaces <option> tags with their contents when inserted outside of
			// the select element.
			div.innerHTML = "<option></option>";
			support.option = !!div.lastChild;
		} )();


		// We have to close these tags to support XHTML (trac-13200)
		var wrapMap = {

			// XHTML parsers do not magically insert elements in the
			// same way that tag soup parsers do. So we cannot shorten
			// this by omitting <tbody> or other required elements.
			thead: [ 1, "<table>", "</table>" ],
			col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
			tr: [ 2, "<table><tbody>", "</tbody></table>" ],
			td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

			_default: [ 0, "", "" ]
		};

		wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
		wrapMap.th = wrapMap.td;

		// Support: IE <=9 only
		if ( !support.option ) {
			wrapMap.optgroup = wrapMap.option = [ 1, "<select multiple='multiple'>", "</select>" ];
		}


		function getAll( context, tag ) {

			// Support: IE <=9 - 11 only
			// Use typeof to avoid zero-argument method invocation on host objects (trac-15151)
			var ret;

			if ( typeof context.getElementsByTagName !== "undefined" ) {
				ret = context.getElementsByTagName( tag || "*" );

			} else if ( typeof context.querySelectorAll !== "undefined" ) {
				ret = context.querySelectorAll( tag || "*" );

			} else {
				ret = [];
			}

			if ( tag === undefined || tag && nodeName( context, tag ) ) {
				return jQuery.merge( [ context ], ret );
			}

			return ret;
		}


		// Mark scripts as having already been evaluated
		function setGlobalEval( elems, refElements ) {
			var i = 0,
				l = elems.length;

			for ( ; i < l; i++ ) {
				dataPriv.set(
					elems[ i ],
					"globalEval",
					!refElements || dataPriv.get( refElements[ i ], "globalEval" )
				);
			}
		}


		var rhtml = /<|&#?\w+;/;

		function buildFragment( elems, context, scripts, selection, ignored ) {
			var elem, tmp, tag, wrap, attached, j,
				fragment = context.createDocumentFragment(),
				nodes = [],
				i = 0,
				l = elems.length;

			for ( ; i < l; i++ ) {
				elem = elems[ i ];

				if ( elem || elem === 0 ) {

					// Add nodes directly
					if ( toType( elem ) === "object" ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

					// Convert non-html into a text node
					} else if ( !rhtml.test( elem ) ) {
						nodes.push( context.createTextNode( elem ) );

					// Convert html into DOM nodes
					} else {
						tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

						// Deserialize a standard representation
						tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
						wrap = wrapMap[ tag ] || wrapMap._default;
						tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

						// Descend through wrappers to the right content
						j = wrap[ 0 ];
						while ( j-- ) {
							tmp = tmp.lastChild;
						}

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( nodes, tmp.childNodes );

						// Remember the top-level container
						tmp = fragment.firstChild;

						// Ensure the created nodes are orphaned (trac-12392)
						tmp.textContent = "";
					}
				}
			}

			// Remove wrapper from fragment
			fragment.textContent = "";

			i = 0;
			while ( ( elem = nodes[ i++ ] ) ) {

				// Skip elements already in the context collection (trac-4087)
				if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
					if ( ignored ) {
						ignored.push( elem );
					}
					continue;
				}

				attached = isAttached( elem );

				// Append to fragment
				tmp = getAll( fragment.appendChild( elem ), "script" );

				// Preserve script evaluation history
				if ( attached ) {
					setGlobalEval( tmp );
				}

				// Capture executables
				if ( scripts ) {
					j = 0;
					while ( ( elem = tmp[ j++ ] ) ) {
						if ( rscriptType.test( elem.type || "" ) ) {
							scripts.push( elem );
						}
					}
				}
			}

			return fragment;
		}


		var rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

		function returnTrue() {
			return true;
		}

		function returnFalse() {
			return false;
		}

		function on( elem, types, selector, data, fn, one ) {
			var origFn, type;

			// Types can be a map of types/handlers
			if ( typeof types === "object" ) {

				// ( types-Object, selector, data )
				if ( typeof selector !== "string" ) {

					// ( types-Object, data )
					data = data || selector;
					selector = undefined;
				}
				for ( type in types ) {
					on( elem, type, selector, data, types[ type ], one );
				}
				return elem;
			}

			if ( data == null && fn == null ) {

				// ( types, fn )
				fn = selector;
				data = selector = undefined;
			} else if ( fn == null ) {
				if ( typeof selector === "string" ) {

					// ( types, selector, fn )
					fn = data;
					data = undefined;
				} else {

					// ( types, data, fn )
					fn = data;
					data = selector;
					selector = undefined;
				}
			}
			if ( fn === false ) {
				fn = returnFalse;
			} else if ( !fn ) {
				return elem;
			}

			if ( one === 1 ) {
				origFn = fn;
				fn = function( event ) {

					// Can use an empty set, since event contains the info
					jQuery().off( event );
					return origFn.apply( this, arguments );
				};

				// Use same guid so caller can remove using origFn
				fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
			}
			return elem.each( function() {
				jQuery.event.add( this, types, fn, data, selector );
			} );
		}

		/*
		 * Helper functions for managing events -- not part of the public interface.
		 * Props to Dean Edwards' addEvent library for many of the ideas.
		 */
		jQuery.event = {

			global: {},

			add: function( elem, types, handler, data, selector ) {

				var handleObjIn, eventHandle, tmp,
					events, t, handleObj,
					special, handlers, type, namespaces, origType,
					elemData = dataPriv.get( elem );

				// Only attach events to objects that accept data
				if ( !acceptData( elem ) ) {
					return;
				}

				// Caller can pass in an object of custom data in lieu of the handler
				if ( handler.handler ) {
					handleObjIn = handler;
					handler = handleObjIn.handler;
					selector = handleObjIn.selector;
				}

				// Ensure that invalid selectors throw exceptions at attach time
				// Evaluate against documentElement in case elem is a non-element node (e.g., document)
				if ( selector ) {
					jQuery.find.matchesSelector( documentElement, selector );
				}

				// Make sure that the handler has a unique ID, used to find/remove it later
				if ( !handler.guid ) {
					handler.guid = jQuery.guid++;
				}

				// Init the element's event structure and main handler, if this is the first
				if ( !( events = elemData.events ) ) {
					events = elemData.events = Object.create( null );
				}
				if ( !( eventHandle = elemData.handle ) ) {
					eventHandle = elemData.handle = function( e ) {

						// Discard the second event of a jQuery.event.trigger() and
						// when an event is called after a page has unloaded
						return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
							jQuery.event.dispatch.apply( elem, arguments ) : undefined;
					};
				}

				// Handle multiple events separated by a space
				types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
				t = types.length;
				while ( t-- ) {
					tmp = rtypenamespace.exec( types[ t ] ) || [];
					type = origType = tmp[ 1 ];
					namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

					// There *must* be a type, no attaching namespace-only handlers
					if ( !type ) {
						continue;
					}

					// If event changes its type, use the special event handlers for the changed type
					special = jQuery.event.special[ type ] || {};

					// If selector defined, determine special event api type, otherwise given type
					type = ( selector ? special.delegateType : special.bindType ) || type;

					// Update special based on newly reset type
					special = jQuery.event.special[ type ] || {};

					// handleObj is passed to all event handlers
					handleObj = jQuery.extend( {
						type: type,
						origType: origType,
						data: data,
						handler: handler,
						guid: handler.guid,
						selector: selector,
						needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
						namespace: namespaces.join( "." )
					}, handleObjIn );

					// Init the event handler queue if we're the first
					if ( !( handlers = events[ type ] ) ) {
						handlers = events[ type ] = [];
						handlers.delegateCount = 0;

						// Only use addEventListener if the special events handler returns false
						if ( !special.setup ||
							special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

							if ( elem.addEventListener ) {
								elem.addEventListener( type, eventHandle );
							}
						}
					}

					if ( special.add ) {
						special.add.call( elem, handleObj );

						if ( !handleObj.handler.guid ) {
							handleObj.handler.guid = handler.guid;
						}
					}

					// Add to the element's handler list, delegates in front
					if ( selector ) {
						handlers.splice( handlers.delegateCount++, 0, handleObj );
					} else {
						handlers.push( handleObj );
					}

					// Keep track of which events have ever been used, for event optimization
					jQuery.event.global[ type ] = true;
				}

			},

			// Detach an event or set of events from an element
			remove: function( elem, types, handler, selector, mappedTypes ) {

				var j, origCount, tmp,
					events, t, handleObj,
					special, handlers, type, namespaces, origType,
					elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

				if ( !elemData || !( events = elemData.events ) ) {
					return;
				}

				// Once for each type.namespace in types; type may be omitted
				types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
				t = types.length;
				while ( t-- ) {
					tmp = rtypenamespace.exec( types[ t ] ) || [];
					type = origType = tmp[ 1 ];
					namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

					// Unbind all events (on this namespace, if provided) for the element
					if ( !type ) {
						for ( type in events ) {
							jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
						}
						continue;
					}

					special = jQuery.event.special[ type ] || {};
					type = ( selector ? special.delegateType : special.bindType ) || type;
					handlers = events[ type ] || [];
					tmp = tmp[ 2 ] &&
						new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

					// Remove matching events
					origCount = j = handlers.length;
					while ( j-- ) {
						handleObj = handlers[ j ];

						if ( ( mappedTypes || origType === handleObj.origType ) &&
							( !handler || handler.guid === handleObj.guid ) &&
							( !tmp || tmp.test( handleObj.namespace ) ) &&
							( !selector || selector === handleObj.selector ||
								selector === "**" && handleObj.selector ) ) {
							handlers.splice( j, 1 );

							if ( handleObj.selector ) {
								handlers.delegateCount--;
							}
							if ( special.remove ) {
								special.remove.call( elem, handleObj );
							}
						}
					}

					// Remove generic event handler if we removed something and no more handlers exist
					// (avoids potential for endless recursion during removal of special event handlers)
					if ( origCount && !handlers.length ) {
						if ( !special.teardown ||
							special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

							jQuery.removeEvent( elem, type, elemData.handle );
						}

						delete events[ type ];
					}
				}

				// Remove data and the expando if it's no longer used
				if ( jQuery.isEmptyObject( events ) ) {
					dataPriv.remove( elem, "handle events" );
				}
			},

			dispatch: function( nativeEvent ) {

				var i, j, ret, matched, handleObj, handlerQueue,
					args = new Array( arguments.length ),

					// Make a writable jQuery.Event from the native event object
					event = jQuery.event.fix( nativeEvent ),

					handlers = (
						dataPriv.get( this, "events" ) || Object.create( null )
					)[ event.type ] || [],
					special = jQuery.event.special[ event.type ] || {};

				// Use the fix-ed jQuery.Event rather than the (read-only) native event
				args[ 0 ] = event;

				for ( i = 1; i < arguments.length; i++ ) {
					args[ i ] = arguments[ i ];
				}

				event.delegateTarget = this;

				// Call the preDispatch hook for the mapped type, and let it bail if desired
				if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
					return;
				}

				// Determine handlers
				handlerQueue = jQuery.event.handlers.call( this, event, handlers );

				// Run delegates first; they may want to stop propagation beneath us
				i = 0;
				while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
					event.currentTarget = matched.elem;

					j = 0;
					while ( ( handleObj = matched.handlers[ j++ ] ) &&
						!event.isImmediatePropagationStopped() ) {

						// If the event is namespaced, then each handler is only invoked if it is
						// specially universal or its namespaces are a superset of the event's.
						if ( !event.rnamespace || handleObj.namespace === false ||
							event.rnamespace.test( handleObj.namespace ) ) {

							event.handleObj = handleObj;
							event.data = handleObj.data;

							ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
								handleObj.handler ).apply( matched.elem, args );

							if ( ret !== undefined ) {
								if ( ( event.result = ret ) === false ) {
									event.preventDefault();
									event.stopPropagation();
								}
							}
						}
					}
				}

				// Call the postDispatch hook for the mapped type
				if ( special.postDispatch ) {
					special.postDispatch.call( this, event );
				}

				return event.result;
			},

			handlers: function( event, handlers ) {
				var i, handleObj, sel, matchedHandlers, matchedSelectors,
					handlerQueue = [],
					delegateCount = handlers.delegateCount,
					cur = event.target;

				// Find delegate handlers
				if ( delegateCount &&

					// Support: IE <=9
					// Black-hole SVG <use> instance trees (trac-13180)
					cur.nodeType &&

					// Support: Firefox <=42
					// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
					// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
					// Support: IE 11 only
					// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
					!( event.type === "click" && event.button >= 1 ) ) {

					for ( ; cur !== this; cur = cur.parentNode || this ) {

						// Don't check non-elements (trac-13208)
						// Don't process clicks on disabled elements (trac-6911, trac-8165, trac-11382, trac-11764)
						if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
							matchedHandlers = [];
							matchedSelectors = {};
							for ( i = 0; i < delegateCount; i++ ) {
								handleObj = handlers[ i ];

								// Don't conflict with Object.prototype properties (trac-13203)
								sel = handleObj.selector + " ";

								if ( matchedSelectors[ sel ] === undefined ) {
									matchedSelectors[ sel ] = handleObj.needsContext ?
										jQuery( sel, this ).index( cur ) > -1 :
										jQuery.find( sel, this, null, [ cur ] ).length;
								}
								if ( matchedSelectors[ sel ] ) {
									matchedHandlers.push( handleObj );
								}
							}
							if ( matchedHandlers.length ) {
								handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
							}
						}
					}
				}

				// Add the remaining (directly-bound) handlers
				cur = this;
				if ( delegateCount < handlers.length ) {
					handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
				}

				return handlerQueue;
			},

			addProp: function( name, hook ) {
				Object.defineProperty( jQuery.Event.prototype, name, {
					enumerable: true,
					configurable: true,

					get: isFunction( hook ) ?
						function() {
							if ( this.originalEvent ) {
								return hook( this.originalEvent );
							}
						} :
						function() {
							if ( this.originalEvent ) {
								return this.originalEvent[ name ];
							}
						},

					set: function( value ) {
						Object.defineProperty( this, name, {
							enumerable: true,
							configurable: true,
							writable: true,
							value: value
						} );
					}
				} );
			},

			fix: function( originalEvent ) {
				return originalEvent[ jQuery.expando ] ?
					originalEvent :
					new jQuery.Event( originalEvent );
			},

			special: {
				load: {

					// Prevent triggered image.load events from bubbling to window.load
					noBubble: true
				},
				click: {

					// Utilize native event to ensure correct state for checkable inputs
					setup: function( data ) {

						// For mutual compressibility with _default, replace `this` access with a local var.
						// `|| data` is dead code meant only to preserve the variable through minification.
						var el = this || data;

						// Claim the first handler
						if ( rcheckableType.test( el.type ) &&
							el.click && nodeName( el, "input" ) ) {

							// dataPriv.set( el, "click", ... )
							leverageNative( el, "click", true );
						}

						// Return false to allow normal processing in the caller
						return false;
					},
					trigger: function( data ) {

						// For mutual compressibility with _default, replace `this` access with a local var.
						// `|| data` is dead code meant only to preserve the variable through minification.
						var el = this || data;

						// Force setup before triggering a click
						if ( rcheckableType.test( el.type ) &&
							el.click && nodeName( el, "input" ) ) {

							leverageNative( el, "click" );
						}

						// Return non-false to allow normal event-path propagation
						return true;
					},

					// For cross-browser consistency, suppress native .click() on links
					// Also prevent it if we're currently inside a leveraged native-event stack
					_default: function( event ) {
						var target = event.target;
						return rcheckableType.test( target.type ) &&
							target.click && nodeName( target, "input" ) &&
							dataPriv.get( target, "click" ) ||
							nodeName( target, "a" );
					}
				},

				beforeunload: {
					postDispatch: function( event ) {

						// Support: Firefox 20+
						// Firefox doesn't alert if the returnValue field is not set.
						if ( event.result !== undefined && event.originalEvent ) {
							event.originalEvent.returnValue = event.result;
						}
					}
				}
			}
		};

		// Ensure the presence of an event listener that handles manually-triggered
		// synthetic events by interrupting progress until reinvoked in response to
		// *native* events that it fires directly, ensuring that state changes have
		// already occurred before other listeners are invoked.
		function leverageNative( el, type, isSetup ) {

			// Missing `isSetup` indicates a trigger call, which must force setup through jQuery.event.add
			if ( !isSetup ) {
				if ( dataPriv.get( el, type ) === undefined ) {
					jQuery.event.add( el, type, returnTrue );
				}
				return;
			}

			// Register the controller as a special universal handler for all event namespaces
			dataPriv.set( el, type, false );
			jQuery.event.add( el, type, {
				namespace: false,
				handler: function( event ) {
					var result,
						saved = dataPriv.get( this, type );

					if ( ( event.isTrigger & 1 ) && this[ type ] ) {

						// Interrupt processing of the outer synthetic .trigger()ed event
						if ( !saved ) {

							// Store arguments for use when handling the inner native event
							// There will always be at least one argument (an event object), so this array
							// will not be confused with a leftover capture object.
							saved = slice.call( arguments );
							dataPriv.set( this, type, saved );

							// Trigger the native event and capture its result
							this[ type ]();
							result = dataPriv.get( this, type );
							dataPriv.set( this, type, false );

							if ( saved !== result ) {

								// Cancel the outer synthetic event
								event.stopImmediatePropagation();
								event.preventDefault();

								return result;
							}

						// If this is an inner synthetic event for an event with a bubbling surrogate
						// (focus or blur), assume that the surrogate already propagated from triggering
						// the native event and prevent that from happening again here.
						// This technically gets the ordering wrong w.r.t. to `.trigger()` (in which the
						// bubbling surrogate propagates *after* the non-bubbling base), but that seems
						// less bad than duplication.
						} else if ( ( jQuery.event.special[ type ] || {} ).delegateType ) {
							event.stopPropagation();
						}

					// If this is a native event triggered above, everything is now in order
					// Fire an inner synthetic event with the original arguments
					} else if ( saved ) {

						// ...and capture the result
						dataPriv.set( this, type, jQuery.event.trigger(
							saved[ 0 ],
							saved.slice( 1 ),
							this
						) );

						// Abort handling of the native event by all jQuery handlers while allowing
						// native handlers on the same element to run. On target, this is achieved
						// by stopping immediate propagation just on the jQuery event. However,
						// the native event is re-wrapped by a jQuery one on each level of the
						// propagation so the only way to stop it for jQuery is to stop it for
						// everyone via native `stopPropagation()`. This is not a problem for
						// focus/blur which don't bubble, but it does also stop click on checkboxes
						// and radios. We accept this limitation.
						event.stopPropagation();
						event.isImmediatePropagationStopped = returnTrue;
					}
				}
			} );
		}

		jQuery.removeEvent = function( elem, type, handle ) {

			// This "if" is needed for plain objects
			if ( elem.removeEventListener ) {
				elem.removeEventListener( type, handle );
			}
		};

		jQuery.Event = function( src, props ) {

			// Allow instantiation without the 'new' keyword
			if ( !( this instanceof jQuery.Event ) ) {
				return new jQuery.Event( src, props );
			}

			// Event object
			if ( src && src.type ) {
				this.originalEvent = src;
				this.type = src.type;

				// Events bubbling up the document may have been marked as prevented
				// by a handler lower down the tree; reflect the correct value.
				this.isDefaultPrevented = src.defaultPrevented ||
						src.defaultPrevented === undefined &&

						// Support: Android <=2.3 only
						src.returnValue === false ?
					returnTrue :
					returnFalse;

				// Create target properties
				// Support: Safari <=6 - 7 only
				// Target should not be a text node (trac-504, trac-13143)
				this.target = ( src.target && src.target.nodeType === 3 ) ?
					src.target.parentNode :
					src.target;

				this.currentTarget = src.currentTarget;
				this.relatedTarget = src.relatedTarget;

			// Event type
			} else {
				this.type = src;
			}

			// Put explicitly provided properties onto the event object
			if ( props ) {
				jQuery.extend( this, props );
			}

			// Create a timestamp if incoming event doesn't have one
			this.timeStamp = src && src.timeStamp || Date.now();

			// Mark it as fixed
			this[ jQuery.expando ] = true;
		};

		// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
		// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
		jQuery.Event.prototype = {
			constructor: jQuery.Event,
			isDefaultPrevented: returnFalse,
			isPropagationStopped: returnFalse,
			isImmediatePropagationStopped: returnFalse,
			isSimulated: false,

			preventDefault: function() {
				var e = this.originalEvent;

				this.isDefaultPrevented = returnTrue;

				if ( e && !this.isSimulated ) {
					e.preventDefault();
				}
			},
			stopPropagation: function() {
				var e = this.originalEvent;

				this.isPropagationStopped = returnTrue;

				if ( e && !this.isSimulated ) {
					e.stopPropagation();
				}
			},
			stopImmediatePropagation: function() {
				var e = this.originalEvent;

				this.isImmediatePropagationStopped = returnTrue;

				if ( e && !this.isSimulated ) {
					e.stopImmediatePropagation();
				}

				this.stopPropagation();
			}
		};

		// Includes all common event props including KeyEvent and MouseEvent specific props
		jQuery.each( {
			altKey: true,
			bubbles: true,
			cancelable: true,
			changedTouches: true,
			ctrlKey: true,
			detail: true,
			eventPhase: true,
			metaKey: true,
			pageX: true,
			pageY: true,
			shiftKey: true,
			view: true,
			"char": true,
			code: true,
			charCode: true,
			key: true,
			keyCode: true,
			button: true,
			buttons: true,
			clientX: true,
			clientY: true,
			offsetX: true,
			offsetY: true,
			pointerId: true,
			pointerType: true,
			screenX: true,
			screenY: true,
			targetTouches: true,
			toElement: true,
			touches: true,
			which: true
		}, jQuery.event.addProp );

		jQuery.each( { focus: "focusin", blur: "focusout" }, function( type, delegateType ) {

			function focusMappedHandler( nativeEvent ) {
				if ( document.documentMode ) {

					// Support: IE 11+
					// Attach a single focusin/focusout handler on the document while someone wants
					// focus/blur. This is because the former are synchronous in IE while the latter
					// are async. In other browsers, all those handlers are invoked synchronously.

					// `handle` from private data would already wrap the event, but we need
					// to change the `type` here.
					var handle = dataPriv.get( this, "handle" ),
						event = jQuery.event.fix( nativeEvent );
					event.type = nativeEvent.type === "focusin" ? "focus" : "blur";
					event.isSimulated = true;

					// First, handle focusin/focusout
					handle( nativeEvent );

					// ...then, handle focus/blur
					//
					// focus/blur don't bubble while focusin/focusout do; simulate the former by only
					// invoking the handler at the lower level.
					if ( event.target === event.currentTarget ) {

						// The setup part calls `leverageNative`, which, in turn, calls
						// `jQuery.event.add`, so event handle will already have been set
						// by this point.
						handle( event );
					}
				} else {

					// For non-IE browsers, attach a single capturing handler on the document
					// while someone wants focusin/focusout.
					jQuery.event.simulate( delegateType, nativeEvent.target,
						jQuery.event.fix( nativeEvent ) );
				}
			}

			jQuery.event.special[ type ] = {

				// Utilize native event if possible so blur/focus sequence is correct
				setup: function() {

					var attaches;

					// Claim the first handler
					// dataPriv.set( this, "focus", ... )
					// dataPriv.set( this, "blur", ... )
					leverageNative( this, type, true );

					if ( document.documentMode ) {

						// Support: IE 9 - 11+
						// We use the same native handler for focusin & focus (and focusout & blur)
						// so we need to coordinate setup & teardown parts between those events.
						// Use `delegateType` as the key as `type` is already used by `leverageNative`.
						attaches = dataPriv.get( this, delegateType );
						if ( !attaches ) {
							this.addEventListener( delegateType, focusMappedHandler );
						}
						dataPriv.set( this, delegateType, ( attaches || 0 ) + 1 );
					} else {

						// Return false to allow normal processing in the caller
						return false;
					}
				},
				trigger: function() {

					// Force setup before trigger
					leverageNative( this, type );

					// Return non-false to allow normal event-path propagation
					return true;
				},

				teardown: function() {
					var attaches;

					if ( document.documentMode ) {
						attaches = dataPriv.get( this, delegateType ) - 1;
						if ( !attaches ) {
							this.removeEventListener( delegateType, focusMappedHandler );
							dataPriv.remove( this, delegateType );
						} else {
							dataPriv.set( this, delegateType, attaches );
						}
					} else {

						// Return false to indicate standard teardown should be applied
						return false;
					}
				},

				// Suppress native focus or blur if we're currently inside
				// a leveraged native-event stack
				_default: function( event ) {
					return dataPriv.get( event.target, type );
				},

				delegateType: delegateType
			};

			// Support: Firefox <=44
			// Firefox doesn't have focus(in | out) events
			// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
			//
			// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
			// focus(in | out) events fire after focus & blur events,
			// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
			// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
			//
			// Support: IE 9 - 11+
			// To preserve relative focusin/focus & focusout/blur event order guaranteed on the 3.x branch,
			// attach a single handler for both events in IE.
			jQuery.event.special[ delegateType ] = {
				setup: function() {

					// Handle: regular nodes (via `this.ownerDocument`), window
					// (via `this.document`) & document (via `this`).
					var doc = this.ownerDocument || this.document || this,
						dataHolder = document.documentMode ? this : doc,
						attaches = dataPriv.get( dataHolder, delegateType );

					// Support: IE 9 - 11+
					// We use the same native handler for focusin & focus (and focusout & blur)
					// so we need to coordinate setup & teardown parts between those events.
					// Use `delegateType` as the key as `type` is already used by `leverageNative`.
					if ( !attaches ) {
						if ( document.documentMode ) {
							this.addEventListener( delegateType, focusMappedHandler );
						} else {
							doc.addEventListener( type, focusMappedHandler, true );
						}
					}
					dataPriv.set( dataHolder, delegateType, ( attaches || 0 ) + 1 );
				},
				teardown: function() {
					var doc = this.ownerDocument || this.document || this,
						dataHolder = document.documentMode ? this : doc,
						attaches = dataPriv.get( dataHolder, delegateType ) - 1;

					if ( !attaches ) {
						if ( document.documentMode ) {
							this.removeEventListener( delegateType, focusMappedHandler );
						} else {
							doc.removeEventListener( type, focusMappedHandler, true );
						}
						dataPriv.remove( dataHolder, delegateType );
					} else {
						dataPriv.set( dataHolder, delegateType, attaches );
					}
				}
			};
		} );

		// Create mouseenter/leave events using mouseover/out and event-time checks
		// so that event delegation works in jQuery.
		// Do the same for pointerenter/pointerleave and pointerover/pointerout
		//
		// Support: Safari 7 only
		// Safari sends mouseenter too often; see:
		// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
		// for the description of the bug (it existed in older Chrome versions as well).
		jQuery.each( {
			mouseenter: "mouseover",
			mouseleave: "mouseout",
			pointerenter: "pointerover",
			pointerleave: "pointerout"
		}, function( orig, fix ) {
			jQuery.event.special[ orig ] = {
				delegateType: fix,
				bindType: fix,

				handle: function( event ) {
					var ret,
						target = this,
						related = event.relatedTarget,
						handleObj = event.handleObj;

					// For mouseenter/leave call the handler if related is outside the target.
					// NB: No relatedTarget if the mouse left/entered the browser window
					if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
						event.type = handleObj.origType;
						ret = handleObj.handler.apply( this, arguments );
						event.type = fix;
					}
					return ret;
				}
			};
		} );

		jQuery.fn.extend( {

			on: function( types, selector, data, fn ) {
				return on( this, types, selector, data, fn );
			},
			one: function( types, selector, data, fn ) {
				return on( this, types, selector, data, fn, 1 );
			},
			off: function( types, selector, fn ) {
				var handleObj, type;
				if ( types && types.preventDefault && types.handleObj ) {

					// ( event )  dispatched jQuery.Event
					handleObj = types.handleObj;
					jQuery( types.delegateTarget ).off(
						handleObj.namespace ?
							handleObj.origType + "." + handleObj.namespace :
							handleObj.origType,
						handleObj.selector,
						handleObj.handler
					);
					return this;
				}
				if ( typeof types === "object" ) {

					// ( types-object [, selector] )
					for ( type in types ) {
						this.off( type, selector, types[ type ] );
					}
					return this;
				}
				if ( selector === false || typeof selector === "function" ) {

					// ( types [, fn] )
					fn = selector;
					selector = undefined;
				}
				if ( fn === false ) {
					fn = returnFalse;
				}
				return this.each( function() {
					jQuery.event.remove( this, types, fn, selector );
				} );
			}
		} );


		var

			// Support: IE <=10 - 11, Edge 12 - 13 only
			// In IE/Edge using regex groups here causes severe slowdowns.
			// See https://connect.microsoft.com/IE/feedback/details/1736512/
			rnoInnerhtml = /<script|<style|<link/i,

			// checked="checked" or checked
			rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,

			rcleanScript = /^\s*<!\[CDATA\[|\]\]>\s*$/g;

		// Prefer a tbody over its parent table for containing new rows
		function manipulationTarget( elem, content ) {
			if ( nodeName( elem, "table" ) &&
				nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

				return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
			}

			return elem;
		}

		// Replace/restore the type attribute of script elements for safe DOM manipulation
		function disableScript( elem ) {
			elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
			return elem;
		}
		function restoreScript( elem ) {
			if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
				elem.type = elem.type.slice( 5 );
			} else {
				elem.removeAttribute( "type" );
			}

			return elem;
		}

		function cloneCopyEvent( src, dest ) {
			var i, l, type, pdataOld, udataOld, udataCur, events;

			if ( dest.nodeType !== 1 ) {
				return;
			}

			// 1. Copy private data: events, handlers, etc.
			if ( dataPriv.hasData( src ) ) {
				pdataOld = dataPriv.get( src );
				events = pdataOld.events;

				if ( events ) {
					dataPriv.remove( dest, "handle events" );

					for ( type in events ) {
						for ( i = 0, l = events[ type ].length; i < l; i++ ) {
							jQuery.event.add( dest, type, events[ type ][ i ] );
						}
					}
				}
			}

			// 2. Copy user data
			if ( dataUser.hasData( src ) ) {
				udataOld = dataUser.access( src );
				udataCur = jQuery.extend( {}, udataOld );

				dataUser.set( dest, udataCur );
			}
		}

		// Fix IE bugs, see support tests
		function fixInput( src, dest ) {
			var nodeName = dest.nodeName.toLowerCase();

			// Fails to persist the checked state of a cloned checkbox or radio button.
			if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
				dest.checked = src.checked;

			// Fails to return the selected option to the default selected state when cloning options
			} else if ( nodeName === "input" || nodeName === "textarea" ) {
				dest.defaultValue = src.defaultValue;
			}
		}

		function domManip( collection, args, callback, ignored ) {

			// Flatten any nested arrays
			args = flat( args );

			var fragment, first, scripts, hasScripts, node, doc,
				i = 0,
				l = collection.length,
				iNoClone = l - 1,
				value = args[ 0 ],
				valueIsFunction = isFunction( value );

			// We can't cloneNode fragments that contain checked, in WebKit
			if ( valueIsFunction ||
					( l > 1 && typeof value === "string" &&
						!support.checkClone && rchecked.test( value ) ) ) {
				return collection.each( function( index ) {
					var self = collection.eq( index );
					if ( valueIsFunction ) {
						args[ 0 ] = value.call( this, index, self.html() );
					}
					domManip( self, args, callback, ignored );
				} );
			}

			if ( l ) {
				fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
				first = fragment.firstChild;

				if ( fragment.childNodes.length === 1 ) {
					fragment = first;
				}

				// Require either new content or an interest in ignored elements to invoke the callback
				if ( first || ignored ) {
					scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
					hasScripts = scripts.length;

					// Use the original fragment for the last item
					// instead of the first because it can end up
					// being emptied incorrectly in certain situations (trac-8070).
					for ( ; i < l; i++ ) {
						node = fragment;

						if ( i !== iNoClone ) {
							node = jQuery.clone( node, true, true );

							// Keep references to cloned scripts for later restoration
							if ( hasScripts ) {

								// Support: Android <=4.0 only, PhantomJS 1 only
								// push.apply(_, arraylike) throws on ancient WebKit
								jQuery.merge( scripts, getAll( node, "script" ) );
							}
						}

						callback.call( collection[ i ], node, i );
					}

					if ( hasScripts ) {
						doc = scripts[ scripts.length - 1 ].ownerDocument;

						// Re-enable scripts
						jQuery.map( scripts, restoreScript );

						// Evaluate executable scripts on first document insertion
						for ( i = 0; i < hasScripts; i++ ) {
							node = scripts[ i ];
							if ( rscriptType.test( node.type || "" ) &&
								!dataPriv.access( node, "globalEval" ) &&
								jQuery.contains( doc, node ) ) {

								if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

									// Optional AJAX dependency, but won't run scripts if not present
									if ( jQuery._evalUrl && !node.noModule ) {
										jQuery._evalUrl( node.src, {
											nonce: node.nonce || node.getAttribute( "nonce" )
										}, doc );
									}
								} else {

									// Unwrap a CDATA section containing script contents. This shouldn't be
									// needed as in XML documents they're already not visible when
									// inspecting element contents and in HTML documents they have no
									// meaning but we're preserving that logic for backwards compatibility.
									// This will be removed completely in 4.0. See gh-4904.
									DOMEval( node.textContent.replace( rcleanScript, "" ), node, doc );
								}
							}
						}
					}
				}
			}

			return collection;
		}

		function remove( elem, selector, keepData ) {
			var node,
				nodes = selector ? jQuery.filter( selector, elem ) : elem,
				i = 0;

			for ( ; ( node = nodes[ i ] ) != null; i++ ) {
				if ( !keepData && node.nodeType === 1 ) {
					jQuery.cleanData( getAll( node ) );
				}

				if ( node.parentNode ) {
					if ( keepData && isAttached( node ) ) {
						setGlobalEval( getAll( node, "script" ) );
					}
					node.parentNode.removeChild( node );
				}
			}

			return elem;
		}

		jQuery.extend( {
			htmlPrefilter: function( html ) {
				return html;
			},

			clone: function( elem, dataAndEvents, deepDataAndEvents ) {
				var i, l, srcElements, destElements,
					clone = elem.cloneNode( true ),
					inPage = isAttached( elem );

				// Fix IE cloning issues
				if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
						!jQuery.isXMLDoc( elem ) ) {

					// We eschew jQuery#find here for performance reasons:
					// https://jsperf.com/getall-vs-sizzle/2
					destElements = getAll( clone );
					srcElements = getAll( elem );

					for ( i = 0, l = srcElements.length; i < l; i++ ) {
						fixInput( srcElements[ i ], destElements[ i ] );
					}
				}

				// Copy the events from the original to the clone
				if ( dataAndEvents ) {
					if ( deepDataAndEvents ) {
						srcElements = srcElements || getAll( elem );
						destElements = destElements || getAll( clone );

						for ( i = 0, l = srcElements.length; i < l; i++ ) {
							cloneCopyEvent( srcElements[ i ], destElements[ i ] );
						}
					} else {
						cloneCopyEvent( elem, clone );
					}
				}

				// Preserve script evaluation history
				destElements = getAll( clone, "script" );
				if ( destElements.length > 0 ) {
					setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
				}

				// Return the cloned set
				return clone;
			},

			cleanData: function( elems ) {
				var data, elem, type,
					special = jQuery.event.special,
					i = 0;

				for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
					if ( acceptData( elem ) ) {
						if ( ( data = elem[ dataPriv.expando ] ) ) {
							if ( data.events ) {
								for ( type in data.events ) {
									if ( special[ type ] ) {
										jQuery.event.remove( elem, type );

									// This is a shortcut to avoid jQuery.event.remove's overhead
									} else {
										jQuery.removeEvent( elem, type, data.handle );
									}
								}
							}

							// Support: Chrome <=35 - 45+
							// Assign undefined instead of using delete, see Data#remove
							elem[ dataPriv.expando ] = undefined;
						}
						if ( elem[ dataUser.expando ] ) {

							// Support: Chrome <=35 - 45+
							// Assign undefined instead of using delete, see Data#remove
							elem[ dataUser.expando ] = undefined;
						}
					}
				}
			}
		} );

		jQuery.fn.extend( {
			detach: function( selector ) {
				return remove( this, selector, true );
			},

			remove: function( selector ) {
				return remove( this, selector );
			},

			text: function( value ) {
				return access( this, function( value ) {
					return value === undefined ?
						jQuery.text( this ) :
						this.empty().each( function() {
							if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
								this.textContent = value;
							}
						} );
				}, null, value, arguments.length );
			},

			append: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						var target = manipulationTarget( this, elem );
						target.appendChild( elem );
					}
				} );
			},

			prepend: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						var target = manipulationTarget( this, elem );
						target.insertBefore( elem, target.firstChild );
					}
				} );
			},

			before: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.parentNode ) {
						this.parentNode.insertBefore( elem, this );
					}
				} );
			},

			after: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.parentNode ) {
						this.parentNode.insertBefore( elem, this.nextSibling );
					}
				} );
			},

			empty: function() {
				var elem,
					i = 0;

				for ( ; ( elem = this[ i ] ) != null; i++ ) {
					if ( elem.nodeType === 1 ) {

						// Prevent memory leaks
						jQuery.cleanData( getAll( elem, false ) );

						// Remove any remaining nodes
						elem.textContent = "";
					}
				}

				return this;
			},

			clone: function( dataAndEvents, deepDataAndEvents ) {
				dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
				deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

				return this.map( function() {
					return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
				} );
			},

			html: function( value ) {
				return access( this, function( value ) {
					var elem = this[ 0 ] || {},
						i = 0,
						l = this.length;

					if ( value === undefined && elem.nodeType === 1 ) {
						return elem.innerHTML;
					}

					// See if we can take a shortcut and just use innerHTML
					if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
						!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

						value = jQuery.htmlPrefilter( value );

						try {
							for ( ; i < l; i++ ) {
								elem = this[ i ] || {};

								// Remove element nodes and prevent memory leaks
								if ( elem.nodeType === 1 ) {
									jQuery.cleanData( getAll( elem, false ) );
									elem.innerHTML = value;
								}
							}

							elem = 0;

						// If using innerHTML throws an exception, use the fallback method
						} catch ( e ) {}
					}

					if ( elem ) {
						this.empty().append( value );
					}
				}, null, value, arguments.length );
			},

			replaceWith: function() {
				var ignored = [];

				// Make the changes, replacing each non-ignored context element with the new content
				return domManip( this, arguments, function( elem ) {
					var parent = this.parentNode;

					if ( jQuery.inArray( this, ignored ) < 0 ) {
						jQuery.cleanData( getAll( this ) );
						if ( parent ) {
							parent.replaceChild( elem, this );
						}
					}

				// Force callback invocation
				}, ignored );
			}
		} );

		jQuery.each( {
			appendTo: "append",
			prependTo: "prepend",
			insertBefore: "before",
			insertAfter: "after",
			replaceAll: "replaceWith"
		}, function( name, original ) {
			jQuery.fn[ name ] = function( selector ) {
				var elems,
					ret = [],
					insert = jQuery( selector ),
					last = insert.length - 1,
					i = 0;

				for ( ; i <= last; i++ ) {
					elems = i === last ? this : this.clone( true );
					jQuery( insert[ i ] )[ original ]( elems );

					// Support: Android <=4.0 only, PhantomJS 1 only
					// .get() because push.apply(_, arraylike) throws on ancient WebKit
					push.apply( ret, elems.get() );
				}

				return this.pushStack( ret );
			};
		} );
		var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

		var rcustomProp = /^--/;


		var getStyles = function( elem ) {

				// Support: IE <=11 only, Firefox <=30 (trac-15098, trac-14150)
				// IE throws on elements created in popups
				// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
				var view = elem.ownerDocument.defaultView;

				if ( !view || !view.opener ) {
					view = window;
				}

				return view.getComputedStyle( elem );
			};

		var swap = function( elem, options, callback ) {
			var ret, name,
				old = {};

			// Remember the old values, and insert the new ones
			for ( name in options ) {
				old[ name ] = elem.style[ name ];
				elem.style[ name ] = options[ name ];
			}

			ret = callback.call( elem );

			// Revert the old values
			for ( name in options ) {
				elem.style[ name ] = old[ name ];
			}

			return ret;
		};


		var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



		( function() {

			// Executing both pixelPosition & boxSizingReliable tests require only one layout
			// so they're executed at the same time to save the second computation.
			function computeStyleTests() {

				// This is a singleton, we need to execute it only once
				if ( !div ) {
					return;
				}

				container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
					"margin-top:1px;padding:0;border:0";
				div.style.cssText =
					"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
					"margin:auto;border:1px;padding:1px;" +
					"width:60%;top:1%";
				documentElement.appendChild( container ).appendChild( div );

				var divStyle = window.getComputedStyle( div );
				pixelPositionVal = divStyle.top !== "1%";

				// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
				reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

				// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
				// Some styles come back with percentage values, even though they shouldn't
				div.style.right = "60%";
				pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

				// Support: IE 9 - 11 only
				// Detect misreporting of content dimensions for box-sizing:border-box elements
				boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

				// Support: IE 9 only
				// Detect overflow:scroll screwiness (gh-3699)
				// Support: Chrome <=64
				// Don't get tricked when zoom affects offsetWidth (gh-4029)
				div.style.position = "absolute";
				scrollboxSizeVal = roundPixelMeasures( div.offsetWidth / 3 ) === 12;

				documentElement.removeChild( container );

				// Nullify the div so it wouldn't be stored in the memory and
				// it will also be a sign that checks already performed
				div = null;
			}

			function roundPixelMeasures( measure ) {
				return Math.round( parseFloat( measure ) );
			}

			var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
				reliableTrDimensionsVal, reliableMarginLeftVal,
				container = document.createElement( "div" ),
				div = document.createElement( "div" );

			// Finish early in limited (non-browser) environments
			if ( !div.style ) {
				return;
			}

			// Support: IE <=9 - 11 only
			// Style of cloned element affects source element cloned (trac-8908)
			div.style.backgroundClip = "content-box";
			div.cloneNode( true ).style.backgroundClip = "";
			support.clearCloneStyle = div.style.backgroundClip === "content-box";

			jQuery.extend( support, {
				boxSizingReliable: function() {
					computeStyleTests();
					return boxSizingReliableVal;
				},
				pixelBoxStyles: function() {
					computeStyleTests();
					return pixelBoxStylesVal;
				},
				pixelPosition: function() {
					computeStyleTests();
					return pixelPositionVal;
				},
				reliableMarginLeft: function() {
					computeStyleTests();
					return reliableMarginLeftVal;
				},
				scrollboxSize: function() {
					computeStyleTests();
					return scrollboxSizeVal;
				},

				// Support: IE 9 - 11+, Edge 15 - 18+
				// IE/Edge misreport `getComputedStyle` of table rows with width/height
				// set in CSS while `offset*` properties report correct values.
				// Behavior in IE 9 is more subtle than in newer versions & it passes
				// some versions of this test; make sure not to make it pass there!
				//
				// Support: Firefox 70+
				// Only Firefox includes border widths
				// in computed dimensions. (gh-4529)
				reliableTrDimensions: function() {
					var table, tr, trChild, trStyle;
					if ( reliableTrDimensionsVal == null ) {
						table = document.createElement( "table" );
						tr = document.createElement( "tr" );
						trChild = document.createElement( "div" );

						table.style.cssText = "position:absolute;left:-11111px;border-collapse:separate";
						tr.style.cssText = "box-sizing:content-box;border:1px solid";

						// Support: Chrome 86+
						// Height set through cssText does not get applied.
						// Computed height then comes back as 0.
						tr.style.height = "1px";
						trChild.style.height = "9px";

						// Support: Android 8 Chrome 86+
						// In our bodyBackground.html iframe,
						// display for all div elements is set to "inline",
						// which causes a problem only in Android 8 Chrome 86.
						// Ensuring the div is `display: block`
						// gets around this issue.
						trChild.style.display = "block";

						documentElement
							.appendChild( table )
							.appendChild( tr )
							.appendChild( trChild );

						trStyle = window.getComputedStyle( tr );
						reliableTrDimensionsVal = ( parseInt( trStyle.height, 10 ) +
							parseInt( trStyle.borderTopWidth, 10 ) +
							parseInt( trStyle.borderBottomWidth, 10 ) ) === tr.offsetHeight;

						documentElement.removeChild( table );
					}
					return reliableTrDimensionsVal;
				}
			} );
		} )();


		function curCSS( elem, name, computed ) {
			var width, minWidth, maxWidth, ret,
				isCustomProp = rcustomProp.test( name ),

				// Support: Firefox 51+
				// Retrieving style before computed somehow
				// fixes an issue with getting wrong values
				// on detached elements
				style = elem.style;

			computed = computed || getStyles( elem );

			// getPropertyValue is needed for:
			//   .css('filter') (IE 9 only, trac-12537)
			//   .css('--customProperty) (gh-3144)
			if ( computed ) {

				// Support: IE <=9 - 11+
				// IE only supports `"float"` in `getPropertyValue`; in computed styles
				// it's only available as `"cssFloat"`. We no longer modify properties
				// sent to `.css()` apart from camelCasing, so we need to check both.
				// Normally, this would create difference in behavior: if
				// `getPropertyValue` returns an empty string, the value returned
				// by `.css()` would be `undefined`. This is usually the case for
				// disconnected elements. However, in IE even disconnected elements
				// with no styles return `"none"` for `getPropertyValue( "float" )`
				ret = computed.getPropertyValue( name ) || computed[ name ];

				if ( isCustomProp && ret ) {

					// Support: Firefox 105+, Chrome <=105+
					// Spec requires trimming whitespace for custom properties (gh-4926).
					// Firefox only trims leading whitespace. Chrome just collapses
					// both leading & trailing whitespace to a single space.
					//
					// Fall back to `undefined` if empty string returned.
					// This collapses a missing definition with property defined
					// and set to an empty string but there's no standard API
					// allowing us to differentiate them without a performance penalty
					// and returning `undefined` aligns with older jQuery.
					//
					// rtrimCSS treats U+000D CARRIAGE RETURN and U+000C FORM FEED
					// as whitespace while CSS does not, but this is not a problem
					// because CSS preprocessing replaces them with U+000A LINE FEED
					// (which *is* CSS whitespace)
					// https://www.w3.org/TR/css-syntax-3/#input-preprocessing
					ret = ret.replace( rtrimCSS, "$1" ) || undefined;
				}

				if ( ret === "" && !isAttached( elem ) ) {
					ret = jQuery.style( elem, name );
				}

				// A tribute to the "awesome hack by Dean Edwards"
				// Android Browser returns percentage for some values,
				// but width seems to be reliably pixels.
				// This is against the CSSOM draft spec:
				// https://drafts.csswg.org/cssom/#resolved-values
				if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

					// Remember the original values
					width = style.width;
					minWidth = style.minWidth;
					maxWidth = style.maxWidth;

					// Put in the new values to get a computed value out
					style.minWidth = style.maxWidth = style.width = ret;
					ret = computed.width;

					// Revert the changed values
					style.width = width;
					style.minWidth = minWidth;
					style.maxWidth = maxWidth;
				}
			}

			return ret !== undefined ?

				// Support: IE <=9 - 11 only
				// IE returns zIndex value as an integer.
				ret + "" :
				ret;
		}


		function addGetHookIf( conditionFn, hookFn ) {

			// Define the hook, we'll check on the first run if it's really needed.
			return {
				get: function() {
					if ( conditionFn() ) {

						// Hook not needed (or it's not possible to use it due
						// to missing dependency), remove it.
						delete this.get;
						return;
					}

					// Hook needed; redefine it so that the support test is not executed again.
					return ( this.get = hookFn ).apply( this, arguments );
				}
			};
		}


		var cssPrefixes = [ "Webkit", "Moz", "ms" ],
			emptyStyle = document.createElement( "div" ).style,
			vendorProps = {};

		// Return a vendor-prefixed property or undefined
		function vendorPropName( name ) {

			// Check for vendor prefixed names
			var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
				i = cssPrefixes.length;

			while ( i-- ) {
				name = cssPrefixes[ i ] + capName;
				if ( name in emptyStyle ) {
					return name;
				}
			}
		}

		// Return a potentially-mapped jQuery.cssProps or vendor prefixed property
		function finalPropName( name ) {
			var final = jQuery.cssProps[ name ] || vendorProps[ name ];

			if ( final ) {
				return final;
			}
			if ( name in emptyStyle ) {
				return name;
			}
			return vendorProps[ name ] = vendorPropName( name ) || name;
		}


		var

			// Swappable if display is none or starts with table
			// except "table", "table-cell", or "table-caption"
			// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
			rdisplayswap = /^(none|table(?!-c[ea]).+)/,
			cssShow = { position: "absolute", visibility: "hidden", display: "block" },
			cssNormalTransform = {
				letterSpacing: "0",
				fontWeight: "400"
			};

		function setPositiveNumber( _elem, value, subtract ) {

			// Any relative (+/-) values have already been
			// normalized at this point
			var matches = rcssNum.exec( value );
			return matches ?

				// Guard against undefined "subtract", e.g., when used as in cssHooks
				Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
				value;
		}

		function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
			var i = dimension === "width" ? 1 : 0,
				extra = 0,
				delta = 0,
				marginDelta = 0;

			// Adjustment may not be necessary
			if ( box === ( isBorderBox ? "border" : "content" ) ) {
				return 0;
			}

			for ( ; i < 4; i += 2 ) {

				// Both box models exclude margin
				// Count margin delta separately to only add it after scroll gutter adjustment.
				// This is needed to make negative margins work with `outerHeight( true )` (gh-3982).
				if ( box === "margin" ) {
					marginDelta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
				}

				// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
				if ( !isBorderBox ) {

					// Add padding
					delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

					// For "border" or "margin", add border
					if ( box !== "padding" ) {
						delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

					// But still keep track of it otherwise
					} else {
						extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
					}

				// If we get here with a border-box (content + padding + border), we're seeking "content" or
				// "padding" or "margin"
				} else {

					// For "content", subtract padding
					if ( box === "content" ) {
						delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
					}

					// For "content" or "padding", subtract border
					if ( box !== "margin" ) {
						delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
					}
				}
			}

			// Account for positive content-box scroll gutter when requested by providing computedVal
			if ( !isBorderBox && computedVal >= 0 ) {

				// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
				// Assuming integer scroll gutter, subtract the rest and round down
				delta += Math.max( 0, Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					computedVal -
					delta -
					extra -
					0.5

				// If offsetWidth/offsetHeight is unknown, then we can't determine content-box scroll gutter
				// Use an explicit zero to avoid NaN (gh-3964)
				) ) || 0;
			}

			return delta + marginDelta;
		}

		function getWidthOrHeight( elem, dimension, extra ) {

			// Start with computed style
			var styles = getStyles( elem ),

				// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-4322).
				// Fake content-box until we know it's needed to know the true value.
				boxSizingNeeded = !support.boxSizingReliable() || extra,
				isBorderBox = boxSizingNeeded &&
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				valueIsBorderBox = isBorderBox,

				val = curCSS( elem, dimension, styles ),
				offsetProp = "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 );

			// Support: Firefox <=54
			// Return a confounding non-pixel value or feign ignorance, as appropriate.
			if ( rnumnonpx.test( val ) ) {
				if ( !extra ) {
					return val;
				}
				val = "auto";
			}


			// Support: IE 9 - 11 only
			// Use offsetWidth/offsetHeight for when box sizing is unreliable.
			// In those cases, the computed value can be trusted to be border-box.
			if ( ( !support.boxSizingReliable() && isBorderBox ||

				// Support: IE 10 - 11+, Edge 15 - 18+
				// IE/Edge misreport `getComputedStyle` of table rows with width/height
				// set in CSS while `offset*` properties report correct values.
				// Interestingly, in some cases IE 9 doesn't suffer from this issue.
				!support.reliableTrDimensions() && nodeName( elem, "tr" ) ||

				// Fall back to offsetWidth/offsetHeight when value is "auto"
				// This happens for inline elements with no explicit setting (gh-3571)
				val === "auto" ||

				// Support: Android <=4.1 - 4.3 only
				// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
				!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) &&

				// Make sure the element is visible & connected
				elem.getClientRects().length ) {

				isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

				// Where available, offsetWidth/offsetHeight approximate border box dimensions.
				// Where not available (e.g., SVG), assume unreliable box-sizing and interpret the
				// retrieved value as a content box dimension.
				valueIsBorderBox = offsetProp in elem;
				if ( valueIsBorderBox ) {
					val = elem[ offsetProp ];
				}
			}

			// Normalize "" and auto
			val = parseFloat( val ) || 0;

			// Adjust for the element's box model
			return ( val +
				boxModelAdjustment(
					elem,
					dimension,
					extra || ( isBorderBox ? "border" : "content" ),
					valueIsBorderBox,
					styles,

					// Provide the current computed size to request scroll gutter calculation (gh-3589)
					val
				)
			) + "px";
		}

		jQuery.extend( {

			// Add in style property hooks for overriding the default
			// behavior of getting and setting a style property
			cssHooks: {
				opacity: {
					get: function( elem, computed ) {
						if ( computed ) {

							// We should always get a number back from opacity
							var ret = curCSS( elem, "opacity" );
							return ret === "" ? "1" : ret;
						}
					}
				}
			},

			// Don't automatically add "px" to these possibly-unitless properties
			cssNumber: {
				animationIterationCount: true,
				aspectRatio: true,
				borderImageSlice: true,
				columnCount: true,
				flexGrow: true,
				flexShrink: true,
				fontWeight: true,
				gridArea: true,
				gridColumn: true,
				gridColumnEnd: true,
				gridColumnStart: true,
				gridRow: true,
				gridRowEnd: true,
				gridRowStart: true,
				lineHeight: true,
				opacity: true,
				order: true,
				orphans: true,
				scale: true,
				widows: true,
				zIndex: true,
				zoom: true,

				// SVG-related
				fillOpacity: true,
				floodOpacity: true,
				stopOpacity: true,
				strokeMiterlimit: true,
				strokeOpacity: true
			},

			// Add in properties whose names you wish to fix before
			// setting or getting the value
			cssProps: {},

			// Get and set the style property on a DOM Node
			style: function( elem, name, value, extra ) {

				// Don't set styles on text and comment nodes
				if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
					return;
				}

				// Make sure that we're working with the right name
				var ret, type, hooks,
					origName = camelCase( name ),
					isCustomProp = rcustomProp.test( name ),
					style = elem.style;

				// Make sure that we're working with the right name. We don't
				// want to query the value if it is a CSS custom property
				// since they are user-defined.
				if ( !isCustomProp ) {
					name = finalPropName( origName );
				}

				// Gets hook for the prefixed version, then unprefixed version
				hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

				// Check if we're setting a value
				if ( value !== undefined ) {
					type = typeof value;

					// Convert "+=" or "-=" to relative numbers (trac-7345)
					if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
						value = adjustCSS( elem, name, ret );

						// Fixes bug trac-9237
						type = "number";
					}

					// Make sure that null and NaN values aren't set (trac-7116)
					if ( value == null || value !== value ) {
						return;
					}

					// If a number was passed in, add the unit (except for certain CSS properties)
					// The isCustomProp check can be removed in jQuery 4.0 when we only auto-append
					// "px" to a few hardcoded values.
					if ( type === "number" && !isCustomProp ) {
						value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
					}

					// background-* props affect original clone's values
					if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
						style[ name ] = "inherit";
					}

					// If a hook was provided, use that value, otherwise just set the specified value
					if ( !hooks || !( "set" in hooks ) ||
						( value = hooks.set( elem, value, extra ) ) !== undefined ) {

						if ( isCustomProp ) {
							style.setProperty( name, value );
						} else {
							style[ name ] = value;
						}
					}

				} else {

					// If a hook was provided get the non-computed value from there
					if ( hooks && "get" in hooks &&
						( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

						return ret;
					}

					// Otherwise just get the value from the style object
					return style[ name ];
				}
			},

			css: function( elem, name, extra, styles ) {
				var val, num, hooks,
					origName = camelCase( name ),
					isCustomProp = rcustomProp.test( name );

				// Make sure that we're working with the right name. We don't
				// want to modify the value if it is a CSS custom property
				// since they are user-defined.
				if ( !isCustomProp ) {
					name = finalPropName( origName );
				}

				// Try prefixed name followed by the unprefixed name
				hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

				// If a hook was provided get the computed value from there
				if ( hooks && "get" in hooks ) {
					val = hooks.get( elem, true, extra );
				}

				// Otherwise, if a way to get the computed value exists, use that
				if ( val === undefined ) {
					val = curCSS( elem, name, styles );
				}

				// Convert "normal" to computed value
				if ( val === "normal" && name in cssNormalTransform ) {
					val = cssNormalTransform[ name ];
				}

				// Make numeric if forced or a qualifier was provided and val looks numeric
				if ( extra === "" || extra ) {
					num = parseFloat( val );
					return extra === true || isFinite( num ) ? num || 0 : val;
				}

				return val;
			}
		} );

		jQuery.each( [ "height", "width" ], function( _i, dimension ) {
			jQuery.cssHooks[ dimension ] = {
				get: function( elem, computed, extra ) {
					if ( computed ) {

						// Certain elements can have dimension info if we invisibly show them
						// but it must have a current display style that would benefit
						return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

							// Support: Safari 8+
							// Table columns in Safari have non-zero offsetWidth & zero
							// getBoundingClientRect().width unless display is changed.
							// Support: IE <=11 only
							// Running getBoundingClientRect on a disconnected node
							// in IE throws an error.
							( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
							swap( elem, cssShow, function() {
								return getWidthOrHeight( elem, dimension, extra );
							} ) :
							getWidthOrHeight( elem, dimension, extra );
					}
				},

				set: function( elem, value, extra ) {
					var matches,
						styles = getStyles( elem ),

						// Only read styles.position if the test has a chance to fail
						// to avoid forcing a reflow.
						scrollboxSizeBuggy = !support.scrollboxSize() &&
							styles.position === "absolute",

						// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-3991)
						boxSizingNeeded = scrollboxSizeBuggy || extra,
						isBorderBox = boxSizingNeeded &&
							jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
						subtract = extra ?
							boxModelAdjustment(
								elem,
								dimension,
								extra,
								isBorderBox,
								styles
							) :
							0;

					// Account for unreliable border-box dimensions by comparing offset* to computed and
					// faking a content-box to get border and padding (gh-3699)
					if ( isBorderBox && scrollboxSizeBuggy ) {
						subtract -= Math.ceil(
							elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
							parseFloat( styles[ dimension ] ) -
							boxModelAdjustment( elem, dimension, "border", false, styles ) -
							0.5
						);
					}

					// Convert to pixels if value adjustment is needed
					if ( subtract && ( matches = rcssNum.exec( value ) ) &&
						( matches[ 3 ] || "px" ) !== "px" ) {

						elem.style[ dimension ] = value;
						value = jQuery.css( elem, dimension );
					}

					return setPositiveNumber( elem, value, subtract );
				}
			};
		} );

		jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
			function( elem, computed ) {
				if ( computed ) {
					return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
						elem.getBoundingClientRect().left -
							swap( elem, { marginLeft: 0 }, function() {
								return elem.getBoundingClientRect().left;
							} )
					) + "px";
				}
			}
		);

		// These hooks are used by animate to expand properties
		jQuery.each( {
			margin: "",
			padding: "",
			border: "Width"
		}, function( prefix, suffix ) {
			jQuery.cssHooks[ prefix + suffix ] = {
				expand: function( value ) {
					var i = 0,
						expanded = {},

						// Assumes a single number if not a string
						parts = typeof value === "string" ? value.split( " " ) : [ value ];

					for ( ; i < 4; i++ ) {
						expanded[ prefix + cssExpand[ i ] + suffix ] =
							parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
					}

					return expanded;
				}
			};

			if ( prefix !== "margin" ) {
				jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
			}
		} );

		jQuery.fn.extend( {
			css: function( name, value ) {
				return access( this, function( elem, name, value ) {
					var styles, len,
						map = {},
						i = 0;

					if ( Array.isArray( name ) ) {
						styles = getStyles( elem );
						len = name.length;

						for ( ; i < len; i++ ) {
							map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
						}

						return map;
					}

					return value !== undefined ?
						jQuery.style( elem, name, value ) :
						jQuery.css( elem, name );
				}, name, value, arguments.length > 1 );
			}
		} );


		function Tween( elem, options, prop, end, easing ) {
			return new Tween.prototype.init( elem, options, prop, end, easing );
		}
		jQuery.Tween = Tween;

		Tween.prototype = {
			constructor: Tween,
			init: function( elem, options, prop, end, easing, unit ) {
				this.elem = elem;
				this.prop = prop;
				this.easing = easing || jQuery.easing._default;
				this.options = options;
				this.start = this.now = this.cur();
				this.end = end;
				this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
			},
			cur: function() {
				var hooks = Tween.propHooks[ this.prop ];

				return hooks && hooks.get ?
					hooks.get( this ) :
					Tween.propHooks._default.get( this );
			},
			run: function( percent ) {
				var eased,
					hooks = Tween.propHooks[ this.prop ];

				if ( this.options.duration ) {
					this.pos = eased = jQuery.easing[ this.easing ](
						percent, this.options.duration * percent, 0, 1, this.options.duration
					);
				} else {
					this.pos = eased = percent;
				}
				this.now = ( this.end - this.start ) * eased + this.start;

				if ( this.options.step ) {
					this.options.step.call( this.elem, this.now, this );
				}

				if ( hooks && hooks.set ) {
					hooks.set( this );
				} else {
					Tween.propHooks._default.set( this );
				}
				return this;
			}
		};

		Tween.prototype.init.prototype = Tween.prototype;

		Tween.propHooks = {
			_default: {
				get: function( tween ) {
					var result;

					// Use a property on the element directly when it is not a DOM element,
					// or when there is no matching style property that exists.
					if ( tween.elem.nodeType !== 1 ||
						tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
						return tween.elem[ tween.prop ];
					}

					// Passing an empty string as a 3rd parameter to .css will automatically
					// attempt a parseFloat and fallback to a string if the parse fails.
					// Simple values such as "10px" are parsed to Float;
					// complex values such as "rotate(1rad)" are returned as-is.
					result = jQuery.css( tween.elem, tween.prop, "" );

					// Empty strings, null, undefined and "auto" are converted to 0.
					return !result || result === "auto" ? 0 : result;
				},
				set: function( tween ) {

					// Use step hook for back compat.
					// Use cssHook if its there.
					// Use .style if available and use plain properties where available.
					if ( jQuery.fx.step[ tween.prop ] ) {
						jQuery.fx.step[ tween.prop ]( tween );
					} else if ( tween.elem.nodeType === 1 && (
						jQuery.cssHooks[ tween.prop ] ||
							tween.elem.style[ finalPropName( tween.prop ) ] != null ) ) {
						jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
					} else {
						tween.elem[ tween.prop ] = tween.now;
					}
				}
			}
		};

		// Support: IE <=9 only
		// Panic based approach to setting things on disconnected nodes
		Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
			set: function( tween ) {
				if ( tween.elem.nodeType && tween.elem.parentNode ) {
					tween.elem[ tween.prop ] = tween.now;
				}
			}
		};

		jQuery.easing = {
			linear: function( p ) {
				return p;
			},
			swing: function( p ) {
				return 0.5 - Math.cos( p * Math.PI ) / 2;
			},
			_default: "swing"
		};

		jQuery.fx = Tween.prototype.init;

		// Back compat <1.8 extension point
		jQuery.fx.step = {};




		var
			fxNow, inProgress,
			rfxtypes = /^(?:toggle|show|hide)$/,
			rrun = /queueHooks$/;

		function schedule() {
			if ( inProgress ) {
				if ( document.hidden === false && window.requestAnimationFrame ) {
					window.requestAnimationFrame( schedule );
				} else {
					window.setTimeout( schedule, jQuery.fx.interval );
				}

				jQuery.fx.tick();
			}
		}

		// Animations created synchronously will run synchronously
		function createFxNow() {
			window.setTimeout( function() {
				fxNow = undefined;
			} );
			return ( fxNow = Date.now() );
		}

		// Generate parameters to create a standard animation
		function genFx( type, includeWidth ) {
			var which,
				i = 0,
				attrs = { height: type };

			// If we include width, step value is 1 to do all cssExpand values,
			// otherwise step value is 2 to skip over Left and Right
			includeWidth = includeWidth ? 1 : 0;
			for ( ; i < 4; i += 2 - includeWidth ) {
				which = cssExpand[ i ];
				attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
			}

			if ( includeWidth ) {
				attrs.opacity = attrs.width = type;
			}

			return attrs;
		}

		function createTween( value, prop, animation ) {
			var tween,
				collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
				index = 0,
				length = collection.length;
			for ( ; index < length; index++ ) {
				if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

					// We're done with this property
					return tween;
				}
			}
		}

		function defaultPrefilter( elem, props, opts ) {
			var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
				isBox = "width" in props || "height" in props,
				anim = this,
				orig = {},
				style = elem.style,
				hidden = elem.nodeType && isHiddenWithinTree( elem ),
				dataShow = dataPriv.get( elem, "fxshow" );

			// Queue-skipping animations hijack the fx hooks
			if ( !opts.queue ) {
				hooks = jQuery._queueHooks( elem, "fx" );
				if ( hooks.unqueued == null ) {
					hooks.unqueued = 0;
					oldfire = hooks.empty.fire;
					hooks.empty.fire = function() {
						if ( !hooks.unqueued ) {
							oldfire();
						}
					};
				}
				hooks.unqueued++;

				anim.always( function() {

					// Ensure the complete handler is called before this completes
					anim.always( function() {
						hooks.unqueued--;
						if ( !jQuery.queue( elem, "fx" ).length ) {
							hooks.empty.fire();
						}
					} );
				} );
			}

			// Detect show/hide animations
			for ( prop in props ) {
				value = props[ prop ];
				if ( rfxtypes.test( value ) ) {
					delete props[ prop ];
					toggle = toggle || value === "toggle";
					if ( value === ( hidden ? "hide" : "show" ) ) {

						// Pretend to be hidden if this is a "show" and
						// there is still data from a stopped show/hide
						if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
							hidden = true;

						// Ignore all other no-op show/hide data
						} else {
							continue;
						}
					}
					orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
				}
			}

			// Bail out if this is a no-op like .hide().hide()
			propTween = !jQuery.isEmptyObject( props );
			if ( !propTween && jQuery.isEmptyObject( orig ) ) {
				return;
			}

			// Restrict "overflow" and "display" styles during box animations
			if ( isBox && elem.nodeType === 1 ) {

				// Support: IE <=9 - 11, Edge 12 - 15
				// Record all 3 overflow attributes because IE does not infer the shorthand
				// from identically-valued overflowX and overflowY and Edge just mirrors
				// the overflowX value there.
				opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

				// Identify a display type, preferring old show/hide data over the CSS cascade
				restoreDisplay = dataShow && dataShow.display;
				if ( restoreDisplay == null ) {
					restoreDisplay = dataPriv.get( elem, "display" );
				}
				display = jQuery.css( elem, "display" );
				if ( display === "none" ) {
					if ( restoreDisplay ) {
						display = restoreDisplay;
					} else {

						// Get nonempty value(s) by temporarily forcing visibility
						showHide( [ elem ], true );
						restoreDisplay = elem.style.display || restoreDisplay;
						display = jQuery.css( elem, "display" );
						showHide( [ elem ] );
					}
				}

				// Animate inline elements as inline-block
				if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
					if ( jQuery.css( elem, "float" ) === "none" ) {

						// Restore the original display value at the end of pure show/hide animations
						if ( !propTween ) {
							anim.done( function() {
								style.display = restoreDisplay;
							} );
							if ( restoreDisplay == null ) {
								display = style.display;
								restoreDisplay = display === "none" ? "" : display;
							}
						}
						style.display = "inline-block";
					}
				}
			}

			if ( opts.overflow ) {
				style.overflow = "hidden";
				anim.always( function() {
					style.overflow = opts.overflow[ 0 ];
					style.overflowX = opts.overflow[ 1 ];
					style.overflowY = opts.overflow[ 2 ];
				} );
			}

			// Implement show/hide animations
			propTween = false;
			for ( prop in orig ) {

				// General show/hide setup for this element animation
				if ( !propTween ) {
					if ( dataShow ) {
						if ( "hidden" in dataShow ) {
							hidden = dataShow.hidden;
						}
					} else {
						dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
					}

					// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
					if ( toggle ) {
						dataShow.hidden = !hidden;
					}

					// Show elements before animating them
					if ( hidden ) {
						showHide( [ elem ], true );
					}

					/* eslint-disable no-loop-func */

					anim.done( function() {

						/* eslint-enable no-loop-func */

						// The final step of a "hide" animation is actually hiding the element
						if ( !hidden ) {
							showHide( [ elem ] );
						}
						dataPriv.remove( elem, "fxshow" );
						for ( prop in orig ) {
							jQuery.style( elem, prop, orig[ prop ] );
						}
					} );
				}

				// Per-property setup
				propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
				if ( !( prop in dataShow ) ) {
					dataShow[ prop ] = propTween.start;
					if ( hidden ) {
						propTween.end = propTween.start;
						propTween.start = 0;
					}
				}
			}
		}

		function propFilter( props, specialEasing ) {
			var index, name, easing, value, hooks;

			// camelCase, specialEasing and expand cssHook pass
			for ( index in props ) {
				name = camelCase( index );
				easing = specialEasing[ name ];
				value = props[ index ];
				if ( Array.isArray( value ) ) {
					easing = value[ 1 ];
					value = props[ index ] = value[ 0 ];
				}

				if ( index !== name ) {
					props[ name ] = value;
					delete props[ index ];
				}

				hooks = jQuery.cssHooks[ name ];
				if ( hooks && "expand" in hooks ) {
					value = hooks.expand( value );
					delete props[ name ];

					// Not quite $.extend, this won't overwrite existing keys.
					// Reusing 'index' because we have the correct "name"
					for ( index in value ) {
						if ( !( index in props ) ) {
							props[ index ] = value[ index ];
							specialEasing[ index ] = easing;
						}
					}
				} else {
					specialEasing[ name ] = easing;
				}
			}
		}

		function Animation( elem, properties, options ) {
			var result,
				stopped,
				index = 0,
				length = Animation.prefilters.length,
				deferred = jQuery.Deferred().always( function() {

					// Don't match elem in the :animated selector
					delete tick.elem;
				} ),
				tick = function() {
					if ( stopped ) {
						return false;
					}
					var currentTime = fxNow || createFxNow(),
						remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

						// Support: Android 2.3 only
						// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (trac-12497)
						temp = remaining / animation.duration || 0,
						percent = 1 - temp,
						index = 0,
						length = animation.tweens.length;

					for ( ; index < length; index++ ) {
						animation.tweens[ index ].run( percent );
					}

					deferred.notifyWith( elem, [ animation, percent, remaining ] );

					// If there's more to do, yield
					if ( percent < 1 && length ) {
						return remaining;
					}

					// If this was an empty animation, synthesize a final progress notification
					if ( !length ) {
						deferred.notifyWith( elem, [ animation, 1, 0 ] );
					}

					// Resolve the animation and report its conclusion
					deferred.resolveWith( elem, [ animation ] );
					return false;
				},
				animation = deferred.promise( {
					elem: elem,
					props: jQuery.extend( {}, properties ),
					opts: jQuery.extend( true, {
						specialEasing: {},
						easing: jQuery.easing._default
					}, options ),
					originalProperties: properties,
					originalOptions: options,
					startTime: fxNow || createFxNow(),
					duration: options.duration,
					tweens: [],
					createTween: function( prop, end ) {
						var tween = jQuery.Tween( elem, animation.opts, prop, end,
							animation.opts.specialEasing[ prop ] || animation.opts.easing );
						animation.tweens.push( tween );
						return tween;
					},
					stop: function( gotoEnd ) {
						var index = 0,

							// If we are going to the end, we want to run all the tweens
							// otherwise we skip this part
							length = gotoEnd ? animation.tweens.length : 0;
						if ( stopped ) {
							return this;
						}
						stopped = true;
						for ( ; index < length; index++ ) {
							animation.tweens[ index ].run( 1 );
						}

						// Resolve when we played the last frame; otherwise, reject
						if ( gotoEnd ) {
							deferred.notifyWith( elem, [ animation, 1, 0 ] );
							deferred.resolveWith( elem, [ animation, gotoEnd ] );
						} else {
							deferred.rejectWith( elem, [ animation, gotoEnd ] );
						}
						return this;
					}
				} ),
				props = animation.props;

			propFilter( props, animation.opts.specialEasing );

			for ( ; index < length; index++ ) {
				result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
				if ( result ) {
					if ( isFunction( result.stop ) ) {
						jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
							result.stop.bind( result );
					}
					return result;
				}
			}

			jQuery.map( props, createTween, animation );

			if ( isFunction( animation.opts.start ) ) {
				animation.opts.start.call( elem, animation );
			}

			// Attach callbacks from options
			animation
				.progress( animation.opts.progress )
				.done( animation.opts.done, animation.opts.complete )
				.fail( animation.opts.fail )
				.always( animation.opts.always );

			jQuery.fx.timer(
				jQuery.extend( tick, {
					elem: elem,
					anim: animation,
					queue: animation.opts.queue
				} )
			);

			return animation;
		}

		jQuery.Animation = jQuery.extend( Animation, {

			tweeners: {
				"*": [ function( prop, value ) {
					var tween = this.createTween( prop, value );
					adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
					return tween;
				} ]
			},

			tweener: function( props, callback ) {
				if ( isFunction( props ) ) {
					callback = props;
					props = [ "*" ];
				} else {
					props = props.match( rnothtmlwhite );
				}

				var prop,
					index = 0,
					length = props.length;

				for ( ; index < length; index++ ) {
					prop = props[ index ];
					Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
					Animation.tweeners[ prop ].unshift( callback );
				}
			},

			prefilters: [ defaultPrefilter ],

			prefilter: function( callback, prepend ) {
				if ( prepend ) {
					Animation.prefilters.unshift( callback );
				} else {
					Animation.prefilters.push( callback );
				}
			}
		} );

		jQuery.speed = function( speed, easing, fn ) {
			var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
				complete: fn || !fn && easing ||
					isFunction( speed ) && speed,
				duration: speed,
				easing: fn && easing || easing && !isFunction( easing ) && easing
			};

			// Go to the end state if fx are off
			if ( jQuery.fx.off ) {
				opt.duration = 0;

			} else {
				if ( typeof opt.duration !== "number" ) {
					if ( opt.duration in jQuery.fx.speeds ) {
						opt.duration = jQuery.fx.speeds[ opt.duration ];

					} else {
						opt.duration = jQuery.fx.speeds._default;
					}
				}
			}

			// Normalize opt.queue - true/undefined/null -> "fx"
			if ( opt.queue == null || opt.queue === true ) {
				opt.queue = "fx";
			}

			// Queueing
			opt.old = opt.complete;

			opt.complete = function() {
				if ( isFunction( opt.old ) ) {
					opt.old.call( this );
				}

				if ( opt.queue ) {
					jQuery.dequeue( this, opt.queue );
				}
			};

			return opt;
		};

		jQuery.fn.extend( {
			fadeTo: function( speed, to, easing, callback ) {

				// Show any hidden elements after setting opacity to 0
				return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

					// Animate to the value specified
					.end().animate( { opacity: to }, speed, easing, callback );
			},
			animate: function( prop, speed, easing, callback ) {
				var empty = jQuery.isEmptyObject( prop ),
					optall = jQuery.speed( speed, easing, callback ),
					doAnimation = function() {

						// Operate on a copy of prop so per-property easing won't be lost
						var anim = Animation( this, jQuery.extend( {}, prop ), optall );

						// Empty animations, or finishing resolves immediately
						if ( empty || dataPriv.get( this, "finish" ) ) {
							anim.stop( true );
						}
					};

				doAnimation.finish = doAnimation;

				return empty || optall.queue === false ?
					this.each( doAnimation ) :
					this.queue( optall.queue, doAnimation );
			},
			stop: function( type, clearQueue, gotoEnd ) {
				var stopQueue = function( hooks ) {
					var stop = hooks.stop;
					delete hooks.stop;
					stop( gotoEnd );
				};

				if ( typeof type !== "string" ) {
					gotoEnd = clearQueue;
					clearQueue = type;
					type = undefined;
				}
				if ( clearQueue ) {
					this.queue( type || "fx", [] );
				}

				return this.each( function() {
					var dequeue = true,
						index = type != null && type + "queueHooks",
						timers = jQuery.timers,
						data = dataPriv.get( this );

					if ( index ) {
						if ( data[ index ] && data[ index ].stop ) {
							stopQueue( data[ index ] );
						}
					} else {
						for ( index in data ) {
							if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
								stopQueue( data[ index ] );
							}
						}
					}

					for ( index = timers.length; index--; ) {
						if ( timers[ index ].elem === this &&
							( type == null || timers[ index ].queue === type ) ) {

							timers[ index ].anim.stop( gotoEnd );
							dequeue = false;
							timers.splice( index, 1 );
						}
					}

					// Start the next in the queue if the last step wasn't forced.
					// Timers currently will call their complete callbacks, which
					// will dequeue but only if they were gotoEnd.
					if ( dequeue || !gotoEnd ) {
						jQuery.dequeue( this, type );
					}
				} );
			},
			finish: function( type ) {
				if ( type !== false ) {
					type = type || "fx";
				}
				return this.each( function() {
					var index,
						data = dataPriv.get( this ),
						queue = data[ type + "queue" ],
						hooks = data[ type + "queueHooks" ],
						timers = jQuery.timers,
						length = queue ? queue.length : 0;

					// Enable finishing flag on private data
					data.finish = true;

					// Empty the queue first
					jQuery.queue( this, type, [] );

					if ( hooks && hooks.stop ) {
						hooks.stop.call( this, true );
					}

					// Look for any active animations, and finish them
					for ( index = timers.length; index--; ) {
						if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
							timers[ index ].anim.stop( true );
							timers.splice( index, 1 );
						}
					}

					// Look for any animations in the old queue and finish them
					for ( index = 0; index < length; index++ ) {
						if ( queue[ index ] && queue[ index ].finish ) {
							queue[ index ].finish.call( this );
						}
					}

					// Turn off finishing flag
					delete data.finish;
				} );
			}
		} );

		jQuery.each( [ "toggle", "show", "hide" ], function( _i, name ) {
			var cssFn = jQuery.fn[ name ];
			jQuery.fn[ name ] = function( speed, easing, callback ) {
				return speed == null || typeof speed === "boolean" ?
					cssFn.apply( this, arguments ) :
					this.animate( genFx( name, true ), speed, easing, callback );
			};
		} );

		// Generate shortcuts for custom animations
		jQuery.each( {
			slideDown: genFx( "show" ),
			slideUp: genFx( "hide" ),
			slideToggle: genFx( "toggle" ),
			fadeIn: { opacity: "show" },
			fadeOut: { opacity: "hide" },
			fadeToggle: { opacity: "toggle" }
		}, function( name, props ) {
			jQuery.fn[ name ] = function( speed, easing, callback ) {
				return this.animate( props, speed, easing, callback );
			};
		} );

		jQuery.timers = [];
		jQuery.fx.tick = function() {
			var timer,
				i = 0,
				timers = jQuery.timers;

			fxNow = Date.now();

			for ( ; i < timers.length; i++ ) {
				timer = timers[ i ];

				// Run the timer and safely remove it when done (allowing for external removal)
				if ( !timer() && timers[ i ] === timer ) {
					timers.splice( i--, 1 );
				}
			}

			if ( !timers.length ) {
				jQuery.fx.stop();
			}
			fxNow = undefined;
		};

		jQuery.fx.timer = function( timer ) {
			jQuery.timers.push( timer );
			jQuery.fx.start();
		};

		jQuery.fx.interval = 13;
		jQuery.fx.start = function() {
			if ( inProgress ) {
				return;
			}

			inProgress = true;
			schedule();
		};

		jQuery.fx.stop = function() {
			inProgress = null;
		};

		jQuery.fx.speeds = {
			slow: 600,
			fast: 200,

			// Default speed
			_default: 400
		};


		// Based off of the plugin by Clint Helfers, with permission.
		jQuery.fn.delay = function( time, type ) {
			time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
			type = type || "fx";

			return this.queue( type, function( next, hooks ) {
				var timeout = window.setTimeout( next, time );
				hooks.stop = function() {
					window.clearTimeout( timeout );
				};
			} );
		};


		( function() {
			var input = document.createElement( "input" ),
				select = document.createElement( "select" ),
				opt = select.appendChild( document.createElement( "option" ) );

			input.type = "checkbox";

			// Support: Android <=4.3 only
			// Default value for a checkbox should be "on"
			support.checkOn = input.value !== "";

			// Support: IE <=11 only
			// Must access selectedIndex to make default options select
			support.optSelected = opt.selected;

			// Support: IE <=11 only
			// An input loses its value after becoming a radio
			input = document.createElement( "input" );
			input.value = "t";
			input.type = "radio";
			support.radioValue = input.value === "t";
		} )();


		var boolHook,
			attrHandle = jQuery.expr.attrHandle;

		jQuery.fn.extend( {
			attr: function( name, value ) {
				return access( this, jQuery.attr, name, value, arguments.length > 1 );
			},

			removeAttr: function( name ) {
				return this.each( function() {
					jQuery.removeAttr( this, name );
				} );
			}
		} );

		jQuery.extend( {
			attr: function( elem, name, value ) {
				var ret, hooks,
					nType = elem.nodeType;

				// Don't get/set attributes on text, comment and attribute nodes
				if ( nType === 3 || nType === 8 || nType === 2 ) {
					return;
				}

				// Fallback to prop when attributes are not supported
				if ( typeof elem.getAttribute === "undefined" ) {
					return jQuery.prop( elem, name, value );
				}

				// Attribute hooks are determined by the lowercase version
				// Grab necessary hook if one is defined
				if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
					hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
						( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
				}

				if ( value !== undefined ) {
					if ( value === null ) {
						jQuery.removeAttr( elem, name );
						return;
					}

					if ( hooks && "set" in hooks &&
						( ret = hooks.set( elem, value, name ) ) !== undefined ) {
						return ret;
					}

					elem.setAttribute( name, value + "" );
					return value;
				}

				if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
					return ret;
				}

				ret = jQuery.find.attr( elem, name );

				// Non-existent attributes return null, we normalize to undefined
				return ret == null ? undefined : ret;
			},

			attrHooks: {
				type: {
					set: function( elem, value ) {
						if ( !support.radioValue && value === "radio" &&
							nodeName( elem, "input" ) ) {
							var val = elem.value;
							elem.setAttribute( "type", value );
							if ( val ) {
								elem.value = val;
							}
							return value;
						}
					}
				}
			},

			removeAttr: function( elem, value ) {
				var name,
					i = 0,

					// Attribute names can contain non-HTML whitespace characters
					// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
					attrNames = value && value.match( rnothtmlwhite );

				if ( attrNames && elem.nodeType === 1 ) {
					while ( ( name = attrNames[ i++ ] ) ) {
						elem.removeAttribute( name );
					}
				}
			}
		} );

		// Hooks for boolean attributes
		boolHook = {
			set: function( elem, value, name ) {
				if ( value === false ) {

					// Remove boolean attributes when set to false
					jQuery.removeAttr( elem, name );
				} else {
					elem.setAttribute( name, name );
				}
				return name;
			}
		};

		jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( _i, name ) {
			var getter = attrHandle[ name ] || jQuery.find.attr;

			attrHandle[ name ] = function( elem, name, isXML ) {
				var ret, handle,
					lowercaseName = name.toLowerCase();

				if ( !isXML ) {

					// Avoid an infinite loop by temporarily removing this function from the getter
					handle = attrHandle[ lowercaseName ];
					attrHandle[ lowercaseName ] = ret;
					ret = getter( elem, name, isXML ) != null ?
						lowercaseName :
						null;
					attrHandle[ lowercaseName ] = handle;
				}
				return ret;
			};
		} );




		var rfocusable = /^(?:input|select|textarea|button)$/i,
			rclickable = /^(?:a|area)$/i;

		jQuery.fn.extend( {
			prop: function( name, value ) {
				return access( this, jQuery.prop, name, value, arguments.length > 1 );
			},

			removeProp: function( name ) {
				return this.each( function() {
					delete this[ jQuery.propFix[ name ] || name ];
				} );
			}
		} );

		jQuery.extend( {
			prop: function( elem, name, value ) {
				var ret, hooks,
					nType = elem.nodeType;

				// Don't get/set properties on text, comment and attribute nodes
				if ( nType === 3 || nType === 8 || nType === 2 ) {
					return;
				}

				if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

					// Fix name and attach hooks
					name = jQuery.propFix[ name ] || name;
					hooks = jQuery.propHooks[ name ];
				}

				if ( value !== undefined ) {
					if ( hooks && "set" in hooks &&
						( ret = hooks.set( elem, value, name ) ) !== undefined ) {
						return ret;
					}

					return ( elem[ name ] = value );
				}

				if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
					return ret;
				}

				return elem[ name ];
			},

			propHooks: {
				tabIndex: {
					get: function( elem ) {

						// Support: IE <=9 - 11 only
						// elem.tabIndex doesn't always return the
						// correct value when it hasn't been explicitly set
						// Use proper attribute retrieval (trac-12072)
						var tabindex = jQuery.find.attr( elem, "tabindex" );

						if ( tabindex ) {
							return parseInt( tabindex, 10 );
						}

						if (
							rfocusable.test( elem.nodeName ) ||
							rclickable.test( elem.nodeName ) &&
							elem.href
						) {
							return 0;
						}

						return -1;
					}
				}
			},

			propFix: {
				"for": "htmlFor",
				"class": "className"
			}
		} );

		// Support: IE <=11 only
		// Accessing the selectedIndex property
		// forces the browser to respect setting selected
		// on the option
		// The getter ensures a default option is selected
		// when in an optgroup
		// eslint rule "no-unused-expressions" is disabled for this code
		// since it considers such accessions noop
		if ( !support.optSelected ) {
			jQuery.propHooks.selected = {
				get: function( elem ) {

					/* eslint no-unused-expressions: "off" */

					var parent = elem.parentNode;
					if ( parent && parent.parentNode ) {
						parent.parentNode.selectedIndex;
					}
					return null;
				},
				set: function( elem ) {

					/* eslint no-unused-expressions: "off" */

					var parent = elem.parentNode;
					if ( parent ) {
						parent.selectedIndex;

						if ( parent.parentNode ) {
							parent.parentNode.selectedIndex;
						}
					}
				}
			};
		}

		jQuery.each( [
			"tabIndex",
			"readOnly",
			"maxLength",
			"cellSpacing",
			"cellPadding",
			"rowSpan",
			"colSpan",
			"useMap",
			"frameBorder",
			"contentEditable"
		], function() {
			jQuery.propFix[ this.toLowerCase() ] = this;
		} );




			// Strip and collapse whitespace according to HTML spec
			// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
			function stripAndCollapse( value ) {
				var tokens = value.match( rnothtmlwhite ) || [];
				return tokens.join( " " );
			}


		function getClass( elem ) {
			return elem.getAttribute && elem.getAttribute( "class" ) || "";
		}

		function classesToArray( value ) {
			if ( Array.isArray( value ) ) {
				return value;
			}
			if ( typeof value === "string" ) {
				return value.match( rnothtmlwhite ) || [];
			}
			return [];
		}

		jQuery.fn.extend( {
			addClass: function( value ) {
				var classNames, cur, curValue, className, i, finalValue;

				if ( isFunction( value ) ) {
					return this.each( function( j ) {
						jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
					} );
				}

				classNames = classesToArray( value );

				if ( classNames.length ) {
					return this.each( function() {
						curValue = getClass( this );
						cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

						if ( cur ) {
							for ( i = 0; i < classNames.length; i++ ) {
								className = classNames[ i ];
								if ( cur.indexOf( " " + className + " " ) < 0 ) {
									cur += className + " ";
								}
							}

							// Only assign if different to avoid unneeded rendering.
							finalValue = stripAndCollapse( cur );
							if ( curValue !== finalValue ) {
								this.setAttribute( "class", finalValue );
							}
						}
					} );
				}

				return this;
			},

			removeClass: function( value ) {
				var classNames, cur, curValue, className, i, finalValue;

				if ( isFunction( value ) ) {
					return this.each( function( j ) {
						jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
					} );
				}

				if ( !arguments.length ) {
					return this.attr( "class", "" );
				}

				classNames = classesToArray( value );

				if ( classNames.length ) {
					return this.each( function() {
						curValue = getClass( this );

						// This expression is here for better compressibility (see addClass)
						cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

						if ( cur ) {
							for ( i = 0; i < classNames.length; i++ ) {
								className = classNames[ i ];

								// Remove *all* instances
								while ( cur.indexOf( " " + className + " " ) > -1 ) {
									cur = cur.replace( " " + className + " ", " " );
								}
							}

							// Only assign if different to avoid unneeded rendering.
							finalValue = stripAndCollapse( cur );
							if ( curValue !== finalValue ) {
								this.setAttribute( "class", finalValue );
							}
						}
					} );
				}

				return this;
			},

			toggleClass: function( value, stateVal ) {
				var classNames, className, i, self,
					type = typeof value,
					isValidValue = type === "string" || Array.isArray( value );

				if ( isFunction( value ) ) {
					return this.each( function( i ) {
						jQuery( this ).toggleClass(
							value.call( this, i, getClass( this ), stateVal ),
							stateVal
						);
					} );
				}

				if ( typeof stateVal === "boolean" && isValidValue ) {
					return stateVal ? this.addClass( value ) : this.removeClass( value );
				}

				classNames = classesToArray( value );

				return this.each( function() {
					if ( isValidValue ) {

						// Toggle individual class names
						self = jQuery( this );

						for ( i = 0; i < classNames.length; i++ ) {
							className = classNames[ i ];

							// Check each className given, space separated list
							if ( self.hasClass( className ) ) {
								self.removeClass( className );
							} else {
								self.addClass( className );
							}
						}

					// Toggle whole class name
					} else if ( value === undefined || type === "boolean" ) {
						className = getClass( this );
						if ( className ) {

							// Store className if set
							dataPriv.set( this, "__className__", className );
						}

						// If the element has a class name or if we're passed `false`,
						// then remove the whole classname (if there was one, the above saved it).
						// Otherwise bring back whatever was previously saved (if anything),
						// falling back to the empty string if nothing was stored.
						if ( this.setAttribute ) {
							this.setAttribute( "class",
								className || value === false ?
									"" :
									dataPriv.get( this, "__className__" ) || ""
							);
						}
					}
				} );
			},

			hasClass: function( selector ) {
				var className, elem,
					i = 0;

				className = " " + selector + " ";
				while ( ( elem = this[ i++ ] ) ) {
					if ( elem.nodeType === 1 &&
						( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
						return true;
					}
				}

				return false;
			}
		} );




		var rreturn = /\r/g;

		jQuery.fn.extend( {
			val: function( value ) {
				var hooks, ret, valueIsFunction,
					elem = this[ 0 ];

				if ( !arguments.length ) {
					if ( elem ) {
						hooks = jQuery.valHooks[ elem.type ] ||
							jQuery.valHooks[ elem.nodeName.toLowerCase() ];

						if ( hooks &&
							"get" in hooks &&
							( ret = hooks.get( elem, "value" ) ) !== undefined
						) {
							return ret;
						}

						ret = elem.value;

						// Handle most common string cases
						if ( typeof ret === "string" ) {
							return ret.replace( rreturn, "" );
						}

						// Handle cases where value is null/undef or number
						return ret == null ? "" : ret;
					}

					return;
				}

				valueIsFunction = isFunction( value );

				return this.each( function( i ) {
					var val;

					if ( this.nodeType !== 1 ) {
						return;
					}

					if ( valueIsFunction ) {
						val = value.call( this, i, jQuery( this ).val() );
					} else {
						val = value;
					}

					// Treat null/undefined as ""; convert numbers to string
					if ( val == null ) {
						val = "";

					} else if ( typeof val === "number" ) {
						val += "";

					} else if ( Array.isArray( val ) ) {
						val = jQuery.map( val, function( value ) {
							return value == null ? "" : value + "";
						} );
					}

					hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

					// If set returns undefined, fall back to normal setting
					if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
						this.value = val;
					}
				} );
			}
		} );

		jQuery.extend( {
			valHooks: {
				option: {
					get: function( elem ) {

						var val = jQuery.find.attr( elem, "value" );
						return val != null ?
							val :

							// Support: IE <=10 - 11 only
							// option.text throws exceptions (trac-14686, trac-14858)
							// Strip and collapse whitespace
							// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
							stripAndCollapse( jQuery.text( elem ) );
					}
				},
				select: {
					get: function( elem ) {
						var value, option, i,
							options = elem.options,
							index = elem.selectedIndex,
							one = elem.type === "select-one",
							values = one ? null : [],
							max = one ? index + 1 : options.length;

						if ( index < 0 ) {
							i = max;

						} else {
							i = one ? index : 0;
						}

						// Loop through all the selected options
						for ( ; i < max; i++ ) {
							option = options[ i ];

							// Support: IE <=9 only
							// IE8-9 doesn't update selected after form reset (trac-2551)
							if ( ( option.selected || i === index ) &&

									// Don't return options that are disabled or in a disabled optgroup
									!option.disabled &&
									( !option.parentNode.disabled ||
										!nodeName( option.parentNode, "optgroup" ) ) ) {

								// Get the specific value for the option
								value = jQuery( option ).val();

								// We don't need an array for one selects
								if ( one ) {
									return value;
								}

								// Multi-Selects return an array
								values.push( value );
							}
						}

						return values;
					},

					set: function( elem, value ) {
						var optionSet, option,
							options = elem.options,
							values = jQuery.makeArray( value ),
							i = options.length;

						while ( i-- ) {
							option = options[ i ];

							/* eslint-disable no-cond-assign */

							if ( option.selected =
								jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
							) {
								optionSet = true;
							}

							/* eslint-enable no-cond-assign */
						}

						// Force browsers to behave consistently when non-matching value is set
						if ( !optionSet ) {
							elem.selectedIndex = -1;
						}
						return values;
					}
				}
			}
		} );

		// Radios and checkboxes getter/setter
		jQuery.each( [ "radio", "checkbox" ], function() {
			jQuery.valHooks[ this ] = {
				set: function( elem, value ) {
					if ( Array.isArray( value ) ) {
						return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
					}
				}
			};
			if ( !support.checkOn ) {
				jQuery.valHooks[ this ].get = function( elem ) {
					return elem.getAttribute( "value" ) === null ? "on" : elem.value;
				};
			}
		} );




		// Return jQuery for attributes-only inclusion
		var location = window.location;

		var nonce = { guid: Date.now() };

		var rquery = ( /\?/ );



		// Cross-browser xml parsing
		jQuery.parseXML = function( data ) {
			var xml, parserErrorElem;
			if ( !data || typeof data !== "string" ) {
				return null;
			}

			// Support: IE 9 - 11 only
			// IE throws on parseFromString with invalid input.
			try {
				xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
			} catch ( e ) {}

			parserErrorElem = xml && xml.getElementsByTagName( "parsererror" )[ 0 ];
			if ( !xml || parserErrorElem ) {
				jQuery.error( "Invalid XML: " + (
					parserErrorElem ?
						jQuery.map( parserErrorElem.childNodes, function( el ) {
							return el.textContent;
						} ).join( "\n" ) :
						data
				) );
			}
			return xml;
		};


		var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
			stopPropagationCallback = function( e ) {
				e.stopPropagation();
			};

		jQuery.extend( jQuery.event, {

			trigger: function( event, data, elem, onlyHandlers ) {

				var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
					eventPath = [ elem || document ],
					type = hasOwn.call( event, "type" ) ? event.type : event,
					namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

				cur = lastElement = tmp = elem = elem || document;

				// Don't do events on text and comment nodes
				if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
					return;
				}

				// focus/blur morphs to focusin/out; ensure we're not firing them right now
				if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
					return;
				}

				if ( type.indexOf( "." ) > -1 ) {

					// Namespaced trigger; create a regexp to match event type in handle()
					namespaces = type.split( "." );
					type = namespaces.shift();
					namespaces.sort();
				}
				ontype = type.indexOf( ":" ) < 0 && "on" + type;

				// Caller can pass in a jQuery.Event object, Object, or just an event type string
				event = event[ jQuery.expando ] ?
					event :
					new jQuery.Event( type, typeof event === "object" && event );

				// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
				event.isTrigger = onlyHandlers ? 2 : 3;
				event.namespace = namespaces.join( "." );
				event.rnamespace = event.namespace ?
					new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
					null;

				// Clean up the event in case it is being reused
				event.result = undefined;
				if ( !event.target ) {
					event.target = elem;
				}

				// Clone any incoming data and prepend the event, creating the handler arg list
				data = data == null ?
					[ event ] :
					jQuery.makeArray( data, [ event ] );

				// Allow special events to draw outside the lines
				special = jQuery.event.special[ type ] || {};
				if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
					return;
				}

				// Determine event propagation path in advance, per W3C events spec (trac-9951)
				// Bubble up to document, then to window; watch for a global ownerDocument var (trac-9724)
				if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

					bubbleType = special.delegateType || type;
					if ( !rfocusMorph.test( bubbleType + type ) ) {
						cur = cur.parentNode;
					}
					for ( ; cur; cur = cur.parentNode ) {
						eventPath.push( cur );
						tmp = cur;
					}

					// Only add window if we got to document (e.g., not plain obj or detached DOM)
					if ( tmp === ( elem.ownerDocument || document ) ) {
						eventPath.push( tmp.defaultView || tmp.parentWindow || window );
					}
				}

				// Fire handlers on the event path
				i = 0;
				while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
					lastElement = cur;
					event.type = i > 1 ?
						bubbleType :
						special.bindType || type;

					// jQuery handler
					handle = ( dataPriv.get( cur, "events" ) || Object.create( null ) )[ event.type ] &&
						dataPriv.get( cur, "handle" );
					if ( handle ) {
						handle.apply( cur, data );
					}

					// Native handler
					handle = ontype && cur[ ontype ];
					if ( handle && handle.apply && acceptData( cur ) ) {
						event.result = handle.apply( cur, data );
						if ( event.result === false ) {
							event.preventDefault();
						}
					}
				}
				event.type = type;

				// If nobody prevented the default action, do it now
				if ( !onlyHandlers && !event.isDefaultPrevented() ) {

					if ( ( !special._default ||
						special._default.apply( eventPath.pop(), data ) === false ) &&
						acceptData( elem ) ) {

						// Call a native DOM method on the target with the same name as the event.
						// Don't do default actions on window, that's where global variables be (trac-6170)
						if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

							// Don't re-trigger an onFOO event when we call its FOO() method
							tmp = elem[ ontype ];

							if ( tmp ) {
								elem[ ontype ] = null;
							}

							// Prevent re-triggering of the same event, since we already bubbled it above
							jQuery.event.triggered = type;

							if ( event.isPropagationStopped() ) {
								lastElement.addEventListener( type, stopPropagationCallback );
							}

							elem[ type ]();

							if ( event.isPropagationStopped() ) {
								lastElement.removeEventListener( type, stopPropagationCallback );
							}

							jQuery.event.triggered = undefined;

							if ( tmp ) {
								elem[ ontype ] = tmp;
							}
						}
					}
				}

				return event.result;
			},

			// Piggyback on a donor event to simulate a different one
			// Used only for `focus(in | out)` events
			simulate: function( type, elem, event ) {
				var e = jQuery.extend(
					new jQuery.Event(),
					event,
					{
						type: type,
						isSimulated: true
					}
				);

				jQuery.event.trigger( e, null, elem );
			}

		} );

		jQuery.fn.extend( {

			trigger: function( type, data ) {
				return this.each( function() {
					jQuery.event.trigger( type, data, this );
				} );
			},
			triggerHandler: function( type, data ) {
				var elem = this[ 0 ];
				if ( elem ) {
					return jQuery.event.trigger( type, data, elem, true );
				}
			}
		} );


		var
			rbracket = /\[\]$/,
			rCRLF = /\r?\n/g,
			rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
			rsubmittable = /^(?:input|select|textarea|keygen)/i;

		function buildParams( prefix, obj, traditional, add ) {
			var name;

			if ( Array.isArray( obj ) ) {

				// Serialize array item.
				jQuery.each( obj, function( i, v ) {
					if ( traditional || rbracket.test( prefix ) ) {

						// Treat each array item as a scalar.
						add( prefix, v );

					} else {

						// Item is non-scalar (array or object), encode its numeric index.
						buildParams(
							prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
							v,
							traditional,
							add
						);
					}
				} );

			} else if ( !traditional && toType( obj ) === "object" ) {

				// Serialize object item.
				for ( name in obj ) {
					buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
				}

			} else {

				// Serialize scalar item.
				add( prefix, obj );
			}
		}

		// Serialize an array of form elements or a set of
		// key/values into a query string
		jQuery.param = function( a, traditional ) {
			var prefix,
				s = [],
				add = function( key, valueOrFunction ) {

					// If value is a function, invoke it and use its return value
					var value = isFunction( valueOrFunction ) ?
						valueOrFunction() :
						valueOrFunction;

					s[ s.length ] = encodeURIComponent( key ) + "=" +
						encodeURIComponent( value == null ? "" : value );
				};

			if ( a == null ) {
				return "";
			}

			// If an array was passed in, assume that it is an array of form elements.
			if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

				// Serialize the form elements
				jQuery.each( a, function() {
					add( this.name, this.value );
				} );

			} else {

				// If traditional, encode the "old" way (the way 1.3.2 or older
				// did it), otherwise encode params recursively.
				for ( prefix in a ) {
					buildParams( prefix, a[ prefix ], traditional, add );
				}
			}

			// Return the resulting serialization
			return s.join( "&" );
		};

		jQuery.fn.extend( {
			serialize: function() {
				return jQuery.param( this.serializeArray() );
			},
			serializeArray: function() {
				return this.map( function() {

					// Can add propHook for "elements" to filter or add form elements
					var elements = jQuery.prop( this, "elements" );
					return elements ? jQuery.makeArray( elements ) : this;
				} ).filter( function() {
					var type = this.type;

					// Use .is( ":disabled" ) so that fieldset[disabled] works
					return this.name && !jQuery( this ).is( ":disabled" ) &&
						rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
						( this.checked || !rcheckableType.test( type ) );
				} ).map( function( _i, elem ) {
					var val = jQuery( this ).val();

					if ( val == null ) {
						return null;
					}

					if ( Array.isArray( val ) ) {
						return jQuery.map( val, function( val ) {
							return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
						} );
					}

					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} ).get();
			}
		} );


		var
			r20 = /%20/g,
			rhash = /#.*$/,
			rantiCache = /([?&])_=[^&]*/,
			rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

			// trac-7653, trac-8125, trac-8152: local protocol detection
			rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
			rnoContent = /^(?:GET|HEAD)$/,
			rprotocol = /^\/\//,

			/* Prefilters
			 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
			 * 2) These are called:
			 *    - BEFORE asking for a transport
			 *    - AFTER param serialization (s.data is a string if s.processData is true)
			 * 3) key is the dataType
			 * 4) the catchall symbol "*" can be used
			 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
			 */
			prefilters = {},

			/* Transports bindings
			 * 1) key is the dataType
			 * 2) the catchall symbol "*" can be used
			 * 3) selection will start with transport dataType and THEN go to "*" if needed
			 */
			transports = {},

			// Avoid comment-prolog char sequence (trac-10098); must appease lint and evade compression
			allTypes = "*/".concat( "*" ),

			// Anchor tag for parsing the document origin
			originAnchor = document.createElement( "a" );

		originAnchor.href = location.href;

		// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
		function addToPrefiltersOrTransports( structure ) {

			// dataTypeExpression is optional and defaults to "*"
			return function( dataTypeExpression, func ) {

				if ( typeof dataTypeExpression !== "string" ) {
					func = dataTypeExpression;
					dataTypeExpression = "*";
				}

				var dataType,
					i = 0,
					dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

				if ( isFunction( func ) ) {

					// For each dataType in the dataTypeExpression
					while ( ( dataType = dataTypes[ i++ ] ) ) {

						// Prepend if requested
						if ( dataType[ 0 ] === "+" ) {
							dataType = dataType.slice( 1 ) || "*";
							( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

						// Otherwise append
						} else {
							( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
						}
					}
				}
			};
		}

		// Base inspection function for prefilters and transports
		function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

			var inspected = {},
				seekingTransport = ( structure === transports );

			function inspect( dataType ) {
				var selected;
				inspected[ dataType ] = true;
				jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
					var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
					if ( typeof dataTypeOrTransport === "string" &&
						!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

						options.dataTypes.unshift( dataTypeOrTransport );
						inspect( dataTypeOrTransport );
						return false;
					} else if ( seekingTransport ) {
						return !( selected = dataTypeOrTransport );
					}
				} );
				return selected;
			}

			return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
		}

		// A special extend for ajax options
		// that takes "flat" options (not to be deep extended)
		// Fixes trac-9887
		function ajaxExtend( target, src ) {
			var key, deep,
				flatOptions = jQuery.ajaxSettings.flatOptions || {};

			for ( key in src ) {
				if ( src[ key ] !== undefined ) {
					( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
				}
			}
			if ( deep ) {
				jQuery.extend( true, target, deep );
			}

			return target;
		}

		/* Handles responses to an ajax request:
		 * - finds the right dataType (mediates between content-type and expected dataType)
		 * - returns the corresponding response
		 */
		function ajaxHandleResponses( s, jqXHR, responses ) {

			var ct, type, finalDataType, firstDataType,
				contents = s.contents,
				dataTypes = s.dataTypes;

			// Remove auto dataType and get content-type in the process
			while ( dataTypes[ 0 ] === "*" ) {
				dataTypes.shift();
				if ( ct === undefined ) {
					ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
				}
			}

			// Check if we're dealing with a known content-type
			if ( ct ) {
				for ( type in contents ) {
					if ( contents[ type ] && contents[ type ].test( ct ) ) {
						dataTypes.unshift( type );
						break;
					}
				}
			}

			// Check to see if we have a response for the expected dataType
			if ( dataTypes[ 0 ] in responses ) {
				finalDataType = dataTypes[ 0 ];
			} else {

				// Try convertible dataTypes
				for ( type in responses ) {
					if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
						finalDataType = type;
						break;
					}
					if ( !firstDataType ) {
						firstDataType = type;
					}
				}

				// Or just use first one
				finalDataType = finalDataType || firstDataType;
			}

			// If we found a dataType
			// We add the dataType to the list if needed
			// and return the corresponding response
			if ( finalDataType ) {
				if ( finalDataType !== dataTypes[ 0 ] ) {
					dataTypes.unshift( finalDataType );
				}
				return responses[ finalDataType ];
			}
		}

		/* Chain conversions given the request and the original response
		 * Also sets the responseXXX fields on the jqXHR instance
		 */
		function ajaxConvert( s, response, jqXHR, isSuccess ) {
			var conv2, current, conv, tmp, prev,
				converters = {},

				// Work with a copy of dataTypes in case we need to modify it for conversion
				dataTypes = s.dataTypes.slice();

			// Create converters map with lowercased keys
			if ( dataTypes[ 1 ] ) {
				for ( conv in s.converters ) {
					converters[ conv.toLowerCase() ] = s.converters[ conv ];
				}
			}

			current = dataTypes.shift();

			// Convert to each sequential dataType
			while ( current ) {

				if ( s.responseFields[ current ] ) {
					jqXHR[ s.responseFields[ current ] ] = response;
				}

				// Apply the dataFilter if provided
				if ( !prev && isSuccess && s.dataFilter ) {
					response = s.dataFilter( response, s.dataType );
				}

				prev = current;
				current = dataTypes.shift();

				if ( current ) {

					// There's only work to do if current dataType is non-auto
					if ( current === "*" ) {

						current = prev;

					// Convert response if prev dataType is non-auto and differs from current
					} else if ( prev !== "*" && prev !== current ) {

						// Seek a direct converter
						conv = converters[ prev + " " + current ] || converters[ "* " + current ];

						// If none found, seek a pair
						if ( !conv ) {
							for ( conv2 in converters ) {

								// If conv2 outputs current
								tmp = conv2.split( " " );
								if ( tmp[ 1 ] === current ) {

									// If prev can be converted to accepted input
									conv = converters[ prev + " " + tmp[ 0 ] ] ||
										converters[ "* " + tmp[ 0 ] ];
									if ( conv ) {

										// Condense equivalence converters
										if ( conv === true ) {
											conv = converters[ conv2 ];

										// Otherwise, insert the intermediate dataType
										} else if ( converters[ conv2 ] !== true ) {
											current = tmp[ 0 ];
											dataTypes.unshift( tmp[ 1 ] );
										}
										break;
									}
								}
							}
						}

						// Apply converter (if not an equivalence)
						if ( conv !== true ) {

							// Unless errors are allowed to bubble, catch and return them
							if ( conv && s.throws ) {
								response = conv( response );
							} else {
								try {
									response = conv( response );
								} catch ( e ) {
									return {
										state: "parsererror",
										error: conv ? e : "No conversion from " + prev + " to " + current
									};
								}
							}
						}
					}
				}
			}

			return { state: "success", data: response };
		}

		jQuery.extend( {

			// Counter for holding the number of active queries
			active: 0,

			// Last-Modified header cache for next request
			lastModified: {},
			etag: {},

			ajaxSettings: {
				url: location.href,
				type: "GET",
				isLocal: rlocalProtocol.test( location.protocol ),
				global: true,
				processData: true,
				async: true,
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",

				/*
				timeout: 0,
				data: null,
				dataType: null,
				username: null,
				password: null,
				cache: null,
				throws: false,
				traditional: false,
				headers: {},
				*/

				accepts: {
					"*": allTypes,
					text: "text/plain",
					html: "text/html",
					xml: "application/xml, text/xml",
					json: "application/json, text/javascript"
				},

				contents: {
					xml: /\bxml\b/,
					html: /\bhtml/,
					json: /\bjson\b/
				},

				responseFields: {
					xml: "responseXML",
					text: "responseText",
					json: "responseJSON"
				},

				// Data converters
				// Keys separate source (or catchall "*") and destination types with a single space
				converters: {

					// Convert anything to text
					"* text": String,

					// Text to html (true = no transformation)
					"text html": true,

					// Evaluate text as a json expression
					"text json": JSON.parse,

					// Parse text as xml
					"text xml": jQuery.parseXML
				},

				// For options that shouldn't be deep extended:
				// you can add your own custom options here if
				// and when you create one that shouldn't be
				// deep extended (see ajaxExtend)
				flatOptions: {
					url: true,
					context: true
				}
			},

			// Creates a full fledged settings object into target
			// with both ajaxSettings and settings fields.
			// If target is omitted, writes into ajaxSettings.
			ajaxSetup: function( target, settings ) {
				return settings ?

					// Building a settings object
					ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

					// Extending ajaxSettings
					ajaxExtend( jQuery.ajaxSettings, target );
			},

			ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
			ajaxTransport: addToPrefiltersOrTransports( transports ),

			// Main method
			ajax: function( url, options ) {

				// If url is an object, simulate pre-1.5 signature
				if ( typeof url === "object" ) {
					options = url;
					url = undefined;
				}

				// Force options to be an object
				options = options || {};

				var transport,

					// URL without anti-cache param
					cacheURL,

					// Response headers
					responseHeadersString,
					responseHeaders,

					// timeout handle
					timeoutTimer,

					// Url cleanup var
					urlAnchor,

					// Request state (becomes false upon send and true upon completion)
					completed,

					// To know if global events are to be dispatched
					fireGlobals,

					// Loop variable
					i,

					// uncached part of the url
					uncached,

					// Create the final options object
					s = jQuery.ajaxSetup( {}, options ),

					// Callbacks context
					callbackContext = s.context || s,

					// Context for global events is callbackContext if it is a DOM node or jQuery collection
					globalEventContext = s.context &&
						( callbackContext.nodeType || callbackContext.jquery ) ?
						jQuery( callbackContext ) :
						jQuery.event,

					// Deferreds
					deferred = jQuery.Deferred(),
					completeDeferred = jQuery.Callbacks( "once memory" ),

					// Status-dependent callbacks
					statusCode = s.statusCode || {},

					// Headers (they are sent all at once)
					requestHeaders = {},
					requestHeadersNames = {},

					// Default abort message
					strAbort = "canceled",

					// Fake xhr
					jqXHR = {
						readyState: 0,

						// Builds headers hashtable if needed
						getResponseHeader: function( key ) {
							var match;
							if ( completed ) {
								if ( !responseHeaders ) {
									responseHeaders = {};
									while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
										responseHeaders[ match[ 1 ].toLowerCase() + " " ] =
											( responseHeaders[ match[ 1 ].toLowerCase() + " " ] || [] )
												.concat( match[ 2 ] );
									}
								}
								match = responseHeaders[ key.toLowerCase() + " " ];
							}
							return match == null ? null : match.join( ", " );
						},

						// Raw string
						getAllResponseHeaders: function() {
							return completed ? responseHeadersString : null;
						},

						// Caches the header
						setRequestHeader: function( name, value ) {
							if ( completed == null ) {
								name = requestHeadersNames[ name.toLowerCase() ] =
									requestHeadersNames[ name.toLowerCase() ] || name;
								requestHeaders[ name ] = value;
							}
							return this;
						},

						// Overrides response content-type header
						overrideMimeType: function( type ) {
							if ( completed == null ) {
								s.mimeType = type;
							}
							return this;
						},

						// Status-dependent callbacks
						statusCode: function( map ) {
							var code;
							if ( map ) {
								if ( completed ) {

									// Execute the appropriate callbacks
									jqXHR.always( map[ jqXHR.status ] );
								} else {

									// Lazy-add the new callbacks in a way that preserves old ones
									for ( code in map ) {
										statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
									}
								}
							}
							return this;
						},

						// Cancel the request
						abort: function( statusText ) {
							var finalText = statusText || strAbort;
							if ( transport ) {
								transport.abort( finalText );
							}
							done( 0, finalText );
							return this;
						}
					};

				// Attach deferreds
				deferred.promise( jqXHR );

				// Add protocol if not provided (prefilters might expect it)
				// Handle falsy url in the settings object (trac-10093: consistency with old signature)
				// We also use the url parameter if available
				s.url = ( ( url || s.url || location.href ) + "" )
					.replace( rprotocol, location.protocol + "//" );

				// Alias method option to type as per ticket trac-12004
				s.type = options.method || options.type || s.method || s.type;

				// Extract dataTypes list
				s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

				// A cross-domain request is in order when the origin doesn't match the current origin.
				if ( s.crossDomain == null ) {
					urlAnchor = document.createElement( "a" );

					// Support: IE <=8 - 11, Edge 12 - 15
					// IE throws exception on accessing the href property if url is malformed,
					// e.g. http://example.com:80x/
					try {
						urlAnchor.href = s.url;

						// Support: IE <=8 - 11 only
						// Anchor's host property isn't correctly set when s.url is relative
						urlAnchor.href = urlAnchor.href;
						s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
							urlAnchor.protocol + "//" + urlAnchor.host;
					} catch ( e ) {

						// If there is an error parsing the URL, assume it is crossDomain,
						// it can be rejected by the transport if it is invalid
						s.crossDomain = true;
					}
				}

				// Convert data if not already a string
				if ( s.data && s.processData && typeof s.data !== "string" ) {
					s.data = jQuery.param( s.data, s.traditional );
				}

				// Apply prefilters
				inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

				// If request was aborted inside a prefilter, stop there
				if ( completed ) {
					return jqXHR;
				}

				// We can fire global events as of now if asked to
				// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (trac-15118)
				fireGlobals = jQuery.event && s.global;

				// Watch for a new set of requests
				if ( fireGlobals && jQuery.active++ === 0 ) {
					jQuery.event.trigger( "ajaxStart" );
				}

				// Uppercase the type
				s.type = s.type.toUpperCase();

				// Determine if request has content
				s.hasContent = !rnoContent.test( s.type );

				// Save the URL in case we're toying with the If-Modified-Since
				// and/or If-None-Match header later on
				// Remove hash to simplify url manipulation
				cacheURL = s.url.replace( rhash, "" );

				// More options handling for requests with no content
				if ( !s.hasContent ) {

					// Remember the hash so we can put it back
					uncached = s.url.slice( cacheURL.length );

					// If data is available and should be processed, append data to url
					if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
						cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

						// trac-9682: remove data so that it's not used in an eventual retry
						delete s.data;
					}

					// Add or update anti-cache param if needed
					if ( s.cache === false ) {
						cacheURL = cacheURL.replace( rantiCache, "$1" );
						uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce.guid++ ) +
							uncached;
					}

					// Put hash and anti-cache on the URL that will be requested (gh-1732)
					s.url = cacheURL + uncached;

				// Change '%20' to '+' if this is encoded form body content (gh-2658)
				} else if ( s.data && s.processData &&
					( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
					s.data = s.data.replace( r20, "+" );
				}

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					if ( jQuery.lastModified[ cacheURL ] ) {
						jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
					}
					if ( jQuery.etag[ cacheURL ] ) {
						jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
					}
				}

				// Set the correct header, if data is being sent
				if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
					jqXHR.setRequestHeader( "Content-Type", s.contentType );
				}

				// Set the Accepts header for the server, depending on the dataType
				jqXHR.setRequestHeader(
					"Accept",
					s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
						s.accepts[ s.dataTypes[ 0 ] ] +
							( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
						s.accepts[ "*" ]
				);

				// Check for headers option
				for ( i in s.headers ) {
					jqXHR.setRequestHeader( i, s.headers[ i ] );
				}

				// Allow custom headers/mimetypes and early abort
				if ( s.beforeSend &&
					( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

					// Abort if not done already and return
					return jqXHR.abort();
				}

				// Aborting is no longer a cancellation
				strAbort = "abort";

				// Install callbacks on deferreds
				completeDeferred.add( s.complete );
				jqXHR.done( s.success );
				jqXHR.fail( s.error );

				// Get transport
				transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

				// If no transport, we auto-abort
				if ( !transport ) {
					done( -1, "No Transport" );
				} else {
					jqXHR.readyState = 1;

					// Send global event
					if ( fireGlobals ) {
						globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
					}

					// If request was aborted inside ajaxSend, stop there
					if ( completed ) {
						return jqXHR;
					}

					// Timeout
					if ( s.async && s.timeout > 0 ) {
						timeoutTimer = window.setTimeout( function() {
							jqXHR.abort( "timeout" );
						}, s.timeout );
					}

					try {
						completed = false;
						transport.send( requestHeaders, done );
					} catch ( e ) {

						// Rethrow post-completion exceptions
						if ( completed ) {
							throw e;
						}

						// Propagate others as results
						done( -1, e );
					}
				}

				// Callback for when everything is done
				function done( status, nativeStatusText, responses, headers ) {
					var isSuccess, success, error, response, modified,
						statusText = nativeStatusText;

					// Ignore repeat invocations
					if ( completed ) {
						return;
					}

					completed = true;

					// Clear timeout if it exists
					if ( timeoutTimer ) {
						window.clearTimeout( timeoutTimer );
					}

					// Dereference transport for early garbage collection
					// (no matter how long the jqXHR object will be used)
					transport = undefined;

					// Cache response headers
					responseHeadersString = headers || "";

					// Set readyState
					jqXHR.readyState = status > 0 ? 4 : 0;

					// Determine if successful
					isSuccess = status >= 200 && status < 300 || status === 304;

					// Get response data
					if ( responses ) {
						response = ajaxHandleResponses( s, jqXHR, responses );
					}

					// Use a noop converter for missing script but not if jsonp
					if ( !isSuccess &&
						jQuery.inArray( "script", s.dataTypes ) > -1 &&
						jQuery.inArray( "json", s.dataTypes ) < 0 ) {
						s.converters[ "text script" ] = function() {};
					}

					// Convert no matter what (that way responseXXX fields are always set)
					response = ajaxConvert( s, response, jqXHR, isSuccess );

					// If successful, handle type chaining
					if ( isSuccess ) {

						// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
						if ( s.ifModified ) {
							modified = jqXHR.getResponseHeader( "Last-Modified" );
							if ( modified ) {
								jQuery.lastModified[ cacheURL ] = modified;
							}
							modified = jqXHR.getResponseHeader( "etag" );
							if ( modified ) {
								jQuery.etag[ cacheURL ] = modified;
							}
						}

						// if no content
						if ( status === 204 || s.type === "HEAD" ) {
							statusText = "nocontent";

						// if not modified
						} else if ( status === 304 ) {
							statusText = "notmodified";

						// If we have data, let's convert it
						} else {
							statusText = response.state;
							success = response.data;
							error = response.error;
							isSuccess = !error;
						}
					} else {

						// Extract error from statusText and normalize for non-aborts
						error = statusText;
						if ( status || !statusText ) {
							statusText = "error";
							if ( status < 0 ) {
								status = 0;
							}
						}
					}

					// Set data for the fake xhr object
					jqXHR.status = status;
					jqXHR.statusText = ( nativeStatusText || statusText ) + "";

					// Success/Error
					if ( isSuccess ) {
						deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
					} else {
						deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
					}

					// Status-dependent callbacks
					jqXHR.statusCode( statusCode );
					statusCode = undefined;

					if ( fireGlobals ) {
						globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
							[ jqXHR, s, isSuccess ? success : error ] );
					}

					// Complete
					completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

					if ( fireGlobals ) {
						globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

						// Handle the global AJAX counter
						if ( !( --jQuery.active ) ) {
							jQuery.event.trigger( "ajaxStop" );
						}
					}
				}

				return jqXHR;
			},

			getJSON: function( url, data, callback ) {
				return jQuery.get( url, data, callback, "json" );
			},

			getScript: function( url, callback ) {
				return jQuery.get( url, undefined, callback, "script" );
			}
		} );

		jQuery.each( [ "get", "post" ], function( _i, method ) {
			jQuery[ method ] = function( url, data, callback, type ) {

				// Shift arguments if data argument was omitted
				if ( isFunction( data ) ) {
					type = type || callback;
					callback = data;
					data = undefined;
				}

				// The url can be an options object (which then must have .url)
				return jQuery.ajax( jQuery.extend( {
					url: url,
					type: method,
					dataType: type,
					data: data,
					success: callback
				}, jQuery.isPlainObject( url ) && url ) );
			};
		} );

		jQuery.ajaxPrefilter( function( s ) {
			var i;
			for ( i in s.headers ) {
				if ( i.toLowerCase() === "content-type" ) {
					s.contentType = s.headers[ i ] || "";
				}
			}
		} );


		jQuery._evalUrl = function( url, options, doc ) {
			return jQuery.ajax( {
				url: url,

				// Make this explicit, since user can override this through ajaxSetup (trac-11264)
				type: "GET",
				dataType: "script",
				cache: true,
				async: false,
				global: false,

				// Only evaluate the response if it is successful (gh-4126)
				// dataFilter is not invoked for failure responses, so using it instead
				// of the default converter is kludgy but it works.
				converters: {
					"text script": function() {}
				},
				dataFilter: function( response ) {
					jQuery.globalEval( response, options, doc );
				}
			} );
		};


		jQuery.fn.extend( {
			wrapAll: function( html ) {
				var wrap;

				if ( this[ 0 ] ) {
					if ( isFunction( html ) ) {
						html = html.call( this[ 0 ] );
					}

					// The elements to wrap the target around
					wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

					if ( this[ 0 ].parentNode ) {
						wrap.insertBefore( this[ 0 ] );
					}

					wrap.map( function() {
						var elem = this;

						while ( elem.firstElementChild ) {
							elem = elem.firstElementChild;
						}

						return elem;
					} ).append( this );
				}

				return this;
			},

			wrapInner: function( html ) {
				if ( isFunction( html ) ) {
					return this.each( function( i ) {
						jQuery( this ).wrapInner( html.call( this, i ) );
					} );
				}

				return this.each( function() {
					var self = jQuery( this ),
						contents = self.contents();

					if ( contents.length ) {
						contents.wrapAll( html );

					} else {
						self.append( html );
					}
				} );
			},

			wrap: function( html ) {
				var htmlIsFunction = isFunction( html );

				return this.each( function( i ) {
					jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
				} );
			},

			unwrap: function( selector ) {
				this.parent( selector ).not( "body" ).each( function() {
					jQuery( this ).replaceWith( this.childNodes );
				} );
				return this;
			}
		} );


		jQuery.expr.pseudos.hidden = function( elem ) {
			return !jQuery.expr.pseudos.visible( elem );
		};
		jQuery.expr.pseudos.visible = function( elem ) {
			return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
		};




		jQuery.ajaxSettings.xhr = function() {
			try {
				return new window.XMLHttpRequest();
			} catch ( e ) {}
		};

		var xhrSuccessStatus = {

				// File protocol always yields status code 0, assume 200
				0: 200,

				// Support: IE <=9 only
				// trac-1450: sometimes IE returns 1223 when it should be 204
				1223: 204
			},
			xhrSupported = jQuery.ajaxSettings.xhr();

		support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
		support.ajax = xhrSupported = !!xhrSupported;

		jQuery.ajaxTransport( function( options ) {
			var callback, errorCallback;

			// Cross domain only allowed if supported through XMLHttpRequest
			if ( support.cors || xhrSupported && !options.crossDomain ) {
				return {
					send: function( headers, complete ) {
						var i,
							xhr = options.xhr();

						xhr.open(
							options.type,
							options.url,
							options.async,
							options.username,
							options.password
						);

						// Apply custom fields if provided
						if ( options.xhrFields ) {
							for ( i in options.xhrFields ) {
								xhr[ i ] = options.xhrFields[ i ];
							}
						}

						// Override mime type if needed
						if ( options.mimeType && xhr.overrideMimeType ) {
							xhr.overrideMimeType( options.mimeType );
						}

						// X-Requested-With header
						// For cross-domain requests, seeing as conditions for a preflight are
						// akin to a jigsaw puzzle, we simply never set it to be sure.
						// (it can always be set on a per-request basis or even using ajaxSetup)
						// For same-domain requests, won't change header if already provided.
						if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
							headers[ "X-Requested-With" ] = "XMLHttpRequest";
						}

						// Set headers
						for ( i in headers ) {
							xhr.setRequestHeader( i, headers[ i ] );
						}

						// Callback
						callback = function( type ) {
							return function() {
								if ( callback ) {
									callback = errorCallback = xhr.onload =
										xhr.onerror = xhr.onabort = xhr.ontimeout =
											xhr.onreadystatechange = null;

									if ( type === "abort" ) {
										xhr.abort();
									} else if ( type === "error" ) {

										// Support: IE <=9 only
										// On a manual native abort, IE9 throws
										// errors on any property access that is not readyState
										if ( typeof xhr.status !== "number" ) {
											complete( 0, "error" );
										} else {
											complete(

												// File: protocol always yields status 0; see trac-8605, trac-14207
												xhr.status,
												xhr.statusText
											);
										}
									} else {
										complete(
											xhrSuccessStatus[ xhr.status ] || xhr.status,
											xhr.statusText,

											// Support: IE <=9 only
											// IE9 has no XHR2 but throws on binary (trac-11426)
											// For XHR2 non-text, let the caller handle it (gh-2498)
											( xhr.responseType || "text" ) !== "text"  ||
											typeof xhr.responseText !== "string" ?
												{ binary: xhr.response } :
												{ text: xhr.responseText },
											xhr.getAllResponseHeaders()
										);
									}
								}
							};
						};

						// Listen to events
						xhr.onload = callback();
						errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

						// Support: IE 9 only
						// Use onreadystatechange to replace onabort
						// to handle uncaught aborts
						if ( xhr.onabort !== undefined ) {
							xhr.onabort = errorCallback;
						} else {
							xhr.onreadystatechange = function() {

								// Check readyState before timeout as it changes
								if ( xhr.readyState === 4 ) {

									// Allow onerror to be called first,
									// but that will not handle a native abort
									// Also, save errorCallback to a variable
									// as xhr.onerror cannot be accessed
									window.setTimeout( function() {
										if ( callback ) {
											errorCallback();
										}
									} );
								}
							};
						}

						// Create the abort callback
						callback = callback( "abort" );

						try {

							// Do send the request (this may raise an exception)
							xhr.send( options.hasContent && options.data || null );
						} catch ( e ) {

							// trac-14683: Only rethrow if this hasn't been notified as an error yet
							if ( callback ) {
								throw e;
							}
						}
					},

					abort: function() {
						if ( callback ) {
							callback();
						}
					}
				};
			}
		} );




		// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
		jQuery.ajaxPrefilter( function( s ) {
			if ( s.crossDomain ) {
				s.contents.script = false;
			}
		} );

		// Install script dataType
		jQuery.ajaxSetup( {
			accepts: {
				script: "text/javascript, application/javascript, " +
					"application/ecmascript, application/x-ecmascript"
			},
			contents: {
				script: /\b(?:java|ecma)script\b/
			},
			converters: {
				"text script": function( text ) {
					jQuery.globalEval( text );
					return text;
				}
			}
		} );

		// Handle cache's special case and crossDomain
		jQuery.ajaxPrefilter( "script", function( s ) {
			if ( s.cache === undefined ) {
				s.cache = false;
			}
			if ( s.crossDomain ) {
				s.type = "GET";
			}
		} );

		// Bind script tag hack transport
		jQuery.ajaxTransport( "script", function( s ) {

			// This transport only deals with cross domain or forced-by-attrs requests
			if ( s.crossDomain || s.scriptAttrs ) {
				var script, callback;
				return {
					send: function( _, complete ) {
						script = jQuery( "<script>" )
							.attr( s.scriptAttrs || {} )
							.prop( { charset: s.scriptCharset, src: s.url } )
							.on( "load error", callback = function( evt ) {
								script.remove();
								callback = null;
								if ( evt ) {
									complete( evt.type === "error" ? 404 : 200, evt.type );
								}
							} );

						// Use native DOM manipulation to avoid our domManip AJAX trickery
						document.head.appendChild( script[ 0 ] );
					},
					abort: function() {
						if ( callback ) {
							callback();
						}
					}
				};
			}
		} );




		var oldCallbacks = [],
			rjsonp = /(=)\?(?=&|$)|\?\?/;

		// Default jsonp settings
		jQuery.ajaxSetup( {
			jsonp: "callback",
			jsonpCallback: function() {
				var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce.guid++ ) );
				this[ callback ] = true;
				return callback;
			}
		} );

		// Detect, normalize options and install callbacks for jsonp requests
		jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

			var callbackName, overwritten, responseContainer,
				jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
					"url" :
					typeof s.data === "string" &&
						( s.contentType || "" )
							.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
						rjsonp.test( s.data ) && "data"
				);

			// Handle iff the expected data type is "jsonp" or we have a parameter to set
			if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

				// Get callback name, remembering preexisting value associated with it
				callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
					s.jsonpCallback() :
					s.jsonpCallback;

				// Insert callback into url or form data
				if ( jsonProp ) {
					s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
				} else if ( s.jsonp !== false ) {
					s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
				}

				// Use data converter to retrieve json after script execution
				s.converters[ "script json" ] = function() {
					if ( !responseContainer ) {
						jQuery.error( callbackName + " was not called" );
					}
					return responseContainer[ 0 ];
				};

				// Force json dataType
				s.dataTypes[ 0 ] = "json";

				// Install callback
				overwritten = window[ callbackName ];
				window[ callbackName ] = function() {
					responseContainer = arguments;
				};

				// Clean-up function (fires after converters)
				jqXHR.always( function() {

					// If previous value didn't exist - remove it
					if ( overwritten === undefined ) {
						jQuery( window ).removeProp( callbackName );

					// Otherwise restore preexisting value
					} else {
						window[ callbackName ] = overwritten;
					}

					// Save back as free
					if ( s[ callbackName ] ) {

						// Make sure that re-using the options doesn't screw things around
						s.jsonpCallback = originalSettings.jsonpCallback;

						// Save the callback name for future use
						oldCallbacks.push( callbackName );
					}

					// Call if it was a function and we have a response
					if ( responseContainer && isFunction( overwritten ) ) {
						overwritten( responseContainer[ 0 ] );
					}

					responseContainer = overwritten = undefined;
				} );

				// Delegate to script
				return "script";
			}
		} );




		// Support: Safari 8 only
		// In Safari 8 documents created via document.implementation.createHTMLDocument
		// collapse sibling forms: the second one becomes a child of the first one.
		// Because of that, this security measure has to be disabled in Safari 8.
		// https://bugs.webkit.org/show_bug.cgi?id=137337
		support.createHTMLDocument = ( function() {
			var body = document.implementation.createHTMLDocument( "" ).body;
			body.innerHTML = "<form></form><form></form>";
			return body.childNodes.length === 2;
		} )();


		// Argument "data" should be string of html
		// context (optional): If specified, the fragment will be created in this context,
		// defaults to document
		// keepScripts (optional): If true, will include scripts passed in the html string
		jQuery.parseHTML = function( data, context, keepScripts ) {
			if ( typeof data !== "string" ) {
				return [];
			}
			if ( typeof context === "boolean" ) {
				keepScripts = context;
				context = false;
			}

			var base, parsed, scripts;

			if ( !context ) {

				// Stop scripts or inline event handlers from being executed immediately
				// by using document.implementation
				if ( support.createHTMLDocument ) {
					context = document.implementation.createHTMLDocument( "" );

					// Set the base href for the created document
					// so any parsed elements with URLs
					// are based on the document's URL (gh-2965)
					base = context.createElement( "base" );
					base.href = document.location.href;
					context.head.appendChild( base );
				} else {
					context = document;
				}
			}

			parsed = rsingleTag.exec( data );
			scripts = !keepScripts && [];

			// Single tag
			if ( parsed ) {
				return [ context.createElement( parsed[ 1 ] ) ];
			}

			parsed = buildFragment( [ data ], context, scripts );

			if ( scripts && scripts.length ) {
				jQuery( scripts ).remove();
			}

			return jQuery.merge( [], parsed.childNodes );
		};


		/**
		 * Load a url into a page
		 */
		jQuery.fn.load = function( url, params, callback ) {
			var selector, type, response,
				self = this,
				off = url.indexOf( " " );

			if ( off > -1 ) {
				selector = stripAndCollapse( url.slice( off ) );
				url = url.slice( 0, off );
			}

			// If it's a function
			if ( isFunction( params ) ) {

				// We assume that it's the callback
				callback = params;
				params = undefined;

			// Otherwise, build a param string
			} else if ( params && typeof params === "object" ) {
				type = "POST";
			}

			// If we have elements to modify, make the request
			if ( self.length > 0 ) {
				jQuery.ajax( {
					url: url,

					// If "type" variable is undefined, then "GET" method will be used.
					// Make value of this field explicit since
					// user can override it through ajaxSetup method
					type: type || "GET",
					dataType: "html",
					data: params
				} ).done( function( responseText ) {

					// Save response for use in complete callback
					response = arguments;

					self.html( selector ?

						// If a selector was specified, locate the right elements in a dummy div
						// Exclude scripts to avoid IE 'Permission Denied' errors
						jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

						// Otherwise use the full result
						responseText );

				// If the request succeeds, this function gets "data", "status", "jqXHR"
				// but they are ignored because response was set above.
				// If it fails, this function gets "jqXHR", "status", "error"
				} ).always( callback && function( jqXHR, status ) {
					self.each( function() {
						callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
					} );
				} );
			}

			return this;
		};




		jQuery.expr.pseudos.animated = function( elem ) {
			return jQuery.grep( jQuery.timers, function( fn ) {
				return elem === fn.elem;
			} ).length;
		};




		jQuery.offset = {
			setOffset: function( elem, options, i ) {
				var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
					position = jQuery.css( elem, "position" ),
					curElem = jQuery( elem ),
					props = {};

				// Set position first, in-case top/left are set even on static elem
				if ( position === "static" ) {
					elem.style.position = "relative";
				}

				curOffset = curElem.offset();
				curCSSTop = jQuery.css( elem, "top" );
				curCSSLeft = jQuery.css( elem, "left" );
				calculatePosition = ( position === "absolute" || position === "fixed" ) &&
					( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

				// Need to be able to calculate position if either
				// top or left is auto and position is either absolute or fixed
				if ( calculatePosition ) {
					curPosition = curElem.position();
					curTop = curPosition.top;
					curLeft = curPosition.left;

				} else {
					curTop = parseFloat( curCSSTop ) || 0;
					curLeft = parseFloat( curCSSLeft ) || 0;
				}

				if ( isFunction( options ) ) {

					// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
					options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
				}

				if ( options.top != null ) {
					props.top = ( options.top - curOffset.top ) + curTop;
				}
				if ( options.left != null ) {
					props.left = ( options.left - curOffset.left ) + curLeft;
				}

				if ( "using" in options ) {
					options.using.call( elem, props );

				} else {
					curElem.css( props );
				}
			}
		};

		jQuery.fn.extend( {

			// offset() relates an element's border box to the document origin
			offset: function( options ) {

				// Preserve chaining for setter
				if ( arguments.length ) {
					return options === undefined ?
						this :
						this.each( function( i ) {
							jQuery.offset.setOffset( this, options, i );
						} );
				}

				var rect, win,
					elem = this[ 0 ];

				if ( !elem ) {
					return;
				}

				// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
				// Support: IE <=11 only
				// Running getBoundingClientRect on a
				// disconnected node in IE throws an error
				if ( !elem.getClientRects().length ) {
					return { top: 0, left: 0 };
				}

				// Get document-relative position by adding viewport scroll to viewport-relative gBCR
				rect = elem.getBoundingClientRect();
				win = elem.ownerDocument.defaultView;
				return {
					top: rect.top + win.pageYOffset,
					left: rect.left + win.pageXOffset
				};
			},

			// position() relates an element's margin box to its offset parent's padding box
			// This corresponds to the behavior of CSS absolute positioning
			position: function() {
				if ( !this[ 0 ] ) {
					return;
				}

				var offsetParent, offset, doc,
					elem = this[ 0 ],
					parentOffset = { top: 0, left: 0 };

				// position:fixed elements are offset from the viewport, which itself always has zero offset
				if ( jQuery.css( elem, "position" ) === "fixed" ) {

					// Assume position:fixed implies availability of getBoundingClientRect
					offset = elem.getBoundingClientRect();

				} else {
					offset = this.offset();

					// Account for the *real* offset parent, which can be the document or its root element
					// when a statically positioned element is identified
					doc = elem.ownerDocument;
					offsetParent = elem.offsetParent || doc.documentElement;
					while ( offsetParent &&
						( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
						jQuery.css( offsetParent, "position" ) === "static" ) {

						offsetParent = offsetParent.parentNode;
					}
					if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

						// Incorporate borders into its offset, since they are outside its content origin
						parentOffset = jQuery( offsetParent ).offset();
						parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
						parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
					}
				}

				// Subtract parent offsets and element margins
				return {
					top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
					left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
				};
			},

			// This method will return documentElement in the following cases:
			// 1) For the element inside the iframe without offsetParent, this method will return
			//    documentElement of the parent window
			// 2) For the hidden or detached element
			// 3) For body or html element, i.e. in case of the html node - it will return itself
			//
			// but those exceptions were never presented as a real life use-cases
			// and might be considered as more preferable results.
			//
			// This logic, however, is not guaranteed and can change at any point in the future
			offsetParent: function() {
				return this.map( function() {
					var offsetParent = this.offsetParent;

					while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
						offsetParent = offsetParent.offsetParent;
					}

					return offsetParent || documentElement;
				} );
			}
		} );

		// Create scrollLeft and scrollTop methods
		jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
			var top = "pageYOffset" === prop;

			jQuery.fn[ method ] = function( val ) {
				return access( this, function( elem, method, val ) {

					// Coalesce documents and windows
					var win;
					if ( isWindow( elem ) ) {
						win = elem;
					} else if ( elem.nodeType === 9 ) {
						win = elem.defaultView;
					}

					if ( val === undefined ) {
						return win ? win[ prop ] : elem[ method ];
					}

					if ( win ) {
						win.scrollTo(
							!top ? val : win.pageXOffset,
							top ? val : win.pageYOffset
						);

					} else {
						elem[ method ] = val;
					}
				}, method, val, arguments.length );
			};
		} );

		// Support: Safari <=7 - 9.1, Chrome <=37 - 49
		// Add the top/left cssHooks using jQuery.fn.position
		// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
		// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
		// getComputedStyle returns percent when specified for top/left/bottom/right;
		// rather than make the css module depend on the offset module, just check for it here
		jQuery.each( [ "top", "left" ], function( _i, prop ) {
			jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
				function( elem, computed ) {
					if ( computed ) {
						computed = curCSS( elem, prop );

						// If curCSS returns percentage, fallback to offset
						return rnumnonpx.test( computed ) ?
							jQuery( elem ).position()[ prop ] + "px" :
							computed;
					}
				}
			);
		} );


		// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
		jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
			jQuery.each( {
				padding: "inner" + name,
				content: type,
				"": "outer" + name
			}, function( defaultExtra, funcName ) {

				// Margin is only for outerHeight, outerWidth
				jQuery.fn[ funcName ] = function( margin, value ) {
					var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
						extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

					return access( this, function( elem, type, value ) {
						var doc;

						if ( isWindow( elem ) ) {

							// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
							return funcName.indexOf( "outer" ) === 0 ?
								elem[ "inner" + name ] :
								elem.document.documentElement[ "client" + name ];
						}

						// Get document width or height
						if ( elem.nodeType === 9 ) {
							doc = elem.documentElement;

							// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
							// whichever is greatest
							return Math.max(
								elem.body[ "scroll" + name ], doc[ "scroll" + name ],
								elem.body[ "offset" + name ], doc[ "offset" + name ],
								doc[ "client" + name ]
							);
						}

						return value === undefined ?

							// Get width or height on the element, requesting but not forcing parseFloat
							jQuery.css( elem, type, extra ) :

							// Set width or height on the element
							jQuery.style( elem, type, value, extra );
					}, type, chainable ? margin : undefined, chainable );
				};
			} );
		} );


		jQuery.each( [
			"ajaxStart",
			"ajaxStop",
			"ajaxComplete",
			"ajaxError",
			"ajaxSuccess",
			"ajaxSend"
		], function( _i, type ) {
			jQuery.fn[ type ] = function( fn ) {
				return this.on( type, fn );
			};
		} );




		jQuery.fn.extend( {

			bind: function( types, data, fn ) {
				return this.on( types, null, data, fn );
			},
			unbind: function( types, fn ) {
				return this.off( types, null, fn );
			},

			delegate: function( selector, types, data, fn ) {
				return this.on( types, selector, data, fn );
			},
			undelegate: function( selector, types, fn ) {

				// ( namespace ) or ( selector, types [, fn] )
				return arguments.length === 1 ?
					this.off( selector, "**" ) :
					this.off( types, selector || "**", fn );
			},

			hover: function( fnOver, fnOut ) {
				return this
					.on( "mouseenter", fnOver )
					.on( "mouseleave", fnOut || fnOver );
			}
		} );

		jQuery.each(
			( "blur focus focusin focusout resize scroll click dblclick " +
			"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
			"change select submit keydown keypress keyup contextmenu" ).split( " " ),
			function( _i, name ) {

				// Handle event binding
				jQuery.fn[ name ] = function( data, fn ) {
					return arguments.length > 0 ?
						this.on( name, null, data, fn ) :
						this.trigger( name );
				};
			}
		);




		// Support: Android <=4.0 only
		// Make sure we trim BOM and NBSP
		// Require that the "whitespace run" starts from a non-whitespace
		// to avoid O(N^2) behavior when the engine would try matching "\s+$" at each space position.
		var rtrim = /^[\s\uFEFF\xA0]+|([^\s\uFEFF\xA0])[\s\uFEFF\xA0]+$/g;

		// Bind a function to a context, optionally partially applying any
		// arguments.
		// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
		// However, it is not slated for removal any time soon
		jQuery.proxy = function( fn, context ) {
			var tmp, args, proxy;

			if ( typeof context === "string" ) {
				tmp = fn[ context ];
				context = fn;
				fn = tmp;
			}

			// Quick check to determine if target is callable, in the spec
			// this throws a TypeError, but we will just return undefined.
			if ( !isFunction( fn ) ) {
				return undefined;
			}

			// Simulated bind
			args = slice.call( arguments, 2 );
			proxy = function() {
				return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
			};

			// Set the guid of unique handler to the same of original handler, so it can be removed
			proxy.guid = fn.guid = fn.guid || jQuery.guid++;

			return proxy;
		};

		jQuery.holdReady = function( hold ) {
			if ( hold ) {
				jQuery.readyWait++;
			} else {
				jQuery.ready( true );
			}
		};
		jQuery.isArray = Array.isArray;
		jQuery.parseJSON = JSON.parse;
		jQuery.nodeName = nodeName;
		jQuery.isFunction = isFunction;
		jQuery.isWindow = isWindow;
		jQuery.camelCase = camelCase;
		jQuery.type = toType;

		jQuery.now = Date.now;

		jQuery.isNumeric = function( obj ) {

			// As of jQuery 3.0, isNumeric is limited to
			// strings and numbers (primitives or objects)
			// that can be coerced to finite numbers (gh-2662)
			var type = jQuery.type( obj );
			return ( type === "number" || type === "string" ) &&

				// parseFloat NaNs numeric-cast false positives ("")
				// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
				// subtraction forces infinities to NaN
				!isNaN( obj - parseFloat( obj ) );
		};

		jQuery.trim = function( text ) {
			return text == null ?
				"" :
				( text + "" ).replace( rtrim, "$1" );
		};




		var

			// Map over jQuery in case of overwrite
			_jQuery = window.jQuery,

			// Map over the $ in case of overwrite
			_$ = window.$;

		jQuery.noConflict = function( deep ) {
			if ( window.$ === jQuery ) {
				window.$ = _$;
			}

			if ( deep && window.jQuery === jQuery ) {
				window.jQuery = _jQuery;
			}

			return jQuery;
		};

		// Expose jQuery and $ identifiers, even in AMD
		// (trac-7102#comment:10, https://github.com/jquery/jquery/pull/557)
		// and CommonJS for browser emulators (trac-13566)
		if ( typeof noGlobal === "undefined" ) {
			window.jQuery = window.$ = jQuery;
		}




		return jQuery;
		} );
	} (jquery$1));

	var jquery = jqueryExports;

	const config = {
		"dev": true,
		"port": 8083,
		"wsPath": "/ws",
		"fps": 60,
		"serverTickRate": 60,
		"netTickRate": 60,
		"prod": false
	};

	const consts = {
		"GRID_COUNT": 100,        // Map size in cells (for coordinate scaling)
		"CELL_WIDTH": 40,         // Size of each cell in pixels
		"SPEED": 4,               // Player movement speed per frame
		"BORDER_WIDTH": 20,       // Border around the map
		"MAX_PLAYERS": 100,        // Maximum players in a game
		"NEW_PLAYER_LAG": 60,     // Frames to wait before player can move
		"LEADERBOARD_NUM": 5,     // Number of players shown on leaderboard
		"MIN_SNIP_TIME": 1.5,
		"MAX_SNIP_TIME": 8.0,
		"SAFETY_SPEED_ESTIMATE_MULT": 0.9,
		"SNIP_FUSE_SPEED_MULT": 1.5,
		// Exponential fuse ramp: v(t)=v0*exp(k*t). Lower k = slower ramp.
		// 25% slower than prior default.
		"SNIP_EXP_ACCEL_PER_SEC": 0.6375,
		// Cap fuse speed as a multiple of the player's current effective speed (generous).
		"SNIP_FUSE_MAX_SPEED_MULT": 6.0,
		// Grace period before fuse starts moving (seconds)
		"SNIP_GRACE_PERIOD": 0.25,
		"PREFIXES": "Angry Baby Crazy Diligent Excited Fat Greedy Hungry Interesting Japanese Kind Little Magic Naïve Old Powerful Quiet Rich Superman THU Undefined Valuable Wifeless Xiangbuchulai Young Zombie",
		"NAMES": "Alice Bob Carol Dave Eve Francis Grace Hans Isabella Jason Kate Louis Margaret Nathan Olivia Paul Queen Richard Susan Thomas Uma Vivian Winnie Xander Yasmine Zach",
		"MAX_COINS": 200,
		"COIN_SPAWN_INTERVAL_SEC": 2.5,
		"COIN_RADIUS": 8,
		"COIN_VALUE": 5,
		"COIN_DROP_PERCENT": 0.15,         // Percentage of XP dropped as loot on death
		"KILLER_XP_PERCENT": 0.15,         // Percentage of XP transferred directly to killer
		"COIN_DROP_MIN": 10,               // Minimum XP dropped on death (even if broke)
		"KILLER_XP_MIN": 20,               // Minimum XP given to killer
		"COINS_PER_AREA_UNIT": 0.00025,
		
		// ===== TRAIL SPEED BUFF =====
		// When players leave their territory, they gain speed over time (risk/reward)
		"TRAIL_SPEED_BUFF_MAX": 1.6,        // Maximum speed multiplier when trailing (1.5 = 50% faster)
		"TRAIL_SPEED_BUFF_RAMP_TIME": 8,  // Seconds to reach max speed buff
		"TRAIL_SPEED_BUFF_EASE": 2,       // Easing exponent (1 = linear, 2 = quadratic ease-in, higher = slower start)
		
		// ===== XP / LEVELING SYSTEM =====
		"XP_BASE_PER_LEVEL": 10,         // Base XP needed to level up (level 1 → 2)
		"XP_INCREMENT_PER_LEVEL": 15,    // XP cost increases by this * level each level
		// Formula: XP needed for level L = BASE + (L-1) * INCREMENT
		// Level 1→2: 50, Level 2→3: 65, Level 3→4: 80, etc.
		"PLAYER_SIZE_SCALE_PER_LEVEL": 0.04,  // Size increase per level (5%)
		"PLAYER_SIZE_SCALE_MAX": 1.75,     // Maximum size multiplier
		
		// ===== COMBAT SYSTEM =====
		// Player HP (for drone combat)
		"PLAYER_MAX_HP": 100,
		"PLAYER_HP_REGEN_IN_TERRITORY": 30,  // SHP per second when in own territory (fast regen)
		"TERRITORY_DAMAGE_REDUCTION": 0.2,   // Damage reduction when in own territory (0.5 = 50% less damage)
		
		// ===== DRONE SYSTEM =====
		// Note: Drones are now granted automatically via leveling (1 per level)
		// Drones use hitscan - instant damage when they fire
		"MAX_DRONES": 10,                 // Maximum drones per player (effectively level cap)
		"DRONE_ORBIT_RADIUS": 55,         // Distance from player center
		"DRONE_ORBIT_SPEED": 2,         // Radians per second (orbit rotation speed)
		"DRONE_RADIUS": 10,               // Visual/collision radius
		"DRONE_DAMAGE": 5,               // Damage for first drone (hitscan)
		"DRONE_DAMAGE_EXTRA_MULT": 0.5,   // Damage multiplier for 2nd drone (relative to 1st)
		"DRONE_DAMAGE_DECAY_FACTOR": 0.75,  // Damage multiplier for each drone after the 2nd (e.g., 0.8 = 20% reduction per drone)
		"DRONE_RANGE": 158,               // Targeting range (reduced 30% from 225)
		"DRONE_COOLDOWN": .1,             // Seconds between shots
		"DRONE_UPDATE_EVERY_TICKS": 1,    // Throttle drone updates sent to clients (1 = every tick)
		
		// ===== AREA OF INTEREST (AOI) OPTIMIZATION =====
		// Reduces bandwidth from O(N²) to O(N×K) where K = avg nearby players
		// AOI radius is now DYNAMIC based on each player's viewport size
		"AOI_MIN_RADIUS": 400,           // Minimum AOI radius (for very small windows)
		"AOI_BUFFER": 300,               // Extra buffer beyond viewport edge (ensures off-screen spawn)
		"AOI_HYSTERESIS": 200,           // Extra buffer before removing from AOI (prevents flicker)
		"AOI_GRID_SIZE": 200             // Spatial grid cell size for efficient queries
	};

	function verifyRange() {
		for (let i = 0; i < arguments.length; i++) {
			if (arguments[i] < 0 || arguments[i] > 1) throw new RangeError("H, S, L, and A parameters must be between the range [0, 1]");
		}
	}
	// https://stackoverflow.com/a/9493060/7344257
	function hslToRgb(h, s, l) {
		let r, g, b;
		if (s == 0) r = g = b = l; //Achromatic
		else {
			const hue2rgb = function(p, q, t) {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}
		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
	}

	class Color {
	    constructor(h, s, l, a) {
	        verifyRange(h, s, l);
	        if (a === undefined) a = 1;
	        else verifyRange(a);
	        Object.defineProperties(this, {
	            "hue": {
	                value: h,
	                enumerable: true
	            },
	            "sat": {
	                value: s,
	                enumerable: true
	            },
	            "lum": {
	                value: l,
	                enumerable: true
	            },
	            "alpha": {
	                value: a,
	                enumerable: true
	            },
	        });
	    }

	    interpolateToString(color, amount) {
	        const rgbThis = hslToRgb(this.hue, this.sat, this.lum);
	        const rgbThat = hslToRgb(color.hue, color.sat, color.lum);
	        const rgb = [];
	        for (let i = 0; i < 3; i++) {
	            rgb[i] = Math.floor((rgbThat[i] - rgbThis[i]) * amount + rgbThis[i]);
	        }
	        return {
	            rgbString: function() {
	                return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
	            }
	        };
	    }

	    deriveLumination(amount) {
	        let lum = this.lum + amount;
	        lum = Math.min(Math.max(lum, 0), 1);
	        return new Color(this.hue, this.sat, lum, this.alpha);
	    }

	    deriveHue(amount) {
	        const hue = this.hue - amount;
	        return new Color(hue - Math.floor(hue), this.sat, this.lum, this.alpha);
	    }

	    deriveSaturation(amount) {
	        let sat = this.sat + amount;
	        sat = Math.min(Math.max(sat, 0), 1);
	        return new Color(this.hue, sat, this.lum, this.alpha);
	    }

	    deriveAlpha(newAlpha) {
	        verifyRange(newAlpha);
	        return new Color(this.hue, this.sat, this.lum, newAlpha);
	    }

	    rgbString() {
	        const rgb = hslToRgb(this.hue, this.sat, this.lum);
	        rgb[3] = this.a;
	        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${this.alpha})`;
	    }
	}

	Color.fromData = data => {
		return new Color(data.hue, data.sat, data.lum, data.alpha);
	};
	Color.possColors = () => {
		const SATS = [192, 150, 100].map(val => val / 240);
		const HUES = [0, 10, 20, 25, 30, 35, 40, 45, 50, 60, 70, 100, 110, 120, 125, 130, 135, 140, 145, 150, 160, 170, 180, 190, 200, 210, 220].map(val => val / 240);
		const possColors = new Array(SATS.length * HUES.length);
		let i = 0;
		for (let s = 0; s < SATS.length; s++) {
			for (let h = 0; h < HUES.length; h++) {
				possColors[i++] = new Color(HUES[h], SATS[s], .5, 1);
			}
		}
		//Shuffle the colors
		for (let i = 0; i < possColors.length * 50; i++) {
			const a = Math.floor(Math.random() * possColors.length);
			const b = Math.floor(Math.random() * possColors.length);
			const tmp = possColors[a];
			possColors[a] = possColors[b];
			possColors[b] = tmp;
		}
		return possColors;
	};

	class f {
	  constructor(t, e) {
	    this.next = null, this.key = t, this.data = e, this.left = null, this.right = null;
	  }
	}
	function d(n, t) {
	  return n > t ? 1 : n < t ? -1 : 0;
	}
	function u$1(n, t, e) {
	  const r = new f(null, null);
	  let l = r, i = r;
	  for (; ; ) {
	    const o = e(n, t.key);
	    if (o < 0) {
	      if (t.left === null) break;
	      if (e(n, t.left.key) < 0) {
	        const s = t.left;
	        if (t.left = s.right, s.right = t, t = s, t.left === null) break;
	      }
	      i.left = t, i = t, t = t.left;
	    } else if (o > 0) {
	      if (t.right === null) break;
	      if (e(n, t.right.key) > 0) {
	        const s = t.right;
	        if (t.right = s.left, s.left = t, t = s, t.right === null) break;
	      }
	      l.right = t, l = t, t = t.right;
	    } else break;
	  }
	  return l.right = t.left, i.left = t.right, t.left = r.right, t.right = r.left, t;
	}
	function c(n, t, e, r) {
	  const l = new f(n, t);
	  if (e === null)
	    return l.left = l.right = null, l;
	  e = u$1(n, e, r);
	  const i = r(n, e.key);
	  return i < 0 ? (l.left = e.left, l.right = e, e.left = null) : i >= 0 && (l.right = e.right, l.left = e, e.right = null), l;
	}
	function m(n, t, e) {
	  let r = null, l = null;
	  if (t) {
	    t = u$1(n, t, e);
	    const i = e(t.key, n);
	    i === 0 ? (r = t.left, l = t.right) : i < 0 ? (l = t.right, t.right = null, r = t) : (r = t.left, t.left = null, l = t);
	  }
	  return { left: r, right: l };
	}
	function w(n, t, e) {
	  return t === null ? n : (n === null || (t = u$1(n.key, t, e), t.left = n), t);
	}
	function _(n, t, e, r, l) {
	  if (n) {
	    r(`${t}${e ? "└── " : "├── "}${l(n)}
`);
	    const i = t + (e ? "    " : "│   ");
	    n.left && _(n.left, i, !1, r, l), n.right && _(n.right, i, !0, r, l);
	  }
	}
	class z {
	  constructor(t = d) {
	    this._root = null, this._size = 0, this._comparator = t;
	  }
	  /**
	   * Inserts a key, allows duplicates
	   */
	  insert(t, e) {
	    return this._size++, this._root = c(t, e, this._root, this._comparator);
	  }
	  /**
	   * Adds a key, if it is not present in the tree
	   */
	  add(t, e) {
	    const r = new f(t, e);
	    this._root === null && (r.left = r.right = null, this._size++, this._root = r);
	    const l = this._comparator, i = u$1(t, this._root, l), o = l(t, i.key);
	    return o === 0 ? this._root = i : (o < 0 ? (r.left = i.left, r.right = i, i.left = null) : o > 0 && (r.right = i.right, r.left = i, i.right = null), this._size++, this._root = r), this._root;
	  }
	  /**
	   * @param  {Key} key
	   * @return {Node|null}
	   */
	  remove(t) {
	    this._root = this._remove(t, this._root, this._comparator);
	  }
	  /**
	   * Deletes i from the tree if it's there
	   */
	  _remove(t, e, r) {
	    let l;
	    return e === null ? null : (e = u$1(t, e, r), r(t, e.key) === 0 ? (e.left === null ? l = e.right : (l = u$1(t, e.left, r), l.right = e.right), this._size--, l) : e);
	  }
	  /**
	   * Removes and returns the node with smallest key
	   */
	  pop() {
	    let t = this._root;
	    if (t) {
	      for (; t.left; ) t = t.left;
	      return this._root = u$1(t.key, this._root, this._comparator), this._root = this._remove(t.key, this._root, this._comparator), { key: t.key, data: t.data };
	    }
	    return null;
	  }
	  /**
	   * Find without splaying
	   */
	  findStatic(t) {
	    let e = this._root;
	    const r = this._comparator;
	    for (; e; ) {
	      const l = r(t, e.key);
	      if (l === 0) return e;
	      l < 0 ? e = e.left : e = e.right;
	    }
	    return null;
	  }
	  find(t) {
	    return this._root && (this._root = u$1(t, this._root, this._comparator), this._comparator(t, this._root.key) !== 0) ? null : this._root;
	  }
	  contains(t) {
	    let e = this._root;
	    const r = this._comparator;
	    for (; e; ) {
	      const l = r(t, e.key);
	      if (l === 0) return !0;
	      l < 0 ? e = e.left : e = e.right;
	    }
	    return !1;
	  }
	  forEach(t, e) {
	    let r = this._root;
	    const l = [];
	    let i = !1;
	    for (; !i; )
	      r !== null ? (l.push(r), r = r.left) : l.length !== 0 ? (r = l.pop(), t.call(e, r), r = r.right) : i = !0;
	    return this;
	  }
	  /**
	   * Walk key range from `low` to `high`. Stops if `fn` returns a value.
	   */
	  range(t, e, r, l) {
	    const i = [], o = this._comparator;
	    let s = this._root, h;
	    for (; i.length !== 0 || s; )
	      if (s)
	        i.push(s), s = s.left;
	      else {
	        if (s = i.pop(), h = o(s.key, e), h > 0)
	          break;
	        if (o(s.key, t) >= 0 && r.call(l, s))
	          return this;
	        s = s.right;
	      }
	    return this;
	  }
	  /**
	   * Returns array of keys
	   */
	  keys() {
	    const t = [];
	    return this.forEach(({ key: e }) => {
	      t.push(e);
	    }), t;
	  }
	  /**
	   * Returns array of all the data in the nodes
	   */
	  values() {
	    const t = [];
	    return this.forEach(({ data: e }) => {
	      t.push(e);
	    }), t;
	  }
	  min() {
	    return this._root ? this.minNode(this._root).key : null;
	  }
	  max() {
	    return this._root ? this.maxNode(this._root).key : null;
	  }
	  minNode(t = this._root) {
	    if (t) for (; t.left; ) t = t.left;
	    return t;
	  }
	  maxNode(t = this._root) {
	    if (t) for (; t.right; ) t = t.right;
	    return t;
	  }
	  /**
	   * Returns node at given index
	   */
	  at(t) {
	    let e = this._root, r = !1, l = 0;
	    const i = [];
	    for (; !r; )
	      if (e)
	        i.push(e), e = e.left;
	      else if (i.length > 0) {
	        if (e = i.pop(), l === t) return e;
	        l++, e = e.right;
	      } else r = !0;
	    return null;
	  }
	  next(t) {
	    let e = this._root, r = null;
	    if (t.right) {
	      for (r = t.right; r.left; ) r = r.left;
	      return r;
	    }
	    const l = this._comparator;
	    for (; e; ) {
	      const i = l(t.key, e.key);
	      if (i === 0) break;
	      i < 0 ? (r = e, e = e.left) : e = e.right;
	    }
	    return r;
	  }
	  prev(t) {
	    let e = this._root, r = null;
	    if (t.left !== null) {
	      for (r = t.left; r.right; ) r = r.right;
	      return r;
	    }
	    const l = this._comparator;
	    for (; e; ) {
	      const i = l(t.key, e.key);
	      if (i === 0) break;
	      i < 0 ? e = e.left : (r = e, e = e.right);
	    }
	    return r;
	  }
	  clear() {
	    return this._root = null, this._size = 0, this;
	  }
	  toList() {
	    return k(this._root);
	  }
	  /**
	   * Bulk-load items. Both array have to be same size
	   */
	  load(t, e = [], r = !1) {
	    let l = t.length;
	    const i = this._comparator;
	    if (r && g(t, e, 0, l - 1, i), this._root === null)
	      this._root = a(t, e, 0, l), this._size = l;
	    else {
	      const o = y(
	        this.toList(),
	        x(t, e),
	        i
	      );
	      l = this._size + l, this._root = p({ head: o }, 0, l);
	    }
	    return this;
	  }
	  isEmpty() {
	    return this._root === null;
	  }
	  get size() {
	    return this._size;
	  }
	  get root() {
	    return this._root;
	  }
	  toString(t = (e) => String(e.key)) {
	    const e = [];
	    return _(this._root, "", !0, (r) => e.push(r), t), e.join("");
	  }
	  update(t, e, r) {
	    const l = this._comparator;
	    let { left: i, right: o } = m(t, this._root, l);
	    l(t, e) < 0 ? o = c(e, r, o, l) : i = c(e, r, i, l), this._root = w(i, o, l);
	  }
	  split(t) {
	    return m(t, this._root, this._comparator);
	  }
	  *[Symbol.iterator]() {
	    let t = this._root;
	    const e = [];
	    let r = !1;
	    for (; !r; )
	      t !== null ? (e.push(t), t = t.left) : e.length !== 0 ? (t = e.pop(), yield t, t = t.right) : r = !0;
	  }
	}
	function a(n, t, e, r) {
	  const l = r - e;
	  if (l > 0) {
	    const i = e + Math.floor(l / 2), o = n[i], s = t[i], h = new f(o, s);
	    return h.left = a(n, t, e, i), h.right = a(n, t, i + 1, r), h;
	  }
	  return null;
	}
	function x(n, t) {
	  const e = new f(null, null);
	  let r = e;
	  for (let l = 0; l < n.length; l++)
	    r = r.next = new f(n[l], t[l]);
	  return r.next = null, e.next;
	}
	function k(n) {
	  let t = n;
	  const e = [];
	  let r = !1;
	  const l = new f(null, null);
	  let i = l;
	  for (; !r; )
	    t ? (e.push(t), t = t.left) : e.length > 0 ? (t = i = i.next = e.pop(), t = t.right) : r = !0;
	  return i.next = null, l.next;
	}
	function p(n, t, e) {
	  const r = e - t;
	  if (r > 0) {
	    const l = t + Math.floor(r / 2), i = p(n, t, l), o = n.head;
	    return o.left = i, n.head = n.head.next, o.right = p(n, l + 1, e), o;
	  }
	  return null;
	}
	function y(n, t, e) {
	  const r = new f(null, null);
	  let l = r, i = n, o = t;
	  for (; i !== null && o !== null; )
	    e(i.key, o.key) < 0 ? (l.next = i, i = i.next) : (l.next = o, o = o.next), l = l.next;
	  return i !== null ? l.next = i : o !== null && (l.next = o), r.next;
	}
	function g(n, t, e, r, l) {
	  if (e >= r) return;
	  const i = n[e + r >> 1];
	  let o = e - 1, s = r + 1;
	  for (; ; ) {
	    do
	      o++;
	    while (l(n[o], i) < 0);
	    do
	      s--;
	    while (l(n[s], i) > 0);
	    if (o >= s) break;
	    let h = n[o];
	    n[o] = n[s], n[s] = h, h = t[o], t[o] = t[s], t[s] = h;
	  }
	  g(n, t, e, s, l), g(n, t, s + 1, r, l);
	}

	const epsilon$1 = 1.1102230246251565e-16;
	const splitter = 134217729;
	const resulterrbound = (3 + 8 * epsilon$1) * epsilon$1;

	// fast_expansion_sum_zeroelim routine from oritinal code
	function sum(elen, e, flen, f, h) {
	    let Q, Qnew, hh, bvirt;
	    let enow = e[0];
	    let fnow = f[0];
	    let eindex = 0;
	    let findex = 0;
	    if ((fnow > enow) === (fnow > -enow)) {
	        Q = enow;
	        enow = e[++eindex];
	    } else {
	        Q = fnow;
	        fnow = f[++findex];
	    }
	    let hindex = 0;
	    if (eindex < elen && findex < flen) {
	        if ((fnow > enow) === (fnow > -enow)) {
	            Qnew = enow + Q;
	            hh = Q - (Qnew - enow);
	            enow = e[++eindex];
	        } else {
	            Qnew = fnow + Q;
	            hh = Q - (Qnew - fnow);
	            fnow = f[++findex];
	        }
	        Q = Qnew;
	        if (hh !== 0) {
	            h[hindex++] = hh;
	        }
	        while (eindex < elen && findex < flen) {
	            if ((fnow > enow) === (fnow > -enow)) {
	                Qnew = Q + enow;
	                bvirt = Qnew - Q;
	                hh = Q - (Qnew - bvirt) + (enow - bvirt);
	                enow = e[++eindex];
	            } else {
	                Qnew = Q + fnow;
	                bvirt = Qnew - Q;
	                hh = Q - (Qnew - bvirt) + (fnow - bvirt);
	                fnow = f[++findex];
	            }
	            Q = Qnew;
	            if (hh !== 0) {
	                h[hindex++] = hh;
	            }
	        }
	    }
	    while (eindex < elen) {
	        Qnew = Q + enow;
	        bvirt = Qnew - Q;
	        hh = Q - (Qnew - bvirt) + (enow - bvirt);
	        enow = e[++eindex];
	        Q = Qnew;
	        if (hh !== 0) {
	            h[hindex++] = hh;
	        }
	    }
	    while (findex < flen) {
	        Qnew = Q + fnow;
	        bvirt = Qnew - Q;
	        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
	        fnow = f[++findex];
	        Q = Qnew;
	        if (hh !== 0) {
	            h[hindex++] = hh;
	        }
	    }
	    if (Q !== 0 || hindex === 0) {
	        h[hindex++] = Q;
	    }
	    return hindex;
	}

	function estimate(elen, e) {
	    let Q = e[0];
	    for (let i = 1; i < elen; i++) Q += e[i];
	    return Q;
	}

	function vec(n) {
	    return new Float64Array(n);
	}

	const ccwerrboundA = (3 + 16 * epsilon$1) * epsilon$1;
	const ccwerrboundB = (2 + 12 * epsilon$1) * epsilon$1;
	const ccwerrboundC = (9 + 64 * epsilon$1) * epsilon$1 * epsilon$1;

	const B = vec(4);
	const C1 = vec(8);
	const C2 = vec(12);
	const D = vec(16);
	const u = vec(4);

	function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
	    let acxtail, acytail, bcxtail, bcytail;
	    let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;

	    const acx = ax - cx;
	    const bcx = bx - cx;
	    const acy = ay - cy;
	    const bcy = by - cy;

	    s1 = acx * bcy;
	    c = splitter * acx;
	    ahi = c - (c - acx);
	    alo = acx - ahi;
	    c = splitter * bcy;
	    bhi = c - (c - bcy);
	    blo = bcy - bhi;
	    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	    t1 = acy * bcx;
	    c = splitter * acy;
	    ahi = c - (c - acy);
	    alo = acy - ahi;
	    c = splitter * bcx;
	    bhi = c - (c - bcx);
	    blo = bcx - bhi;
	    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	    _i = s0 - t0;
	    bvirt = s0 - _i;
	    B[0] = s0 - (_i + bvirt) + (bvirt - t0);
	    _j = s1 + _i;
	    bvirt = _j - s1;
	    _0 = s1 - (_j - bvirt) + (_i - bvirt);
	    _i = _0 - t1;
	    bvirt = _0 - _i;
	    B[1] = _0 - (_i + bvirt) + (bvirt - t1);
	    u3 = _j + _i;
	    bvirt = u3 - _j;
	    B[2] = _j - (u3 - bvirt) + (_i - bvirt);
	    B[3] = u3;

	    let det = estimate(4, B);
	    let errbound = ccwerrboundB * detsum;
	    if (det >= errbound || -det >= errbound) {
	        return det;
	    }

	    bvirt = ax - acx;
	    acxtail = ax - (acx + bvirt) + (bvirt - cx);
	    bvirt = bx - bcx;
	    bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
	    bvirt = ay - acy;
	    acytail = ay - (acy + bvirt) + (bvirt - cy);
	    bvirt = by - bcy;
	    bcytail = by - (bcy + bvirt) + (bvirt - cy);

	    if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
	        return det;
	    }

	    errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
	    det += (acx * bcytail + bcy * acxtail) - (acy * bcxtail + bcx * acytail);
	    if (det >= errbound || -det >= errbound) return det;

	    s1 = acxtail * bcy;
	    c = splitter * acxtail;
	    ahi = c - (c - acxtail);
	    alo = acxtail - ahi;
	    c = splitter * bcy;
	    bhi = c - (c - bcy);
	    blo = bcy - bhi;
	    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	    t1 = acytail * bcx;
	    c = splitter * acytail;
	    ahi = c - (c - acytail);
	    alo = acytail - ahi;
	    c = splitter * bcx;
	    bhi = c - (c - bcx);
	    blo = bcx - bhi;
	    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	    _i = s0 - t0;
	    bvirt = s0 - _i;
	    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	    _j = s1 + _i;
	    bvirt = _j - s1;
	    _0 = s1 - (_j - bvirt) + (_i - bvirt);
	    _i = _0 - t1;
	    bvirt = _0 - _i;
	    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	    u3 = _j + _i;
	    bvirt = u3 - _j;
	    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	    u[3] = u3;
	    const C1len = sum(4, B, 4, u, C1);

	    s1 = acx * bcytail;
	    c = splitter * acx;
	    ahi = c - (c - acx);
	    alo = acx - ahi;
	    c = splitter * bcytail;
	    bhi = c - (c - bcytail);
	    blo = bcytail - bhi;
	    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	    t1 = acy * bcxtail;
	    c = splitter * acy;
	    ahi = c - (c - acy);
	    alo = acy - ahi;
	    c = splitter * bcxtail;
	    bhi = c - (c - bcxtail);
	    blo = bcxtail - bhi;
	    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	    _i = s0 - t0;
	    bvirt = s0 - _i;
	    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	    _j = s1 + _i;
	    bvirt = _j - s1;
	    _0 = s1 - (_j - bvirt) + (_i - bvirt);
	    _i = _0 - t1;
	    bvirt = _0 - _i;
	    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	    u3 = _j + _i;
	    bvirt = u3 - _j;
	    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	    u[3] = u3;
	    const C2len = sum(C1len, C1, 4, u, C2);

	    s1 = acxtail * bcytail;
	    c = splitter * acxtail;
	    ahi = c - (c - acxtail);
	    alo = acxtail - ahi;
	    c = splitter * bcytail;
	    bhi = c - (c - bcytail);
	    blo = bcytail - bhi;
	    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	    t1 = acytail * bcxtail;
	    c = splitter * acytail;
	    ahi = c - (c - acytail);
	    alo = acytail - ahi;
	    c = splitter * bcxtail;
	    bhi = c - (c - bcxtail);
	    blo = bcxtail - bhi;
	    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	    _i = s0 - t0;
	    bvirt = s0 - _i;
	    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	    _j = s1 + _i;
	    bvirt = _j - s1;
	    _0 = s1 - (_j - bvirt) + (_i - bvirt);
	    _i = _0 - t1;
	    bvirt = _0 - _i;
	    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	    u3 = _j + _i;
	    bvirt = u3 - _j;
	    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	    u[3] = u3;
	    const Dlen = sum(C2len, C2, 4, u, D);

	    return D[Dlen - 1];
	}

	function orient2d(ax, ay, bx, by, cx, cy) {
	    const detleft = (ay - cy) * (bx - cx);
	    const detright = (ax - cx) * (by - cy);
	    const det = detleft - detright;

	    const detsum = Math.abs(detleft + detright);
	    if (Math.abs(det) >= ccwerrboundA * detsum) return det;

	    return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
	}

	/**
	 * A bounding box has the format:
	 *
	 *  { ll: { x: xmin, y: ymin }, ur: { x: xmax, y: ymax } }
	 *
	 */

	const isInBbox = (bbox, point) => {
	  return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
	};

	/* Returns either null, or a bbox (aka an ordered pair of points)
	 * If there is only one point of overlap, a bbox with identical points
	 * will be returned */
	const getBboxOverlap = (b1, b2) => {
	  // check if the bboxes overlap at all
	  if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;

	  // find the middle two X values
	  const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
	  const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;

	  // find the middle two Y values
	  const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
	  const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;

	  // put those middle values together to get the overlap
	  return {
	    ll: {
	      x: lowerX,
	      y: lowerY
	    },
	    ur: {
	      x: upperX,
	      y: upperY
	    }
	  };
	};

	/* Javascript doesn't do integer math. Everything is
	 * floating point with percision Number.EPSILON.
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON
	 */

	let epsilon = Number.EPSILON;

	// IE Polyfill
	if (epsilon === undefined) epsilon = Math.pow(2, -52);
	const EPSILON_SQ = epsilon * epsilon;

	/* FLP comparator */
	const cmp = (a, b) => {
	  // check if they're both 0
	  if (-epsilon < a && a < epsilon) {
	    if (-epsilon < b && b < epsilon) {
	      return 0;
	    }
	  }

	  // check if they're flp equal
	  const ab = a - b;
	  if (ab * ab < EPSILON_SQ * a * b) {
	    return 0;
	  }

	  // normal comparison
	  return a < b ? -1 : 1;
	};

	/**
	 * This class rounds incoming values sufficiently so that
	 * floating points problems are, for the most part, avoided.
	 *
	 * Incoming points are have their x & y values tested against
	 * all previously seen x & y values. If either is 'too close'
	 * to a previously seen value, it's value is 'snapped' to the
	 * previously seen value.
	 *
	 * All points should be rounded by this class before being
	 * stored in any data structures in the rest of this algorithm.
	 */

	class PtRounder {
	  constructor() {
	    this.reset();
	  }
	  reset() {
	    this.xRounder = new CoordRounder();
	    this.yRounder = new CoordRounder();
	  }
	  round(x, y) {
	    return {
	      x: this.xRounder.round(x),
	      y: this.yRounder.round(y)
	    };
	  }
	}
	class CoordRounder {
	  constructor() {
	    this.tree = new z();
	    // preseed with 0 so we don't end up with values < Number.EPSILON
	    this.round(0);
	  }

	  // Note: this can rounds input values backwards or forwards.
	  //       You might ask, why not restrict this to just rounding
	  //       forwards? Wouldn't that allow left endpoints to always
	  //       remain left endpoints during splitting (never change to
	  //       right). No - it wouldn't, because we snap intersections
	  //       to endpoints (to establish independence from the segment
	  //       angle for t-intersections).
	  round(coord) {
	    const node = this.tree.add(coord);
	    const prevNode = this.tree.prev(node);
	    if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
	      this.tree.remove(coord);
	      return prevNode.key;
	    }
	    const nextNode = this.tree.next(node);
	    if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
	      this.tree.remove(coord);
	      return nextNode.key;
	    }
	    return coord;
	  }
	}

	// singleton available by import
	const rounder = new PtRounder();

	/* Cross Product of two vectors with first point at origin */
	const crossProduct = (a, b) => a.x * b.y - a.y * b.x;

	/* Dot Product of two vectors with first point at origin */
	const dotProduct = (a, b) => a.x * b.x + a.y * b.y;

	/* Comparator for two vectors with same starting point */
	const compareVectorAngles = (basePt, endPt1, endPt2) => {
	  const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
	  if (res > 0) return -1;
	  if (res < 0) return 1;
	  return 0;
	};
	const length = v => Math.sqrt(dotProduct(v, v));

	/* Get the sine of the angle from pShared -> pAngle to pShaed -> pBase */
	const sineOfAngle = (pShared, pBase, pAngle) => {
	  const vBase = {
	    x: pBase.x - pShared.x,
	    y: pBase.y - pShared.y
	  };
	  const vAngle = {
	    x: pAngle.x - pShared.x,
	    y: pAngle.y - pShared.y
	  };
	  return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
	};

	/* Get the cosine of the angle from pShared -> pAngle to pShaed -> pBase */
	const cosineOfAngle = (pShared, pBase, pAngle) => {
	  const vBase = {
	    x: pBase.x - pShared.x,
	    y: pBase.y - pShared.y
	  };
	  const vAngle = {
	    x: pAngle.x - pShared.x,
	    y: pAngle.y - pShared.y
	  };
	  return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
	};

	/* Get the x coordinate where the given line (defined by a point and vector)
	 * crosses the horizontal line with the given y coordiante.
	 * In the case of parrallel lines (including overlapping ones) returns null. */
	const horizontalIntersection = (pt, v, y) => {
	  if (v.y === 0) return null;
	  return {
	    x: pt.x + v.x / v.y * (y - pt.y),
	    y: y
	  };
	};

	/* Get the y coordinate where the given line (defined by a point and vector)
	 * crosses the vertical line with the given x coordiante.
	 * In the case of parrallel lines (including overlapping ones) returns null. */
	const verticalIntersection = (pt, v, x) => {
	  if (v.x === 0) return null;
	  return {
	    x: x,
	    y: pt.y + v.y / v.x * (x - pt.x)
	  };
	};

	/* Get the intersection of two lines, each defined by a base point and a vector.
	 * In the case of parrallel lines (including overlapping ones) returns null. */
	const intersection$1 = (pt1, v1, pt2, v2) => {
	  // take some shortcuts for vertical and horizontal lines
	  // this also ensures we don't calculate an intersection and then discover
	  // it's actually outside the bounding box of the line
	  if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
	  if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
	  if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
	  if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);

	  // General case for non-overlapping segments.
	  // This algorithm is based on Schneider and Eberly.
	  // http://www.cimec.org.ar/~ncalvo/Schneider_Eberly.pdf - pg 244

	  const kross = crossProduct(v1, v2);
	  if (kross == 0) return null;
	  const ve = {
	    x: pt2.x - pt1.x,
	    y: pt2.y - pt1.y
	  };
	  const d1 = crossProduct(ve, v1) / kross;
	  const d2 = crossProduct(ve, v2) / kross;

	  // take the average of the two calculations to minimize rounding error
	  const x1 = pt1.x + d2 * v1.x,
	    x2 = pt2.x + d1 * v2.x;
	  const y1 = pt1.y + d2 * v1.y,
	    y2 = pt2.y + d1 * v2.y;
	  const x = (x1 + x2) / 2;
	  const y = (y1 + y2) / 2;
	  return {
	    x: x,
	    y: y
	  };
	};

	class SweepEvent {
	  // for ordering sweep events in the sweep event queue
	  static compare(a, b) {
	    // favor event with a point that the sweep line hits first
	    const ptCmp = SweepEvent.comparePoints(a.point, b.point);
	    if (ptCmp !== 0) return ptCmp;

	    // the points are the same, so link them if needed
	    if (a.point !== b.point) a.link(b);

	    // favor right events over left
	    if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;

	    // we have two matching left or right endpoints
	    // ordering of this case is the same as for their segments
	    return Segment.compare(a.segment, b.segment);
	  }

	  // for ordering points in sweep line order
	  static comparePoints(aPt, bPt) {
	    if (aPt.x < bPt.x) return -1;
	    if (aPt.x > bPt.x) return 1;
	    if (aPt.y < bPt.y) return -1;
	    if (aPt.y > bPt.y) return 1;
	    return 0;
	  }

	  // Warning: 'point' input will be modified and re-used (for performance)
	  constructor(point, isLeft) {
	    if (point.events === undefined) point.events = [this];else point.events.push(this);
	    this.point = point;
	    this.isLeft = isLeft;
	    // this.segment, this.otherSE set by factory
	  }
	  link(other) {
	    if (other.point === this.point) {
	      throw new Error("Tried to link already linked events");
	    }
	    const otherEvents = other.point.events;
	    for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
	      const evt = otherEvents[i];
	      this.point.events.push(evt);
	      evt.point = this.point;
	    }
	    this.checkForConsuming();
	  }

	  /* Do a pass over our linked events and check to see if any pair
	   * of segments match, and should be consumed. */
	  checkForConsuming() {
	    // FIXME: The loops in this method run O(n^2) => no good.
	    //        Maintain little ordered sweep event trees?
	    //        Can we maintaining an ordering that avoids the need
	    //        for the re-sorting with getLeftmostComparator in geom-out?

	    // Compare each pair of events to see if other events also match
	    const numEvents = this.point.events.length;
	    for (let i = 0; i < numEvents; i++) {
	      const evt1 = this.point.events[i];
	      if (evt1.segment.consumedBy !== undefined) continue;
	      for (let j = i + 1; j < numEvents; j++) {
	        const evt2 = this.point.events[j];
	        if (evt2.consumedBy !== undefined) continue;
	        if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
	        evt1.segment.consume(evt2.segment);
	      }
	    }
	  }
	  getAvailableLinkedEvents() {
	    // point.events is always of length 2 or greater
	    const events = [];
	    for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
	      const evt = this.point.events[i];
	      if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
	        events.push(evt);
	      }
	    }
	    return events;
	  }

	  /**
	   * Returns a comparator function for sorting linked events that will
	   * favor the event that will give us the smallest left-side angle.
	   * All ring construction starts as low as possible heading to the right,
	   * so by always turning left as sharp as possible we'll get polygons
	   * without uncessary loops & holes.
	   *
	   * The comparator function has a compute cache such that it avoids
	   * re-computing already-computed values.
	   */
	  getLeftmostComparator(baseEvent) {
	    const cache = new Map();
	    const fillCache = linkedEvent => {
	      const nextEvent = linkedEvent.otherSE;
	      cache.set(linkedEvent, {
	        sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
	        cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
	      });
	    };
	    return (a, b) => {
	      if (!cache.has(a)) fillCache(a);
	      if (!cache.has(b)) fillCache(b);
	      const {
	        sine: asine,
	        cosine: acosine
	      } = cache.get(a);
	      const {
	        sine: bsine,
	        cosine: bcosine
	      } = cache.get(b);

	      // both on or above x-axis
	      if (asine >= 0 && bsine >= 0) {
	        if (acosine < bcosine) return 1;
	        if (acosine > bcosine) return -1;
	        return 0;
	      }

	      // both below x-axis
	      if (asine < 0 && bsine < 0) {
	        if (acosine < bcosine) return -1;
	        if (acosine > bcosine) return 1;
	        return 0;
	      }

	      // one above x-axis, one below
	      if (bsine < asine) return -1;
	      if (bsine > asine) return 1;
	      return 0;
	    };
	  }
	}

	// Give segments unique ID's to get consistent sorting of
	// segments and sweep events when all else is identical
	let segmentId = 0;
	class Segment {
	  /* This compare() function is for ordering segments in the sweep
	   * line tree, and does so according to the following criteria:
	   *
	   * Consider the vertical line that lies an infinestimal step to the
	   * right of the right-more of the two left endpoints of the input
	   * segments. Imagine slowly moving a point up from negative infinity
	   * in the increasing y direction. Which of the two segments will that
	   * point intersect first? That segment comes 'before' the other one.
	   *
	   * If neither segment would be intersected by such a line, (if one
	   * or more of the segments are vertical) then the line to be considered
	   * is directly on the right-more of the two left inputs.
	   */
	  static compare(a, b) {
	    const alx = a.leftSE.point.x;
	    const blx = b.leftSE.point.x;
	    const arx = a.rightSE.point.x;
	    const brx = b.rightSE.point.x;

	    // check if they're even in the same vertical plane
	    if (brx < alx) return 1;
	    if (arx < blx) return -1;
	    const aly = a.leftSE.point.y;
	    const bly = b.leftSE.point.y;
	    const ary = a.rightSE.point.y;
	    const bry = b.rightSE.point.y;

	    // is left endpoint of segment B the right-more?
	    if (alx < blx) {
	      // are the two segments in the same horizontal plane?
	      if (bly < aly && bly < ary) return 1;
	      if (bly > aly && bly > ary) return -1;

	      // is the B left endpoint colinear to segment A?
	      const aCmpBLeft = a.comparePoint(b.leftSE.point);
	      if (aCmpBLeft < 0) return 1;
	      if (aCmpBLeft > 0) return -1;

	      // is the A right endpoint colinear to segment B ?
	      const bCmpARight = b.comparePoint(a.rightSE.point);
	      if (bCmpARight !== 0) return bCmpARight;

	      // colinear segments, consider the one with left-more
	      // left endpoint to be first (arbitrary?)
	      return -1;
	    }

	    // is left endpoint of segment A the right-more?
	    if (alx > blx) {
	      if (aly < bly && aly < bry) return -1;
	      if (aly > bly && aly > bry) return 1;

	      // is the A left endpoint colinear to segment B?
	      const bCmpALeft = b.comparePoint(a.leftSE.point);
	      if (bCmpALeft !== 0) return bCmpALeft;

	      // is the B right endpoint colinear to segment A?
	      const aCmpBRight = a.comparePoint(b.rightSE.point);
	      if (aCmpBRight < 0) return 1;
	      if (aCmpBRight > 0) return -1;

	      // colinear segments, consider the one with left-more
	      // left endpoint to be first (arbitrary?)
	      return 1;
	    }

	    // if we get here, the two left endpoints are in the same
	    // vertical plane, ie alx === blx

	    // consider the lower left-endpoint to come first
	    if (aly < bly) return -1;
	    if (aly > bly) return 1;

	    // left endpoints are identical
	    // check for colinearity by using the left-more right endpoint

	    // is the A right endpoint more left-more?
	    if (arx < brx) {
	      const bCmpARight = b.comparePoint(a.rightSE.point);
	      if (bCmpARight !== 0) return bCmpARight;
	    }

	    // is the B right endpoint more left-more?
	    if (arx > brx) {
	      const aCmpBRight = a.comparePoint(b.rightSE.point);
	      if (aCmpBRight < 0) return 1;
	      if (aCmpBRight > 0) return -1;
	    }
	    if (arx !== brx) {
	      // are these two [almost] vertical segments with opposite orientation?
	      // if so, the one with the lower right endpoint comes first
	      const ay = ary - aly;
	      const ax = arx - alx;
	      const by = bry - bly;
	      const bx = brx - blx;
	      if (ay > ax && by < bx) return 1;
	      if (ay < ax && by > bx) return -1;
	    }

	    // we have colinear segments with matching orientation
	    // consider the one with more left-more right endpoint to be first
	    if (arx > brx) return 1;
	    if (arx < brx) return -1;

	    // if we get here, two two right endpoints are in the same
	    // vertical plane, ie arx === brx

	    // consider the lower right-endpoint to come first
	    if (ary < bry) return -1;
	    if (ary > bry) return 1;

	    // right endpoints identical as well, so the segments are idential
	    // fall back on creation order as consistent tie-breaker
	    if (a.id < b.id) return -1;
	    if (a.id > b.id) return 1;

	    // identical segment, ie a === b
	    return 0;
	  }

	  /* Warning: a reference to ringWindings input will be stored,
	   *  and possibly will be later modified */
	  constructor(leftSE, rightSE, rings, windings) {
	    this.id = ++segmentId;
	    this.leftSE = leftSE;
	    leftSE.segment = this;
	    leftSE.otherSE = rightSE;
	    this.rightSE = rightSE;
	    rightSE.segment = this;
	    rightSE.otherSE = leftSE;
	    this.rings = rings;
	    this.windings = windings;
	    // left unset for performance, set later in algorithm
	    // this.ringOut, this.consumedBy, this.prev
	  }
	  static fromRing(pt1, pt2, ring) {
	    let leftPt, rightPt, winding;

	    // ordering the two points according to sweep line ordering
	    const cmpPts = SweepEvent.comparePoints(pt1, pt2);
	    if (cmpPts < 0) {
	      leftPt = pt1;
	      rightPt = pt2;
	      winding = 1;
	    } else if (cmpPts > 0) {
	      leftPt = pt2;
	      rightPt = pt1;
	      winding = -1;
	    } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
	    const leftSE = new SweepEvent(leftPt, true);
	    const rightSE = new SweepEvent(rightPt, false);
	    return new Segment(leftSE, rightSE, [ring], [winding]);
	  }

	  /* When a segment is split, the rightSE is replaced with a new sweep event */
	  replaceRightSE(newRightSE) {
	    this.rightSE = newRightSE;
	    this.rightSE.segment = this;
	    this.rightSE.otherSE = this.leftSE;
	    this.leftSE.otherSE = this.rightSE;
	  }
	  bbox() {
	    const y1 = this.leftSE.point.y;
	    const y2 = this.rightSE.point.y;
	    return {
	      ll: {
	        x: this.leftSE.point.x,
	        y: y1 < y2 ? y1 : y2
	      },
	      ur: {
	        x: this.rightSE.point.x,
	        y: y1 > y2 ? y1 : y2
	      }
	    };
	  }

	  /* A vector from the left point to the right */
	  vector() {
	    return {
	      x: this.rightSE.point.x - this.leftSE.point.x,
	      y: this.rightSE.point.y - this.leftSE.point.y
	    };
	  }
	  isAnEndpoint(pt) {
	    return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
	  }

	  /* Compare this segment with a point.
	   *
	   * A point P is considered to be colinear to a segment if there
	   * exists a distance D such that if we travel along the segment
	   * from one * endpoint towards the other a distance D, we find
	   * ourselves at point P.
	   *
	   * Return value indicates:
	   *
	   *   1: point lies above the segment (to the left of vertical)
	   *   0: point is colinear to segment
	   *  -1: point lies below the segment (to the right of vertical)
	   */
	  comparePoint(point) {
	    if (this.isAnEndpoint(point)) return 0;
	    const lPt = this.leftSE.point;
	    const rPt = this.rightSE.point;
	    const v = this.vector();

	    // Exactly vertical segments.
	    if (lPt.x === rPt.x) {
	      if (point.x === lPt.x) return 0;
	      return point.x < lPt.x ? 1 : -1;
	    }

	    // Nearly vertical segments with an intersection.
	    // Check to see where a point on the line with matching Y coordinate is.
	    const yDist = (point.y - lPt.y) / v.y;
	    const xFromYDist = lPt.x + yDist * v.x;
	    if (point.x === xFromYDist) return 0;

	    // General case.
	    // Check to see where a point on the line with matching X coordinate is.
	    const xDist = (point.x - lPt.x) / v.x;
	    const yFromXDist = lPt.y + xDist * v.y;
	    if (point.y === yFromXDist) return 0;
	    return point.y < yFromXDist ? -1 : 1;
	  }

	  /**
	   * Given another segment, returns the first non-trivial intersection
	   * between the two segments (in terms of sweep line ordering), if it exists.
	   *
	   * A 'non-trivial' intersection is one that will cause one or both of the
	   * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
	   *
	   *   * endpoint of segA with endpoint of segB --> trivial
	   *   * endpoint of segA with point along segB --> non-trivial
	   *   * endpoint of segB with point along segA --> non-trivial
	   *   * point along segA with point along segB --> non-trivial
	   *
	   * If no non-trivial intersection exists, return null
	   * Else, return null.
	   */
	  getIntersection(other) {
	    // If bboxes don't overlap, there can't be any intersections
	    const tBbox = this.bbox();
	    const oBbox = other.bbox();
	    const bboxOverlap = getBboxOverlap(tBbox, oBbox);
	    if (bboxOverlap === null) return null;

	    // We first check to see if the endpoints can be considered intersections.
	    // This will 'snap' intersections to endpoints if possible, and will
	    // handle cases of colinearity.

	    const tlp = this.leftSE.point;
	    const trp = this.rightSE.point;
	    const olp = other.leftSE.point;
	    const orp = other.rightSE.point;

	    // does each endpoint touch the other segment?
	    // note that we restrict the 'touching' definition to only allow segments
	    // to touch endpoints that lie forward from where we are in the sweep line pass
	    const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
	    const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
	    const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
	    const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;

	    // do left endpoints match?
	    if (touchesThisLSE && touchesOtherLSE) {
	      // these two cases are for colinear segments with matching left
	      // endpoints, and one segment being longer than the other
	      if (touchesThisRSE && !touchesOtherRSE) return trp;
	      if (!touchesThisRSE && touchesOtherRSE) return orp;
	      // either the two segments match exactly (two trival intersections)
	      // or just on their left endpoint (one trivial intersection
	      return null;
	    }

	    // does this left endpoint matches (other doesn't)
	    if (touchesThisLSE) {
	      // check for segments that just intersect on opposing endpoints
	      if (touchesOtherRSE) {
	        if (tlp.x === orp.x && tlp.y === orp.y) return null;
	      }
	      // t-intersection on left endpoint
	      return tlp;
	    }

	    // does other left endpoint matches (this doesn't)
	    if (touchesOtherLSE) {
	      // check for segments that just intersect on opposing endpoints
	      if (touchesThisRSE) {
	        if (trp.x === olp.x && trp.y === olp.y) return null;
	      }
	      // t-intersection on left endpoint
	      return olp;
	    }

	    // trivial intersection on right endpoints
	    if (touchesThisRSE && touchesOtherRSE) return null;

	    // t-intersections on just one right endpoint
	    if (touchesThisRSE) return trp;
	    if (touchesOtherRSE) return orp;

	    // None of our endpoints intersect. Look for a general intersection between
	    // infinite lines laid over the segments
	    const pt = intersection$1(tlp, this.vector(), olp, other.vector());

	    // are the segments parrallel? Note that if they were colinear with overlap,
	    // they would have an endpoint intersection and that case was already handled above
	    if (pt === null) return null;

	    // is the intersection found between the lines not on the segments?
	    if (!isInBbox(bboxOverlap, pt)) return null;

	    // round the the computed point if needed
	    return rounder.round(pt.x, pt.y);
	  }

	  /**
	   * Split the given segment into multiple segments on the given points.
	   *  * Each existing segment will retain its leftSE and a new rightSE will be
	   *    generated for it.
	   *  * A new segment will be generated which will adopt the original segment's
	   *    rightSE, and a new leftSE will be generated for it.
	   *  * If there are more than two points given to split on, new segments
	   *    in the middle will be generated with new leftSE and rightSE's.
	   *  * An array of the newly generated SweepEvents will be returned.
	   *
	   * Warning: input array of points is modified
	   */
	  split(point) {
	    const newEvents = [];
	    const alreadyLinked = point.events !== undefined;
	    const newLeftSE = new SweepEvent(point, true);
	    const newRightSE = new SweepEvent(point, false);
	    const oldRightSE = this.rightSE;
	    this.replaceRightSE(newRightSE);
	    newEvents.push(newRightSE);
	    newEvents.push(newLeftSE);
	    const newSeg = new Segment(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());

	    // when splitting a nearly vertical downward-facing segment,
	    // sometimes one of the resulting new segments is vertical, in which
	    // case its left and right events may need to be swapped
	    if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
	      newSeg.swapEvents();
	    }
	    if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
	      this.swapEvents();
	    }

	    // in the point we just used to create new sweep events with was already
	    // linked to other events, we need to check if either of the affected
	    // segments should be consumed
	    if (alreadyLinked) {
	      newLeftSE.checkForConsuming();
	      newRightSE.checkForConsuming();
	    }
	    return newEvents;
	  }

	  /* Swap which event is left and right */
	  swapEvents() {
	    const tmpEvt = this.rightSE;
	    this.rightSE = this.leftSE;
	    this.leftSE = tmpEvt;
	    this.leftSE.isLeft = true;
	    this.rightSE.isLeft = false;
	    for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
	      this.windings[i] *= -1;
	    }
	  }

	  /* Consume another segment. We take their rings under our wing
	   * and mark them as consumed. Use for perfectly overlapping segments */
	  consume(other) {
	    let consumer = this;
	    let consumee = other;
	    while (consumer.consumedBy) consumer = consumer.consumedBy;
	    while (consumee.consumedBy) consumee = consumee.consumedBy;
	    const cmp = Segment.compare(consumer, consumee);
	    if (cmp === 0) return; // already consumed
	    // the winner of the consumption is the earlier segment
	    // according to sweep line ordering
	    if (cmp > 0) {
	      const tmp = consumer;
	      consumer = consumee;
	      consumee = tmp;
	    }

	    // make sure a segment doesn't consume it's prev
	    if (consumer.prev === consumee) {
	      const tmp = consumer;
	      consumer = consumee;
	      consumee = tmp;
	    }
	    for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
	      const ring = consumee.rings[i];
	      const winding = consumee.windings[i];
	      const index = consumer.rings.indexOf(ring);
	      if (index === -1) {
	        consumer.rings.push(ring);
	        consumer.windings.push(winding);
	      } else consumer.windings[index] += winding;
	    }
	    consumee.rings = null;
	    consumee.windings = null;
	    consumee.consumedBy = consumer;

	    // mark sweep events consumed as to maintain ordering in sweep event queue
	    consumee.leftSE.consumedBy = consumer.leftSE;
	    consumee.rightSE.consumedBy = consumer.rightSE;
	  }

	  /* The first segment previous segment chain that is in the result */
	  prevInResult() {
	    if (this._prevInResult !== undefined) return this._prevInResult;
	    if (!this.prev) this._prevInResult = null;else if (this.prev.isInResult()) this._prevInResult = this.prev;else this._prevInResult = this.prev.prevInResult();
	    return this._prevInResult;
	  }
	  beforeState() {
	    if (this._beforeState !== undefined) return this._beforeState;
	    if (!this.prev) this._beforeState = {
	      rings: [],
	      windings: [],
	      multiPolys: []
	    };else {
	      const seg = this.prev.consumedBy || this.prev;
	      this._beforeState = seg.afterState();
	    }
	    return this._beforeState;
	  }
	  afterState() {
	    if (this._afterState !== undefined) return this._afterState;
	    const beforeState = this.beforeState();
	    this._afterState = {
	      rings: beforeState.rings.slice(0),
	      windings: beforeState.windings.slice(0),
	      multiPolys: []
	    };
	    const ringsAfter = this._afterState.rings;
	    const windingsAfter = this._afterState.windings;
	    const mpsAfter = this._afterState.multiPolys;

	    // calculate ringsAfter, windingsAfter
	    for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
	      const ring = this.rings[i];
	      const winding = this.windings[i];
	      const index = ringsAfter.indexOf(ring);
	      if (index === -1) {
	        ringsAfter.push(ring);
	        windingsAfter.push(winding);
	      } else windingsAfter[index] += winding;
	    }

	    // calcualte polysAfter
	    const polysAfter = [];
	    const polysExclude = [];
	    for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
	      if (windingsAfter[i] === 0) continue; // non-zero rule
	      const ring = ringsAfter[i];
	      const poly = ring.poly;
	      if (polysExclude.indexOf(poly) !== -1) continue;
	      if (ring.isExterior) polysAfter.push(poly);else {
	        if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
	        const index = polysAfter.indexOf(ring.poly);
	        if (index !== -1) polysAfter.splice(index, 1);
	      }
	    }

	    // calculate multiPolysAfter
	    for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
	      const mp = polysAfter[i].multiPoly;
	      if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
	    }
	    return this._afterState;
	  }

	  /* Is this segment part of the final result? */
	  isInResult() {
	    // if we've been consumed, we're not in the result
	    if (this.consumedBy) return false;
	    if (this._isInResult !== undefined) return this._isInResult;
	    const mpsBefore = this.beforeState().multiPolys;
	    const mpsAfter = this.afterState().multiPolys;
	    switch (operation.type) {
	      case "union":
	        {
	          // UNION - included iff:
	          //  * On one side of us there is 0 poly interiors AND
	          //  * On the other side there is 1 or more.
	          const noBefores = mpsBefore.length === 0;
	          const noAfters = mpsAfter.length === 0;
	          this._isInResult = noBefores !== noAfters;
	          break;
	        }
	      case "intersection":
	        {
	          // INTERSECTION - included iff:
	          //  * on one side of us all multipolys are rep. with poly interiors AND
	          //  * on the other side of us, not all multipolys are repsented
	          //    with poly interiors
	          let least;
	          let most;
	          if (mpsBefore.length < mpsAfter.length) {
	            least = mpsBefore.length;
	            most = mpsAfter.length;
	          } else {
	            least = mpsAfter.length;
	            most = mpsBefore.length;
	          }
	          this._isInResult = most === operation.numMultiPolys && least < most;
	          break;
	        }
	      case "xor":
	        {
	          // XOR - included iff:
	          //  * the difference between the number of multipolys represented
	          //    with poly interiors on our two sides is an odd number
	          const diff = Math.abs(mpsBefore.length - mpsAfter.length);
	          this._isInResult = diff % 2 === 1;
	          break;
	        }
	      case "difference":
	        {
	          // DIFFERENCE included iff:
	          //  * on exactly one side, we have just the subject
	          const isJustSubject = mps => mps.length === 1 && mps[0].isSubject;
	          this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
	          break;
	        }
	      default:
	        throw new Error(`Unrecognized operation type found ${operation.type}`);
	    }
	    return this._isInResult;
	  }
	}

	class RingIn {
	  constructor(geomRing, poly, isExterior) {
	    if (!Array.isArray(geomRing) || geomRing.length === 0) {
	      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
	    }
	    this.poly = poly;
	    this.isExterior = isExterior;
	    this.segments = [];
	    if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
	      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
	    }
	    const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
	    this.bbox = {
	      ll: {
	        x: firstPoint.x,
	        y: firstPoint.y
	      },
	      ur: {
	        x: firstPoint.x,
	        y: firstPoint.y
	      }
	    };
	    let prevPoint = firstPoint;
	    for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
	      if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
	        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
	      }
	      let point = rounder.round(geomRing[i][0], geomRing[i][1]);
	      // skip repeated points
	      if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
	      this.segments.push(Segment.fromRing(prevPoint, point, this));
	      if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
	      if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
	      if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
	      if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
	      prevPoint = point;
	    }
	    // add segment from last to first if last is not the same as first
	    if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
	      this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
	    }
	  }
	  getSweepEvents() {
	    const sweepEvents = [];
	    for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
	      const segment = this.segments[i];
	      sweepEvents.push(segment.leftSE);
	      sweepEvents.push(segment.rightSE);
	    }
	    return sweepEvents;
	  }
	}
	class PolyIn {
	  constructor(geomPoly, multiPoly) {
	    if (!Array.isArray(geomPoly)) {
	      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
	    }
	    this.exteriorRing = new RingIn(geomPoly[0], this, true);
	    // copy by value
	    this.bbox = {
	      ll: {
	        x: this.exteriorRing.bbox.ll.x,
	        y: this.exteriorRing.bbox.ll.y
	      },
	      ur: {
	        x: this.exteriorRing.bbox.ur.x,
	        y: this.exteriorRing.bbox.ur.y
	      }
	    };
	    this.interiorRings = [];
	    for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
	      const ring = new RingIn(geomPoly[i], this, false);
	      if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
	      if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
	      if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
	      if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
	      this.interiorRings.push(ring);
	    }
	    this.multiPoly = multiPoly;
	  }
	  getSweepEvents() {
	    const sweepEvents = this.exteriorRing.getSweepEvents();
	    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
	      const ringSweepEvents = this.interiorRings[i].getSweepEvents();
	      for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
	        sweepEvents.push(ringSweepEvents[j]);
	      }
	    }
	    return sweepEvents;
	  }
	}
	class MultiPolyIn {
	  constructor(geom, isSubject) {
	    if (!Array.isArray(geom)) {
	      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
	    }
	    try {
	      // if the input looks like a polygon, convert it to a multipolygon
	      if (typeof geom[0][0][0] === "number") geom = [geom];
	    } catch (ex) {
	      // The input is either malformed or has empty arrays.
	      // In either case, it will be handled later on.
	    }
	    this.polys = [];
	    this.bbox = {
	      ll: {
	        x: Number.POSITIVE_INFINITY,
	        y: Number.POSITIVE_INFINITY
	      },
	      ur: {
	        x: Number.NEGATIVE_INFINITY,
	        y: Number.NEGATIVE_INFINITY
	      }
	    };
	    for (let i = 0, iMax = geom.length; i < iMax; i++) {
	      const poly = new PolyIn(geom[i], this);
	      if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
	      if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
	      if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
	      if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
	      this.polys.push(poly);
	    }
	    this.isSubject = isSubject;
	  }
	  getSweepEvents() {
	    const sweepEvents = [];
	    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
	      const polySweepEvents = this.polys[i].getSweepEvents();
	      for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
	        sweepEvents.push(polySweepEvents[j]);
	      }
	    }
	    return sweepEvents;
	  }
	}

	class RingOut {
	  /* Given the segments from the sweep line pass, compute & return a series
	   * of closed rings from all the segments marked to be part of the result */
	  static factory(allSegments) {
	    const ringsOut = [];
	    for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
	      const segment = allSegments[i];
	      if (!segment.isInResult() || segment.ringOut) continue;
	      let prevEvent = null;
	      let event = segment.leftSE;
	      let nextEvent = segment.rightSE;
	      const events = [event];
	      const startingPoint = event.point;
	      const intersectionLEs = [];

	      /* Walk the chain of linked events to form a closed ring */
	      while (true) {
	        prevEvent = event;
	        event = nextEvent;
	        events.push(event);

	        /* Is the ring complete? */
	        if (event.point === startingPoint) break;
	        while (true) {
	          const availableLEs = event.getAvailableLinkedEvents();

	          /* Did we hit a dead end? This shouldn't happen.
	           * Indicates some earlier part of the algorithm malfunctioned. */
	          if (availableLEs.length === 0) {
	            const firstPt = events[0].point;
	            const lastPt = events[events.length - 1].point;
	            throw new Error(`Unable to complete output ring starting at [${firstPt.x},` + ` ${firstPt.y}]. Last matching segment found ends at` + ` [${lastPt.x}, ${lastPt.y}].`);
	          }

	          /* Only one way to go, so cotinue on the path */
	          if (availableLEs.length === 1) {
	            nextEvent = availableLEs[0].otherSE;
	            break;
	          }

	          /* We must have an intersection. Check for a completed loop */
	          let indexLE = null;
	          for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
	            if (intersectionLEs[j].point === event.point) {
	              indexLE = j;
	              break;
	            }
	          }
	          /* Found a completed loop. Cut that off and make a ring */
	          if (indexLE !== null) {
	            const intersectionLE = intersectionLEs.splice(indexLE)[0];
	            const ringEvents = events.splice(intersectionLE.index);
	            ringEvents.unshift(ringEvents[0].otherSE);
	            ringsOut.push(new RingOut(ringEvents.reverse()));
	            continue;
	          }
	          /* register the intersection */
	          intersectionLEs.push({
	            index: events.length,
	            point: event.point
	          });
	          /* Choose the left-most option to continue the walk */
	          const comparator = event.getLeftmostComparator(prevEvent);
	          nextEvent = availableLEs.sort(comparator)[0].otherSE;
	          break;
	        }
	      }
	      ringsOut.push(new RingOut(events));
	    }
	    return ringsOut;
	  }
	  constructor(events) {
	    this.events = events;
	    for (let i = 0, iMax = events.length; i < iMax; i++) {
	      events[i].segment.ringOut = this;
	    }
	    this.poly = null;
	  }
	  getGeom() {
	    // Remove superfluous points (ie extra points along a straight line),
	    let prevPt = this.events[0].point;
	    const points = [prevPt];
	    for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
	      const pt = this.events[i].point;
	      const nextPt = this.events[i + 1].point;
	      if (compareVectorAngles(pt, prevPt, nextPt) === 0) continue;
	      points.push(pt);
	      prevPt = pt;
	    }

	    // ring was all (within rounding error of angle calc) colinear points
	    if (points.length === 1) return null;

	    // check if the starting point is necessary
	    const pt = points[0];
	    const nextPt = points[1];
	    if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
	    points.push(points[0]);
	    const step = this.isExteriorRing() ? 1 : -1;
	    const iStart = this.isExteriorRing() ? 0 : points.length - 1;
	    const iEnd = this.isExteriorRing() ? points.length : -1;
	    const orderedPoints = [];
	    for (let i = iStart; i != iEnd; i += step) orderedPoints.push([points[i].x, points[i].y]);
	    return orderedPoints;
	  }
	  isExteriorRing() {
	    if (this._isExteriorRing === undefined) {
	      const enclosing = this.enclosingRing();
	      this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
	    }
	    return this._isExteriorRing;
	  }
	  enclosingRing() {
	    if (this._enclosingRing === undefined) {
	      this._enclosingRing = this._calcEnclosingRing();
	    }
	    return this._enclosingRing;
	  }

	  /* Returns the ring that encloses this one, if any */
	  _calcEnclosingRing() {
	    // start with the ealier sweep line event so that the prevSeg
	    // chain doesn't lead us inside of a loop of ours
	    let leftMostEvt = this.events[0];
	    for (let i = 1, iMax = this.events.length; i < iMax; i++) {
	      const evt = this.events[i];
	      if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
	    }
	    let prevSeg = leftMostEvt.segment.prevInResult();
	    let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
	    while (true) {
	      // no segment found, thus no ring can enclose us
	      if (!prevSeg) return null;

	      // no segments below prev segment found, thus the ring of the prev
	      // segment must loop back around and enclose us
	      if (!prevPrevSeg) return prevSeg.ringOut;

	      // if the two segments are of different rings, the ring of the prev
	      // segment must either loop around us or the ring of the prev prev
	      // seg, which would make us and the ring of the prev peers
	      if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
	        if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
	          return prevSeg.ringOut;
	        } else return prevSeg.ringOut.enclosingRing();
	      }

	      // two segments are from the same ring, so this was a penisula
	      // of that ring. iterate downward, keep searching
	      prevSeg = prevPrevSeg.prevInResult();
	      prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
	    }
	  }
	}
	class PolyOut {
	  constructor(exteriorRing) {
	    this.exteriorRing = exteriorRing;
	    exteriorRing.poly = this;
	    this.interiorRings = [];
	  }
	  addInterior(ring) {
	    this.interiorRings.push(ring);
	    ring.poly = this;
	  }
	  getGeom() {
	    const geom = [this.exteriorRing.getGeom()];
	    // exterior ring was all (within rounding error of angle calc) colinear points
	    if (geom[0] === null) return null;
	    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
	      const ringGeom = this.interiorRings[i].getGeom();
	      // interior ring was all (within rounding error of angle calc) colinear points
	      if (ringGeom === null) continue;
	      geom.push(ringGeom);
	    }
	    return geom;
	  }
	}
	class MultiPolyOut {
	  constructor(rings) {
	    this.rings = rings;
	    this.polys = this._composePolys(rings);
	  }
	  getGeom() {
	    const geom = [];
	    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
	      const polyGeom = this.polys[i].getGeom();
	      // exterior ring was all (within rounding error of angle calc) colinear points
	      if (polyGeom === null) continue;
	      geom.push(polyGeom);
	    }
	    return geom;
	  }
	  _composePolys(rings) {
	    const polys = [];
	    for (let i = 0, iMax = rings.length; i < iMax; i++) {
	      const ring = rings[i];
	      if (ring.poly) continue;
	      if (ring.isExteriorRing()) polys.push(new PolyOut(ring));else {
	        const enclosingRing = ring.enclosingRing();
	        if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
	        enclosingRing.poly.addInterior(ring);
	      }
	    }
	    return polys;
	  }
	}

	/**
	 * NOTE:  We must be careful not to change any segments while
	 *        they are in the SplayTree. AFAIK, there's no way to tell
	 *        the tree to rebalance itself - thus before splitting
	 *        a segment that's in the tree, we remove it from the tree,
	 *        do the split, then re-insert it. (Even though splitting a
	 *        segment *shouldn't* change its correct position in the
	 *        sweep line tree, the reality is because of rounding errors,
	 *        it sometimes does.)
	 */

	class SweepLine {
	  constructor(queue) {
	    let comparator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Segment.compare;
	    this.queue = queue;
	    this.tree = new z(comparator);
	    this.segments = [];
	  }
	  process(event) {
	    const segment = event.segment;
	    const newEvents = [];

	    // if we've already been consumed by another segment,
	    // clean up our body parts and get out
	    if (event.consumedBy) {
	      if (event.isLeft) this.queue.remove(event.otherSE);else this.tree.remove(segment);
	      return newEvents;
	    }
	    const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
	    if (!node) throw new Error(`Unable to find segment #${segment.id} ` + `[${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> ` + `[${segment.rightSE.point.x}, ${segment.rightSE.point.y}] ` + "in SweepLine tree.");
	    let prevNode = node;
	    let nextNode = node;
	    let prevSeg = undefined;
	    let nextSeg = undefined;

	    // skip consumed segments still in tree
	    while (prevSeg === undefined) {
	      prevNode = this.tree.prev(prevNode);
	      if (prevNode === null) prevSeg = null;else if (prevNode.key.consumedBy === undefined) prevSeg = prevNode.key;
	    }

	    // skip consumed segments still in tree
	    while (nextSeg === undefined) {
	      nextNode = this.tree.next(nextNode);
	      if (nextNode === null) nextSeg = null;else if (nextNode.key.consumedBy === undefined) nextSeg = nextNode.key;
	    }
	    if (event.isLeft) {
	      // Check for intersections against the previous segment in the sweep line
	      let prevMySplitter = null;
	      if (prevSeg) {
	        const prevInter = prevSeg.getIntersection(segment);
	        if (prevInter !== null) {
	          if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
	          if (!prevSeg.isAnEndpoint(prevInter)) {
	            const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
	            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
	              newEvents.push(newEventsFromSplit[i]);
	            }
	          }
	        }
	      }

	      // Check for intersections against the next segment in the sweep line
	      let nextMySplitter = null;
	      if (nextSeg) {
	        const nextInter = nextSeg.getIntersection(segment);
	        if (nextInter !== null) {
	          if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
	          if (!nextSeg.isAnEndpoint(nextInter)) {
	            const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
	            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
	              newEvents.push(newEventsFromSplit[i]);
	            }
	          }
	        }
	      }

	      // For simplicity, even if we find more than one intersection we only
	      // spilt on the 'earliest' (sweep-line style) of the intersections.
	      // The other intersection will be handled in a future process().
	      if (prevMySplitter !== null || nextMySplitter !== null) {
	        let mySplitter = null;
	        if (prevMySplitter === null) mySplitter = nextMySplitter;else if (nextMySplitter === null) mySplitter = prevMySplitter;else {
	          const cmpSplitters = SweepEvent.comparePoints(prevMySplitter, nextMySplitter);
	          mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
	        }

	        // Rounding errors can cause changes in ordering,
	        // so remove afected segments and right sweep events before splitting
	        this.queue.remove(segment.rightSE);
	        newEvents.push(segment.rightSE);
	        const newEventsFromSplit = segment.split(mySplitter);
	        for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
	          newEvents.push(newEventsFromSplit[i]);
	        }
	      }
	      if (newEvents.length > 0) {
	        // We found some intersections, so re-do the current event to
	        // make sure sweep line ordering is totally consistent for later
	        // use with the segment 'prev' pointers
	        this.tree.remove(segment);
	        newEvents.push(event);
	      } else {
	        // done with left event
	        this.segments.push(segment);
	        segment.prev = prevSeg;
	      }
	    } else {
	      // event.isRight

	      // since we're about to be removed from the sweep line, check for
	      // intersections between our previous and next segments
	      if (prevSeg && nextSeg) {
	        const inter = prevSeg.getIntersection(nextSeg);
	        if (inter !== null) {
	          if (!prevSeg.isAnEndpoint(inter)) {
	            const newEventsFromSplit = this._splitSafely(prevSeg, inter);
	            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
	              newEvents.push(newEventsFromSplit[i]);
	            }
	          }
	          if (!nextSeg.isAnEndpoint(inter)) {
	            const newEventsFromSplit = this._splitSafely(nextSeg, inter);
	            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
	              newEvents.push(newEventsFromSplit[i]);
	            }
	          }
	        }
	      }
	      this.tree.remove(segment);
	    }
	    return newEvents;
	  }

	  /* Safely split a segment that is currently in the datastructures
	   * IE - a segment other than the one that is currently being processed. */
	  _splitSafely(seg, pt) {
	    // Rounding errors can cause changes in ordering,
	    // so remove afected segments and right sweep events before splitting
	    // removeNode() doesn't work, so have re-find the seg
	    // https://github.com/w8r/splay-tree/pull/5
	    this.tree.remove(seg);
	    const rightSE = seg.rightSE;
	    this.queue.remove(rightSE);
	    const newEvents = seg.split(pt);
	    newEvents.push(rightSE);
	    // splitting can trigger consumption
	    if (seg.consumedBy === undefined) this.tree.add(seg);
	    return newEvents;
	  }
	}

	// Limits on iterative processes to prevent infinite loops - usually caused by floating-point math round-off errors.
	const POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1000000;
	const POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1000000;
	class Operation {
	  run(type, geom, moreGeoms) {
	    operation.type = type;
	    rounder.reset();

	    /* Convert inputs to MultiPoly objects */
	    const multipolys = [new MultiPolyIn(geom, true)];
	    for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
	      multipolys.push(new MultiPolyIn(moreGeoms[i], false));
	    }
	    operation.numMultiPolys = multipolys.length;

	    /* BBox optimization for difference operation
	     * If the bbox of a multipolygon that's part of the clipping doesn't
	     * intersect the bbox of the subject at all, we can just drop that
	     * multiploygon. */
	    if (operation.type === "difference") {
	      // in place removal
	      const subject = multipolys[0];
	      let i = 1;
	      while (i < multipolys.length) {
	        if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;else multipolys.splice(i, 1);
	      }
	    }

	    /* BBox optimization for intersection operation
	     * If we can find any pair of multipolygons whose bbox does not overlap,
	     * then the result will be empty. */
	    if (operation.type === "intersection") {
	      // TODO: this is O(n^2) in number of polygons. By sorting the bboxes,
	      //       it could be optimized to O(n * ln(n))
	      for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
	        const mpA = multipolys[i];
	        for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
	          if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
	        }
	      }
	    }

	    /* Put segment endpoints in a priority queue */
	    const queue = new z(SweepEvent.compare);
	    for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
	      const sweepEvents = multipolys[i].getSweepEvents();
	      for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
	        queue.insert(sweepEvents[j]);
	        if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
	          // prevents an infinite loop, an otherwise common manifestation of bugs
	          throw new Error("Infinite loop when putting segment endpoints in a priority queue " + "(queue size too big).");
	        }
	      }
	    }

	    /* Pass the sweep line over those endpoints */
	    const sweepLine = new SweepLine(queue);
	    let prevQueueSize = queue.size;
	    let node = queue.pop();
	    while (node) {
	      const evt = node.key;
	      if (queue.size === prevQueueSize) {
	        // prevents an infinite loop, an otherwise common manifestation of bugs
	        const seg = evt.segment;
	        throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent ` + `[${evt.point.x}, ${evt.point.y}] from segment #${seg.id} ` + `[${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> ` + `[${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
	      }
	      if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
	        // prevents an infinite loop, an otherwise common manifestation of bugs
	        throw new Error("Infinite loop when passing sweep line over endpoints " + "(queue size too big).");
	      }
	      if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
	        // prevents an infinite loop, an otherwise common manifestation of bugs
	        throw new Error("Infinite loop when passing sweep line over endpoints " + "(too many sweep line segments).");
	      }
	      const newEvents = sweepLine.process(evt);
	      for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
	        const evt = newEvents[i];
	        if (evt.consumedBy === undefined) queue.insert(evt);
	      }
	      prevQueueSize = queue.size;
	      node = queue.pop();
	    }

	    // free some memory we don't need anymore
	    rounder.reset();

	    /* Collect and compile segments we're keeping into a multipolygon */
	    const ringsOut = RingOut.factory(sweepLine.segments);
	    const result = new MultiPolyOut(ringsOut);
	    return result.getGeom();
	  }
	}

	// singleton available by import
	const operation = new Operation();

	const union = function (geom) {
	  for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	    moreGeoms[_key - 1] = arguments[_key];
	  }
	  return operation.run("union", geom, moreGeoms);
	};
	const intersection = function (geom) {
	  for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
	    moreGeoms[_key2 - 1] = arguments[_key2];
	  }
	  return operation.run("intersection", geom, moreGeoms);
	};
	const xor = function (geom) {
	  for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
	    moreGeoms[_key3 - 1] = arguments[_key3];
	  }
	  return operation.run("xor", geom, moreGeoms);
	};
	const difference = function (subjectGeom) {
	  for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
	    clippingGeoms[_key4 - 1] = arguments[_key4];
	  }
	  return operation.run("difference", subjectGeom, clippingGeoms);
	};
	var index = {
	  union: union,
	  intersection: intersection,
	  xor: xor,
	  difference: difference
	};

	const PLAYER_RADIUS$1 = 15;
	const TRAIL_MIN_DIST = 10;

	// Point in polygon check
	function pointInPolygon(point, polygon) {
		if (!polygon || polygon.length < 3) return false;
		
		let inside = false;
		const x = point.x, y = point.y;
		
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const xi = polygon[i].x, yi = polygon[i].y;
			const xj = polygon[j].x, yj = polygon[j].y;
			
			if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
				inside = !inside;
			}
		}
		return inside;
	}

	// Check collision between two players
	function checkPlayerCollision(p1, p2) {
		const dx = p1.x - p2.x;
		const dy = p1.y - p2.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		return dist < PLAYER_RADIUS$1 * 2;
	}

	// Trail class for free movement
	class Trail {
		constructor(player) {
			this.player = player;
			this.points = [];
		}
		
		addPoint(x, y) {
			if (this.points.length > 0) {
				const last = this.points[this.points.length - 1];
				const dx = x - last.x;
				const dy = y - last.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < TRAIL_MIN_DIST) return;
			}
			this.points.push({ x, y });
		}
		
		clear() {
			this.points = [];
		}
		
		hitsTrail(x, y, skipDist) {
			if (this.points.length < 2) return null;
			
			const checkPoint = { x, y };
			
			// Check if point is near any trail segment (excluding recent points)
			for (let i = 0; i < this.points.length - 1; i++) {
				const p1 = this.points[i];
				const p2 = this.points[i + 1];
				
				// Skip recent segments for self-collision
				if (skipDist > 0 && i >= this.points.length - 3) continue;
				
				const hitInfo = pointToSegmentHit(checkPoint, p1, p2);
				if (hitInfo.distance < PLAYER_RADIUS$1) {
					return {
						index: i,
						point: hitInfo.point
					};
				}
			}
			return null;
		}
		
		render(ctx) {
			if (this.points.length < 2) return;
			
			const player = this.player;
			
			// If snipped, render the fuse effect
			if (player.isSnipped && player.snipFusePosition) {
				const fusePos = player.snipFusePosition;
				
				// Draw the "safe" portion (from fuse to player) - this is the unburned trail
				// This portion starts at the fuse position and continues through the rest of the trail points
				ctx.strokeStyle = player.tailColor.rgbString();
				ctx.lineWidth = PLAYER_RADIUS$1;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";
				
				ctx.beginPath();
				ctx.moveTo(fusePos.x, fusePos.y);
				
				// Draw from fuse to the end of the current segment it's on
				if (fusePos.segmentIndex + 1 < this.points.length) {
					for (let i = fusePos.segmentIndex + 1; i < this.points.length; i++) {
						ctx.lineTo(this.points[i].x, this.points[i].y);
					}
				}
				// Also draw to the player's current position
				ctx.lineTo(player.x, player.y);
				ctx.stroke();
				
				// Draw the fuse head - glowing spark effect
				const time = Date.now() / 100;
				const pulse = 0.7 + 0.3 * Math.sin(time * 3);
				const sparkSize = PLAYER_RADIUS$1 * 1.2 * pulse;
				
				// Outer glow
				const gradient = ctx.createRadialGradient(fusePos.x, fusePos.y, 0, fusePos.x, fusePos.y, sparkSize * 2);
				gradient.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
				gradient.addColorStop(0.3, 'rgba(255, 100, 0, 0.6)');
				gradient.addColorStop(0.6, 'rgba(255, 50, 0, 0.3)');
				gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
				
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(fusePos.x, fusePos.y, sparkSize * 2, 0, Math.PI * 2);
				ctx.fill();
				
				// Inner bright core
				ctx.fillStyle = `rgba(255, 255, 200, ${pulse})`;
				ctx.beginPath();
				ctx.arc(fusePos.x, fusePos.y, sparkSize * 0.5, 0, Math.PI * 2);
				ctx.fill();
				
				// Sparks
				ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
				for (let i = 0; i < 5; i++) {
					const angle = time * 2 + i * (Math.PI * 2 / 5);
					const dist = sparkSize * (0.8 + 0.4 * Math.sin(time * 5 + i));
					const sx = fusePos.x + Math.cos(angle) * dist;
					const sy = fusePos.y + Math.sin(angle) * dist;
					ctx.beginPath();
					ctx.arc(sx, sy, 3, 0, Math.PI * 2);
					ctx.fill();
				}
			} else {
				// Normal trail rendering
				ctx.strokeStyle = player.tailColor.rgbString();
				ctx.lineWidth = PLAYER_RADIUS$1;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";
				
				ctx.beginPath();
				ctx.moveTo(this.points[0].x, this.points[0].y);
				for (let i = 1; i < this.points.length; i++) {
					ctx.lineTo(this.points[i].x, this.points[i].y);
				}
				ctx.stroke();
			}
		}
		
		serialData() {
			return this.points.slice();
		}
	}

	function pointToSegmentHit(p, v, w) {
		const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
		if (l2 === 0) {
			const d = Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
			return { distance: d, point: { x: v.x, y: v.y } };
		}
		
		let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
		t = Math.max(0, Math.min(1, t));
		
		const projX = v.x + t * (w.x - v.x);
		const projY = v.y + t * (w.y - v.y);
		
		const d = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
		return { distance: d, point: { x: projX, y: projY } };
	}

	function Player(sdata) {
		// Handle both old (grid, sdata) and new (sdata) signatures
		if (arguments.length === 2) {
			sdata = arguments[1];
		}
		sdata = sdata || {};
		
		// Position and movement
		this.x = sdata.posX || sdata.x || 0;
		this.y = sdata.posY || sdata.y || 0;
		this.spawnX = sdata.spawnX || this.x;
		this.spawnY = sdata.spawnY || this.y;
		this.angle = sdata.angle || 0;
		this.targetAngle = sdata.targetAngle || this.angle;
		this.speedMult = sdata.speedMult ?? 1.0;
		this.speed = consts.SPEED * this.speedMult;
		
		// Player info
		this.num = sdata.num;
		this.name = sdata.name || "Player " + (this.num + 1);
		this.waitLag = sdata.waitLag || 0;
		this.dead = false;

		// XP + Leveling System
		this.level = sdata.level ?? 1;    // Starts at level 1
		this.xp = sdata.xp ?? 0;          // Current XP (0 to XP_PER_LEVEL-1)
		
		// Size scaling based on level: sizeScale = clamp(1.0 + (level-1)*0.05, 1.0, 1.6)
		const sizeScalePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL ;
		const sizeScaleMax = consts.PLAYER_SIZE_SCALE_MAX ;
		this.sizeScale = Math.min(sizeScaleMax, Math.max(1.0, 1.0 + (this.level - 1) * sizeScalePerLevel));

		// Stat multipliers
		this.snipGraceBonusSec = sdata.snipGraceBonusSec ?? 0;
		this._pendingTerritoryAreaGained = 0; // Accumulates area in px^2
		this._territoryCoinCarry = 0; // Carryover for fractional coin conversion
		
		// Snip system state
		this.isSnipped = sdata.isSnipped ?? false;
		this.snippedBy = sdata.snippedBy ?? null; // Player number who caused the snip (null for self-snip)
		this.snipTimeRemaining = sdata.snipTimeRemaining ?? 0;
		this.snipMaxTime = sdata.snipMaxTime ?? 0;
		this.snipStartPoint = sdata.snipStartPoint ?? null;
		this.snipProgressDist = sdata.snipProgressDist ?? 0;
		this.snipFuseSpeed = sdata.snipFuseSpeed ?? (this.speed * consts.SNIP_FUSE_SPEED_MULT);
		this.snipTrailIndex = sdata.snipTrailIndex ?? -1;
		this.snipFusePosition = sdata.snipFusePosition ?? null;
		this.snipTotalTrailLength = sdata.snipTotalTrailLength ?? 0;
		// Exponential fuse acceleration state
		this.snipElapsed = sdata.snipElapsed ?? 0; // seconds since snip started
		
		// Trail speed buff state
		this.trailStartTime = sdata.trailStartTime ?? null; // When player left territory (null if in territory)
		this.currentSpeedBuff = sdata.currentSpeedBuff ?? 1.0; // Current speed multiplier
		
		// HP system (for combat damage from drones)
		this.hp = sdata.hp ?? (consts.PLAYER_MAX_HP );
		this.maxHp = sdata.maxHp ?? (consts.PLAYER_MAX_HP );
		
		// Territory and trail
		this.territory = sdata.territory || [];
		this.trail = new Trail(this);
		if (sdata.trail && Array.isArray(sdata.trail)) {
			sdata.trail.forEach(p => this.trail.points.push({ x: p.x, y: p.y }));
		}
		
		// Colors
		let base;
		if (sdata.base) {
			base = this.baseColor = sdata.base instanceof Color ? sdata.base : Color.fromData(sdata.base);
		} else {
			const hue = Math.random();
			this.baseColor = base = new Color(hue, 0.8, 0.5);
		}
		this.lightBaseColor = base.deriveLumination(0.1);
		this.shadowColor = base.deriveLumination(-0.3);
		this.tailColor = base.deriveLumination(0.2).deriveAlpha(0.98);
		
		// Map bounds
		this.mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
	}

	Player.prototype.move = function(deltaSeconds) {
		deltaSeconds = deltaSeconds || 1/60;
		const frameScale = deltaSeconds / (1 / 60);
		
		if (this.waitLag < consts.NEW_PLAYER_LAG) {
			this.waitLag += frameScale;
			return;
		}
		
		// Handle snip logic
		if (this.isSnipped) {
			this.updateSnip(deltaSeconds);
			if (this.dead) return;
		}
		
		// Smoothly interpolate angle towards target
		let angleDiff = this.targetAngle - this.angle;
		while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
		while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
		
		const turnSpeed = 0.15 * frameScale;
		if (Math.abs(angleDiff) < turnSpeed) {
			this.angle = this.targetAngle;
		} else {
			this.angle += Math.sign(angleDiff) * turnSpeed;
		}
		
		// Check if in own territory for speed buff
		const inTerritory = this.isInOwnTerritory();
		
		// Calculate trail speed buff (increases speed when outside territory over time)
		// Speed buff is disabled when snipped - player moves at base speed
		const now = Date.now();
		if (inTerritory) {
			// Reset trail time when in territory
			this.trailStartTime = null;
			this.currentSpeedBuff = 1.0;
		} else if (this.isSnipped) {
			// No speed buff while snipped - stuck at base speed
			this.trailStartTime = null;
			this.currentSpeedBuff = 1.0;
		} else {
			// Outside territory - track time and calculate speed buff
			if (this.trailStartTime === null) {
				this.trailStartTime = now;
			}
			
			const timeOutsideSec = (now - this.trailStartTime) / 1000;
			this.currentSpeedBuff = this.calculateSpeedBuff(timeOutsideSec);
		}
		
		// Apply speed buff to movement
		// Include upgrade moveSpeedMult if available
		const upgradeSpeedMult = (this.derivedStats && this.derivedStats.moveSpeedMult) || 1.0;
		const speedMultiplier = this.currentSpeedBuff * upgradeSpeedMult;

		// Move in current direction
		this.x += Math.cos(this.angle) * this.speed * speedMultiplier * frameScale;
		this.y += Math.sin(this.angle) * this.speed * speedMultiplier * frameScale;
		
		// Clamp to map bounds (sliding against walls)
		this.x = Math.max(PLAYER_RADIUS$1, Math.min(this.mapSize - PLAYER_RADIUS$1, this.x));
		this.y = Math.max(PLAYER_RADIUS$1, Math.min(this.mapSize - PLAYER_RADIUS$1, this.y));
		
		// If snipped, don't do normal trail/capture logic - updateSnip handles safety check
		if (this.isSnipped) {
			// Still add trail points while snipped (player is still moving)
			if (!inTerritory) {
				this.trail.addPoint(this.x, this.y);
			}
			// Safety check is handled in updateSnip
			return;
		}
		
		if (inTerritory && this.trail.points.length > 2) {
			// Returned to territory - capture area
			this.captureTerritory();
			this.trail.clear();
		} else if (!inTerritory) {
			// Outside territory - add to trail
			this.trail.addPoint(this.x, this.y);
		}
	};

	Player.prototype.isInOwnTerritory = function() {
		return pointInPolygon({ x: this.x, y: this.y }, this.territory);
	};

	/**
	 * Calculate speed buff based on time outside territory
	 * Uses config values: TRAIL_SPEED_BUFF_MAX, TRAIL_SPEED_BUFF_RAMP_TIME, TRAIL_SPEED_BUFF_EASE
	 */
	Player.prototype.calculateSpeedBuff = function(timeOutsideSec) {
		const maxBuff = consts.TRAIL_SPEED_BUFF_MAX ;
		const rampTime = consts.TRAIL_SPEED_BUFF_RAMP_TIME ;
		const ease = consts.TRAIL_SPEED_BUFF_EASE ;
		
		// Progress from 0 to 1 over ramp time
		const progress = Math.min(1, timeOutsideSec / rampTime);
		
		// Apply easing (higher ease = slower start)
		const easedProgress = Math.pow(progress, ease);
		
		// Calculate buff: 1.0 to maxBuff
		return 1.0 + (maxBuff - 1.0) * easedProgress;
	};

	Player.prototype.captureTerritory = function() {
		if (this.trail.points.length < 3) return;
		
		// Cannot capture if snipped
		if (this.isSnipped) return;
		
		// Find where the trail intersects the territory boundary
		const trail = this.trail.points;
		const territory = this.territory;
		
		if (territory.length < 3) {
			// No existing territory - create from trail
			this.territory = trail.map(p => ({ x: p.x, y: p.y }));
			return;
		}
		
		// Find entry and exit points on territory boundary
		let entryIdx = -1, exitIdx = -1;
		let entryPoint = null, exitPoint = null;
		
		// Find where trail starts (exits territory)
		for (let i = 0; i < territory.length; i++) {
			const t1 = territory[i];
			const t2 = territory[(i + 1) % territory.length];
			
			// Check trail start
			if (entryIdx === -1 && trail.length > 1) {
				const intersection = getLineIntersection(trail[0], trail[1], t1, t2);
				if (intersection) {
					entryIdx = i;
					entryPoint = intersection;
				}
			}
			
			// Check trail end  
			if (trail.length > 1) {
				const lastIdx = trail.length - 1;
				const intersection = getLineIntersection(trail[lastIdx - 1], trail[lastIdx], t1, t2);
				if (intersection) {
					exitIdx = i;
					exitPoint = intersection;
				}
			}
		}
		
		// If we couldn't find proper intersections, use simpler approach
		if (entryIdx === -1 || exitIdx === -1) {
			// Find closest territory points to trail start/end
			let minDistStart = Infinity, minDistEnd = Infinity;
			
			for (let i = 0; i < territory.length; i++) {
				const t = territory[i];
				const distStart = Math.sqrt((t.x - trail[0].x) ** 2 + (t.y - trail[0].y) ** 2);
				const distEnd = Math.sqrt((t.x - trail[trail.length - 1].x) ** 2 + (t.y - trail[trail.length - 1].y) ** 2);
				
				if (distStart < minDistStart) {
					minDistStart = distStart;
					entryIdx = i;
					entryPoint = { x: trail[0].x, y: trail[0].y };
				}
				if (distEnd < minDistEnd) {
					minDistEnd = distEnd;
					exitIdx = i;
					exitPoint = { x: trail[trail.length - 1].x, y: trail[trail.length - 1].y };
				}
			}
		}
		
		if (entryIdx === -1 || exitIdx === -1) return;
		
		// Build new territory by combining trail with a territory boundary segment.
		// There are TWO possible boundary paths between exit and entry; picking the wrong one
		// can shrink/overwrite territory. We build both candidates and keep the one that
		// preserves/increases area.
		const n = territory.length;
		const prevArea = polygonAreaAbs(territory);
		const EPS_AREA = 1e-2;
		
		function clonePoint(p) {
			return { x: p.x, y: p.y };
		}
		
		function dedupeConsecutive(points) {
			if (!points || points.length === 0) return [];
			const out = [points[0]];
			for (let i = 1; i < points.length; i++) {
				const a = out[out.length - 1];
				const b = points[i];
				if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) continue;
				out.push(b);
			}
			// Drop last point if it equals first (we implicitly close polygons elsewhere)
			if (out.length > 2) {
				const a = out[0];
				const b = out[out.length - 1];
				if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) out.pop();
			}
			return out;
		}
		
		function collectBoundaryForward(fromSegIdx, toSegIdx) {
			// Traverse vertices from (fromSegIdx+1) up to and including toSegIdx.
			const pts = [];
			let i = (fromSegIdx + 1) % n;
			const visited = new Set();
			while (!visited.has(i)) {
				visited.add(i);
				pts.push(clonePoint(territory[i]));
				if (i === toSegIdx) break;
				i = (i + 1) % n;
			}
			return pts;
		}
		
		function collectBoundaryReverse(fromSegIdx, toSegIdx) {
			// Traverse vertices from fromSegIdx down to and including (toSegIdx+1).
			const pts = [];
			let i = fromSegIdx;
			const stop = (toSegIdx + 1) % n;
			const visited = new Set();
			while (!visited.has(i)) {
				visited.add(i);
				pts.push(clonePoint(territory[i]));
				if (i === stop) break;
				i = (i - 1 + n) % n;
			}
			return pts;
		}
		
		function buildCandidate(boundaryPts) {
			const poly = [];
			if (entryPoint) poly.push(clonePoint(entryPoint));
			for (const p of trail) poly.push(clonePoint(p));
			if (exitPoint) poly.push(clonePoint(exitPoint));
			for (const p of boundaryPts) poly.push(clonePoint(p));
			return dedupeConsecutive(poly);
		}
		
		const candForward = buildCandidate(collectBoundaryForward(exitIdx, entryIdx));
		const candReverse = buildCandidate(collectBoundaryReverse(exitIdx, entryIdx));
		
		const areaF = polygonAreaAbs(candForward);
		const areaR = polygonAreaAbs(candReverse);
		
		// Prefer the candidate that grows territory; never allow a meaningful shrink.
		let chosen = null;
		if (areaF >= areaR) chosen = candForward;
		else chosen = candReverse;
		
		const chosenArea = polygonAreaAbs(chosen);
		if (chosen && chosen.length >= 3 && chosenArea + EPS_AREA >= prevArea) {
			const areaDelta = Math.max(0, chosenArea - prevArea);
			this.territory = chosen;
			this._pendingTerritoryAreaGained += areaDelta;
		} else {
			// Fallback: choose the bigger one only if it doesn't shrink too much.
			const best = areaF >= areaR ? candForward : candReverse;
			const bestArea = Math.max(areaF, areaR);
			if (best && best.length >= 3 && bestArea + EPS_AREA >= prevArea) {
				const areaDelta = Math.max(0, bestArea - prevArea);
				this.territory = best;
				this._pendingTerritoryAreaGained += areaDelta;
			}
			// Otherwise keep existing territory (better than nuking it).
		}
	};

	function polygonAreaAbs(polygon) {
		if (!polygon || polygon.length < 3) return 0;
		let area = 0;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
		}
		return Math.abs(area / 2);
	}

	function getLineIntersection(p1, p2, p3, p4) {
		const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
		if (Math.abs(d) < 0.0001) return null;
		
		const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
		const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
		
		if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
			return {
				x: p1.x + t * (p2.x - p1.x),
				y: p1.y + t * (p2.y - p1.y)
			};
		}
		return null;
	}

	// ===== POLYGON BOOLEAN OPERATIONS =====

	/**
	 * Check if two polygons overlap (bounding box + point-in-polygon check)
	 */
	function polygonsOverlap(polyA, polyB) {
		if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;
		
		// Quick bounding box check first
		const boundsA = getPolygonBounds(polyA);
		const boundsB = getPolygonBounds(polyB);
		
		if (boundsA.maxX < boundsB.minX || boundsB.maxX < boundsA.minX ||
			boundsA.maxY < boundsB.minY || boundsB.maxY < boundsA.minY) {
			return false;
		}
		
		// Check if any vertex of A is inside B or vice versa
		for (const p of polyA) {
			if (pointInPolygon(p, polyB)) return true;
		}
		for (const p of polyB) {
			if (pointInPolygon(p, polyA)) return true;
		}
		
		// Check if any edges intersect
		for (let i = 0; i < polyA.length; i++) {
			const a1 = polyA[i];
			const a2 = polyA[(i + 1) % polyA.length];
			for (let j = 0; j < polyB.length; j++) {
				const b1 = polyB[j];
				const b2 = polyB[(j + 1) % polyB.length];
				if (getLineIntersection(a1, a2, b1, b2)) return true;
			}
		}
		
		return false;
	}

	function getPolygonBounds(polygon) {
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;
		for (const p of polygon) {
			if (p.x < minX) minX = p.x;
			if (p.x > maxX) maxX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.y > maxY) maxY = p.y;
		}
		return { minX, maxX, minY, maxY };
	}

	/**
	 * Subtract clipPoly from subjectPoly.
	 * Returns the part of subjectPoly that is OUTSIDE clipPoly.
	 * Uses a robust vertex/intersection based approach with proper boundary tracing.
	 */
	function subtractTerritorySimple(subjectPoly, clipPoly, preferPoint) {
		return subtractTerritory(subjectPoly, clipPoly, preferPoint);
	}

	/**
	 * Robust territory subtraction using polygon boolean operations.
	 *
	 * - Handles edge-only overlaps (no subject vertices inside clip).
	 * - Handles splits (difference yields multiple polygons) by selecting a single best piece.
	 * - Optionally prefers the piece containing `preferPoint` (e.g. defender's spawn).
	 */
	function subtractTerritory(subjectPoly, clipPoly, preferPoint) {
		if (!subjectPoly || subjectPoly.length < 3) return subjectPoly;
		if (!clipPoly || clipPoly.length < 3) return subjectPoly;
		if (!polygonsOverlap(subjectPoly, clipPoly)) return subjectPoly;

		const toRing = (poly) => poly.map(p => [p.x, p.y]);
		const pcSubject = [toRing(subjectPoly)];
		const pcClip = [toRing(clipPoly)];

		let diff;
		try {
			diff = index.difference(pcSubject, pcClip);
		} catch (err) {
			// Fallback: keep original (better than corrupting territory).
			// This should be rare; polygon-clipping is usually robust.
			return subjectPoly;
		}

		if (!diff || diff.length === 0) return [];

		const EPS = 1e-6;
		const cleanedCandidates = [];

		for (const poly of diff) {
			if (!poly || poly.length === 0) continue;
			const outer = poly[0];
			if (!outer || outer.length < 4) continue; // polygon-clipping returns closed rings

			let pts = outer.map(([x, y]) => ({ x, y }));
			// Drop closing point if it equals the first.
			if (pts.length >= 2) {
				const a = pts[0];
				const b = pts[pts.length - 1];
				if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) {
					pts = pts.slice(0, -1);
				}
			}

			// Dedupe consecutive near-identical points.
			const cleaned = [];
			for (const p of pts) {
				if (cleaned.length === 0) {
					cleaned.push(p);
					continue;
				}
				const last = cleaned[cleaned.length - 1];
				if (Math.abs(p.x - last.x) < EPS && Math.abs(p.y - last.y) < EPS) continue;
				cleaned.push(p);
			}
			// Also drop last if it matches first.
			if (cleaned.length >= 2) {
				const a = cleaned[0];
				const b = cleaned[cleaned.length - 1];
				if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) cleaned.pop();
			}

			if (cleaned.length >= 3) {
				cleanedCandidates.push(cleaned);
			}
		}

		if (cleanedCandidates.length === 0) return [];

		const hasPrefer =
			preferPoint &&
			typeof preferPoint.x === "number" &&
			typeof preferPoint.y === "number" &&
			Number.isFinite(preferPoint.x) &&
			Number.isFinite(preferPoint.y);

		let candidates = cleanedCandidates;
		if (hasPrefer) {
			const containing = cleanedCandidates.filter(poly => pointInPolygon(preferPoint, poly));
			// If spawn point is in a remaining piece, prefer those pieces
			// If spawn was captured but there ARE remaining pieces, keep the largest piece
			// (Don't throw away all territory just because spawn was captured)
			if (containing.length > 0) {
				candidates = containing;
			}
			// If no pieces contain spawn, candidates stays as cleanedCandidates
			// and we'll pick the largest remaining piece below
		}

		let best = candidates[0];
		let bestArea = polygonAreaAbs(best);
		for (let i = 1; i < candidates.length; i++) {
			const area = polygonAreaAbs(candidates[i]);
			if (area > bestArea) {
				bestArea = area;
				best = candidates[i];
			}
		}

		return best;
	}

	Player.prototype.startSnip = function(collisionPoint, hitInfo, snipperNum) {
		if (this.isSnipped) return; // Ignore if already snipped (per MVP recommendation)
		
		this.isSnipped = true;
		this.snippedBy = snipperNum ?? null; // Track who caused the snip (null for self-snip)
		this.snipStartPoint = { x: collisionPoint.x, y: collisionPoint.y };
		this.snipTrailIndex = hitInfo.index;
		this.snipProgressDist = 0;
		this.snipElapsed = 0;
		
		// Reset speed buff when snipped (lose all accumulated speed)
		this.trailStartTime = null;
		this.currentSpeedBuff = 1.0;
		
		// Calculate total trail length from snip point to player
		let totalTrailLength = 0;
		
		// Distance from snip point to next trail point
		if (hitInfo.index + 1 < this.trail.points.length) {
			const nextPoint = this.trail.points[hitInfo.index + 1];
			totalTrailLength += Math.sqrt(
				(collisionPoint.x - nextPoint.x) ** 2 + 
				(collisionPoint.y - nextPoint.y) ** 2
			);
		}
		
		// Distance along remaining trail segments
		for (let i = hitInfo.index + 1; i < this.trail.points.length - 1; i++) {
			const p1 = this.trail.points[i];
			const p2 = this.trail.points[i + 1];
			totalTrailLength += Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
		}
		
		// Distance from last trail point to player
		if (this.trail.points.length > 0) {
			const lastPoint = this.trail.points[this.trail.points.length - 1];
			totalTrailLength += Math.sqrt((lastPoint.x - this.x) ** 2 + (lastPoint.y - this.y) ** 2);
		}
		
		this.snipTotalTrailLength = totalTrailLength;
		
		// Initial displayed timer (exactness comes from updateSnip recalculation).
		// We keep this consistent with our exponential model at t=0:
		// remainingTime = (1/k) * ln(1 + remainingDist * k / v0)
		const currentSpeedPerFrame = this.speed;
		const fps = 60;
		const v0 = currentSpeedPerFrame * consts.SNIP_FUSE_SPEED_MULT * fps;
		const k = consts.SNIP_EXP_ACCEL_PER_SEC;
		const initialRemaining = (Math.log(1 + (totalTrailLength * k) / v0) / k) ;
		this.snipMaxTime = initialRemaining;
		this.snipTimeRemaining = initialRemaining;
		
		// Initialize fuse position
		this.snipFusePosition = {
			x: collisionPoint.x,
			y: collisionPoint.y,
			segmentIndex: hitInfo.index
		};
	};

	Player.prototype.updateSnip = function(deltaSeconds) {
		if (!this.isSnipped || this.dead) return;
		
		// Safety check for trail and start point
		if (!this.trail || !this.trail.points || this.trail.points.length === 0 || !this.snipStartPoint) {
			this.die();
			return;
		}
		
		// Exponential acceleration: v(t) = v0 * exp(k * t)
		// We recompute v0 from the player's current effective speed so the fuse is always >= 1.5x faster,
		// even if debuffs/buffs change mid-snip.
		this.snipElapsed += deltaSeconds;
		const currentSpeedPerFrame = this.speed;
		const fps = deltaSeconds > 0 ? (1 / deltaSeconds) : 60;
		const v0 = currentSpeedPerFrame * consts.SNIP_FUSE_SPEED_MULT * fps;
		const k = consts.SNIP_EXP_ACCEL_PER_SEC;
		
		// Grace period: fuse doesn't move during grace period
		const gracePeriod = (consts.SNIP_GRACE_PERIOD ) + (this.snipGraceBonusSec || 0);
		const effectiveElapsed = Math.max(0, this.snipElapsed - gracePeriod);
		
		const accelFactor = Math.exp(k * effectiveElapsed) ;
		const desiredFuseSpeedPerSec = v0 * accelFactor;
		// Cap fuse speed relative to player's current effective speed (generous cap)
		const fuseCapPerSec = currentSpeedPerFrame * (consts.SNIP_FUSE_MAX_SPEED_MULT ) * fps;
		const fuseSpeedPerSec = Math.min(desiredFuseSpeedPerSec, fuseCapPerSec);
		
		// Only advance fuse after grace period
		if (this.snipElapsed > gracePeriod) {
			// Advance fuse along the trail (units/sec * sec = units)
			this.snipProgressDist += fuseSpeedPerSec * deltaSeconds;
		}
		
		// Calculate current total trail length from start point to player
		let currentTotalLength = 0;
		let currentIdx = this.snipTrailIndex;
		
		if (currentIdx + 1 < this.trail.points.length) {
			const nextPoint = this.trail.points[currentIdx + 1];
			currentTotalLength += Math.sqrt(
				(this.snipStartPoint.x - nextPoint.x) ** 2 + 
				(this.snipStartPoint.y - nextPoint.y) ** 2
			);
			
			for (let i = currentIdx + 1; i < this.trail.points.length - 1; i++) {
				const p1 = this.trail.points[i];
				const p2 = this.trail.points[i + 1];
				currentTotalLength += Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
			}
		}
		
		const lastPoint = this.trail.points[this.trail.points.length - 1];
		const distToPlayer = Math.sqrt((lastPoint.x - this.x) ** 2 + (lastPoint.y - this.y) ** 2);
		currentTotalLength += distToPlayer;
		this.snipTotalTrailLength = currentTotalLength;

		// Calculate fuse position and remaining distance
		let remainingTrailDist = 0;
		let currentSegment = this.snipTrailIndex;
		let fuseX = this.snipStartPoint.x;
		let fuseY = this.snipStartPoint.y;
		let remainingDist = this.snipProgressDist;
		
		// Start from snip point and walk along trail to find current fuse position
		if (currentSegment + 1 < this.trail.points.length) {
			const nextPoint = this.trail.points[currentSegment + 1];
			const segDist = Math.sqrt(
				(this.snipStartPoint.x - nextPoint.x) ** 2 + 
				(this.snipStartPoint.y - nextPoint.y) ** 2
			);
			
			if (remainingDist < segDist) {
				const t = remainingDist / segDist;
				fuseX = this.snipStartPoint.x + t * (nextPoint.x - this.snipStartPoint.x);
				fuseY = this.snipStartPoint.y + t * (nextPoint.y - this.snipStartPoint.y);
			} else {
				remainingDist -= segDist;
				currentSegment++;
				
				while (currentSegment + 1 < this.trail.points.length) {
					const p1 = this.trail.points[currentSegment];
					const p2 = this.trail.points[currentSegment + 1];
					const segLen = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
					
					if (remainingDist < segLen) {
						const t = remainingDist / segLen;
						fuseX = p1.x + t * (p2.x - p1.x);
						fuseY = p1.y + t * (p2.y - p1.y);
						break;
					}
					remainingDist -= segLen;
					currentSegment++;
				}
				
				if (currentSegment >= this.trail.points.length - 1) {
					const lp = this.trail.points[this.trail.points.length - 1];
					fuseX = lp.x;
					fuseY = lp.y;
				}
			}
		}
		
		remainingTrailDist = Math.max(0, currentTotalLength - this.snipProgressDist);

		// Check if fuse caught the player
		if (this.snipProgressDist >= currentTotalLength) {
			this.die();
			return;
		}

		// Update fuse position for rendering
		this.snipFusePosition = {
			x: fuseX,
			y: fuseY,
			segmentIndex: currentSegment
		};
		
		// Update timer based on remaining distance.
		// - If we're capped, use linear remainingDist / capSpeed (since acceleration no longer applies).
		// - Otherwise use exponential model from current t.
		// - Add remaining grace period if still in it.
		const remainingGrace = Math.max(0, gracePeriod - this.snipElapsed);
		const isCapped = desiredFuseSpeedPerSec >= fuseCapPerSec;
		let chaseTime;
		if (isCapped) {
			chaseTime = remainingTrailDist / fuseCapPerSec;
		} else {
			const denom = v0 * accelFactor;
			chaseTime = Math.log(1 + (remainingTrailDist * k) / denom) / k;
		}
		this.snipTimeRemaining = remainingGrace + chaseTime;
		
		// Check if timer expired or fuse caught player (redundant but safe)
		if (this.snipTimeRemaining <= 0) {
			this.die();
			return;
		}
		
		// Check if reached safety
		if (this.isInOwnTerritory()) {
			this.clearSnip();
		}
	};

	Player.prototype.clearSnip = function() {
		this.isSnipped = false;
		this.snippedBy = null;
		this.snipTimeRemaining = 0;
		this.snipFusePosition = null;
		this.snipElapsed = 0;
		this.trail.clear();
	};

	Player.prototype.die = function() {
		this.dead = true;
	};

	// Recalculate size scale based on current level
	Player.prototype.updateSizeScale = function() {
		const sizeScalePerLevel = consts.PLAYER_SIZE_SCALE_PER_LEVEL ;
		const sizeScaleMax = consts.PLAYER_SIZE_SCALE_MAX ;
		this.sizeScale = Math.min(sizeScaleMax, Math.max(1.0, 1.0 + (this.level - 1) * sizeScalePerLevel));
	};

	// Get the player's effective collision radius (used by server for collisions)
	Player.prototype.getScaledRadius = function() {
		return PLAYER_RADIUS$1 * (this.sizeScale || 1.0);
	};

	Player.prototype.render = function(ctx, fade, outlineThicknessMultiplier) {
		fade = fade || 1;
		outlineThicknessMultiplier = outlineThicknessMultiplier || 1;
		
		// Snipped visual effect: flashing ghost appearance
		let snipAlpha = 1;
		if (this.isSnipped) {
			const time = Date.now() / 100;
			// Fast flashing effect (0.3 to 0.8 alpha)
			snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
		}
		
		// Render territory
		if (this.territory && this.territory.length >= 3) {
			ctx.fillStyle = this.baseColor.deriveAlpha(0.4 * fade * snipAlpha).rgbString();
			ctx.beginPath();
			ctx.moveTo(this.territory[0].x, this.territory[0].y);
			for (let i = 1; i < this.territory.length; i++) {
				ctx.lineTo(this.territory[i].x, this.territory[i].y);
			}
			ctx.closePath();
			ctx.fill();
			
			// Territory border outline (2-3px, using owner's color)
			const baseOutlineWidth = 2.5;
			const outlineWidth = baseOutlineWidth * outlineThicknessMultiplier;
			ctx.strokeStyle = this.baseColor.deriveAlpha(0.9 * fade * snipAlpha).rgbString();
			ctx.lineWidth = outlineWidth;
			ctx.lineJoin = 'round';
			ctx.stroke();
		}
		
		// Render body (trail, player circle, name, etc)
		this.renderBody(ctx, fade);
	};

	// Render just the trail (for layering control)
	Player.prototype.renderTrail = function(ctx) {
		this.trail.render(ctx);
	};

	// Render just the player body, trail, and overlays (not territory)
	// Used when territories are rendered separately for proper overlap resolution
	// skipTrail: if true, only renders the body (trail rendered separately)
	Player.prototype.renderBody = function(ctx, fade, skipTrail) {
		fade = fade || 1;
		
		// Apply size scaling based on level
		const scaledRadius = PLAYER_RADIUS$1 * (this.sizeScale || 1.0);
		
		// Snipped visual effect: flashing ghost appearance
		let snipAlpha = 1;
		if (this.isSnipped) {
			const time = Date.now() / 100;
			// Fast flashing effect (0.3 to 0.8 alpha)
			snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
		}
		
		// Render trail (unless skipped for separate layer rendering)
		if (!skipTrail) {
			this.trail.render(ctx);
		}
		
		// Render player shadow
		ctx.fillStyle = this.shadowColor.deriveAlpha(fade * snipAlpha).rgbString();
		ctx.beginPath();
		ctx.arc(this.x + 2, this.y + 4, scaledRadius, 0, Math.PI * 2);
		ctx.fill();
		
		// Check if in own territory for gold glow effect
		const inOwnTerritory = this.isInOwnTerritory();
		
		// Render player body
		if (this.isSnipped) {
			// Ghost effect: red-tinted, semi-transparent
			const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 4);
			ctx.fillStyle = `rgba(255, ${Math.floor(100 * pulse)}, ${Math.floor(100 * pulse)}, ${fade * snipAlpha})`;
		} else {
			ctx.fillStyle = this.baseColor.deriveAlpha(fade).rgbString();
		}
		ctx.beginPath();
		ctx.arc(this.x, this.y, scaledRadius, 0, Math.PI * 2);
		ctx.fill();
		
		// Green-to-gold glow effect when in own territory (safety indicator)
		if (inOwnTerritory && !this.isSnipped) {
			const time = Date.now() / 1000;
			const pulse = 0.5 + 0.5 * Math.sin(time * 2.5); // 0 to 1 pulse for color lerp
			const intensity = 0.7 + 0.3 * Math.sin(time * 3); // Intensity pulse
			const glowRadius = scaledRadius * 2.2;
			
			// Interpolate between green (0, 200, 80) and gold (255, 215, 0)
			const r = Math.round(0 + pulse * 255);
			const g = Math.round(200 + pulse * 15);  // 200 -> 215
			const b = Math.round(80 - pulse * 80);   // 80 -> 0
			
			// Outer glow ring
			ctx.save();
			ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
			ctx.shadowBlur = 15 * intensity;
			ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.6 * intensity * fade})`;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(this.x, this.y, scaledRadius + 4, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
			
			// Radial glow aura
			const gradient = ctx.createRadialGradient(
				this.x, this.y, scaledRadius,
				this.x, this.y, glowRadius
			);
			gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 * intensity * fade})`);
			gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${0.25 * intensity * fade})`);
			gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
			
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
			ctx.fill();
		}
		
		// Snipped glow ring
		if (this.isSnipped) {
			const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100 * 6);
			ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + 0.5 * pulse})`;
			ctx.lineWidth = 3 + 2 * pulse;
			ctx.beginPath();
			ctx.arc(this.x, this.y, scaledRadius + 4 + 2 * pulse, 0, Math.PI * 2);
			ctx.stroke();
		}
		
		// Direction indicator
		const indicatorX = this.x + Math.cos(this.angle) * scaledRadius * 0.6;
		const indicatorY = this.y + Math.sin(this.angle) * scaledRadius * 0.6;
		ctx.fillStyle = this.lightBaseColor.deriveAlpha(fade * snipAlpha).rgbString();
		ctx.beginPath();
		ctx.arc(indicatorX, indicatorY, scaledRadius * 0.3, 0, Math.PI * 2);
		ctx.fill();
		
		// Render name (with "SNIPPED!" indicator)
		ctx.fillStyle = this.shadowColor.deriveAlpha(fade).rgbString();
		ctx.textAlign = "center";
		ctx.font = "bold 14px Arial";
		if (this.isSnipped) {
			ctx.fillStyle = "rgba(255, 50, 50, 1)";
			ctx.fillText("SNIPPED!", this.x, this.y - scaledRadius - 22);
			ctx.fillStyle = this.shadowColor.deriveAlpha(fade * snipAlpha).rgbString();
		}
		ctx.fillText(this.name, this.x, this.y - scaledRadius - 8);

	};

	Player.prototype.serialData = function() {
		return {
			base: this.baseColor,
			num: this.num,
			name: this.name,
			x: this.x,
			y: this.y,
			spawnX: this.spawnX,
			spawnY: this.spawnY,
			angle: this.angle,
			targetAngle: this.targetAngle,
			territory: this.territory,
			trail: this.trail.serialData(),
			waitLag: this.waitLag,
			// XP/Leveling fields
			level: this.level,
			xp: this.xp,
			sizeScale: this.sizeScale,
			snipGraceBonusSec: this.snipGraceBonusSec,
			isSnipped: this.isSnipped,
			snippedBy: this.snippedBy,
			snipTimeRemaining: this.snipTimeRemaining,
			snipMaxTime: this.snipMaxTime,
			snipStartPoint: this.snipStartPoint,
			snipProgressDist: this.snipProgressDist,
			snipTrailIndex: this.snipTrailIndex,
			snipFusePosition: this.snipFusePosition,
			snipTotalTrailLength: this.snipTotalTrailLength,
			snipElapsed: this.snipElapsed,
			hp: this.hp,
			maxHp: this.maxHp,
			// Speed buff state
			trailStartTime: this.trailStartTime,
			currentSpeedBuff: this.currentSpeedBuff
		};
	};

	// Legacy compatibility
	Object.defineProperties(Player.prototype, {
		posX: {
			get: function() { return this.x; },
			set: function(v) { this.x = v; }
		},
		posY: {
			get: function() { return this.y; },
			set: function(v) { this.y = v; }
		},
		row: {
			get: function() { return Math.floor(this.y / consts.CELL_WIDTH); }
		},
		col: {
			get: function() { return Math.floor(this.x / consts.CELL_WIDTH); }
		},
		currentHeading: {
			get: function() {
				// Convert angle to heading (0=up, 1=right, 2=down, 3=left)
				const normalized = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
				if (normalized < Math.PI * 0.25 || normalized >= Math.PI * 1.75) return 1; // right
				if (normalized < Math.PI * 0.75) return 2; // down
				if (normalized < Math.PI * 1.25) return 3; // left
				return 0; // up
			}
		}
	});

	// Initialize player with starting territory (small circle around spawn)
	function initPlayer(player) {
		const territoryRadius = consts.CELL_WIDTH * 1.5;
		const segments = 12;
		player.territory = [];
		
		// Ensure spawn center is set (usually handled by constructor, but safe here)
		if (player.spawnX === undefined) player.spawnX = player.x;
		if (player.spawnY === undefined) player.spawnY = player.y;
		
		for (let i = 0; i < segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			player.territory.push({
				x: player.x + Math.cos(angle) * territoryRadius,
				y: player.y + Math.sin(angle) * territoryRadius
			});
		}
	}

	/**
	 * Updates player stamina based on whether they are in their own territory.
	 * Also regenerates HP when in territory.
	 * @param {Player} player 
	 * @param {number} deltaSeconds 
	 */
	function updateStamina(player, deltaSeconds) {
		const inTerritory = player.isInOwnTerritory();
		
		// Apply stat multipliers (default to 1.0 if not set)
		const regenMult = player.staminaRegenMult || 1.0;
		const drainMult = player.staminaDrainMult || 1.0;
		
		if (inTerritory) {
			// Regenerate stamina
			player.stamina += consts.STAMINA_REGEN_INSIDE_PER_SEC * regenMult * deltaSeconds;
			if (player.stamina > player.maxStamina) {
				player.stamina = player.maxStamina;
			}
			
			// Recover from exhaustion
			if (player.isExhausted && player.stamina >= consts.EXHAUSTED_RECOVER_THRESHOLD) {
				player.isExhausted = false;
			}
			
			// Regenerate HP in territory (using effective maxHp from upgrades)
			const baseMaxHp = consts.PLAYER_MAX_HP ;
			const maxHpMult = (player.derivedStats && player.derivedStats.maxHpMult) || 1.0;
			player.maxHp = baseMaxHp * maxHpMult;
			
			if (player.hp < player.maxHp) {
				player.hp += (consts.PLAYER_HP_REGEN_IN_TERRITORY ) * deltaSeconds;
				if (player.hp > player.maxHp) {
					player.hp = player.maxHp;
				}
			}
		} else {
			// Drain stamina outside territory
			player.stamina -= consts.STAMINA_DRAIN_OUTSIDE_PER_SEC * drainMult * deltaSeconds;
			if (player.stamina <= 0) {
				player.stamina = 0;
				player.isExhausted = true;
			}
		}
	}

	function updateFrame(players, dead, notifyKill, deltaSeconds = 1 / 60) {
		const adead = dead instanceof Array ? dead : [];
		// deltaSeconds defaults to 1/60 for legacy callers

		// Track which players captured territory this frame
		const capturedThisFrame = [];
		
		// Move all players
		const alive = players.filter(player => {
			// Store previous territory area to detect captures
			const prevArea = polygonArea(player.territory);
			
			updateStamina(player, deltaSeconds);
			player.move(deltaSeconds);
			
			// Check if player captured territory (area increased)
			const newArea = polygonArea(player.territory);
			if (newArea > prevArea + 100) { // Significant capture (not just floating point noise)
				capturedThisFrame.push(player);
			}
			
			if (player.dead) {
				adead.push(player);
			}
			return !player.dead;
		});
		
		// Set up collision tracking and kill notification (needed for territory resolution too)
		const removing = new Array(alive.length).fill(false);
		const kill = notifyKill || (() => {});
		
		// TERRITORY OVERLAP RESOLUTION
		// When a player captures territory, subtract it from overlapping enemy territories
		// Also check if players are trapped inside the captured territory
		for (const capturer of capturedThisFrame) {
			if (capturer.dead) continue;
			
			for (const other of alive) {
				if (other === capturer || other.dead) continue;
				
				// Check if territories overlap
				if (polygonsOverlap(capturer.territory, other.territory)) {
					// Subtract the capturer's territory from the other player's territory
					const newTerritory = subtractTerritorySimple(
						other.territory,
						capturer.territory,
						{ x: other.spawnX, y: other.spawnY }
					);
					
					// Only update if the result is valid
					if (newTerritory && newTerritory.length >= 3) {
						other.territory = newTerritory;
					} else {
						// Territory completely consumed - kill the player
						const otherAliveIdx = alive.indexOf(other);
						const capturerPlayersIdx = players.indexOf(capturer);
						const otherPlayersIdx = players.indexOf(other);
						if (capturerPlayersIdx !== -1 && otherPlayersIdx !== -1) {
							kill(capturerPlayersIdx, otherPlayersIdx);
						}
						if (otherAliveIdx !== -1) removing[otherAliveIdx] = true;
						other.dead = true;
					}
				}
				
				// Check if the other player is trapped inside capturer's territory
				// (player is inside enemy territory and NOT in their own territory)
				if (!other.dead && pointInPolygon({ x: other.x, y: other.y }, capturer.territory)) {
					// Player is inside the capturer's territory
					// Check if they're NOT in their own territory (trapped)
					if (!pointInPolygon({ x: other.x, y: other.y }, other.territory)) {
						// Trapped! Kill the player
						const otherAliveIdx = alive.indexOf(other);
						const capturerPlayersIdx = players.indexOf(capturer);
						const otherPlayersIdx = players.indexOf(other);
						if (capturerPlayersIdx !== -1 && otherPlayersIdx !== -1) {
							kill(capturerPlayersIdx, otherPlayersIdx);
						}
						if (otherAliveIdx !== -1) removing[otherAliveIdx] = true;
						other.dead = true;
					}
				}
			}
		}

		// Check collisions
		for (let i = 0; i < alive.length; i++) {
			if (removing[i] || alive[i].dead) continue;
			
			for (let j = 0; j < alive.length; j++) {
				if (i === j || removing[j] || alive[j].dead) continue;

				
				// Check if player i hits player j's trail
				// Snipped players cannot snip others
				if (!alive[i].isSnipped) {
					const trailHit = alive[j].trail.hitsTrail(alive[i].x, alive[i].y, 0);
					if (trailHit) {
						// Instead of immediate death, start the snip fuse
						if (!alive[j].isSnipped) {
							// Pass the snipper's player number for kill tracking
							alive[j].startSnip({ x: alive[i].x, y: alive[i].y }, trailHit, alive[i].num);
						}
						// MVP: ignore if victim already snipped.
						break;
					}
				}

				// Check if players collide with each other
				if (!removing[i] && !removing[j] && checkPlayerCollision(alive[i], alive[j])) {
					// Player in their own territory wins
					const iInTerritory = alive[i].isInOwnTerritory();
					const jInTerritory = alive[j].isInOwnTerritory();
					
					// Map alive indices to players indices for kill callback
					const playersIdxI = players.indexOf(alive[i]);
					const playersIdxJ = players.indexOf(alive[j]);
					
					if (iInTerritory && !jInTerritory) {
						kill(playersIdxI, playersIdxJ);
						removing[j] = true;
					} else if (jInTerritory && !iInTerritory) {
						kill(playersIdxJ, playersIdxI);
						removing[i] = true;
					} else {
						// Both in or out of territory - both die or compare territory size
						const areaI = polygonArea(alive[i].territory);
						const areaJ = polygonArea(alive[j].territory);

						if (Math.abs(areaI - areaJ) < 100) {
							// Similar size - both die
							kill(playersIdxI, playersIdxJ);
							kill(playersIdxJ, playersIdxI);
							removing[i] = removing[j] = true;
						} else if (areaI > areaJ) {
							kill(playersIdxI, playersIdxJ);
							removing[j] = true;
						} else {
							kill(playersIdxJ, playersIdxI);
							removing[i] = true;
						}
					}
				}
			}
			
			// Check if player i hits their own trail (suicide)
			const selfHit = alive[i].trail.hitsTrail(alive[i].x, alive[i].y, 10);
			if (!removing[i] && selfHit) {
				if (!alive[i].isSnipped) {
					// Self-snip: pass null as snipper (no kill credit)
					alive[i].startSnip({ x: alive[i].x, y: alive[i].y }, selfHit, null);
				}
			}
		}

		// Remove dead players
		const remaining = alive.filter((player, i) => {
			if (removing[i]) {
				adead.push(player);
				player.die();
				return false;
			}
			return true;
		});

		// Update players array in place
		players.length = remaining.length;
		for (let i = 0; i < remaining.length; i++) {
			players[i] = remaining[i];
		}
		}

	// Calculate polygon area using shoelace formula
	function polygonArea(polygon) {
		if (!polygon || polygon.length < 3) return 0;
		
		let area = 0;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
		}
		return Math.abs(area / 2);
	}

	function utf8Count(str) {
	    const strLength = str.length;
	    let byteLength = 0;
	    let pos = 0;
	    while (pos < strLength) {
	        let value = str.charCodeAt(pos++);
	        if ((value & 0xffffff80) === 0) {
	            // 1-byte
	            byteLength++;
	            continue;
	        }
	        else if ((value & 0xfffff800) === 0) {
	            // 2-bytes
	            byteLength += 2;
	        }
	        else {
	            // handle surrogate pair
	            if (value >= 0xd800 && value <= 0xdbff) {
	                // high surrogate
	                if (pos < strLength) {
	                    const extra = str.charCodeAt(pos);
	                    if ((extra & 0xfc00) === 0xdc00) {
	                        ++pos;
	                        value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
	                    }
	                }
	            }
	            if ((value & 0xffff0000) === 0) {
	                // 3-byte
	                byteLength += 3;
	            }
	            else {
	                // 4-byte
	                byteLength += 4;
	            }
	        }
	    }
	    return byteLength;
	}
	function utf8EncodeJs(str, output, outputOffset) {
	    const strLength = str.length;
	    let offset = outputOffset;
	    let pos = 0;
	    while (pos < strLength) {
	        let value = str.charCodeAt(pos++);
	        if ((value & 0xffffff80) === 0) {
	            // 1-byte
	            output[offset++] = value;
	            continue;
	        }
	        else if ((value & 0xfffff800) === 0) {
	            // 2-bytes
	            output[offset++] = ((value >> 6) & 0x1f) | 0xc0;
	        }
	        else {
	            // handle surrogate pair
	            if (value >= 0xd800 && value <= 0xdbff) {
	                // high surrogate
	                if (pos < strLength) {
	                    const extra = str.charCodeAt(pos);
	                    if ((extra & 0xfc00) === 0xdc00) {
	                        ++pos;
	                        value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
	                    }
	                }
	            }
	            if ((value & 0xffff0000) === 0) {
	                // 3-byte
	                output[offset++] = ((value >> 12) & 0x0f) | 0xe0;
	                output[offset++] = ((value >> 6) & 0x3f) | 0x80;
	            }
	            else {
	                // 4-byte
	                output[offset++] = ((value >> 18) & 0x07) | 0xf0;
	                output[offset++] = ((value >> 12) & 0x3f) | 0x80;
	                output[offset++] = ((value >> 6) & 0x3f) | 0x80;
	            }
	        }
	        output[offset++] = (value & 0x3f) | 0x80;
	    }
	}
	// TextEncoder and TextDecoder are standardized in whatwg encoding:
	// https://encoding.spec.whatwg.org/
	// and available in all the modern browsers:
	// https://caniuse.com/textencoder
	// They are available in Node.js since v12 LTS as well:
	// https://nodejs.org/api/globals.html#textencoder
	const sharedTextEncoder = new TextEncoder();
	// This threshold should be determined by benchmarking, which might vary in engines and input data.
	// Run `npx ts-node benchmark/encode-string.ts` for details.
	const TEXT_ENCODER_THRESHOLD = 50;
	function utf8EncodeTE(str, output, outputOffset) {
	    sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
	}
	function utf8Encode(str, output, outputOffset) {
	    if (str.length > TEXT_ENCODER_THRESHOLD) {
	        utf8EncodeTE(str, output, outputOffset);
	    }
	    else {
	        utf8EncodeJs(str, output, outputOffset);
	    }
	}
	const CHUNK_SIZE = 4096;
	function utf8DecodeJs(bytes, inputOffset, byteLength) {
	    let offset = inputOffset;
	    const end = offset + byteLength;
	    const units = [];
	    let result = "";
	    while (offset < end) {
	        const byte1 = bytes[offset++];
	        if ((byte1 & 0x80) === 0) {
	            // 1 byte
	            units.push(byte1);
	        }
	        else if ((byte1 & 0xe0) === 0xc0) {
	            // 2 bytes
	            const byte2 = bytes[offset++] & 0x3f;
	            units.push(((byte1 & 0x1f) << 6) | byte2);
	        }
	        else if ((byte1 & 0xf0) === 0xe0) {
	            // 3 bytes
	            const byte2 = bytes[offset++] & 0x3f;
	            const byte3 = bytes[offset++] & 0x3f;
	            units.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
	        }
	        else if ((byte1 & 0xf8) === 0xf0) {
	            // 4 bytes
	            const byte2 = bytes[offset++] & 0x3f;
	            const byte3 = bytes[offset++] & 0x3f;
	            const byte4 = bytes[offset++] & 0x3f;
	            let unit = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
	            if (unit > 0xffff) {
	                unit -= 0x10000;
	                units.push(((unit >>> 10) & 0x3ff) | 0xd800);
	                unit = 0xdc00 | (unit & 0x3ff);
	            }
	            units.push(unit);
	        }
	        else {
	            units.push(byte1);
	        }
	        if (units.length >= CHUNK_SIZE) {
	            result += String.fromCharCode(...units);
	            units.length = 0;
	        }
	    }
	    if (units.length > 0) {
	        result += String.fromCharCode(...units);
	    }
	    return result;
	}
	const sharedTextDecoder = new TextDecoder();
	// This threshold should be determined by benchmarking, which might vary in engines and input data.
	// Run `npx ts-node benchmark/decode-string.ts` for details.
	const TEXT_DECODER_THRESHOLD = 200;
	function utf8DecodeTD(bytes, inputOffset, byteLength) {
	    const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
	    return sharedTextDecoder.decode(stringBytes);
	}
	function utf8Decode(bytes, inputOffset, byteLength) {
	    if (byteLength > TEXT_DECODER_THRESHOLD) {
	        return utf8DecodeTD(bytes, inputOffset, byteLength);
	    }
	    else {
	        return utf8DecodeJs(bytes, inputOffset, byteLength);
	    }
	}

	/**
	 * ExtData is used to handle Extension Types that are not registered to ExtensionCodec.
	 */
	class ExtData {
	    type;
	    data;
	    constructor(type, data) {
	        this.type = type;
	        this.data = data;
	    }
	}

	class DecodeError extends Error {
	    constructor(message) {
	        super(message);
	        // fix the prototype chain in a cross-platform way
	        const proto = Object.create(DecodeError.prototype);
	        Object.setPrototypeOf(this, proto);
	        Object.defineProperty(this, "name", {
	            configurable: true,
	            enumerable: false,
	            value: DecodeError.name,
	        });
	    }
	}

	// Integer Utility
	const UINT32_MAX = 4294967295;
	// DataView extension to handle int64 / uint64,
	// where the actual range is 53-bits integer (a.k.a. safe integer)
	function setUint64(view, offset, value) {
	    const high = value / 4294967296;
	    const low = value; // high bits are truncated by DataView
	    view.setUint32(offset, high);
	    view.setUint32(offset + 4, low);
	}
	function setInt64(view, offset, value) {
	    const high = Math.floor(value / 4294967296);
	    const low = value; // high bits are truncated by DataView
	    view.setUint32(offset, high);
	    view.setUint32(offset + 4, low);
	}
	function getInt64(view, offset) {
	    const high = view.getInt32(offset);
	    const low = view.getUint32(offset + 4);
	    return high * 4294967296 + low;
	}
	function getUint64(view, offset) {
	    const high = view.getUint32(offset);
	    const low = view.getUint32(offset + 4);
	    return high * 4294967296 + low;
	}

	// https://github.com/msgpack/msgpack/blob/master/spec.md#timestamp-extension-type
	const EXT_TIMESTAMP = -1;
	const TIMESTAMP32_MAX_SEC = 0x100000000 - 1; // 32-bit unsigned int
	const TIMESTAMP64_MAX_SEC = 0x400000000 - 1; // 34-bit unsigned int
	function encodeTimeSpecToTimestamp({ sec, nsec }) {
	    if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
	        // Here sec >= 0 && nsec >= 0
	        if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
	            // timestamp 32 = { sec32 (unsigned) }
	            const rv = new Uint8Array(4);
	            const view = new DataView(rv.buffer);
	            view.setUint32(0, sec);
	            return rv;
	        }
	        else {
	            // timestamp 64 = { nsec30 (unsigned), sec34 (unsigned) }
	            const secHigh = sec / 0x100000000;
	            const secLow = sec & 0xffffffff;
	            const rv = new Uint8Array(8);
	            const view = new DataView(rv.buffer);
	            // nsec30 | secHigh2
	            view.setUint32(0, (nsec << 2) | (secHigh & 0x3));
	            // secLow32
	            view.setUint32(4, secLow);
	            return rv;
	        }
	    }
	    else {
	        // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
	        const rv = new Uint8Array(12);
	        const view = new DataView(rv.buffer);
	        view.setUint32(0, nsec);
	        setInt64(view, 4, sec);
	        return rv;
	    }
	}
	function encodeDateToTimeSpec(date) {
	    const msec = date.getTime();
	    const sec = Math.floor(msec / 1e3);
	    const nsec = (msec - sec * 1e3) * 1e6;
	    // Normalizes { sec, nsec } to ensure nsec is unsigned.
	    const nsecInSec = Math.floor(nsec / 1e9);
	    return {
	        sec: sec + nsecInSec,
	        nsec: nsec - nsecInSec * 1e9,
	    };
	}
	function encodeTimestampExtension(object) {
	    if (object instanceof Date) {
	        const timeSpec = encodeDateToTimeSpec(object);
	        return encodeTimeSpecToTimestamp(timeSpec);
	    }
	    else {
	        return null;
	    }
	}
	function decodeTimestampToTimeSpec(data) {
	    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	    // data may be 32, 64, or 96 bits
	    switch (data.byteLength) {
	        case 4: {
	            // timestamp 32 = { sec32 }
	            const sec = view.getUint32(0);
	            const nsec = 0;
	            return { sec, nsec };
	        }
	        case 8: {
	            // timestamp 64 = { nsec30, sec34 }
	            const nsec30AndSecHigh2 = view.getUint32(0);
	            const secLow32 = view.getUint32(4);
	            const sec = (nsec30AndSecHigh2 & 0x3) * 0x100000000 + secLow32;
	            const nsec = nsec30AndSecHigh2 >>> 2;
	            return { sec, nsec };
	        }
	        case 12: {
	            // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
	            const sec = getInt64(view, 4);
	            const nsec = view.getUint32(0);
	            return { sec, nsec };
	        }
	        default:
	            throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
	    }
	}
	function decodeTimestampExtension(data) {
	    const timeSpec = decodeTimestampToTimeSpec(data);
	    return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
	}
	const timestampExtension = {
	    type: EXT_TIMESTAMP,
	    encode: encodeTimestampExtension,
	    decode: decodeTimestampExtension,
	};

	// ExtensionCodec to handle MessagePack extensions
	class ExtensionCodec {
	    static defaultCodec = new ExtensionCodec();
	    // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
	    // this will make type errors a lot more clear
	    // eslint-disable-next-line @typescript-eslint/naming-convention
	    __brand;
	    // built-in extensions
	    builtInEncoders = [];
	    builtInDecoders = [];
	    // custom extensions
	    encoders = [];
	    decoders = [];
	    constructor() {
	        this.register(timestampExtension);
	    }
	    register({ type, encode, decode, }) {
	        if (type >= 0) {
	            // custom extensions
	            this.encoders[type] = encode;
	            this.decoders[type] = decode;
	        }
	        else {
	            // built-in extensions
	            const index = -1 - type;
	            this.builtInEncoders[index] = encode;
	            this.builtInDecoders[index] = decode;
	        }
	    }
	    tryToEncode(object, context) {
	        // built-in extensions
	        for (let i = 0; i < this.builtInEncoders.length; i++) {
	            const encodeExt = this.builtInEncoders[i];
	            if (encodeExt != null) {
	                const data = encodeExt(object, context);
	                if (data != null) {
	                    const type = -1 - i;
	                    return new ExtData(type, data);
	                }
	            }
	        }
	        // custom extensions
	        for (let i = 0; i < this.encoders.length; i++) {
	            const encodeExt = this.encoders[i];
	            if (encodeExt != null) {
	                const data = encodeExt(object, context);
	                if (data != null) {
	                    const type = i;
	                    return new ExtData(type, data);
	                }
	            }
	        }
	        if (object instanceof ExtData) {
	            // to keep ExtData as is
	            return object;
	        }
	        return null;
	    }
	    decode(data, type, context) {
	        const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
	        if (decodeExt) {
	            return decodeExt(data, type, context);
	        }
	        else {
	            // decode() does not fail, returns ExtData instead.
	            return new ExtData(type, data);
	        }
	    }
	}

	function isArrayBufferLike(buffer) {
	    return (buffer instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer));
	}
	function ensureUint8Array(buffer) {
	    if (buffer instanceof Uint8Array) {
	        return buffer;
	    }
	    else if (ArrayBuffer.isView(buffer)) {
	        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	    }
	    else if (isArrayBufferLike(buffer)) {
	        return new Uint8Array(buffer);
	    }
	    else {
	        // ArrayLike<number>
	        return Uint8Array.from(buffer);
	    }
	}

	const DEFAULT_MAX_DEPTH = 100;
	const DEFAULT_INITIAL_BUFFER_SIZE = 2048;
	class Encoder {
	    extensionCodec;
	    context;
	    useBigInt64;
	    maxDepth;
	    initialBufferSize;
	    sortKeys;
	    forceFloat32;
	    ignoreUndefined;
	    forceIntegerToFloat;
	    pos;
	    view;
	    bytes;
	    entered = false;
	    constructor(options) {
	        this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
	        this.context = options?.context; // needs a type assertion because EncoderOptions has no context property when ContextType is undefined
	        this.useBigInt64 = options?.useBigInt64 ?? false;
	        this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
	        this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
	        this.sortKeys = options?.sortKeys ?? false;
	        this.forceFloat32 = options?.forceFloat32 ?? false;
	        this.ignoreUndefined = options?.ignoreUndefined ?? false;
	        this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
	        this.pos = 0;
	        this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
	        this.bytes = new Uint8Array(this.view.buffer);
	    }
	    clone() {
	        // Because of slightly special argument `context`,
	        // type assertion is needed.
	        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	        return new Encoder({
	            extensionCodec: this.extensionCodec,
	            context: this.context,
	            useBigInt64: this.useBigInt64,
	            maxDepth: this.maxDepth,
	            initialBufferSize: this.initialBufferSize,
	            sortKeys: this.sortKeys,
	            forceFloat32: this.forceFloat32,
	            ignoreUndefined: this.ignoreUndefined,
	            forceIntegerToFloat: this.forceIntegerToFloat,
	        });
	    }
	    reinitializeState() {
	        this.pos = 0;
	    }
	    /**
	     * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
	     *
	     * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
	     */
	    encodeSharedRef(object) {
	        if (this.entered) {
	            const instance = this.clone();
	            return instance.encodeSharedRef(object);
	        }
	        try {
	            this.entered = true;
	            this.reinitializeState();
	            this.doEncode(object, 1);
	            return this.bytes.subarray(0, this.pos);
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    /**
	     * @returns Encodes the object and returns a copy of the encoder's internal buffer.
	     */
	    encode(object) {
	        if (this.entered) {
	            const instance = this.clone();
	            return instance.encode(object);
	        }
	        try {
	            this.entered = true;
	            this.reinitializeState();
	            this.doEncode(object, 1);
	            return this.bytes.slice(0, this.pos);
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    doEncode(object, depth) {
	        if (depth > this.maxDepth) {
	            throw new Error(`Too deep objects in depth ${depth}`);
	        }
	        if (object == null) {
	            this.encodeNil();
	        }
	        else if (typeof object === "boolean") {
	            this.encodeBoolean(object);
	        }
	        else if (typeof object === "number") {
	            if (!this.forceIntegerToFloat) {
	                this.encodeNumber(object);
	            }
	            else {
	                this.encodeNumberAsFloat(object);
	            }
	        }
	        else if (typeof object === "string") {
	            this.encodeString(object);
	        }
	        else if (this.useBigInt64 && typeof object === "bigint") {
	            this.encodeBigInt64(object);
	        }
	        else {
	            this.encodeObject(object, depth);
	        }
	    }
	    ensureBufferSizeToWrite(sizeToWrite) {
	        const requiredSize = this.pos + sizeToWrite;
	        if (this.view.byteLength < requiredSize) {
	            this.resizeBuffer(requiredSize * 2);
	        }
	    }
	    resizeBuffer(newSize) {
	        const newBuffer = new ArrayBuffer(newSize);
	        const newBytes = new Uint8Array(newBuffer);
	        const newView = new DataView(newBuffer);
	        newBytes.set(this.bytes);
	        this.view = newView;
	        this.bytes = newBytes;
	    }
	    encodeNil() {
	        this.writeU8(0xc0);
	    }
	    encodeBoolean(object) {
	        if (object === false) {
	            this.writeU8(0xc2);
	        }
	        else {
	            this.writeU8(0xc3);
	        }
	    }
	    encodeNumber(object) {
	        if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
	            if (object >= 0) {
	                if (object < 0x80) {
	                    // positive fixint
	                    this.writeU8(object);
	                }
	                else if (object < 0x100) {
	                    // uint 8
	                    this.writeU8(0xcc);
	                    this.writeU8(object);
	                }
	                else if (object < 0x10000) {
	                    // uint 16
	                    this.writeU8(0xcd);
	                    this.writeU16(object);
	                }
	                else if (object < 0x100000000) {
	                    // uint 32
	                    this.writeU8(0xce);
	                    this.writeU32(object);
	                }
	                else if (!this.useBigInt64) {
	                    // uint 64
	                    this.writeU8(0xcf);
	                    this.writeU64(object);
	                }
	                else {
	                    this.encodeNumberAsFloat(object);
	                }
	            }
	            else {
	                if (object >= -0x20) {
	                    // negative fixint
	                    this.writeU8(0xe0 | (object + 0x20));
	                }
	                else if (object >= -0x80) {
	                    // int 8
	                    this.writeU8(0xd0);
	                    this.writeI8(object);
	                }
	                else if (object >= -0x8000) {
	                    // int 16
	                    this.writeU8(0xd1);
	                    this.writeI16(object);
	                }
	                else if (object >= -0x80000000) {
	                    // int 32
	                    this.writeU8(0xd2);
	                    this.writeI32(object);
	                }
	                else if (!this.useBigInt64) {
	                    // int 64
	                    this.writeU8(0xd3);
	                    this.writeI64(object);
	                }
	                else {
	                    this.encodeNumberAsFloat(object);
	                }
	            }
	        }
	        else {
	            this.encodeNumberAsFloat(object);
	        }
	    }
	    encodeNumberAsFloat(object) {
	        if (this.forceFloat32) {
	            // float 32
	            this.writeU8(0xca);
	            this.writeF32(object);
	        }
	        else {
	            // float 64
	            this.writeU8(0xcb);
	            this.writeF64(object);
	        }
	    }
	    encodeBigInt64(object) {
	        if (object >= BigInt(0)) {
	            // uint 64
	            this.writeU8(0xcf);
	            this.writeBigUint64(object);
	        }
	        else {
	            // int 64
	            this.writeU8(0xd3);
	            this.writeBigInt64(object);
	        }
	    }
	    writeStringHeader(byteLength) {
	        if (byteLength < 32) {
	            // fixstr
	            this.writeU8(0xa0 + byteLength);
	        }
	        else if (byteLength < 0x100) {
	            // str 8
	            this.writeU8(0xd9);
	            this.writeU8(byteLength);
	        }
	        else if (byteLength < 0x10000) {
	            // str 16
	            this.writeU8(0xda);
	            this.writeU16(byteLength);
	        }
	        else if (byteLength < 0x100000000) {
	            // str 32
	            this.writeU8(0xdb);
	            this.writeU32(byteLength);
	        }
	        else {
	            throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
	        }
	    }
	    encodeString(object) {
	        const maxHeaderSize = 1 + 4;
	        const byteLength = utf8Count(object);
	        this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
	        this.writeStringHeader(byteLength);
	        utf8Encode(object, this.bytes, this.pos);
	        this.pos += byteLength;
	    }
	    encodeObject(object, depth) {
	        // try to encode objects with custom codec first of non-primitives
	        const ext = this.extensionCodec.tryToEncode(object, this.context);
	        if (ext != null) {
	            this.encodeExtension(ext);
	        }
	        else if (Array.isArray(object)) {
	            this.encodeArray(object, depth);
	        }
	        else if (ArrayBuffer.isView(object)) {
	            this.encodeBinary(object);
	        }
	        else if (typeof object === "object") {
	            this.encodeMap(object, depth);
	        }
	        else {
	            // symbol, function and other special object come here unless extensionCodec handles them.
	            throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
	        }
	    }
	    encodeBinary(object) {
	        const size = object.byteLength;
	        if (size < 0x100) {
	            // bin 8
	            this.writeU8(0xc4);
	            this.writeU8(size);
	        }
	        else if (size < 0x10000) {
	            // bin 16
	            this.writeU8(0xc5);
	            this.writeU16(size);
	        }
	        else if (size < 0x100000000) {
	            // bin 32
	            this.writeU8(0xc6);
	            this.writeU32(size);
	        }
	        else {
	            throw new Error(`Too large binary: ${size}`);
	        }
	        const bytes = ensureUint8Array(object);
	        this.writeU8a(bytes);
	    }
	    encodeArray(object, depth) {
	        const size = object.length;
	        if (size < 16) {
	            // fixarray
	            this.writeU8(0x90 + size);
	        }
	        else if (size < 0x10000) {
	            // array 16
	            this.writeU8(0xdc);
	            this.writeU16(size);
	        }
	        else if (size < 0x100000000) {
	            // array 32
	            this.writeU8(0xdd);
	            this.writeU32(size);
	        }
	        else {
	            throw new Error(`Too large array: ${size}`);
	        }
	        for (const item of object) {
	            this.doEncode(item, depth + 1);
	        }
	    }
	    countWithoutUndefined(object, keys) {
	        let count = 0;
	        for (const key of keys) {
	            if (object[key] !== undefined) {
	                count++;
	            }
	        }
	        return count;
	    }
	    encodeMap(object, depth) {
	        const keys = Object.keys(object);
	        if (this.sortKeys) {
	            keys.sort();
	        }
	        const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
	        if (size < 16) {
	            // fixmap
	            this.writeU8(0x80 + size);
	        }
	        else if (size < 0x10000) {
	            // map 16
	            this.writeU8(0xde);
	            this.writeU16(size);
	        }
	        else if (size < 0x100000000) {
	            // map 32
	            this.writeU8(0xdf);
	            this.writeU32(size);
	        }
	        else {
	            throw new Error(`Too large map object: ${size}`);
	        }
	        for (const key of keys) {
	            const value = object[key];
	            if (!(this.ignoreUndefined && value === undefined)) {
	                this.encodeString(key);
	                this.doEncode(value, depth + 1);
	            }
	        }
	    }
	    encodeExtension(ext) {
	        if (typeof ext.data === "function") {
	            const data = ext.data(this.pos + 6);
	            const size = data.length;
	            if (size >= 0x100000000) {
	                throw new Error(`Too large extension object: ${size}`);
	            }
	            this.writeU8(0xc9);
	            this.writeU32(size);
	            this.writeI8(ext.type);
	            this.writeU8a(data);
	            return;
	        }
	        const size = ext.data.length;
	        if (size === 1) {
	            // fixext 1
	            this.writeU8(0xd4);
	        }
	        else if (size === 2) {
	            // fixext 2
	            this.writeU8(0xd5);
	        }
	        else if (size === 4) {
	            // fixext 4
	            this.writeU8(0xd6);
	        }
	        else if (size === 8) {
	            // fixext 8
	            this.writeU8(0xd7);
	        }
	        else if (size === 16) {
	            // fixext 16
	            this.writeU8(0xd8);
	        }
	        else if (size < 0x100) {
	            // ext 8
	            this.writeU8(0xc7);
	            this.writeU8(size);
	        }
	        else if (size < 0x10000) {
	            // ext 16
	            this.writeU8(0xc8);
	            this.writeU16(size);
	        }
	        else if (size < 0x100000000) {
	            // ext 32
	            this.writeU8(0xc9);
	            this.writeU32(size);
	        }
	        else {
	            throw new Error(`Too large extension object: ${size}`);
	        }
	        this.writeI8(ext.type);
	        this.writeU8a(ext.data);
	    }
	    writeU8(value) {
	        this.ensureBufferSizeToWrite(1);
	        this.view.setUint8(this.pos, value);
	        this.pos++;
	    }
	    writeU8a(values) {
	        const size = values.length;
	        this.ensureBufferSizeToWrite(size);
	        this.bytes.set(values, this.pos);
	        this.pos += size;
	    }
	    writeI8(value) {
	        this.ensureBufferSizeToWrite(1);
	        this.view.setInt8(this.pos, value);
	        this.pos++;
	    }
	    writeU16(value) {
	        this.ensureBufferSizeToWrite(2);
	        this.view.setUint16(this.pos, value);
	        this.pos += 2;
	    }
	    writeI16(value) {
	        this.ensureBufferSizeToWrite(2);
	        this.view.setInt16(this.pos, value);
	        this.pos += 2;
	    }
	    writeU32(value) {
	        this.ensureBufferSizeToWrite(4);
	        this.view.setUint32(this.pos, value);
	        this.pos += 4;
	    }
	    writeI32(value) {
	        this.ensureBufferSizeToWrite(4);
	        this.view.setInt32(this.pos, value);
	        this.pos += 4;
	    }
	    writeF32(value) {
	        this.ensureBufferSizeToWrite(4);
	        this.view.setFloat32(this.pos, value);
	        this.pos += 4;
	    }
	    writeF64(value) {
	        this.ensureBufferSizeToWrite(8);
	        this.view.setFloat64(this.pos, value);
	        this.pos += 8;
	    }
	    writeU64(value) {
	        this.ensureBufferSizeToWrite(8);
	        setUint64(this.view, this.pos, value);
	        this.pos += 8;
	    }
	    writeI64(value) {
	        this.ensureBufferSizeToWrite(8);
	        setInt64(this.view, this.pos, value);
	        this.pos += 8;
	    }
	    writeBigUint64(value) {
	        this.ensureBufferSizeToWrite(8);
	        this.view.setBigUint64(this.pos, value);
	        this.pos += 8;
	    }
	    writeBigInt64(value) {
	        this.ensureBufferSizeToWrite(8);
	        this.view.setBigInt64(this.pos, value);
	        this.pos += 8;
	    }
	}

	/**
	 * It encodes `value` in the MessagePack format and
	 * returns a byte buffer.
	 *
	 * The returned buffer is a slice of a larger `ArrayBuffer`, so you have to use its `#byteOffset` and `#byteLength` in order to convert it to another typed arrays including NodeJS `Buffer`.
	 */
	function encode(value, options) {
	    const encoder = new Encoder(options);
	    return encoder.encodeSharedRef(value);
	}

	function prettyByte(byte) {
	    return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
	}

	const DEFAULT_MAX_KEY_LENGTH = 16;
	const DEFAULT_MAX_LENGTH_PER_KEY = 16;
	class CachedKeyDecoder {
	    hit = 0;
	    miss = 0;
	    caches;
	    maxKeyLength;
	    maxLengthPerKey;
	    constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
	        this.maxKeyLength = maxKeyLength;
	        this.maxLengthPerKey = maxLengthPerKey;
	        // avoid `new Array(N)`, which makes a sparse array,
	        // because a sparse array is typically slower than a non-sparse array.
	        this.caches = [];
	        for (let i = 0; i < this.maxKeyLength; i++) {
	            this.caches.push([]);
	        }
	    }
	    canBeCached(byteLength) {
	        return byteLength > 0 && byteLength <= this.maxKeyLength;
	    }
	    find(bytes, inputOffset, byteLength) {
	        const records = this.caches[byteLength - 1];
	        FIND_CHUNK: for (const record of records) {
	            const recordBytes = record.bytes;
	            for (let j = 0; j < byteLength; j++) {
	                if (recordBytes[j] !== bytes[inputOffset + j]) {
	                    continue FIND_CHUNK;
	                }
	            }
	            return record.str;
	        }
	        return null;
	    }
	    store(bytes, value) {
	        const records = this.caches[bytes.length - 1];
	        const record = { bytes, str: value };
	        if (records.length >= this.maxLengthPerKey) {
	            // `records` are full!
	            // Set `record` to an arbitrary position.
	            records[(Math.random() * records.length) | 0] = record;
	        }
	        else {
	            records.push(record);
	        }
	    }
	    decode(bytes, inputOffset, byteLength) {
	        const cachedValue = this.find(bytes, inputOffset, byteLength);
	        if (cachedValue != null) {
	            this.hit++;
	            return cachedValue;
	        }
	        this.miss++;
	        const str = utf8DecodeJs(bytes, inputOffset, byteLength);
	        // Ensure to copy a slice of bytes because the bytes may be a NodeJS Buffer and Buffer#slice() returns a reference to its internal ArrayBuffer.
	        const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
	        this.store(slicedCopyOfBytes, str);
	        return str;
	    }
	}

	const STATE_ARRAY = "array";
	const STATE_MAP_KEY = "map_key";
	const STATE_MAP_VALUE = "map_value";
	const mapKeyConverter = (key) => {
	    if (typeof key === "string" || typeof key === "number") {
	        return key;
	    }
	    throw new DecodeError("The type of key must be string or number but " + typeof key);
	};
	class StackPool {
	    stack = [];
	    stackHeadPosition = -1;
	    get length() {
	        return this.stackHeadPosition + 1;
	    }
	    top() {
	        return this.stack[this.stackHeadPosition];
	    }
	    pushArrayState(size) {
	        const state = this.getUninitializedStateFromPool();
	        state.type = STATE_ARRAY;
	        state.position = 0;
	        state.size = size;
	        state.array = new Array(size);
	    }
	    pushMapState(size) {
	        const state = this.getUninitializedStateFromPool();
	        state.type = STATE_MAP_KEY;
	        state.readCount = 0;
	        state.size = size;
	        state.map = {};
	    }
	    getUninitializedStateFromPool() {
	        this.stackHeadPosition++;
	        if (this.stackHeadPosition === this.stack.length) {
	            const partialState = {
	                type: undefined,
	                size: 0,
	                array: undefined,
	                position: 0,
	                readCount: 0,
	                map: undefined,
	                key: null,
	            };
	            this.stack.push(partialState);
	        }
	        return this.stack[this.stackHeadPosition];
	    }
	    release(state) {
	        const topStackState = this.stack[this.stackHeadPosition];
	        if (topStackState !== state) {
	            throw new Error("Invalid stack state. Released state is not on top of the stack.");
	        }
	        if (state.type === STATE_ARRAY) {
	            const partialState = state;
	            partialState.size = 0;
	            partialState.array = undefined;
	            partialState.position = 0;
	            partialState.type = undefined;
	        }
	        if (state.type === STATE_MAP_KEY || state.type === STATE_MAP_VALUE) {
	            const partialState = state;
	            partialState.size = 0;
	            partialState.map = undefined;
	            partialState.readCount = 0;
	            partialState.type = undefined;
	        }
	        this.stackHeadPosition--;
	    }
	    reset() {
	        this.stack.length = 0;
	        this.stackHeadPosition = -1;
	    }
	}
	const HEAD_BYTE_REQUIRED = -1;
	const EMPTY_VIEW = new DataView(new ArrayBuffer(0));
	const EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
	try {
	    // IE11: The spec says it should throw RangeError,
	    // IE11: but in IE11 it throws TypeError.
	    EMPTY_VIEW.getInt8(0);
	}
	catch (e) {
	    if (!(e instanceof RangeError)) {
	        throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
	    }
	}
	const MORE_DATA = new RangeError("Insufficient data");
	const sharedCachedKeyDecoder = new CachedKeyDecoder();
	class Decoder {
	    extensionCodec;
	    context;
	    useBigInt64;
	    rawStrings;
	    maxStrLength;
	    maxBinLength;
	    maxArrayLength;
	    maxMapLength;
	    maxExtLength;
	    keyDecoder;
	    mapKeyConverter;
	    totalPos = 0;
	    pos = 0;
	    view = EMPTY_VIEW;
	    bytes = EMPTY_BYTES;
	    headByte = HEAD_BYTE_REQUIRED;
	    stack = new StackPool();
	    entered = false;
	    constructor(options) {
	        this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
	        this.context = options?.context; // needs a type assertion because EncoderOptions has no context property when ContextType is undefined
	        this.useBigInt64 = options?.useBigInt64 ?? false;
	        this.rawStrings = options?.rawStrings ?? false;
	        this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
	        this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
	        this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
	        this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
	        this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
	        this.keyDecoder = options?.keyDecoder !== undefined ? options.keyDecoder : sharedCachedKeyDecoder;
	        this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
	    }
	    clone() {
	        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	        return new Decoder({
	            extensionCodec: this.extensionCodec,
	            context: this.context,
	            useBigInt64: this.useBigInt64,
	            rawStrings: this.rawStrings,
	            maxStrLength: this.maxStrLength,
	            maxBinLength: this.maxBinLength,
	            maxArrayLength: this.maxArrayLength,
	            maxMapLength: this.maxMapLength,
	            maxExtLength: this.maxExtLength,
	            keyDecoder: this.keyDecoder,
	        });
	    }
	    reinitializeState() {
	        this.totalPos = 0;
	        this.headByte = HEAD_BYTE_REQUIRED;
	        this.stack.reset();
	        // view, bytes, and pos will be re-initialized in setBuffer()
	    }
	    setBuffer(buffer) {
	        const bytes = ensureUint8Array(buffer);
	        this.bytes = bytes;
	        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	        this.pos = 0;
	    }
	    appendBuffer(buffer) {
	        if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
	            this.setBuffer(buffer);
	        }
	        else {
	            const remainingData = this.bytes.subarray(this.pos);
	            const newData = ensureUint8Array(buffer);
	            // concat remainingData + newData
	            const newBuffer = new Uint8Array(remainingData.length + newData.length);
	            newBuffer.set(remainingData);
	            newBuffer.set(newData, remainingData.length);
	            this.setBuffer(newBuffer);
	        }
	    }
	    hasRemaining(size) {
	        return this.view.byteLength - this.pos >= size;
	    }
	    createExtraByteError(posToShow) {
	        const { view, pos } = this;
	        return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
	    }
	    /**
	     * @throws {@link DecodeError}
	     * @throws {@link RangeError}
	     */
	    decode(buffer) {
	        if (this.entered) {
	            const instance = this.clone();
	            return instance.decode(buffer);
	        }
	        try {
	            this.entered = true;
	            this.reinitializeState();
	            this.setBuffer(buffer);
	            const object = this.doDecodeSync();
	            if (this.hasRemaining(1)) {
	                throw this.createExtraByteError(this.pos);
	            }
	            return object;
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    *decodeMulti(buffer) {
	        if (this.entered) {
	            const instance = this.clone();
	            yield* instance.decodeMulti(buffer);
	            return;
	        }
	        try {
	            this.entered = true;
	            this.reinitializeState();
	            this.setBuffer(buffer);
	            while (this.hasRemaining(1)) {
	                yield this.doDecodeSync();
	            }
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    async decodeAsync(stream) {
	        if (this.entered) {
	            const instance = this.clone();
	            return instance.decodeAsync(stream);
	        }
	        try {
	            this.entered = true;
	            let decoded = false;
	            let object;
	            for await (const buffer of stream) {
	                if (decoded) {
	                    this.entered = false;
	                    throw this.createExtraByteError(this.totalPos);
	                }
	                this.appendBuffer(buffer);
	                try {
	                    object = this.doDecodeSync();
	                    decoded = true;
	                }
	                catch (e) {
	                    if (!(e instanceof RangeError)) {
	                        throw e; // rethrow
	                    }
	                    // fallthrough
	                }
	                this.totalPos += this.pos;
	            }
	            if (decoded) {
	                if (this.hasRemaining(1)) {
	                    throw this.createExtraByteError(this.totalPos);
	                }
	                return object;
	            }
	            const { headByte, pos, totalPos } = this;
	            throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    decodeArrayStream(stream) {
	        return this.decodeMultiAsync(stream, true);
	    }
	    decodeStream(stream) {
	        return this.decodeMultiAsync(stream, false);
	    }
	    async *decodeMultiAsync(stream, isArray) {
	        if (this.entered) {
	            const instance = this.clone();
	            yield* instance.decodeMultiAsync(stream, isArray);
	            return;
	        }
	        try {
	            this.entered = true;
	            let isArrayHeaderRequired = isArray;
	            let arrayItemsLeft = -1;
	            for await (const buffer of stream) {
	                if (isArray && arrayItemsLeft === 0) {
	                    throw this.createExtraByteError(this.totalPos);
	                }
	                this.appendBuffer(buffer);
	                if (isArrayHeaderRequired) {
	                    arrayItemsLeft = this.readArraySize();
	                    isArrayHeaderRequired = false;
	                    this.complete();
	                }
	                try {
	                    while (true) {
	                        yield this.doDecodeSync();
	                        if (--arrayItemsLeft === 0) {
	                            break;
	                        }
	                    }
	                }
	                catch (e) {
	                    if (!(e instanceof RangeError)) {
	                        throw e; // rethrow
	                    }
	                    // fallthrough
	                }
	                this.totalPos += this.pos;
	            }
	        }
	        finally {
	            this.entered = false;
	        }
	    }
	    doDecodeSync() {
	        DECODE: while (true) {
	            const headByte = this.readHeadByte();
	            let object;
	            if (headByte >= 0xe0) {
	                // negative fixint (111x xxxx) 0xe0 - 0xff
	                object = headByte - 0x100;
	            }
	            else if (headByte < 0xc0) {
	                if (headByte < 0x80) {
	                    // positive fixint (0xxx xxxx) 0x00 - 0x7f
	                    object = headByte;
	                }
	                else if (headByte < 0x90) {
	                    // fixmap (1000 xxxx) 0x80 - 0x8f
	                    const size = headByte - 0x80;
	                    if (size !== 0) {
	                        this.pushMapState(size);
	                        this.complete();
	                        continue DECODE;
	                    }
	                    else {
	                        object = {};
	                    }
	                }
	                else if (headByte < 0xa0) {
	                    // fixarray (1001 xxxx) 0x90 - 0x9f
	                    const size = headByte - 0x90;
	                    if (size !== 0) {
	                        this.pushArrayState(size);
	                        this.complete();
	                        continue DECODE;
	                    }
	                    else {
	                        object = [];
	                    }
	                }
	                else {
	                    // fixstr (101x xxxx) 0xa0 - 0xbf
	                    const byteLength = headByte - 0xa0;
	                    object = this.decodeString(byteLength, 0);
	                }
	            }
	            else if (headByte === 0xc0) {
	                // nil
	                object = null;
	            }
	            else if (headByte === 0xc2) {
	                // false
	                object = false;
	            }
	            else if (headByte === 0xc3) {
	                // true
	                object = true;
	            }
	            else if (headByte === 0xca) {
	                // float 32
	                object = this.readF32();
	            }
	            else if (headByte === 0xcb) {
	                // float 64
	                object = this.readF64();
	            }
	            else if (headByte === 0xcc) {
	                // uint 8
	                object = this.readU8();
	            }
	            else if (headByte === 0xcd) {
	                // uint 16
	                object = this.readU16();
	            }
	            else if (headByte === 0xce) {
	                // uint 32
	                object = this.readU32();
	            }
	            else if (headByte === 0xcf) {
	                // uint 64
	                if (this.useBigInt64) {
	                    object = this.readU64AsBigInt();
	                }
	                else {
	                    object = this.readU64();
	                }
	            }
	            else if (headByte === 0xd0) {
	                // int 8
	                object = this.readI8();
	            }
	            else if (headByte === 0xd1) {
	                // int 16
	                object = this.readI16();
	            }
	            else if (headByte === 0xd2) {
	                // int 32
	                object = this.readI32();
	            }
	            else if (headByte === 0xd3) {
	                // int 64
	                if (this.useBigInt64) {
	                    object = this.readI64AsBigInt();
	                }
	                else {
	                    object = this.readI64();
	                }
	            }
	            else if (headByte === 0xd9) {
	                // str 8
	                const byteLength = this.lookU8();
	                object = this.decodeString(byteLength, 1);
	            }
	            else if (headByte === 0xda) {
	                // str 16
	                const byteLength = this.lookU16();
	                object = this.decodeString(byteLength, 2);
	            }
	            else if (headByte === 0xdb) {
	                // str 32
	                const byteLength = this.lookU32();
	                object = this.decodeString(byteLength, 4);
	            }
	            else if (headByte === 0xdc) {
	                // array 16
	                const size = this.readU16();
	                if (size !== 0) {
	                    this.pushArrayState(size);
	                    this.complete();
	                    continue DECODE;
	                }
	                else {
	                    object = [];
	                }
	            }
	            else if (headByte === 0xdd) {
	                // array 32
	                const size = this.readU32();
	                if (size !== 0) {
	                    this.pushArrayState(size);
	                    this.complete();
	                    continue DECODE;
	                }
	                else {
	                    object = [];
	                }
	            }
	            else if (headByte === 0xde) {
	                // map 16
	                const size = this.readU16();
	                if (size !== 0) {
	                    this.pushMapState(size);
	                    this.complete();
	                    continue DECODE;
	                }
	                else {
	                    object = {};
	                }
	            }
	            else if (headByte === 0xdf) {
	                // map 32
	                const size = this.readU32();
	                if (size !== 0) {
	                    this.pushMapState(size);
	                    this.complete();
	                    continue DECODE;
	                }
	                else {
	                    object = {};
	                }
	            }
	            else if (headByte === 0xc4) {
	                // bin 8
	                const size = this.lookU8();
	                object = this.decodeBinary(size, 1);
	            }
	            else if (headByte === 0xc5) {
	                // bin 16
	                const size = this.lookU16();
	                object = this.decodeBinary(size, 2);
	            }
	            else if (headByte === 0xc6) {
	                // bin 32
	                const size = this.lookU32();
	                object = this.decodeBinary(size, 4);
	            }
	            else if (headByte === 0xd4) {
	                // fixext 1
	                object = this.decodeExtension(1, 0);
	            }
	            else if (headByte === 0xd5) {
	                // fixext 2
	                object = this.decodeExtension(2, 0);
	            }
	            else if (headByte === 0xd6) {
	                // fixext 4
	                object = this.decodeExtension(4, 0);
	            }
	            else if (headByte === 0xd7) {
	                // fixext 8
	                object = this.decodeExtension(8, 0);
	            }
	            else if (headByte === 0xd8) {
	                // fixext 16
	                object = this.decodeExtension(16, 0);
	            }
	            else if (headByte === 0xc7) {
	                // ext 8
	                const size = this.lookU8();
	                object = this.decodeExtension(size, 1);
	            }
	            else if (headByte === 0xc8) {
	                // ext 16
	                const size = this.lookU16();
	                object = this.decodeExtension(size, 2);
	            }
	            else if (headByte === 0xc9) {
	                // ext 32
	                const size = this.lookU32();
	                object = this.decodeExtension(size, 4);
	            }
	            else {
	                throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
	            }
	            this.complete();
	            const stack = this.stack;
	            while (stack.length > 0) {
	                // arrays and maps
	                const state = stack.top();
	                if (state.type === STATE_ARRAY) {
	                    state.array[state.position] = object;
	                    state.position++;
	                    if (state.position === state.size) {
	                        object = state.array;
	                        stack.release(state);
	                    }
	                    else {
	                        continue DECODE;
	                    }
	                }
	                else if (state.type === STATE_MAP_KEY) {
	                    if (object === "__proto__") {
	                        throw new DecodeError("The key __proto__ is not allowed");
	                    }
	                    state.key = this.mapKeyConverter(object);
	                    state.type = STATE_MAP_VALUE;
	                    continue DECODE;
	                }
	                else {
	                    // it must be `state.type === State.MAP_VALUE` here
	                    state.map[state.key] = object;
	                    state.readCount++;
	                    if (state.readCount === state.size) {
	                        object = state.map;
	                        stack.release(state);
	                    }
	                    else {
	                        state.key = null;
	                        state.type = STATE_MAP_KEY;
	                        continue DECODE;
	                    }
	                }
	            }
	            return object;
	        }
	    }
	    readHeadByte() {
	        if (this.headByte === HEAD_BYTE_REQUIRED) {
	            this.headByte = this.readU8();
	            // console.log("headByte", prettyByte(this.headByte));
	        }
	        return this.headByte;
	    }
	    complete() {
	        this.headByte = HEAD_BYTE_REQUIRED;
	    }
	    readArraySize() {
	        const headByte = this.readHeadByte();
	        switch (headByte) {
	            case 0xdc:
	                return this.readU16();
	            case 0xdd:
	                return this.readU32();
	            default: {
	                if (headByte < 0xa0) {
	                    return headByte - 0x90;
	                }
	                else {
	                    throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
	                }
	            }
	        }
	    }
	    pushMapState(size) {
	        if (size > this.maxMapLength) {
	            throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
	        }
	        this.stack.pushMapState(size);
	    }
	    pushArrayState(size) {
	        if (size > this.maxArrayLength) {
	            throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
	        }
	        this.stack.pushArrayState(size);
	    }
	    decodeString(byteLength, headerOffset) {
	        if (!this.rawStrings || this.stateIsMapKey()) {
	            return this.decodeUtf8String(byteLength, headerOffset);
	        }
	        return this.decodeBinary(byteLength, headerOffset);
	    }
	    /**
	     * @throws {@link RangeError}
	     */
	    decodeUtf8String(byteLength, headerOffset) {
	        if (byteLength > this.maxStrLength) {
	            throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
	        }
	        if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
	            throw MORE_DATA;
	        }
	        const offset = this.pos + headerOffset;
	        let object;
	        if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
	            object = this.keyDecoder.decode(this.bytes, offset, byteLength);
	        }
	        else {
	            object = utf8Decode(this.bytes, offset, byteLength);
	        }
	        this.pos += headerOffset + byteLength;
	        return object;
	    }
	    stateIsMapKey() {
	        if (this.stack.length > 0) {
	            const state = this.stack.top();
	            return state.type === STATE_MAP_KEY;
	        }
	        return false;
	    }
	    /**
	     * @throws {@link RangeError}
	     */
	    decodeBinary(byteLength, headOffset) {
	        if (byteLength > this.maxBinLength) {
	            throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
	        }
	        if (!this.hasRemaining(byteLength + headOffset)) {
	            throw MORE_DATA;
	        }
	        const offset = this.pos + headOffset;
	        const object = this.bytes.subarray(offset, offset + byteLength);
	        this.pos += headOffset + byteLength;
	        return object;
	    }
	    decodeExtension(size, headOffset) {
	        if (size > this.maxExtLength) {
	            throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
	        }
	        const extType = this.view.getInt8(this.pos + headOffset);
	        const data = this.decodeBinary(size, headOffset + 1 /* extType */);
	        return this.extensionCodec.decode(data, extType, this.context);
	    }
	    lookU8() {
	        return this.view.getUint8(this.pos);
	    }
	    lookU16() {
	        return this.view.getUint16(this.pos);
	    }
	    lookU32() {
	        return this.view.getUint32(this.pos);
	    }
	    readU8() {
	        const value = this.view.getUint8(this.pos);
	        this.pos++;
	        return value;
	    }
	    readI8() {
	        const value = this.view.getInt8(this.pos);
	        this.pos++;
	        return value;
	    }
	    readU16() {
	        const value = this.view.getUint16(this.pos);
	        this.pos += 2;
	        return value;
	    }
	    readI16() {
	        const value = this.view.getInt16(this.pos);
	        this.pos += 2;
	        return value;
	    }
	    readU32() {
	        const value = this.view.getUint32(this.pos);
	        this.pos += 4;
	        return value;
	    }
	    readI32() {
	        const value = this.view.getInt32(this.pos);
	        this.pos += 4;
	        return value;
	    }
	    readU64() {
	        const value = getUint64(this.view, this.pos);
	        this.pos += 8;
	        return value;
	    }
	    readI64() {
	        const value = getInt64(this.view, this.pos);
	        this.pos += 8;
	        return value;
	    }
	    readU64AsBigInt() {
	        const value = this.view.getBigUint64(this.pos);
	        this.pos += 8;
	        return value;
	    }
	    readI64AsBigInt() {
	        const value = this.view.getBigInt64(this.pos);
	        this.pos += 8;
	        return value;
	    }
	    readF32() {
	        const value = this.view.getFloat32(this.pos);
	        this.pos += 4;
	        return value;
	    }
	    readF64() {
	        const value = this.view.getFloat64(this.pos);
	        this.pos += 8;
	        return value;
	    }
	}

	/**
	 * It decodes a single MessagePack object in a buffer.
	 *
	 * This is a synchronous decoding function.
	 * See other variants for asynchronous decoding: {@link decodeAsync}, {@link decodeMultiStream}, or {@link decodeArrayStream}.
	 *
	 * @throws {@link RangeError} if the buffer is incomplete, including the case where the buffer is empty.
	 * @throws {@link DecodeError} if the buffer contains invalid data.
	 */
	function decode(buffer, options) {
	    const decoder = new Decoder(options);
	    return decoder.decode(buffer);
	}

	const MSG = {
		HELLO: 1,
		HELLO_ACK: 2,
		INIT: 3,
		FRAME: 4,
		INPUT: 5,
		REQUEST: 6,
		VIEWPORT: 7,
		PING: 8,
		PONG: 9,
		DEAD: 10,
		UPGRADE_OFFER: 11,   // Server -> Client: 3 upgrade choices
		UPGRADE_PICK: 12     // Client -> Server: selected upgrade ID
	};

	function encodePacket(type, payload) {
		return encode([type, payload]);
	}

	function decodePacket(data) {
		if (data instanceof ArrayBuffer) {
			return decode(new Uint8Array(data));
		}
		if (ArrayBuffer.isView(data)) {
			return decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
		}
		return decode(new Uint8Array(data));
	}

	// Helper to calculate XP needed for a level
	function getXpForLevel(level) {
		const base = consts.XP_BASE_PER_LEVEL ;
		const increment = consts.XP_INCREMENT_PER_LEVEL ;
		return base + (level - 1) * increment;
	}

	let running = false;
	let user$2, socket, frame;
	let players, allPlayers;
	let coinsById = new Map();
	let dronesById = new Map(); // Stores all drones keyed by id
	let enemies = [];
	let enemyStats = { runTime: 0, spawnInterval: 0, enemies: 0, kills: 0 };
	let kills;

	// Upgrade system state
	let upgradeChoices$1 = null; // Current upgrade choices shown to player
	let gamePaused = false; // True when upgrade selection is pending
	let timeout = undefined;
	let dirty = false;
	let deadFrames = 0;
	let requesting = -1;
	let frameCache = [];
	let _allowAnimation = true;
	let renderer;
	let mouseX = 0, mouseY = 0;
	let lastScreenX = 0, lastScreenY = 0;
	let lastZoom = 1;
	let mouseSet = false;
	let viewOffset = { x: 0, y: 0 };
	const clientTickRate = config.netTickRate   ;

	// WASD keyboard control state
	let wasdKeys = { w: false, a: false, s: false, d: false };
	let useWasd = false; // True when WASD keys are being pressed
	let wasdCurrentAngle = 0; // Current smoothed WASD angle
	let wasdTargetAngle = 0; // Target angle based on key presses
	const WASD_TURN_SPEED = 0.15; // Radians per frame for smooth turning

	let requestAnimationFrame;
	try {
		requestAnimationFrame = window.requestAnimationFrame;
	} catch {
		requestAnimationFrame = callback => { setTimeout(callback, 1000 / 30); };
	}

	// Get current viewport dimensions for AOI calculation
	function getViewportDimensions() {
		// Use the actual window dimensions
		const width = window.innerWidth || document.documentElement.clientWidth || 800;
		const height = window.innerHeight || document.documentElement.clientHeight || 600;
		return { width, height };
	}

	// Send viewport update to server
	function sendViewportUpdate() {
		if (socket && socket.readyState === WebSocket.OPEN) {
			const viewport = getViewportDimensions();
			socket.send(encodePacket(MSG.VIEWPORT, viewport));
		}
	}

	// Public API
	function connectGame(wsUrl, name, callback, flag) {
		if (running) return;
		running = true;
		user$2 = null;
		deadFrames = 0;
		
		const prefixes = consts.PREFIXES.split(" ");
		const names = consts.NAMES.split(" ");
		name = name || [prefixes[Math.floor(Math.random() * prefixes.length)], names[Math.floor(Math.random() * names.length)]].join(" ");
		
		socket = new WebSocket(wsUrl);
		socket.binaryType = "arraybuffer";
		
		socket.addEventListener("open", () => {
			console.info("Connected to server.");
			const viewport = getViewportDimensions();
			socket.send(encodePacket(MSG.HELLO, {
				name: name,
				type: 0,
				gameid: -1,
				god: flag,
				viewport
			}));
		});
		
		// Listen for window resize to update AOI on server
		window.addEventListener("resize", sendViewportUpdate);
		
		socket.addEventListener("message", (event) => {
			const [type, data] = decodePacket(event.data);
			if (type === MSG.HELLO_ACK) {
				if (data?.ok) {
					console.info("Connected to game!");
				} else {
					const msg = data?.error || "Unable to connect to game.";
					console.error("Unable to connect to game: " + msg);
					running = false;
					socket.close();
				}
				if (callback) callback(!!data?.ok, data?.error);
				return;
			}
			if (type === MSG.INIT) {
				handleInitState(data);
				return;
			}
			if (type === MSG.FRAME) {
				processFrame(data);
				return;
			}
			if (type === MSG.DEAD) {
				socket.close();
				return;
			}
			if (type === MSG.UPGRADE_OFFER) {
				// Server is offering upgrade choices - pause and show UI
				upgradeChoices$1 = data.choices;
				gamePaused = true;
				invokeRenderer("showUpgradeUI", [data.choices, data.newLevel]);
				return;
			}
		});
		
		socket.addEventListener("close", () => {
			console.info("Server has disconnected. Creating new game.");
			window.removeEventListener("resize", sendViewportUpdate);
			if (!user$2) return;
			user$2.die();
			dirty = true;
			paintLoop();
			running = false;
			invokeRenderer("disconnect", []);
		});
		
		socket.addEventListener("error", () => {
			console.error("WebSocket error");
		});
	}

	function handleInitState(data) {
		if (timeout != undefined) clearTimeout(timeout);
			
			frame = data.frame;
			reset$2();
			
			// Load XP pickups (coins)
			if (data.coins) {
				data.coins.forEach(c => coinsById.set(c.id, c));
			}
		
		if (data.enemies) {
			enemies = data.enemies;
		}
		if (data.enemyStats) {
			enemyStats = data.enemyStats;
		}

			// Load players
			data.players.forEach(p => {
				const pl = new Player(p);
				// Copy stat multipliers
				pl.speedMult = p.speedMult || 1.0;
				pl.snipGraceBonusSec = p.snipGraceBonusSec || 0;
				
				// XP/Level fields
				pl.level = p.level || 1;
				pl.xp = p.xp || 0;
				pl.xpPerLevel = p.xpPerLevel || getXpForLevel(pl.level);
				pl.sizeScale = p.sizeScale || 1.0;
				
				// HP fields
				pl.hp = p.hp ?? (consts.PLAYER_MAX_HP );
				pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP );
				
				// Drone fields
				pl.droneCount = p.droneCount || 1;
				pl.drones = p.drones || [];
				// Store drones in the map
				for (const d of pl.drones) {
					dronesById.set(d.id, d);
				}
				
				addPlayer$1(pl);
				if (!p.territory || p.territory.length === 0) {
					initPlayer(pl);
				}
			});
			
			user$2 = allPlayers[data.num];
			setUser$1(user$2);
			
			invokeRenderer("paint", []);
			frame = data.frame;
			
			if (requesting !== -1) {
				const minFrame = requesting;
				requesting = -1;
				while (frameCache.length > frame - minFrame) {
					processFrame(frameCache[frame - minFrame]);
				}
				frameCache = [];
			}
	}

	function updateMousePosition(clientX, clientY, canvasRect, canvasWidth, canvasHeight, zoom) {
		if (!user$2) return;
		
		// Store screen position and zoom for continuous updates
		lastScreenX = clientX - canvasRect.left;
		const screenY = clientY - canvasRect.top;
		
		const BAR_HEIGHT = 45;
		lastScreenY = screenY - BAR_HEIGHT;
		lastZoom = zoom;
		mouseSet = true;
		
		// Convert to world coordinates
		mouseX = (lastScreenX / lastZoom) + viewOffset.x;
		mouseY = (lastScreenY / lastZoom) + viewOffset.y;
	}

	function setViewOffset(x, y) {
		viewOffset.x = x;
		viewOffset.y = y;
	}

	function updateZoom(zoom) {
		lastZoom = zoom;
	}

	function sendTargetAngle() {
		if (!user$2 || user$2.dead || !socket) return;
		
		// Don't send input while game is paused (upgrade selection)
		if (gamePaused) return;
		
		let targetAngle;
		
		// Check if WASD is being used
		if (useWasd) {
			// Calculate target direction from WASD keys
			let dx = 0, dy = 0;
			if (wasdKeys.w) dy -= 1;
			if (wasdKeys.s) dy += 1;
			if (wasdKeys.a) dx -= 1;
			if (wasdKeys.d) dx += 1;
			
			// If no keys pressed, don't send update
			if (dx === 0 && dy === 0) return;
			
			// Calculate target angle from key combination
			wasdTargetAngle = Math.atan2(dy, dx);
			
			// Smoothly interpolate current angle toward target (omnidirectional)
			let angleDiff = wasdTargetAngle - wasdCurrentAngle;
			
			// Normalize angle difference to [-PI, PI]
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			
			// Smoothly turn toward target
			if (Math.abs(angleDiff) < WASD_TURN_SPEED) {
				wasdCurrentAngle = wasdTargetAngle;
			} else {
				wasdCurrentAngle += Math.sign(angleDiff) * WASD_TURN_SPEED;
			}
			
			// Normalize current angle to [-PI, PI]
			while (wasdCurrentAngle > Math.PI) wasdCurrentAngle -= Math.PI * 2;
			while (wasdCurrentAngle < -Math.PI) wasdCurrentAngle += Math.PI * 2;
			
			targetAngle = wasdCurrentAngle;
		} else {
			// Mouse control
			if (!mouseSet) return;
			
			// Update world mouse position based on last screen position and current view offset.
			mouseX = (lastScreenX / lastZoom) + viewOffset.x;
			mouseY = (lastScreenY / lastZoom) + viewOffset.y;

			// Calculate angle from player to mouse position
			const dx = mouseX - user$2.x;
			const dy = mouseY - user$2.y;
			
			// If mouse is too close to player center, don't update angle
			if (dx * dx + dy * dy < 100) return;
			
			targetAngle = Math.atan2(dy, dx);
			
			// Sync WASD angle with mouse when not using WASD (for smooth transition)
			wasdCurrentAngle = targetAngle;
		}
		
		if (socket.readyState === WebSocket.OPEN) {
			socket.send(encodePacket(MSG.INPUT, {
				frame: frame,
				targetAngle: targetAngle
			}));
		}
	}

	function getPlayers() {
		return players.slice();
	}

	function getCoins() {
		return Array.from(coinsById.values());
	}

	function getEnemies() {
		return enemies.slice();
	}

	function getEnemyStats() {
		return { ...enemyStats };
	}

	function disconnect$1() {
		window.removeEventListener("resize", sendViewportUpdate);
		if (socket) socket.close();
		running = false;
	}

	// Private API
	function addPlayer$1(player) {
		if (allPlayers[player.num]) return;
		allPlayers[player.num] = players[players.length] = player;
		invokeRenderer("addPlayer", [player]);
		return players.length - 1;
	}

	function invokeRenderer(name, args) {
		if (renderer && typeof renderer[name] === "function") {
			renderer[name].apply(null, args);
		}
	}

	function processFrame(data) {
		if (timeout != undefined) clearTimeout(timeout);
		
		if (requesting !== -1 && requesting < data.frame) {
			frameCache.push(data);
			return;
		}
		
		if (data.frame - 1 !== frame) {
			console.error("Frames don't match up!");
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(encodePacket(MSG.REQUEST));
			}
			requesting = data.frame;
			frameCache.push(data);
			return;
		}
		
		frame++;
		
		// Handle economy deltas
		if (data.coinSpawns) {
			// Check for death loot coins (have fromDeath flag)
			const deathLootCoins = data.coinSpawns.filter(c => c.fromDeath);
			if (deathLootCoins.length > 0) {
				// Group by origin point
				const originX = deathLootCoins[0].originX;
				const originY = deathLootCoins[0].originY;
				invokeRenderer("spawnLootCoins", [originX, originY, deathLootCoins]);
			}
			data.coinSpawns.forEach(c => coinsById.set(c.id, c));
		}
		if (data.coinRemovals) {
			data.coinRemovals.forEach(id => {
				const coin = coinsById.get(id);
				// Check if coin was near the local player (player picked it up)
				if (coin && user$2 && !user$2.dead) {
					const dx = coin.x - user$2.x;
					const dy = coin.y - user$2.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					// If coin was within pickup range, notify renderer
					if (dist < 60) {
						invokeRenderer("coinPickup", [coin]);
					}
				}
				coinsById.delete(id);
			});
		}
		
		if (data.enemies) {
			enemies = data.enemies;
		}
		if (data.enemyStats) {
			enemyStats = data.enemyStats;
		}
		
		// Handle XP/Level updates
		if (data.xpUpdates) {
			data.xpUpdates.forEach(update => {
				const p = allPlayers[update.num];
				if (p) {
					p.level = update.level;
					p.xp = update.xp;
					p.xpPerLevel = update.xpPerLevel; // Store XP needed for next level
					p.sizeScale = update.sizeScale;
					// Update drone count
					if (update.droneCount !== undefined) {
						p.droneCount = update.droneCount;
					}
				}
			});
		}
		
		// Handle level-up events (for visual feedback)
		if (data.levelUps) {
			data.levelUps.forEach(levelUp => {
				invokeRenderer("levelUp", [levelUp.x, levelUp.y, levelUp.newLevel, allPlayers[levelUp.playerNum]]);
			});
		}
		
		// Handle drone updates (positions, targeting)
		if (data.droneUpdates) {
			data.droneUpdates.forEach(update => {
				const p = allPlayers[update.ownerNum];
				if (p) {
					// Update player's drones array
					p.drones = update.drones || [];
					// Update global drone map
					for (const d of p.drones) {
						d.ownerId = update.ownerNum;
						dronesById.set(d.id, d);
					}
				}
			});
		}
		
		// Handle hitscan events (drone laser shots)
		if (data.hitscanEvents) {
			data.hitscanEvents.forEach(hit => {
				const target = allPlayers[hit.targetNum];
				if (target) {
					// Use server's authoritative HP value
					if (hit.remainingHp !== undefined) {
						target.hp = hit.remainingHp;
					} else {
						// Fallback to local calculation
						target.hp = Math.max(0, (target.hp || 100) - hit.damage);
					}
					// Track last hit time for HP bar visibility
					target.lastHitTime = Date.now();
				}
				// Notify renderer of hitscan for visual effect (laser line)
				invokeRenderer("hitscan", [hit.fromX, hit.fromY, hit.toX, hit.toY, hit.ownerId, hit.damage]);
			});
		}
		
		// Handle capture events for visual feedback
		if (data.captureEvents) {
			data.captureEvents.forEach(evt => {
				const player = allPlayers[evt.playerNum];
				const isLocalPlayer = user$2 && evt.playerNum === user$2.num;
				invokeRenderer("captureSuccess", [evt.x, evt.y, evt.xpGained, player, isLocalPlayer]);
			});
		}
		
		// Handle territory updates (when server sends changed territories)
		if (data.territoryUpdates) {
			data.territoryUpdates.forEach(update => {
				const player = allPlayers[update.num];
				if (player && update.territory) {
					player.territory = update.territory;
				}
			});
		}
		
		// Handle kill events (for kill sound and counter)
		if (data.killEvents) {
			data.killEvents.forEach(evt => {
				// Check if local player got the kill
				if (user$2 && evt.killerNum === user$2.num) {
					kills++;
					invokeRenderer("playerKill", [evt.killerNum, evt.victimNum, evt.victimName, evt.killType]);
				}
				// Check if local player was killed
				if (user$2 && evt.victimNum === user$2.num) {
					const killer = allPlayers[evt.killerNum];
					const killerName = killer ? (killer.name || 'Unknown') : 'Unknown';
					invokeRenderer("playerWasKilled", [killerName, evt.killType]);
				}
			});
		}

		if (data.newPlayers) {
			data.newPlayers.forEach(p => {
				if (user$2 && p.num === user$2.num) return;
				const pl = new Player(p);
				// Copy XP/Level fields
				pl.level = p.level || 1;
				pl.xp = p.xp || 0;
				pl.xpPerLevel = p.xpPerLevel || getXpForLevel(pl.level);
				pl.sizeScale = p.sizeScale || 1.0;
				// HP fields
				pl.hp = p.hp ?? (consts.PLAYER_MAX_HP );
				pl.maxHp = p.maxHp ?? (consts.PLAYER_MAX_HP );
				// Drone fields
				pl.droneCount = p.droneCount || 1;
				pl.drones = p.drones || [];
				for (const d of pl.drones) {
					dronesById.set(d.id, d);
				}
				addPlayer$1(pl);
				if (!p.territory || p.territory.length === 0) {
					initPlayer(pl);
				}
			});
		}
		
		// Handle players leaving AOI (server stopped sending them)
		// Note: This is NOT a death - just out of view. Don't trigger death effects.
		if (data.leftPlayers) {
			data.leftPlayers.forEach(num => {
				const p = allPlayers[num];
				if (p && p !== user$2) {
					// Remove their drones from the map
					if (p.drones) {
						for (const d of p.drones) {
							dronesById.delete(d.id);
						}
					}
					// Remove from players array
					const idx = players.indexOf(p);
					if (idx !== -1) {
						players.splice(idx, 1);
					}
					delete allPlayers[num];
					// Use silent removal - no death animation
					invokeRenderer("removePlayerSilent", [p]);
				}
			});
		}
		
		// IMPORTANT: never rely on array index alignment between server `moves[]` and local `players[]`.
		// Players can be added/removed and local ordering can drift, which would randomly kill the wrong player.
		const presentNums = new Set();
		data.moves.forEach(val => {
			presentNums.add(val.num);
			const player = allPlayers[val.num];
			if (!player) return;
			if (val.left) player.die();
			player.targetAngle = val.targetAngle;
			
			// Sync position with server to prevent drift (especially for drones)
			if (val.x !== undefined && val.y !== undefined) {
				// Snap to server position when paused, lerp during normal play
				if (gamePaused) {
					player.x = val.x;
					player.y = val.y;
				} else {
					// Smooth correction to server position
					const correctionStrength = 0.3;
					player.x += (val.x - player.x) * correctionStrength;
					player.y += (val.y - player.y) * correctionStrength;
				}
			}
		});
		
		// Any locally-known player that isn't in the server moves list this frame should be considered gone/dead.
		for (const p of players) {
			if (p && !presentNums.has(p.num)) {
				p.die();
			}
		}
		
		update$2();
		
		dirty = true;
		requestAnimationFrame(paintLoop);
		
		timeout = setTimeout(() => {
			console.warn("Server has timed-out. Disconnecting.");
			if (socket) socket.close();
		}, 3000);
	}

	function paintLoop() {
		if (!dirty) return;
		invokeRenderer("paint", []);
		dirty = false;
		
		if (user$2 && user$2.dead) {
			if (timeout) clearTimeout(timeout);
			if (deadFrames === 60) {
				const before = _allowAnimation;
				_allowAnimation = false;
				update$2();
				invokeRenderer("paint", []);
				_allowAnimation = before;
				user$2 = null;
				deadFrames = 0;
				return;
			}
			if (socket) socket.close();
			deadFrames++;
			dirty = true;
			update$2();
			requestAnimationFrame(paintLoop);
		}
	}

	function reset$2() {
		user$2 = null;
		players = [];
		allPlayers = [];
		coinsById.clear();
		dronesById.clear();
		enemies = [];
		enemyStats = { runTime: 0, spawnInterval: 0, enemies: 0, kills: 0 };
		kills = 0;
		invokeRenderer("reset");
	}

	function setUser$1(player) {
		user$2 = player;
		invokeRenderer("setUser", [player]);
	}

	function update$2() {
		// Skip simulation update while upgrade UI is open (game paused)
		if (gamePaused) {
			invokeRenderer("update", [frame]);
			return;
		}
		
		const dead = [];
		updateFrame(players, dead, undefined, 1 / clientTickRate);
		
		dead.forEach(val => {
			console.log((val.name || "Unnamed") + " is dead");
			delete allPlayers[val.num];
			invokeRenderer("removePlayer", [val]);
		});
		
		invokeRenderer("update", [frame]);
	}

	function setRenderer(r) {
		renderer = r;
	}

	function getKills() {
		return kills;
	}

	// WASD key state management
	function setKeyState(key, pressed) {
		const k = key.toLowerCase();
		if (k in wasdKeys) {
			wasdKeys[k] = pressed;
			// Check if any WASD key is pressed
			useWasd = wasdKeys.w || wasdKeys.a || wasdKeys.s || wasdKeys.d;
		}
	}

	// Upgrade system functions
	function selectUpgrade(upgradeId) {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		if (!upgradeChoices$1 || !gamePaused) return;
		
		// Validate the selection is one of the choices
		const validChoice = upgradeChoices$1.find(c => c.id === upgradeId);
		if (!validChoice) {
			console.warn("Invalid upgrade selection:", upgradeId);
			return;
		}
		
		// Send selection to server
		socket.send(encodePacket(MSG.UPGRADE_PICK, { upgradeId }));
		
		// Clear local state (server will resume)
		upgradeChoices$1 = null;
		gamePaused = false;
		
		// Notify renderer to hide UI
		invokeRenderer("hideUpgradeUI", []);
	}

	const allowAnimation = {
		get: function() {
			return _allowAnimation;
		},
		set: function(val) {
			_allowAnimation = !!val;
		},
		enumerable: true
	};

	const SHADOW_OFFSET$1 = 5;
	const ANIMATE_FRAMES$1 = 24;
	const MIN_BAR_WIDTH$1 = 65;
	const BAR_HEIGHT$1 = 45;
	const BAR_WIDTH$1 = 400;

	let canvas$1, ctx$1, offscreenCanvas$1, offctx$1, canvasWidth$1, canvasHeight$1, gameWidth$1, gameHeight$1;
	const $$2 = jquery;

	$$2(() => {
		canvas$1 = $$2("#main-ui")[0];
		ctx$1 = canvas$1.getContext("2d");
		offscreenCanvas$1 = document.createElement("canvas");
		offctx$1 = offscreenCanvas$1.getContext("2d");
		updateSize$1();
	});

	let playerPortion$1, portionsRolling$1, barProportionRolling$1, user$1, zoom$1, showedDead$1;

	function updateSize$1() {
		if (canvasWidth$1 != window.innerWidth) {
			gameWidth$1 = canvasWidth$1 = offscreenCanvas$1.width = canvas$1.width = window.innerWidth;
		}
		if (canvasHeight$1 != window.innerHeight) {
			gameHeight$1 = canvasHeight$1 = offscreenCanvas$1.height = canvas$1.height = window.innerHeight;
		}
	}

	function reset$1() {
		playerPortion$1 = [];
		portionsRolling$1 = [];
		barProportionRolling$1 = [];
		user$1 = null;
		// Zoom to fit entire map
		const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT;
		zoom$1 = Math.min(canvasWidth$1, canvasHeight$1) / (mapSize + consts.BORDER_WIDTH * 2);
		showedDead$1 = false;
	}

	reset$1();

	// Paint methods
	function paintGridBackground$1(ctx) {
		const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
		
		// Background
		ctx.fillStyle = "rgb(211, 225, 237)";
		ctx.fillRect(0, 0, mapSize, mapSize);
		
		// Grid lines (subtle)
		ctx.strokeStyle = "rgba(180, 200, 220, 0.3)";
		ctx.lineWidth = 1;
		const gridSpacing = consts.CELL_WIDTH * 4;
		
		for (let x = 0; x <= mapSize; x += gridSpacing) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, mapSize);
			ctx.stroke();
		}
		for (let y = 0; y <= mapSize; y += gridSpacing) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(mapSize, y);
			ctx.stroke();
		}
		
		// Border
		ctx.fillStyle = "lightgray";
		ctx.fillRect(-consts.BORDER_WIDTH, 0, consts.BORDER_WIDTH, mapSize);
		ctx.fillRect(-consts.BORDER_WIDTH, -consts.BORDER_WIDTH, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
		ctx.fillRect(mapSize, 0, consts.BORDER_WIDTH, mapSize);
		ctx.fillRect(-consts.BORDER_WIDTH, mapSize, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
	}

	function paintUIBar$1(ctx) {
		ctx.fillStyle = "white";
		ctx.font = "18px Changa";

		// Calculate rank
		const sorted = [];
		getPlayers().forEach(val => {
			sorted.push({ player: val, portion: playerPortion$1[val.num] || 0 });
		});
		sorted.sort((a, b) => {
			return (a.portion === b.portion) ? a.player.num - b.player.num : b.portion - a.portion;
		});

		// Rolling the leaderboard bars
		if (sorted.length > 0) {
			const maxPortion = sorted[0].portion || 1;
			getPlayers().forEach(player => {
				const rolling = barProportionRolling$1[player.num];
				if (rolling) {
					rolling.value = (playerPortion$1[player.num] || 0) / maxPortion;
					rolling.update();
				}
			});
		}

		// Show leaderboard
		const leaderboardNum = Math.min(consts.LEADERBOARD_NUM, sorted.length);
		for (let i = 0; i < leaderboardNum; i++) {
			const { player } = sorted[i];
			const name = player.name || "Unnamed";
			const portion = barProportionRolling$1[player.num] ? barProportionRolling$1[player.num].lag : 0;
			const nameWidth = ctx.measureText(name).width;
			const barSize = Math.ceil((BAR_WIDTH$1 - MIN_BAR_WIDTH$1) * portion + MIN_BAR_WIDTH$1);
			const barX = canvasWidth$1 - barSize;
			const barY = BAR_HEIGHT$1 * i;
			const offsetY = i == 0 ? 10 : 0;
			ctx.fillStyle = "rgba(10, 10, 10, .3)";
			ctx.fillRect(barX - 10, barY + 10 - offsetY, barSize + 10, BAR_HEIGHT$1 + offsetY);
			ctx.fillStyle = player.baseColor.rgbString();
			ctx.fillRect(barX, barY, barSize, BAR_HEIGHT$1 - SHADOW_OFFSET$1);
			ctx.fillStyle = player.shadowColor.rgbString();
			ctx.fillRect(barX, barY + BAR_HEIGHT$1 - SHADOW_OFFSET$1, barSize, SHADOW_OFFSET$1);
			ctx.fillStyle = "black";
			ctx.fillText(name, barX - nameWidth - 15, barY + 27);
			const percentage = (portionsRolling$1[player.num] ? portionsRolling$1[player.num].lag * 100 : 0).toFixed(3) + "%";
			ctx.fillStyle = "white";
			ctx.fillText(percentage, barX + 5, barY + BAR_HEIGHT$1 - 15);
		}
	}

	function paint$1(ctx) {
		ctx.fillStyle = "#e2ebf3";
		ctx.fillRect(0, 0, canvasWidth$1, canvasHeight$1);

		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, gameWidth$1, gameHeight$1);
		ctx.clip();

		// Center the map
		const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT + consts.BORDER_WIDTH * 2;
		const offsetX = (gameWidth$1 - mapSize * zoom$1) / 2;
		const offsetY = (gameHeight$1 - mapSize * zoom$1) / 2;
		
		ctx.translate(offsetX, offsetY);
		ctx.scale(zoom$1, zoom$1);
		ctx.translate(consts.BORDER_WIDTH, consts.BORDER_WIDTH);

		paintGridBackground$1(ctx);
		
		// Render all players
		getPlayers().forEach(p => {
			const fr = p.waitLag;
			if (fr < ANIMATE_FRAMES$1) {
				p.render(ctx, fr / ANIMATE_FRAMES$1);
			} else {
				p.render(ctx);
			}
		});

		ctx.restore();
		paintUIBar$1(ctx);

		if ((!user$1 || user$1.dead) && !showedDead$1) {
			showedDead$1 = true;
			console.log("Spectating...");
		}
	}

	function paintDoubleBuff$1() {
		paint$1(offctx$1);
		ctx$1.drawImage(offscreenCanvas$1, 0, 0);
	}

	function update$1() {
		updateSize$1();
		
		// Recalculate zoom to fit map
		const mapSize = consts.CELL_WIDTH * consts.GRID_COUNT;
		zoom$1 = Math.min(canvasWidth$1, canvasHeight$1) / (mapSize + consts.BORDER_WIDTH * 2);

		// Calculate player portions based on territory area
		const mapArea = mapSize * mapSize;
		getPlayers().forEach(player => {
			const area = polygonArea(player.territory);
			playerPortion$1[player.num] = area;
			
			const roll = portionsRolling$1[player.num];
			if (roll) {
				roll.value = area / mapArea;
				roll.update();
			}
		});
	}

	function Rolling$1(value, frames) {
		let lag = 0;
		if (!frames) frames = 24;
		this.value = value;
		Object.defineProperty(this, "lag", {
			get: function() {
				return lag;
			},
			enumerable: true
		});
		this.update = function() {
			const delta = this.value - lag;
			const dir = Math.sign(delta);
			const speed = Math.abs(delta) / frames;
			const mag = Math.min(Math.abs(speed), Math.abs(delta));
			lag += mag * dir;
			return lag;
		};
	}

	var godRenderer = {
		addPlayer: function(player) {
			playerPortion$1[player.num] = 0;
			portionsRolling$1[player.num] = new Rolling$1(0, ANIMATE_FRAMES$1);
			barProportionRolling$1[player.num] = new Rolling$1(0, ANIMATE_FRAMES$1);
		},
		disconnect: function() {
		},
		removePlayer: function(player) {
			delete playerPortion$1[player.num];
			delete portionsRolling$1[player.num];
			delete barProportionRolling$1[player.num];
		},
		removePlayerSilent: function(player) {
			delete playerPortion$1[player.num];
			delete portionsRolling$1[player.num];
			delete barProportionRolling$1[player.num];
		},
		setUser: function(player) {
			user$1 = player;
		},
		reset: reset$1,
		paint: paintDoubleBuff$1,
		update: update$1
	};

	/**
	 * Sound Manager - Synthesized game audio using Web Audio API
	 * No external sound files needed - all sounds are procedurally generated
	 */

	let audioContext = null;
	let masterGain = null;
	let initialized = false;

	// Sound settings - individual volume knobs for each sound type
	const settings = {
	    masterVolume: 0.6,
	    sfxVolume: 0.8,
	    musicVolume: 0.3,
	    enabled: true,
	    
	    // Individual sound volumes (0.0 - 1.0)
	    // Adjust these to balance sound levels
	    volumes: {
	        playerLaser: 0.3,    // Your drone laser shots
	        enemyLaser: 0.2,     // Enemy drone laser shots
	        playerFuse: 1.0,     // Your fuse when snipped
	        enemyFuse: 0.7,      // Enemy fuse when you snip them
	        capture: 1.0,        // Territory capture sound
	        levelUp: 0.8,        // Level up fanfare
	        death: 2.0,          // Death explosion
	        kill: 2.0,           // Kill sound (when you kill someone)
	        coinPickup: 1.0,     // XP orb pickup
	        hit: 1.5,            // Taking damage
	        trailing: 0.4,       // Legacy (unused)
	        speedRush: 0.5       // Speed rush sound (plays at 10%+ speed buff)
	    }
	};

	// Speed rush sound state (looping sound) - when speed buff >= 10%
	let speedRushSound = null;
	let speedRushGainNode = null;
	let speedRushNoiseSource = null;
	let speedRushOscillator = null;

	// Background music state (playlist)
	let bgMusicAudio = null;
	let bgMusicPlaying = false;
	let bgMusicPlaylist = [];      // All available tracks
	let bgMusicShuffled = [];      // Shuffled order to play
	let bgMusicCurrentIndex = 0;   // Current position in shuffled list

	// Menu music state
	let menuMusicAudio = null;
	let menuMusicPlaying = false;
	const MENU_MUSIC_PATH = '/music/playlist/menu/SwarmBlitz - Main Menu Theme.mp3';

	/**
	 * Initialize the audio context (must be called after user interaction)
	 */
	function init() {
	    if (initialized) return;
	    
	    try {
	        audioContext = new (window.AudioContext || window.webkitAudioContext)();
	        masterGain = audioContext.createGain();
	        masterGain.gain.value = settings.masterVolume;
	        masterGain.connect(audioContext.destination);
	        initialized = true;
	        console.log("[SoundManager] Initialized");
	    } catch (e) {
	        console.warn("[SoundManager] Web Audio API not supported:", e);
	        settings.enabled = false;
	    }
	}

	/**
	 * Resume audio context if suspended (needed for Chrome autoplay policy)
	 */
	function resume() {
	    if (audioContext && audioContext.state === 'suspended') {
	        audioContext.resume();
	    }
	}

	/**
	 * Set master volume (0.0 - 1.0)
	 */
	function setMasterVolume(vol) {
	    settings.masterVolume = Math.max(0, Math.min(1, vol));
	    if (masterGain) {
	        masterGain.gain.value = settings.masterVolume;
	    }
	    // Update music volume too
	    if (bgMusicAudio) {
	        bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    }
	    if (menuMusicAudio) {
	        menuMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    }
	}

	/**
	 * Set music volume (0.0 - 1.0)
	 */
	function setMusicVolume(vol) {
	    settings.musicVolume = Math.max(0, Math.min(1, vol));
	    if (bgMusicAudio) {
	        bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    }
	    if (menuMusicAudio) {
	        menuMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    }
	}

	/**
	 * Set SFX volume (0.0 - 1.0)
	 */
	function setSfxVolume(vol) {
	    settings.sfxVolume = Math.max(0, Math.min(1, vol));
	}

	// ===== PLAYER LASER SOUND =====
	// A satisfying "pew" sound - higher pitched, quick attack

	function playPlayerLaser() {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.playerLaser;
	    const now = audioContext.currentTime;
	    const duration = 0.15;
	    
	    // Main tone - bright synth "pew"
	    const osc1 = audioContext.createOscillator();
	    const osc2 = audioContext.createOscillator();
	    const gainNode = audioContext.createGain();
	    const filter = audioContext.createBiquadFilter();
	    
	    osc1.type = 'sawtooth';
	    osc2.type = 'square';
	    
	    // Frequency sweep down for "pew" effect
	    osc1.frequency.setValueAtTime(1800, now);
	    osc1.frequency.exponentialRampToValueAtTime(400, now + duration * 0.7);
	    
	    osc2.frequency.setValueAtTime(1400, now);
	    osc2.frequency.exponentialRampToValueAtTime(300, now + duration * 0.7);
	    
	    // Filter sweep
	    filter.type = 'lowpass';
	    filter.frequency.setValueAtTime(4000, now);
	    filter.frequency.exponentialRampToValueAtTime(800, now + duration);
	    filter.Q.value = 2;
	    
	    // Envelope - quick attack, fast decay
	    gainNode.gain.setValueAtTime(0, now);
	    gainNode.gain.linearRampToValueAtTime(0.35 * settings.sfxVolume * vol, now + 0.01);
	    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
	    
	    // Connect
	    osc1.connect(filter);
	    osc2.connect(filter);
	    filter.connect(gainNode);
	    gainNode.connect(masterGain);
	    
	    osc1.start(now);
	    osc2.start(now);
	    osc1.stop(now + duration);
	    osc2.stop(now + duration);
	}

	// ===== ENEMY LASER SOUND =====
	// Lower pitched, slightly different timbre, with positional volume

	function playEnemyLaser(distance, maxDistance = 800) {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.enemyLaser;
	    
	    // Calculate volume based on distance (linear falloff)
	    // At distance 0 = full volume, at maxDistance or beyond = silent
	    const volumeMultiplier = Math.max(0, 1 - (distance / maxDistance));
	    
	    // If too far away, don't even play the sound
	    if (volumeMultiplier < 0.05) return;
	    
	    const now = audioContext.currentTime;
	    const duration = 0.12;
	    
	    // Main tone - deeper, more menacing
	    const osc1 = audioContext.createOscillator();
	    const osc2 = audioContext.createOscillator();
	    const gainNode = audioContext.createGain();
	    const filter = audioContext.createBiquadFilter();
	    
	    osc1.type = 'sawtooth';
	    osc2.type = 'triangle';
	    
	    // Lower frequency sweep for enemy lasers
	    osc1.frequency.setValueAtTime(900, now);
	    osc1.frequency.exponentialRampToValueAtTime(250, now + duration * 0.8);
	    
	    osc2.frequency.setValueAtTime(700, now);
	    osc2.frequency.exponentialRampToValueAtTime(180, now + duration * 0.8);
	    
	    // Filter
	    filter.type = 'lowpass';
	    filter.frequency.setValueAtTime(2500, now);
	    filter.frequency.exponentialRampToValueAtTime(500, now + duration);
	    filter.Q.value = 3;
	    
	    // Envelope with distance-based volume
	    const baseVolume = 0.25 * settings.sfxVolume * vol * volumeMultiplier;
	    gainNode.gain.setValueAtTime(0, now);
	    gainNode.gain.linearRampToValueAtTime(baseVolume, now + 0.008);
	    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
	    
	    // Connect
	    osc1.connect(filter);
	    osc2.connect(filter);
	    filter.connect(gainNode);
	    gainNode.connect(masterGain);
	    
	    osc1.start(now);
	    osc2.start(now);
	    osc1.stop(now + duration);
	    osc2.stop(now + duration);
	}

	// ===== TERRITORY CAPTURE SOUND =====
	// Satisfying "whoosh" + chime for capturing land

	function playCaptureSound(isLocalPlayer = true) {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.capture;
	    const now = audioContext.currentTime;
	    const volume = (isLocalPlayer ? 1.0 : 0.3) * vol;
	    
	    // Whoosh sound (filtered noise sweep)
	    const bufferSize = audioContext.sampleRate * 0.4;
	    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
	    const data = buffer.getChannelData(0);
	    
	    for (let i = 0; i < bufferSize; i++) {
	        data[i] = Math.random() * 2 - 1;
	    }
	    
	    const noise = audioContext.createBufferSource();
	    noise.buffer = buffer;
	    
	    const noiseGain = audioContext.createGain();
	    const noiseFilter = audioContext.createBiquadFilter();
	    
	    noiseFilter.type = 'bandpass';
	    noiseFilter.frequency.setValueAtTime(300, now);
	    noiseFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
	    noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.4);
	    noiseFilter.Q.value = 1;
	    
	    noiseGain.gain.setValueAtTime(0, now);
	    noiseGain.gain.linearRampToValueAtTime(0.15 * settings.sfxVolume * volume, now + 0.05);
	    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
	    
	    noise.connect(noiseFilter);
	    noiseFilter.connect(noiseGain);
	    noiseGain.connect(masterGain);
	    
	    noise.start(now);
	    noise.stop(now + 0.4);
	    
	    // Chime/success tone (only for local player)
	    if (isLocalPlayer) {
	        // Pleasant chord: C5, E5, G5
	        const frequencies = [523.25, 659.25, 783.99];
	        const duration = 0.35;
	        
	        frequencies.forEach((freq, i) => {
	            const osc = audioContext.createOscillator();
	            const oscGain = audioContext.createGain();
	            
	            osc.type = 'sine';
	            osc.frequency.value = freq;
	            
	            const startTime = now + i * 0.03; // Slight stagger for arpeggio effect
	            
	            oscGain.gain.setValueAtTime(0, startTime);
	            oscGain.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * volume, startTime + 0.02);
	            oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
	            
	            osc.connect(oscGain);
	            oscGain.connect(masterGain);
	            
	            osc.start(startTime);
	            osc.stop(startTime + duration);
	        });
	    }
	}

	// ===== LEVEL UP SOUND =====
	// Epic fanfare - ascending notes with sparkle

	function playLevelUpSound() {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.levelUp;
	    const now = audioContext.currentTime;
	    
	    // Ascending fanfare notes
	    const notes = [
	        { freq: 523.25, time: 0 },      // C5
	        { freq: 659.25, time: 0.08 },   // E5
	        { freq: 783.99, time: 0.16 },   // G5
	        { freq: 1046.5, time: 0.24 },   // C6 (octave up)
	    ];
	    
	    // Main fanfare
	    notes.forEach(note => {
	        const osc = audioContext.createOscillator();
	        const osc2 = audioContext.createOscillator();
	        const gainNode = audioContext.createGain();
	        
	        osc.type = 'sine';
	        osc2.type = 'triangle';
	        osc.frequency.value = note.freq;
	        osc2.frequency.value = note.freq * 2; // Octave above for brightness
	        
	        const startTime = now + note.time;
	        const duration = 0.5 - note.time * 0.5; // Later notes sustain less
	        
	        gainNode.gain.setValueAtTime(0, startTime);
	        gainNode.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * vol, startTime + 0.02);
	        gainNode.gain.setValueAtTime(0.18 * settings.sfxVolume * vol, startTime + duration * 0.3);
	        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
	        
	        osc.connect(gainNode);
	        osc2.connect(gainNode);
	        gainNode.connect(masterGain);
	        
	        osc.start(startTime);
	        osc2.start(startTime);
	        osc.stop(startTime + duration);
	        osc2.stop(startTime + duration);
	    });
	    
	    // Sparkle/shimmer effect
	    const sparkleCount = 8;
	    for (let i = 0; i < sparkleCount; i++) {
	        const osc = audioContext.createOscillator();
	        const gainNode = audioContext.createGain();
	        
	        osc.type = 'sine';
	        const baseFreq = 2000 + Math.random() * 2000;
	        osc.frequency.value = baseFreq;
	        
	        const startTime = now + 0.1 + Math.random() * 0.4;
	        const duration = 0.1 + Math.random() * 0.15;
	        
	        gainNode.gain.setValueAtTime(0, startTime);
	        gainNode.gain.linearRampToValueAtTime(0.06 * settings.sfxVolume * vol, startTime + 0.01);
	        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
	        
	        osc.connect(gainNode);
	        gainNode.connect(masterGain);
	        
	        osc.start(startTime);
	        osc.stop(startTime + duration);
	    }
	    
	    // Low "boom" for impact
	    const boom = audioContext.createOscillator();
	    const boomGain = audioContext.createGain();
	    
	    boom.type = 'sine';
	    boom.frequency.setValueAtTime(150, now);
	    boom.frequency.exponentialRampToValueAtTime(50, now + 0.5);
	    
	    boomGain.gain.setValueAtTime(0, now);
	    boomGain.gain.linearRampToValueAtTime(0.25 * settings.sfxVolume * vol, now + 0.02);
	    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
	    
	    boom.connect(boomGain);
	    boomGain.connect(masterGain);
	    
	    boom.start(now);
	    boom.stop(now + 0.5);
	}

	// ===== DEATH SOUND =====
	// Dramatic "shatter and fade" death sound

	function playDeathSound(isLocalPlayer = false, distance = 0, maxDistance = 400) {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.death;
	    const now = audioContext.currentTime;
	    
	    let volume;
	    if (isLocalPlayer) {
	        // Local player death - full volume
	        volume = 1.0 * vol;
	    } else {
	        // Other player death - distance-based volume
	        const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
	        
	        // If too far, don't play at all
	        if (distanceRatio < 0.1) return;
	        
	        volume = 0.5 * vol * distanceRatio;
	    }
	    
	    // === Layer 1: Dramatic descending tone (the "soul leaving" sound) ===
	    const descend1 = audioContext.createOscillator();
	    const descend2 = audioContext.createOscillator();
	    const descendGain = audioContext.createGain();
	    const descendFilter = audioContext.createBiquadFilter();
	    
	    descend1.type = 'sine';
	    descend2.type = 'triangle';
	    
	    // Mournful descending pitch
	    descend1.frequency.setValueAtTime(600, now);
	    descend1.frequency.exponentialRampToValueAtTime(80, now + 0.8);
	    descend2.frequency.setValueAtTime(603, now); // Slight detune for thickness
	    descend2.frequency.exponentialRampToValueAtTime(82, now + 0.8);
	    
	    descendFilter.type = 'lowpass';
	    descendFilter.frequency.setValueAtTime(2000, now);
	    descendFilter.frequency.exponentialRampToValueAtTime(200, now + 0.7);
	    
	    descendGain.gain.setValueAtTime(0.25 * settings.sfxVolume * volume, now);
	    descendGain.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * volume, now + 0.1);
	    descendGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
	    
	    descend1.connect(descendFilter);
	    descend2.connect(descendFilter);
	    descendFilter.connect(descendGain);
	    descendGain.connect(masterGain);
	    
	    descend1.start(now);
	    descend2.start(now);
	    descend1.stop(now + 0.9);
	    descend2.stop(now + 0.9);
	    
	    // === Layer 2: Soft "glass shatter" texture (filtered noise, short) ===
	    const shatterDuration = 0.15;
	    const shatterSize = audioContext.sampleRate * shatterDuration;
	    const shatterBuffer = audioContext.createBuffer(1, shatterSize, audioContext.sampleRate);
	    const shatterData = shatterBuffer.getChannelData(0);
	    
	    // Create crackly texture instead of pure noise
	    for (let i = 0; i < shatterSize; i++) {
	        const t = i / audioContext.sampleRate;
	        // Crackling with decay
	        const crackle = Math.random() > 0.7 ? (Math.random() * 2 - 1) : 0;
	        const decay = Math.exp(-t * 15);
	        shatterData[i] = crackle * decay;
	    }
	    
	    const shatter = audioContext.createBufferSource();
	    shatter.buffer = shatterBuffer;
	    
	    const shatterGain = audioContext.createGain();
	    const shatterFilter = audioContext.createBiquadFilter();
	    
	    shatterFilter.type = 'highpass';
	    shatterFilter.frequency.value = 2000;
	    shatterFilter.Q.value = 1;
	    
	    shatterGain.gain.setValueAtTime(0.18 * settings.sfxVolume * volume, now);
	    shatterGain.gain.exponentialRampToValueAtTime(0.01, now + shatterDuration);
	    
	    shatter.connect(shatterFilter);
	    shatterFilter.connect(shatterGain);
	    shatterGain.connect(masterGain);
	    
	    shatter.start(now);
	    shatter.stop(now + shatterDuration);
	    
	    // === Layer 3: Sub bass thump (impact feel) ===
	    const thump = audioContext.createOscillator();
	    const thumpGain = audioContext.createGain();
	    
	    thump.type = 'sine';
	    thump.frequency.setValueAtTime(60, now);
	    thump.frequency.exponentialRampToValueAtTime(25, now + 0.3);
	    
	    thumpGain.gain.setValueAtTime(0, now);
	    thumpGain.gain.linearRampToValueAtTime(0.3 * settings.sfxVolume * volume, now + 0.015);
	    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
	    
	    thump.connect(thumpGain);
	    thumpGain.connect(masterGain);
	    
	    thump.start(now);
	    thump.stop(now + 0.35);
	    
	    // === Layer 4: Dissonant "death chord" (only for local player) ===
	    if (isLocalPlayer) {
	        // Minor second interval - unsettling
	        const deathChordFreqs = [180, 190, 270]; // Dissonant cluster
	        
	        deathChordFreqs.forEach((freq, i) => {
	            const osc = audioContext.createOscillator();
	            const oscGain = audioContext.createGain();
	            
	            osc.type = 'sine';
	            osc.frequency.setValueAtTime(freq, now);
	            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.6);
	            
	            oscGain.gain.setValueAtTime(0, now + 0.02);
	            oscGain.gain.linearRampToValueAtTime(0.08 * settings.sfxVolume * vol, now + 0.05);
	            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
	            
	            osc.connect(oscGain);
	            oscGain.connect(masterGain);
	            
	            osc.start(now);
	            osc.stop(now + 0.7);
	        });
	    }
	}

	// ===== COIN/XP PICKUP SOUND =====
	// Satisfying "bling" for picking up XP orbs

	function playCoinPickup() {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.coinPickup;
	    const now = audioContext.currentTime;
	    
	    // Main chime tone
	    const osc1 = audioContext.createOscillator();
	    const osc2 = audioContext.createOscillator();
	    const gainNode = audioContext.createGain();
	    
	    osc1.type = 'sine';
	    osc2.type = 'triangle';
	    
	    // Rising pitch for satisfying feel
	    osc1.frequency.setValueAtTime(800, now);
	    osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
	    
	    osc2.frequency.setValueAtTime(1200, now);
	    osc2.frequency.exponentialRampToValueAtTime(2100, now + 0.08);
	    
	    gainNode.gain.setValueAtTime(0, now);
	    gainNode.gain.linearRampToValueAtTime(0.2 * settings.sfxVolume * vol, now + 0.015);
	    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
	    
	    osc1.connect(gainNode);
	    osc2.connect(gainNode);
	    gainNode.connect(masterGain);
	    
	    osc1.start(now);
	    osc2.start(now);
	    osc1.stop(now + 0.2);
	    osc2.stop(now + 0.2);
	    
	    // Add sparkle overtone
	    const sparkle = audioContext.createOscillator();
	    const sparkleGain = audioContext.createGain();
	    
	    sparkle.type = 'sine';
	    sparkle.frequency.setValueAtTime(2400, now + 0.02);
	    sparkle.frequency.exponentialRampToValueAtTime(3200, now + 0.1);
	    
	    sparkleGain.gain.setValueAtTime(0, now + 0.02);
	    sparkleGain.gain.linearRampToValueAtTime(0.08 * settings.sfxVolume * vol, now + 0.04);
	    sparkleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
	    
	    sparkle.connect(sparkleGain);
	    sparkleGain.connect(masterGain);
	    
	    sparkle.start(now + 0.02);
	    sparkle.stop(now + 0.15);
	}

	// ===== KILL SOUND =====
	// Triumphant sound when you eliminate another player

	function playKillSound() {
	    if (!initialized || !settings.enabled) return;
	    resume();
	    
	    const vol = settings.volumes.kill;
	    const now = audioContext.currentTime;
	    
	    // === LAYER 1: Meaty bass thump ===
	    const bass = audioContext.createOscillator();
	    const bassGain = audioContext.createGain();
	    
	    bass.type = 'sine';
	    bass.frequency.setValueAtTime(120, now);
	    bass.frequency.exponentialRampToValueAtTime(40, now + 0.2);
	    
	    bassGain.gain.setValueAtTime(0.4 * settings.sfxVolume * vol, now);
	    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
	    
	    bass.connect(bassGain);
	    bassGain.connect(masterGain);
	    
	    bass.start(now);
	    bass.stop(now + 0.25);
	    
	    // === LAYER 2: Punchy mid hit ===
	    const punch = audioContext.createOscillator();
	    const punchGain = audioContext.createGain();
	    const punchFilter = audioContext.createBiquadFilter();
	    
	    punch.type = 'square';
	    punch.frequency.setValueAtTime(200, now);
	    punch.frequency.exponentialRampToValueAtTime(80, now + 0.1);
	    
	    punchFilter.type = 'lowpass';
	    punchFilter.frequency.value = 400;
	    
	    punchGain.gain.setValueAtTime(0.25 * settings.sfxVolume * vol, now);
	    punchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
	    
	    punch.connect(punchFilter);
	    punchFilter.connect(punchGain);
	    punchGain.connect(masterGain);
	    
	    punch.start(now);
	    punch.stop(now + 0.12);
	    
	    // === LAYER 3: "Cha-ching!" coin/bell sound ===
	    const bellFreqs = [1318.5, 1568, 2093]; // E6, G6, C7 - bright major chord
	    bellFreqs.forEach((freq, i) => {
	        const bell = audioContext.createOscillator();
	        const bellGain = audioContext.createGain();
	        
	        bell.type = 'sine';
	        bell.frequency.value = freq;
	        
	        const startTime = now + 0.03 + i * 0.015;
	        
	        bellGain.gain.setValueAtTime(0, startTime);
	        bellGain.gain.linearRampToValueAtTime(0.18 * settings.sfxVolume * vol, startTime + 0.01);
	        bellGain.gain.setValueAtTime(0.15 * settings.sfxVolume * vol, startTime + 0.05);
	        bellGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
	        
	        bell.connect(bellGain);
	        bellGain.connect(masterGain);
	        
	        bell.start(startTime);
	        bell.stop(startTime + 0.4);
	    });
	    
	    // === LAYER 4: Triumphant rising sweep ===
	    const sweep = audioContext.createOscillator();
	    const sweepGain = audioContext.createGain();
	    const sweepFilter = audioContext.createBiquadFilter();
	    
	    sweep.type = 'sawtooth';
	    sweep.frequency.setValueAtTime(400, now + 0.02);
	    sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
	    
	    sweepFilter.type = 'bandpass';
	    sweepFilter.frequency.setValueAtTime(600, now + 0.02);
	    sweepFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
	    sweepFilter.Q.value = 2;
	    
	    sweepGain.gain.setValueAtTime(0, now + 0.02);
	    sweepGain.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * vol, now + 0.06);
	    sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
	    
	    sweep.connect(sweepFilter);
	    sweepFilter.connect(sweepGain);
	    sweepGain.connect(masterGain);
	    
	    sweep.start(now + 0.02);
	    sweep.stop(now + 0.2);
	    
	    // === LAYER 5: Sparkle/shimmer ===
	    for (let i = 0; i < 6; i++) {
	        const sparkle = audioContext.createOscillator();
	        const sparkleGain = audioContext.createGain();
	        
	        sparkle.type = 'sine';
	        const baseFreq = 2500 + Math.random() * 2000;
	        sparkle.frequency.value = baseFreq;
	        
	        const startTime = now + 0.05 + Math.random() * 0.15;
	        const duration = 0.08 + Math.random() * 0.1;
	        
	        sparkleGain.gain.setValueAtTime(0, startTime);
	        sparkleGain.gain.linearRampToValueAtTime(0.06 * settings.sfxVolume * vol, startTime + 0.01);
	        sparkleGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
	        
	        sparkle.connect(sparkleGain);
	        sparkleGain.connect(masterGain);
	        
	        sparkle.start(startTime);
	        sparkle.stop(startTime + duration);
	    }
	    
	    // === LAYER 6: Final victory chord ===
	    const chordFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 - full major chord
	    chordFreqs.forEach((freq, i) => {
	        const chime = audioContext.createOscillator();
	        const chimeGain = audioContext.createGain();
	        
	        chime.type = 'sine';
	        chime.frequency.value = freq;
	        
	        const startTime = now + 0.08 + i * 0.02;
	        
	        chimeGain.gain.setValueAtTime(0, startTime);
	        chimeGain.gain.linearRampToValueAtTime(0.1 * settings.sfxVolume * vol, startTime + 0.015);
	        chimeGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
	        
	        chime.connect(chimeGain);
	        chimeGain.connect(masterGain);
	        
	        chime.start(startTime);
	        chime.stop(startTime + 0.5);
	    });
	}

	// ===== SPEED RUSH SOUND (LOOPING) =====
	// Whooshing rush sound when player has 10%+ speed buff - intensifies with speed

	function startSpeedRushSound() {
	    if (!initialized || !settings.enabled) return;
	    if (speedRushSound) return; // Already playing
	    resume();
	    
	    // Create an energetic rushing/whoosh sound
	    const noiseDuration = 2.0;
	    const noiseBufferSize = audioContext.sampleRate * noiseDuration;
	    const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate);
	    const noiseData = noiseBuffer.getChannelData(0);
	    
	    // Generate rushing wind texture with more energy
	    for (let i = 0; i < noiseBufferSize; i++) {
	        const t = i / audioContext.sampleRate;
	        
	        // Base rushing noise
	        const rush = (Math.random() * 2 - 1) * 0.5;
	        
	        // Rhythmic whooshing for movement feel
	        const whoosh = Math.sin(t * 12) * 0.2 * (Math.random() * 2 - 1);
	        
	        // Subtle pulsing undertone
	        const pulse = Math.sin(t * 6) * 0.08;
	        
	        noiseData[i] = rush + whoosh + pulse;
	    }
	    
	    speedRushNoiseSource = audioContext.createBufferSource();
	    speedRushNoiseSource.buffer = noiseBuffer;
	    speedRushNoiseSource.loop = true;
	    speedRushNoiseSource.playbackRate.value = 1.0;
	    
	    // Bandpass filter for whoosh character
	    const bandpass = audioContext.createBiquadFilter();
	    bandpass.type = 'bandpass';
	    bandpass.frequency.value = 600;
	    bandpass.Q.value = 1.2;
	    
	    // Highpass to keep it clean
	    const highpass = audioContext.createBiquadFilter();
	    highpass.type = 'highpass';
	    highpass.frequency.value = 300;
	    highpass.Q.value = 0.7;
	    
	    // Tonal component - energetic hum
	    speedRushOscillator = audioContext.createOscillator();
	    speedRushOscillator.type = 'sawtooth';
	    speedRushOscillator.frequency.value = 100;
	    
	    const oscGain = audioContext.createGain();
	    oscGain.gain.value = 0.02;
	    
	    const oscFilter = audioContext.createBiquadFilter();
	    oscFilter.type = 'lowpass';
	    oscFilter.frequency.value = 200;
	    
	    // Main gain node
	    speedRushGainNode = audioContext.createGain();
	    speedRushGainNode.gain.value = 0; // Start silent, will fade in
	    
	    // Connect noise path
	    speedRushNoiseSource.connect(bandpass);
	    bandpass.connect(highpass);
	    highpass.connect(speedRushGainNode);
	    
	    // Connect oscillator path
	    speedRushOscillator.connect(oscFilter);
	    oscFilter.connect(oscGain);
	    oscGain.connect(speedRushGainNode);
	    
	    speedRushGainNode.connect(masterGain);
	    
	    speedRushNoiseSource.start();
	    speedRushOscillator.start();
	    
	    speedRushSound = { noiseSource: speedRushNoiseSource, oscillator: speedRushOscillator, oscGain, oscFilter, bandpass };
	    
	    // Fade in
	    const now = audioContext.currentTime;
	    const vol = settings.volumes.speedRush ;
	    speedRushGainNode.gain.linearRampToValueAtTime(0.12 * settings.sfxVolume * vol, now + 0.3);
	}

	function stopSpeedRushSound() {
	    if (!speedRushSound) return;
	    
	    try {
	        if (speedRushGainNode) {
	            const now = audioContext.currentTime;
	            speedRushGainNode.gain.linearRampToValueAtTime(0, now + 0.2);
	        }
	        
	        setTimeout(() => {
	            try {
	                if (speedRushSound) {
	                    speedRushSound.noiseSource.stop();
	                    speedRushSound.oscillator.stop();
	                }
	            } catch (e) {
	                // Already stopped
	            }
	            speedRushSound = null;
	            speedRushGainNode = null;
	            speedRushNoiseSource = null;
	            speedRushOscillator = null;
	        }, 250);
	    } catch (e) {
	        speedRushSound = null;
	        speedRushGainNode = null;
	        speedRushNoiseSource = null;
	        speedRushOscillator = null;
	    }
	}

	function updateSpeedRushSound(speedMultiplier) {
	    // speedMultiplier: 1.1+ triggers the sound, up to ~1.2 at max buff
	    // This sound ONLY plays when speed buff is 10% or more
	    if (!speedRushSound || !speedRushGainNode || !initialized || !settings.enabled) return;
	    
	    const vol = settings.volumes.speedRush ;
	    const now = audioContext.currentTime;
	    
	    // Calculate intensity based on speed (0 at 1.1x, 1 at 1.2x)
	    // Sound intensity scales from 10% buff to 20% buff
	    const speedRatio = Math.min(1.0, Math.max(0, (speedMultiplier - 1.1) / 0.1));
	    
	    // Playback rate increases with speed (1.0 to 1.5)
	    const minRate = 1.0;
	    const maxRate = 1.5;
	    const playbackRate = minRate + (maxRate - minRate) * speedRatio;
	    
	    if (speedRushNoiseSource) {
	        speedRushNoiseSource.playbackRate.linearRampToValueAtTime(playbackRate, now + 0.1);
	    }
	    
	    // Volume increases with speed intensity
	    const minVolume = 0.1;
	    const maxVolume = 0.25;
	    const volume = (minVolume + (maxVolume - minVolume) * speedRatio) * settings.sfxVolume * vol;
	    speedRushGainNode.gain.linearRampToValueAtTime(volume, now + 0.1);
	    
	    // Oscillator pitch increases
	    if (speedRushOscillator) {
	        const minFreq = 100;
	        const maxFreq = 180;
	        const freq = minFreq + (maxFreq - minFreq) * speedRatio;
	        speedRushOscillator.frequency.linearRampToValueAtTime(freq, now + 0.1);
	    }
	    
	    // Bandpass center frequency shifts up with speed
	    if (speedRushSound.bandpass) {
	        const minBandFreq = 500;
	        const maxBandFreq = 1200;
	        const bandFreq = minBandFreq + (maxBandFreq - minBandFreq) * speedRatio;
	        speedRushSound.bandpass.frequency.linearRampToValueAtTime(bandFreq, now + 0.1);
	    }
	}

	// ============================================
	// BACKGROUND MUSIC - Playlist with Shuffle
	// ============================================

	/**
	 * Shuffle array using Fisher-Yates algorithm
	 */
	function shuffleArray(array) {
	    const shuffled = [...array];
	    for (let i = shuffled.length - 1; i > 0; i--) {
	        const j = Math.floor(Math.random() * (i + 1));
	        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	    }
	    return shuffled;
	}

	/**
	 * Fetch playlist from server and start playing
	 */
	async function fetchPlaylist() {
	    try {
	        const response = await fetch('/api/playlist');
	        const data = await response.json();
	        bgMusicPlaylist = data.tracks || [];
	        console.log("[SoundManager] Playlist loaded:", bgMusicPlaylist.length, "tracks");
	        return bgMusicPlaylist.length > 0;
	    } catch (e) {
	        console.warn("[SoundManager] Could not fetch playlist:", e);
	        return false;
	    }
	}

	/**
	 * Play the next track in the shuffled playlist
	 */
	function playNextTrack() {
	    if (!bgMusicPlaying || bgMusicShuffled.length === 0) return;
	    
	    // Get current track
	    const track = bgMusicShuffled[bgMusicCurrentIndex];
	    const trackUrl = `/music/playlist/${encodeURIComponent(track)}`;
	    
	    console.log("[SoundManager] Playing track:", track, `(${bgMusicCurrentIndex + 1}/${bgMusicShuffled.length})`);
	    
	    // Create new audio element for this track
	    if (bgMusicAudio) {
	        bgMusicAudio.pause();
	        bgMusicAudio.removeEventListener('ended', onTrackEnded);
	    }
	    
	    bgMusicAudio = new Audio(trackUrl);
	    bgMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    bgMusicAudio.addEventListener('ended', onTrackEnded);
	    
	    bgMusicAudio.play().catch(e => {
	        console.warn("[SoundManager] Could not play track:", e);
	        // Try next track on error
	        advanceToNextTrack();
	    });
	}

	/**
	 * Called when a track finishes playing
	 */
	function onTrackEnded() {
	    advanceToNextTrack();
	}

	/**
	 * Advance to the next track, reshuffling if we've played all tracks
	 */
	function advanceToNextTrack() {
	    if (!bgMusicPlaying) return;
	    
	    bgMusicCurrentIndex++;
	    
	    // If we've played all tracks, reshuffle
	    if (bgMusicCurrentIndex >= bgMusicShuffled.length) {
	        console.log("[SoundManager] All tracks played, reshuffling playlist");
	        bgMusicShuffled = shuffleArray(bgMusicPlaylist);
	        bgMusicCurrentIndex = 0;
	    }
	    
	    playNextTrack();
	}

	/**
	 * Start background music (loads playlist and plays shuffled)
	 */
	async function startBackgroundMusic() {
	    if (!settings.enabled || bgMusicPlaying) return;
	    
	    bgMusicPlaying = true;
	    
	    // Fetch playlist if not loaded
	    if (bgMusicPlaylist.length === 0) {
	        const hasPlaylist = await fetchPlaylist();
	        if (!hasPlaylist) {
	            console.warn("[SoundManager] No tracks in playlist");
	            bgMusicPlaying = false;
	            return;
	        }
	    }
	    
	    // Shuffle the playlist
	    bgMusicShuffled = shuffleArray(bgMusicPlaylist);
	    bgMusicCurrentIndex = 0;
	    
	    // Start playing first track
	    playNextTrack();
	    
	    console.log("[SoundManager] Background music started with", bgMusicPlaylist.length, "tracks");
	}

	/**
	 * Stop background music
	 */
	function stopBackgroundMusic() {
	    if (!bgMusicPlaying) return;
	    
	    bgMusicPlaying = false;
	    
	    if (bgMusicAudio) {
	        bgMusicAudio.removeEventListener('ended', onTrackEnded);
	        
	        // Fade out
	        const audio = bgMusicAudio;
	        const fadeOut = setInterval(() => {
	            if (audio.volume > 0.05) {
	                audio.volume = Math.max(0, audio.volume - 0.05);
	            } else {
	                clearInterval(fadeOut);
	                audio.pause();
	            }
	        }, 30);
	    }
	    
	    console.log("[SoundManager] Background music stopped");
	}

	/**
	 * Update background music tempo based on game state
	 * (Currently disabled - music plays at constant speed)
	 */
	function updateBackgroundMusicTempo(isSnipped, territoryPercent) {
	    // Music plays at constant normal speed
	}

	/**
	 * Check if background music is playing
	 */
	function isBackgroundMusicPlaying() {
	    return bgMusicPlaying;
	}

	// ============================================
	// MENU MUSIC - Plays on main menu
	// ============================================

	/**
	 * Start menu music (plays when on main menu)
	 */
	function startMenuMusic() {
	    if (!settings.enabled || menuMusicPlaying) return;
	    
	    // Stop any game music if playing
	    if (bgMusicPlaying) {
	        stopBackgroundMusic();
	    }
	    
	    menuMusicPlaying = true;
	    
	    // Create audio element for menu music
	    if (menuMusicAudio) {
	        menuMusicAudio.pause();
	    }
	    
	    menuMusicAudio = new Audio(MENU_MUSIC_PATH);
	    menuMusicAudio.volume = settings.musicVolume * settings.masterVolume;
	    menuMusicAudio.loop = true; // Menu music loops
	    
	    menuMusicAudio.play().catch(e => {
	        console.warn("[SoundManager] Could not play menu music:", e);
	        menuMusicPlaying = false;
	    });
	    
	    console.log("[SoundManager] Menu music started");
	}

	/**
	 * Stop menu music
	 */
	function stopMenuMusic() {
	    if (!menuMusicPlaying) return;
	    
	    menuMusicPlaying = false;
	    
	    if (menuMusicAudio) {
	        // Fade out
	        const audio = menuMusicAudio;
	        const fadeOut = setInterval(() => {
	            if (audio.volume > 0.05) {
	                audio.volume = Math.max(0, audio.volume - 0.05);
	            } else {
	                clearInterval(fadeOut);
	                audio.pause();
	            }
	        }, 30);
	    }
	    
	    console.log("[SoundManager] Menu music stopped");
	}

	// Drone rendering constants
	const DRONE_VISUAL_RADIUS = consts.DRONE_RADIUS ;

	// Enemy type colors and styles
	const ENEMY_STYLES = {
		basic:   { color: "rgba(200, 60, 60, 0.9)",  outline: "rgba(90, 20, 20, 0.9)" },     // Red - basic
		charger: { color: "rgba(255, 140, 0, 0.9)",  outline: "rgba(140, 70, 0, 0.9)" },     // Orange - charges at player
		tank:    { color: "rgba(100, 100, 180, 0.9)", outline: "rgba(40, 40, 100, 0.9)" },   // Blue - slow, high HP
		swarm:   { color: "rgba(150, 220, 80, 0.9)", outline: "rgba(70, 120, 30, 0.9)" },    // Green - small, fast, groups
		sniper:  { color: "rgba(180, 60, 180, 0.9)", outline: "rgba(90, 20, 90, 0.9)" }      // Purple - ranged (future)
	};

	const SHADOW_OFFSET = 5;
	const ANIMATE_FRAMES = 24;
	const MIN_BAR_WIDTH = 65;
	const BAR_HEIGHT = 45;
	const BAR_WIDTH = 400;
	const PLAYER_RADIUS = consts.CELL_WIDTH / 2;

	// Territory outline constants
	const TERRITORY_OUTLINE_WIDTH = 2.5;

	// Capture feedback constants
	const CAPTURE_FLASH_TIME_SEC = 1.0;
	const PARTICLE_COUNT = 40;
	const PULSE_RADIUS_START = 10;
	const PULSE_RADIUS_END = 120;
	const PULSE_TIME = 0.8;

	// XP meter tweening
	const XP_TWEEN_DURATION = 0.4;

	let canvas, ctx, offscreenCanvas, offctx, canvasWidth, canvasHeight, gameWidth, gameHeight;
	const $$1 = jquery;

	// Death animation system
	const deathParticles = [];
	let screenShake = { x: 0, y: 0, intensity: 0, decay: 0.92 };
	const dyingPlayers = []; // Track players with death animations

	// Loot coin animation system
	const lootCoins = []; // Animated coins dropping from deaths

	// Hitscan laser effects (drone shots)
	const hitscanEffects = [];

	// Capture feedback effects
	const captureEffects = [];

	// XP meter tweening state
	const xpMeterTween = {
		startValue: 0,
		targetValue: 0,
		currentValue: 0,
		startTime: 0,
		duration: XP_TWEEN_DURATION * 1000
	};

	// Local player outline thickening state
	let localOutlineThicken = {
		active: false,
		startTime: 0,
		duration: 500 // ms
	};

	// Speed buff tracking for sound and visual effects
	let trailStartTime = null; // When player left territory (null if in territory)
	let speedRushActive = false; // Whether speed rush sound is playing
	let soundInitialized = false; // Whether sound manager has been initialized
	const SPEED_TRAIL_THRESHOLD = 1.1; // 10% speed buff to show trail/spikes

	// Upgrade UI state
	let upgradeUIVisible = false;
	let upgradeChoices = [];
	let upgradeNewLevel = 1;
	let hoveredUpgrade = -1; // Index of hovered upgrade card (-1 = none)

	// Rarity colors for upgrade cards
	const RARITY_COLORS = {
		basic: '#9E9E9E',      // Gray
		rare: '#2196F3',       // Blue  
		legendary: '#FFD700'   // Gold
	};

	// Speed spike state - must be declared before reset() is called
	let speedSpikeState = {
		active: false,
		playerX: 0,
		playerY: 0,
		playerAngle: 0,
		speedRatio: 0,
		baseColor: null,
		pulsePhase: 0
	};

	$$1(() => {
		canvas = $$1("#main-ui")[0];
		ctx = canvas.getContext("2d");
		offscreenCanvas = document.createElement("canvas");
		offctx = offscreenCanvas.getContext("2d");
		updateSize();
		
		// Mouse tracking for free movement
		canvas.addEventListener("mousemove", handleMouseMove);
		canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
		canvas.addEventListener("touchstart", handleTouchMove, { passive: false });
		
		// Keyboard and mouse input handlers
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		canvas.addEventListener("click", handleClick);

		// Unlock audio on any first interaction (menu buttons, canvas, etc.)
		const unlockAudio = () => {
			initSoundOnInteraction();
		};
		document.addEventListener("pointerdown", unlockAudio, { once: true });
		document.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
		
		// Send target angle on every frame
		setInterval(() => {
			sendTargetAngle();
		}, 1000 / 60);
		
		// Setup settings panel
		setupSettingsPanel();
	});

	function handleKeyDown(e) {
		// Initialize sound on first key press
		initSoundOnInteraction();
		
		// Handle upgrade selection with number keys
		if (upgradeUIVisible && upgradeChoices && upgradeChoices.length > 0) {
			const key = e.key;
			if (key === '1' && upgradeChoices[0]) {
				selectUpgrade(upgradeChoices[0].id);
				return;
			}
			if (key === '2' && upgradeChoices[1]) {
				selectUpgrade(upgradeChoices[1].id);
				return;
			}
			if (key === '3' && upgradeChoices[2]) {
				selectUpgrade(upgradeChoices[2].id);
				return;
			}
			// Block other input while upgrade UI is open
			return;
		}
		
		// WASD movement controls
		const key = e.key.toLowerCase();
		if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
			setKeyState(key, true);
		}
	}

	function handleKeyUp(e) {
		// Block input while upgrade UI is open
		if (upgradeUIVisible) return;
		
		// WASD movement controls
		const key = e.key.toLowerCase();
		if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
			setKeyState(key, false);
		}
	}

	function handleClick(e) {
		// Initialize sound on first click
		initSoundOnInteraction();
		
		// Handle upgrade selection by clicking cards
		if (upgradeUIVisible && upgradeChoices && upgradeChoices.length > 0) {
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			
			const cardIndex = getHoveredUpgradeCard(mouseX, mouseY);
			if (cardIndex >= 0 && upgradeChoices[cardIndex]) {
				selectUpgrade(upgradeChoices[cardIndex].id);
			}
		}
	}

	// Settings panel setup
	let settingsOpen = false;

	function setupSettingsPanel() {
		const settingsPanel = document.getElementById('settings');
		const toggleBtn = document.querySelector('.toggle');
		const closeBtn = document.getElementById('settings-close');
		const menuBtn = document.getElementById('settings-menu-btn');
		
		function openSettings() {
			settingsOpen = true;
			settingsPanel.style.display = 'block';
		}
		
		function closeSettings() {
			settingsOpen = false;
			settingsPanel.style.display = 'none';
		}
		
		// Toggle settings panel
		if (toggleBtn) {
			toggleBtn.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (settingsOpen) {
					closeSettings();
				} else {
					openSettings();
				}
			});
		}
		
		// Close button
		if (closeBtn) {
			closeBtn.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				closeSettings();
			});
		}
		
		// Main menu button
		if (menuBtn) {
			menuBtn.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				closeSettings();
				// Trigger main menu (same as other .menu buttons)
				setTimeout(() => {
					$$1('.menu').first().trigger('click');
				}, 50);
			});
		}
		
		// Volume sliders
		const masterSlider = document.getElementById('vol-master');
		const musicSlider = document.getElementById('vol-music');
		const sfxSlider = document.getElementById('vol-sfx');
		
		const masterVal = document.getElementById('vol-master-val');
		const musicVal = document.getElementById('vol-music-val');
		const sfxVal = document.getElementById('vol-sfx-val');
		
		// Master volume
		if (masterSlider) {
			masterSlider.addEventListener('input', (e) => {
				const val = parseInt(e.target.value);
				masterVal.textContent = val + '%';
				setMasterVolume(val / 100);
			});
		}
		
		// Music volume
		if (musicSlider) {
			musicSlider.addEventListener('input', (e) => {
				const val = parseInt(e.target.value);
				musicVal.textContent = val + '%';
				if (setMusicVolume) {
					setMusicVolume(val / 100);
				}
			});
		}
		
		// SFX volume
		if (sfxSlider) {
			sfxSlider.addEventListener('input', (e) => {
				const val = parseInt(e.target.value);
				sfxVal.textContent = val + '%';
				if (setSfxVolume) {
					setSfxVolume(val / 100);
				}
			});
		}
		
		// Expandable "How to Play" section
		const howToPlayToggle = document.getElementById('how-to-play-toggle');
		const howToPlayContent = document.getElementById('how-to-play-content');
		const expandableSection = howToPlayToggle ? howToPlayToggle.closest('.expandable') : null;
		
		if (howToPlayToggle && howToPlayContent) {
			howToPlayToggle.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const isOpen = howToPlayContent.style.display !== 'none';
				howToPlayContent.style.display = isOpen ? 'none' : 'block';
				if (expandableSection) {
					expandableSection.classList.toggle('open', !isOpen);
				}
			});
		}
	}

	function initSoundOnInteraction() {
		if (!soundInitialized) {
			init();
			resume();
			soundInitialized = true;
			// Start background music
			startBackgroundMusic();
		}
	}

	function handleMouseMove(e) {
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		
		// Track hovered upgrade card
		if (upgradeUIVisible) {
			hoveredUpgrade = getHoveredUpgradeCard(mouseX, mouseY);
		}
		
		updateMousePosition(e.clientX, e.clientY, rect, canvasWidth, canvasHeight, zoom);
	}

	function handleTouchMove(e) {
		e.preventDefault();
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			const rect = canvas.getBoundingClientRect();
			updateMousePosition(touch.clientX, touch.clientY, rect, canvasWidth, canvasHeight, zoom);
		}
	}

	let playerPortion, portionsRolling, barProportionRolling, animateTo, offset, user, zoom, showedDead;
	let lastKillerName = null; // Track who killed the player

	function updateSize() {
		let changed = false;
		if (canvasWidth != window.innerWidth) {
			gameWidth = canvasWidth = offscreenCanvas.width = canvas.width = window.innerWidth;
			changed = true;
		}
		if (canvasHeight != window.innerHeight) {
			canvasHeight = offscreenCanvas.height = canvas.height = window.innerHeight;
			gameHeight = canvasHeight - BAR_HEIGHT;
			changed = true;
		}
		if (changed && user) centerOnPlayer(user, offset);
	}

	function reset() {
		playerPortion = [];
		portionsRolling = [];
		barProportionRolling = [];
		animateTo = [0, 0];
		offset = [0, 0];
		user = null;
		zoom = 1;
		showedDead = false;
		lastKillerName = null;
		
		// Clear death effects
		deathParticles.length = 0;
		dyingPlayers.length = 0;
		screenShake.intensity = 0;
		screenShake.x = 0;
		screenShake.y = 0;
		
		// Clear loot coin animations
		lootCoins.length = 0;
		
		// Clear hitscan effects
		hitscanEffects.length = 0;
		
		// Clear capture effects
		captureEffects.length = 0;
		
		// Reset XP meter tween
		xpMeterTween.startValue = 0;
		xpMeterTween.targetValue = 0;
		xpMeterTween.currentValue = 0;
		xpMeterTween.startTime = 0;
		
		// Reset outline thickening
		localOutlineThicken.active = false;
		
		// Reset speed buff sound and visual spike state
		trailStartTime = null;
		if (speedRushActive) {
			stopSpeedRushSound();
			speedRushActive = false;
		}
		clearSpeedTrailParticles();
		
		// Reset upgrade UI
		upgradeUIVisible = false;
		upgradeChoices = [];
		upgradeNewLevel = 1;
		hoveredUpgrade = -1;
		
		// Restart background music on respawn
		if (soundInitialized && !isBackgroundMusicPlaying()) {
			startBackgroundMusic();
		}
	}

	reset();

	// Paint methods
	function paintGridBackground(ctx) {
		const mapSize = consts.GRID_COUNT * consts.CELL_WIDTH;
		
		// Background
		ctx.fillStyle = "rgb(211, 225, 237)";
		ctx.fillRect(0, 0, mapSize, mapSize);
		
		// Grid lines (subtle)
		ctx.strokeStyle = "rgba(180, 200, 220, 0.5)";
		ctx.lineWidth = 1;
		const gridSpacing = consts.CELL_WIDTH * 2;
		
		for (let x = 0; x <= mapSize; x += gridSpacing) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, mapSize);
			ctx.stroke();
		}
		for (let y = 0; y <= mapSize; y += gridSpacing) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(mapSize, y);
			ctx.stroke();
		}
		
		// Border
		ctx.fillStyle = "lightgray";
		ctx.fillRect(-consts.BORDER_WIDTH, 0, consts.BORDER_WIDTH, mapSize);
		ctx.fillRect(-consts.BORDER_WIDTH, -consts.BORDER_WIDTH, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
		ctx.fillRect(mapSize, 0, consts.BORDER_WIDTH, mapSize);
		ctx.fillRect(-consts.BORDER_WIDTH, mapSize, mapSize + consts.BORDER_WIDTH * 2, consts.BORDER_WIDTH);
	}

	function paintUIBar(ctx) {
		// UI Bar background - gray color
		ctx.fillStyle = "#3a3a3a";
		ctx.fillRect(0, 0, canvasWidth, BAR_HEIGHT);
		
		// Reset text alignment
		ctx.textAlign = "left";
		ctx.textBaseline = "alphabetic";

		// Calculate rank first (needed for right side display)
		const sorted = [];
		getPlayers().forEach(val => {
			sorted.push({ player: val, portion: playerPortion[val.num] || 0 });
		});
		sorted.sort((a, b) => {
			return (a.portion === b.portion) ? a.player.num - b.player.num : b.portion - a.portion;
		});

		// Get user stats
		const userPortions = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
		const score = (userPortions * 100).toFixed(2) + "%";
		const kills = getKills();
		const level = user.level || 1;
		const droneCount = user.droneCount || level;

		// === TOP LEFT: Score, Kills, Drones (horizontal) ===
		let xOffset = 50;
		const centerY = BAR_HEIGHT / 2 + 6;

		// Score
		ctx.fillStyle = "#FFD700";
		ctx.font = "bold 18px Changa";
		ctx.fillText("Score:", xOffset, centerY);
		xOffset += ctx.measureText("Score:").width + 5;
		ctx.fillStyle = "white";
		ctx.fillText(score, xOffset, centerY);
		xOffset += ctx.measureText(score).width + 20;

		// Kills
		ctx.fillStyle = "#FF6B6B";
		ctx.font = "bold 18px Changa";
		ctx.fillText("Kills:", xOffset, centerY);
		xOffset += ctx.measureText("Kills:").width + 5;
		ctx.fillStyle = "white";
		ctx.fillText(kills, xOffset, centerY);
		xOffset += ctx.measureText(String(kills)).width + 20;

		// Drones
		ctx.fillStyle = "#88CCFF";
		ctx.font = "bold 18px Changa";
		ctx.fillText("Drones:", xOffset, centerY);
		xOffset += ctx.measureText("Drones:").width + 5;
		ctx.fillStyle = "white";
		ctx.fillText(droneCount, xOffset, centerY);

		// === TOP RIGHT: Rank ===
		const rank = sorted.findIndex(val => val.player === user);
		const rankNum = (rank === -1 ? "--" : rank + 1);
		
		ctx.font = "bold 18px Changa";
		ctx.textAlign = "right";
		
		// Draw value first (white), then label (green) to the left
		const valueText = rankNum + " of " + sorted.length;
		const labelText = "Rank: ";
		const valueWidth = ctx.measureText(valueText).width;
		ctx.measureText(labelText).width;
		
		// Position from right edge
		const rightPadding = 15;
		ctx.fillStyle = "white";
		ctx.fillText(valueText, canvasWidth - rightPadding, centerY);
		ctx.fillStyle = "#98FB98";
		ctx.fillText(labelText, canvasWidth - rightPadding - valueWidth, centerY);
		
		ctx.textAlign = "left";

		// Rolling the leaderboard bars
		if (sorted.length > 0) {
			const maxPortion = sorted[0].portion || 1;
			getPlayers().forEach(player => {
				const rolling = barProportionRolling[player.num];
				if (rolling) {
					rolling.value = (playerPortion[player.num] || 0) / maxPortion;
					rolling.update();
				}
			});
		}

		// Show leaderboard
		const leaderboardNum = Math.min(consts.LEADERBOARD_NUM, sorted.length);
		ctx.font = "18px Changa";
		for (let i = 0; i < leaderboardNum; i++) {
			const { player } = sorted[i];
			const name = player.name || "Unnamed";
			const portion = barProportionRolling[player.num] ? barProportionRolling[player.num].lag : 0;
			const nameWidth = ctx.measureText(name).width;
			const barSize = Math.ceil((BAR_WIDTH - MIN_BAR_WIDTH) * portion + MIN_BAR_WIDTH);
			const barX = canvasWidth - barSize;
			const barY = BAR_HEIGHT * (i + 1);
			const offsetY = i == 0 ? 10 : 0;
			ctx.fillStyle = "rgba(10, 10, 10, .3)";
			ctx.fillRect(barX - 10, barY + 10 - offsetY, barSize + 10, BAR_HEIGHT + offsetY);
			ctx.fillStyle = player.baseColor.rgbString();
			ctx.fillRect(barX, barY, barSize, BAR_HEIGHT - SHADOW_OFFSET);
			ctx.fillStyle = player.shadowColor.rgbString();
			ctx.fillRect(barX, barY + BAR_HEIGHT - SHADOW_OFFSET, barSize, SHADOW_OFFSET);
			ctx.fillStyle = "black";
			ctx.fillText(name, barX - nameWidth - 15, barY + 27);
			const percentage = (portionsRolling[player.num] ? portionsRolling[player.num].lag * 100 : 0).toFixed(3) + "%";
			ctx.fillStyle = "white";
			ctx.fillText(percentage, barX + 5, barY + BAR_HEIGHT - 15);
		}
	}

	function paintBottomHPBar(ctx) {
		if (!user) return;
		
		const hp = user.hp ?? (consts.PLAYER_MAX_HP );
		const maxHp = user.maxHp ?? (consts.PLAYER_MAX_HP );
		
		// Bar dimensions (above the XP bar)
		const barWidth = 250;
		const barHeight = 18;
		const barX = (canvasWidth - barWidth) / 2;
		const barY = canvasHeight - 80; // Above XP bar
		
		const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
		
		// === DARK BACKGROUND ===
		ctx.fillStyle = "rgba(10, 10, 10, 0.5)";
		ctx.fillRect(barX - 35, barY - 2, barWidth + 45, barHeight + 4);
		
		// === HP LABEL (left side) ===
		ctx.font = "bold 14px Changa";
		ctx.fillStyle = "#FF6B6B";
		ctx.textAlign = "left";
		ctx.fillText("HP", barX - 30, barY + barHeight - 4);
		
		// === HP BAR TRACK (gray background) ===
		ctx.fillStyle = "rgba(60, 60, 60, 0.8)";
		ctx.fillRect(barX, barY, barWidth, barHeight - 3);
		ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
		ctx.fillRect(barX, barY + barHeight - 3, barWidth, 3);
		
		// === HP BAR FILL (color changes based on HP) ===
		if (hpRatio > 0) {
			const fillWidth = barWidth * hpRatio;
			let fillColor, shadowColor;
			if (hpRatio > 0.5) {
				fillColor = "#44ff44";
				shadowColor = "#228822";
			} else if (hpRatio > 0.25) {
				fillColor = "#ffcc00";
				shadowColor = "#cc9900";
			} else {
				fillColor = "#ff4444";
				shadowColor = "#aa2222";
			}
			ctx.fillStyle = fillColor;
			ctx.fillRect(barX, barY, fillWidth, barHeight - 3);
			ctx.fillStyle = shadowColor;
			ctx.fillRect(barX, barY + barHeight - 3, fillWidth, 3);
		}
		
		// === HP TEXT (on the bar) ===
		ctx.font = "13px Changa";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(Math.floor(hp) + "/" + Math.floor(maxHp), barX + barWidth / 2, barY + barHeight - 4);
	}

	function paintBottomXPBar(ctx) {
		if (!user) return;
		
		const level = user.level || 1;
		const xp = user.xp || 0;
		const xpPerLevel = user.xpPerLevel || ((consts.XP_BASE_PER_LEVEL ) + (level - 1) * (consts.XP_INCREMENT_PER_LEVEL ));
		
		// Bar dimensions (matching game style)
		const barWidth = 250;
		const barHeight = 28;
		const barX = (canvasWidth - barWidth) / 2;
		const barY = canvasHeight - 45;
		
		// Tweened XP for smooth animation
		const tweenedXp = updateXpMeterTween(xp);
		const progressRatio = Math.min(1, tweenedXp / xpPerLevel);
		
		// Get player color for the bar
		const baseColor = user.baseColor;
		const shadowColor = user.shadowColor;
		
		// === DARK BACKGROUND (like leaderboard style) ===
		ctx.fillStyle = "rgba(10, 10, 10, 0.5)";
		ctx.fillRect(barX - 60, barY - 2, barWidth + 70, barHeight + 4);
		
		// === LEVEL TEXT (left side) ===
		ctx.font = "bold 18px Changa";
		ctx.fillStyle = "#FFD700";
		ctx.textAlign = "left";
		const levelText = "Lv." + level;
		ctx.fillText(levelText, barX - 55, barY + barHeight - 8);
		
		// === XP BAR TRACK (gray background) ===
		ctx.fillStyle = "rgba(60, 60, 60, 0.8)";
		ctx.fillRect(barX, barY, barWidth, barHeight - SHADOW_OFFSET);
		ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
		ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, barWidth, SHADOW_OFFSET);
		
		// === XP BAR FILL (player color with shadow offset) ===
		if (progressRatio > 0) {
			const fillWidth = barWidth * progressRatio;
			ctx.fillStyle = baseColor.rgbString();
			ctx.fillRect(barX, barY, fillWidth, barHeight - SHADOW_OFFSET);
			ctx.fillStyle = shadowColor.rgbString();
			ctx.fillRect(barX, barY + barHeight - SHADOW_OFFSET, fillWidth, SHADOW_OFFSET);
		}
		
		// === XP TEXT (on the bar) ===
		ctx.font = "16px Changa";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText(Math.floor(xp) + "/" + xpPerLevel + " XP", barX + barWidth / 2, barY + barHeight - 9);
	}

	function paintDebugOverlay(ctx) {
		const stats = getEnemyStats();
		if (!stats) return;
		
		const spawnInterval = stats.spawnInterval != null ? stats.spawnInterval : 0;
		const runTime = stats.runTime != null ? stats.runTime : 0;
		const enemyCount = stats.enemies != null ? stats.enemies : 0;
		const killCount = stats.kills != null ? stats.kills : getKills();
		const unlockedTypes = stats.unlockedTypes || ['basic'];
		
		const lines = [
			`Enemies: ${enemyCount}`,
			`Spawn: ${spawnInterval.toFixed(2)}s`,
			`Run: ${runTime.toFixed(1)}s`,
			`Kills: ${killCount}`,
			`Types: ${unlockedTypes.join(', ')}`
		];
		
		ctx.save();
		ctx.font = "12px monospace";
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		
		const startX = 10;
		const startY = 8;
		for (let i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], startX, startY + i * 14);
		}
		
		ctx.restore();
	}

	// ===== UPGRADE SELECTION UI =====

	function paintUpgradeUI(ctx) {
		if (!upgradeChoices || upgradeChoices.length === 0) return;
		
		// Get player color for accent
		const playerColor = user && user.baseColor ? user.baseColor : null;
		const accentColor = playerColor ? playerColor.rgbString() : '#FFD700';
		const shadowAccent = user && user.shadowColor ? user.shadowColor.rgbString() : '#B8860B';
		
		// Dark overlay matching game style
		ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
		
		// Card dimensions - more compact
		const cardWidth = 200;
		const cardHeight = 240;
		const cardGap = 25;
		const totalWidth = (cardWidth * 3) + (cardGap * 2);
		const startX = (canvasWidth - totalWidth) / 2;
		const startY = (canvasHeight - cardHeight) / 2 - 30;
		
		// Title banner background (like UI bar style)
		const bannerY = startY - 80;
		const bannerHeight = 50;
		ctx.fillStyle = "rgba(30, 30, 30, 0.9)";
		ctx.fillRect(startX - 20, bannerY, totalWidth + 40, bannerHeight);
		
		// Title accent bar (player color)
		ctx.fillStyle = accentColor;
		ctx.fillRect(startX - 20, bannerY, totalWidth + 40, 4);
		ctx.fillStyle = shadowAccent;
		ctx.fillRect(startX - 20, bannerY + bannerHeight - 4, totalWidth + 40, 4);
		
		// Title text
		ctx.save();
		ctx.font = "bold 28px Changa";
		ctx.fillStyle = accentColor;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(`LEVEL UP!`, canvasWidth / 2 - 50, bannerY + bannerHeight / 2);
		
		ctx.fillStyle = "white";
		ctx.font = "bold 24px Changa";
		ctx.fillText(`Lv.${upgradeNewLevel}`, canvasWidth / 2 + 60, bannerY + bannerHeight / 2);
		ctx.restore();
		
		// Draw each card
		for (let i = 0; i < upgradeChoices.length; i++) {
			const choice = upgradeChoices[i];
			const cardX = startX + i * (cardWidth + cardGap);
			const cardY = startY;
			const isHovered = (hoveredUpgrade === i);
			
			drawUpgradeCard(ctx, choice, cardX, cardY, cardWidth, cardHeight, isHovered, i + 1, playerColor);
		}
		
		// Instructions at bottom (subtle)
		ctx.save();
		ctx.font = "14px Changa";
		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("Click or press 1, 2, 3", canvasWidth / 2, startY + cardHeight + 35);
		ctx.restore();
	}

	function drawUpgradeCard(ctx, choice, x, y, width, height, isHovered, keyNum, playerColor) {
		const rarityColor = RARITY_COLORS[choice.rarity] || RARITY_COLORS.basic;
		
		ctx.save();
		
		// Hover offset effect (lift up slightly)
		const yOffset = isHovered ? -8 : 0;
		y += yOffset;
		
		// Shadow (darker when hovered for depth)
		ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)";
		ctx.fillRect(x + 3, y + 5 - yOffset, width, height);
		
		// Main card background - match game's dark UI style
		ctx.fillStyle = isHovered ? "rgba(50, 50, 55, 0.95)" : "rgba(30, 30, 35, 0.95)";
		ctx.fillRect(x, y, width, height);
		
		// Top accent bar (rarity color with shadow offset like XP bar)
		const barHeight = 6;
		ctx.fillStyle = rarityColor;
		ctx.fillRect(x, y, width, barHeight - 2);
		// Darker shadow portion
		ctx.fillStyle = isHovered ? rarityColor : shadeColor(rarityColor, -30);
		ctx.fillRect(x, y + barHeight - 2, width, 2);
		
		// Subtle border
		ctx.strokeStyle = isHovered ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)";
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, width, height);
		
		// Key number badge (top-left, styled like game UI)
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.fillRect(x + 8, y + 14, 28, 24);
		ctx.fillStyle = isHovered ? "#FFD700" : "rgba(255, 255, 255, 0.6)";
		ctx.font = "bold 18px Changa";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(keyNum, x + 22, y + 26);
		
		// Rarity label (top-right)
		ctx.font = "bold 11px Changa";
		ctx.textAlign = "right";
		ctx.fillStyle = rarityColor;
		const rarityLabel = choice.rarity.toUpperCase();
		ctx.fillText(rarityLabel, x + width - 10, y + 22);
		
		// Upgrade name
		ctx.font = "bold 20px Changa";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(choice.name, x + width / 2, y + 55);
		
		// Horizontal divider line
		ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x + 15, y + 75);
		ctx.lineTo(x + width - 15, y + 75);
		ctx.stroke();
		
		// Stack count (using player color accent if available)
		const currentStacks = choice.currentStacks || 0;
		ctx.font = "15px Changa";
		const stackColor = playerColor ? playerColor.rgbString() : '#88CCFF';
		ctx.fillStyle = stackColor;
		ctx.fillText(`${currentStacks} → ${currentStacks + 1}`, x + width / 2, y + 95);
		
		// Description (multiline) - more compact
		ctx.font = "13px Changa";
		ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
		const descLines = choice.description.split('\n');
		let descY = y + 120;
		for (const line of descLines) {
			// Word wrap long lines
			const words = line.split(' ');
			let currentLine = '';
			for (const word of words) {
				const testLine = currentLine + (currentLine ? ' ' : '') + word;
				if (ctx.measureText(testLine).width > width - 24) {
					ctx.fillText(currentLine, x + width / 2, descY);
					descY += 18;
					currentLine = word;
				} else {
					currentLine = testLine;
				}
			}
			if (currentLine) {
				ctx.fillText(currentLine, x + width / 2, descY);
				descY += 18;
			}
		}
		
		// Hover highlight glow (subtle, matching game style)
		if (isHovered) {
			ctx.strokeStyle = rarityColor;
			ctx.lineWidth = 2;
			ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
		}
		
		ctx.restore();
	}

	// Helper to darken a color
	function shadeColor(color, percent) {
		// Handle rgba/rgb strings
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			let r = parseInt(match[1]);
			let g = parseInt(match[2]);
			let b = parseInt(match[3]);
			r = Math.max(0, Math.min(255, r + percent));
			g = Math.max(0, Math.min(255, g + percent));
			b = Math.max(0, Math.min(255, b + percent));
			return `rgb(${r}, ${g}, ${b})`;
		}
		// Handle hex colors
		if (color.startsWith('#')) {
			let hex = color.slice(1);
			if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
			let r = parseInt(hex.substr(0, 2), 16);
			let g = parseInt(hex.substr(2, 2), 16);
			let b = parseInt(hex.substr(4, 2), 16);
			r = Math.max(0, Math.min(255, r + percent));
			g = Math.max(0, Math.min(255, g + percent));
			b = Math.max(0, Math.min(255, b + percent));
			return `rgb(${r}, ${g}, ${b})`;
		}
		return color;
	}

	// Check if mouse is over an upgrade card
	function getHoveredUpgradeCard(mouseX, mouseY) {
		if (!upgradeUIVisible || !upgradeChoices || upgradeChoices.length === 0) return -1;
		
		// Must match paintUpgradeUI dimensions
		const cardWidth = 200;
		const cardHeight = 240;
		const cardGap = 25;
		const totalWidth = (cardWidth * 3) + (cardGap * 2);
		const startX = (canvasWidth - totalWidth) / 2;
		const startY = (canvasHeight - cardHeight) / 2 - 30;
		
		for (let i = 0; i < upgradeChoices.length; i++) {
			const cardX = startX + i * (cardWidth + cardGap);
			const cardY = startY;
			
			// Include hover lift area
			if (mouseX >= cardX && mouseX <= cardX + cardWidth &&
				mouseY >= cardY - 10 && mouseY <= cardY + cardHeight) {
				return i;
			}
		}
		
		return -1;
	}

	// Level up effect is now handled by the levelUp renderer callback

	function paint(ctx) {
		ctx.fillStyle = "#e2ebf3";
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		// Move to viewport, below the stats bar
		ctx.save();
		ctx.translate(0, BAR_HEIGHT);
		ctx.beginPath();
		ctx.rect(0, 0, gameWidth, gameHeight);
		ctx.clip();

		// Apply screen shake
		ctx.translate(screenShake.x, screenShake.y);

		// Zoom based on territory size
		ctx.scale(zoom, zoom);
		ctx.translate(-offset[0] + consts.BORDER_WIDTH, -offset[1] + consts.BORDER_WIDTH);

		// Update view offset for mouse position calculation
		setViewOffset(offset[0] - consts.BORDER_WIDTH, offset[1] - consts.BORDER_WIDTH);

		paintGridBackground(ctx);

		// Get all players sorted by num for consistent z-ordering
		// This ensures overlapping territories always show the same owner
		const allPlayers = getPlayers().slice().sort((a, b) => a.num - b.num);
		
		// ===== LAYER 1: TERRITORIES (bottom layer) =====
		// Render all territory fills first
		for (const p of allPlayers) {
			const fr = p.waitLag;
			const dissolve = getDyingPlayerEffect(p);
			const fade = fr < ANIMATE_FRAMES ? fr / ANIMATE_FRAMES : 1;
			
			// Skip dead players' territories
			if (dissolve >= 1) continue;
			
			// Snipped visual effect
			let snipAlpha = 1;
			if (p.isSnipped) {
				const time = Date.now() / 100;
				snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
			}
			
			// Render territory fill
			if (p.territory && p.territory.length >= 3) {
				ctx.save();
				if (dissolve > 0) {
					ctx.globalAlpha = Math.max(0, 1 - dissolve);
				}
				
				// Fill territory
				ctx.fillStyle = p.baseColor.deriveAlpha(0.4 * fade * snipAlpha).rgbString();
				ctx.beginPath();
				ctx.moveTo(p.territory[0].x, p.territory[0].y);
				for (let i = 1; i < p.territory.length; i++) {
					ctx.lineTo(p.territory[i].x, p.territory[i].y);
				}
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}
		}
		
		// Render all territory outlines (on top of all fills)
		for (const p of allPlayers) {
			const fr = p.waitLag;
			const dissolve = getDyingPlayerEffect(p);
			const fade = fr < ANIMATE_FRAMES ? fr / ANIMATE_FRAMES : 1;
			
			if (dissolve >= 1) continue;
			
			let snipAlpha = 1;
			if (p.isSnipped) {
				const time = Date.now() / 100;
				snipAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4));
			}
			
			const outlineThickness = getOutlineThickness(p);
			
			if (p.territory && p.territory.length >= 3) {
				ctx.save();
				if (dissolve > 0) {
					ctx.globalAlpha = Math.max(0, 1 - dissolve);
				}
				
				// Draw outline
				const baseOutlineWidth = TERRITORY_OUTLINE_WIDTH;
				const outlineWidth = baseOutlineWidth * outlineThickness;
				ctx.strokeStyle = p.baseColor.deriveAlpha(0.9 * fade * snipAlpha).rgbString();
				ctx.lineWidth = outlineWidth;
				ctx.lineJoin = 'round';
				ctx.lineCap = 'round';
				
				ctx.beginPath();
				ctx.moveTo(p.territory[0].x, p.territory[0].y);
				for (let i = 1; i < p.territory.length; i++) {
					ctx.lineTo(p.territory[i].x, p.territory[i].y);
				}
				ctx.closePath();
				ctx.stroke();
				ctx.restore();
			}
		}

		// ===== LAYER 2: COINS =====
		const coins = getCoins();
		ctx.fillStyle = "#FFD700";
		ctx.shadowBlur = 5;
		ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
		for (const coin of coins) {
			ctx.beginPath();
			ctx.arc(coin.x, coin.y, consts.COIN_RADIUS, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.shadowBlur = 0;
		
		// Render animated loot coins
		renderLootCoins(ctx);
		
		// ===== LAYER 3: PLAYER TRAILS =====
		for (const p of allPlayers) {
			const dissolve = getDyingPlayerEffect(p);
			if (dissolve >= 1) continue;
			
			if (dissolve > 0) {
				ctx.globalAlpha = Math.max(0, 1 - dissolve);
			}
			
			// Render just the trail
			p.renderTrail(ctx);
			
			ctx.globalAlpha = 1;
		}
		
		// ===== LAYER 3.5: ENEMIES =====
		renderEnemies(ctx);
		
		// ===== LAYER 4: SPEED SPIKES (above trails, below players) =====
		renderSpeedTrailParticles(ctx);
		
		// ===== LAYER 5: PLAYER BODIES (above spikes, below drones) =====
		for (const p of allPlayers) {
			const fr = p.waitLag;
			const dissolve = getDyingPlayerEffect(p);
			
			if (dissolve > 0) {
				ctx.globalAlpha = Math.max(0, 1 - dissolve);
			}
			
			// Render player body only (skip trail since already rendered)
			if (fr < ANIMATE_FRAMES) {
				p.renderBody(ctx, fr / ANIMATE_FRAMES, true);
			} else {
				p.renderBody(ctx, 1, true);
			}
			
			ctx.globalAlpha = 1;
		}
		
		// ===== LAYER 5.5: DRONE RANGE INDICATOR (only for user) =====
		if (user && !user.dead && user.drones && user.drones.length > 0) {
			renderDroneRangeCircle(ctx, user);
		}
		
		// ===== LAYER 6: DRONES (above players) =====
		renderAllDrones(ctx);
		
		// ===== LAYER 7: HP BARS (above drones so they're visible) =====
		const HP_BAR_VISIBLE_DURATION = 2000; // Show HP bar for 2 seconds after taking damage
		for (const p of allPlayers) {
			const dissolve = getDyingPlayerEffect(p);
			if (dissolve >= 1) continue;
			
			// Always show HP bar for local player, or if damaged/recently hit for others
			const isLocalPlayer = (p === user);
			const recentlyHit = p.lastHitTime && (Date.now() - p.lastHitTime) < HP_BAR_VISIBLE_DURATION;
			if (p.hp !== undefined && (isLocalPlayer || p.hp < p.maxHp || recentlyHit)) {
				renderPlayerHpBar(ctx, p, isLocalPlayer);
			}
		}
		
		// ===== LAYER 8: EFFECTS (top layers) =====
		// Render capture effects (pulse rings, particles, coins text)
		renderCaptureEffects(ctx);
		
		// Render death particles
		renderDeathParticles(ctx);
		
		// Render hitscan laser effects (on top of everything)
		renderHitscanEffects(ctx);

		// Reset transform for fixed UI
		ctx.restore();
		paintUIBar(ctx);
		paintBottomHPBar(ctx);
		paintBottomXPBar(ctx);
		paintDebugOverlay(ctx);
		
		// Render upgrade selection UI if visible
		if (upgradeUIVisible) {
			paintUpgradeUI(ctx);
		}

		if ((!user || user.dead) && !showedDead) {
			showedDead = true;
			console.log("You died!");
			// Stop background music on death
			if (soundInitialized) {
				stopBackgroundMusic();
			}
			
			// Update death screen stats
			updateDeathStats();
		}
	}

	function updateDeathStats() {
		// Get stats before user is cleared
		const scoreEl = document.getElementById('death-score');
		const killsEl = document.getElementById('death-kills');
		const levelEl = document.getElementById('death-level');
		const killerInfo = document.getElementById('death-killer-info');
		const killerName = document.getElementById('death-killer-name');
		
		if (scoreEl && user) {
			const userPortion = portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
			scoreEl.textContent = (userPortion * 100).toFixed(2) + '%';
		}
		
		if (killsEl) {
			killsEl.textContent = getKills();
		}
		
		if (levelEl && user) {
			levelEl.textContent = user.level || 1;
		}
		
		// Show killer info if available (will be set by playerKill callback)
		if (killerInfo && lastKillerName) {
			killerInfo.style.display = 'block';
			killerName.textContent = lastKillerName;
		} else if (killerInfo) {
			killerInfo.style.display = 'none';
		}
	}

	function paintDoubleBuff() {
		paint(offctx);
		ctx.drawImage(offscreenCanvas, 0, 0);
	}

	function update() {
		updateSize();
		
		// Update death animation effects
		updateDeathEffects();
		
		// Update speed buff and sound effects for local player
		updateSpeedBuffSound();
		
		// Update background music tempo based on game state
		if (user && soundInitialized) {
			portionsRolling[user.num] ? portionsRolling[user.num].lag : 0;
			updateBackgroundMusicTempo(user.isSnipped);
		}

		// Smooth camera movement
		for (let i = 0; i <= 1; i++) {
			if (animateTo[i] !== offset[i]) {
				if (allowAnimation) {
					const delta = animateTo[i] - offset[i];
					const dir = Math.sign(delta);
					const mag = Math.min(consts.SPEED * 2, Math.abs(delta));
					offset[i] += dir * mag;
				} else {
					offset[i] = animateTo[i];
				}
			}
		}

		// Calculate player portions based on territory area
		const mapArea = consts.GRID_COUNT * consts.CELL_WIDTH * consts.GRID_COUNT * consts.CELL_WIDTH;
		getPlayers().forEach(player => {
			const area = polygonArea(player.territory);
			playerPortion[player.num] = area;
			
			const roll = portionsRolling[player.num];
			if (roll) {
				roll.value = area / mapArea;
				roll.update();
			}
		});

		// Zoom based on player size (zoom out as player grows)
		// When sizeScale increases by X%, zoom out by X%
		if (user) {
			const sizeScale = user.sizeScale || 1.0;
			const maxSizeScale = consts.PLAYER_SIZE_SCALE_MAX ;
			// Clamp sizeScale to max (stop zooming at max size)
			const clampedScale = Math.min(sizeScale, maxSizeScale);
			// Zoom = 1 / sizeScale (so 4% bigger = 4% more zoomed out)
			const targetZoom = 1 / clampedScale;
			// Smooth interpolation
			zoom = zoom + (targetZoom - zoom) * 0.05;
			zoom = Math.max(0.3, Math.min(1, zoom));
			updateZoom(zoom);
		}
		
		if (user) centerOnPlayer(user, animateTo);
	}

	/**
	 * Calculate speed buff based on time outside territory
	 * Uses config values: TRAIL_SPEED_BUFF_MAX, TRAIL_SPEED_BUFF_RAMP_TIME, TRAIL_SPEED_BUFF_EASE
	 */
	function calculateSpeedBuff(timeOutsideSec) {
		const maxBuff = consts.TRAIL_SPEED_BUFF_MAX ;
		const rampTime = consts.TRAIL_SPEED_BUFF_RAMP_TIME ;
		const ease = consts.TRAIL_SPEED_BUFF_EASE ;
		
		// Progress from 0 to 1 over ramp time
		const progress = Math.min(1, timeOutsideSec / rampTime);
		
		// Apply easing (higher ease = slower start)
		const easedProgress = Math.pow(progress, ease);
		
		// Calculate buff: 1.0 to maxBuff
		return 1.0 + (maxBuff - 1.0) * easedProgress;
	}

	/**
	 * Check if player is inside their own territory
	 */
	function isInOwnTerritory(player) {
		if (!player || !player.territory || player.territory.length < 3) return false;
		
		const x = player.x;
		const y = player.y;
		const polygon = player.territory;
		
		let inside = false;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const xi = polygon[i].x, yi = polygon[i].y;
			const xj = polygon[j].x, yj = polygon[j].y;
			
			if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
				inside = !inside;
			}
		}
		return inside;
	}

	/**
	 * Update speed buff tracking, speed rush sound, and visual trail
	 */
	function updateSpeedBuffSound() {
		// Update visual particles regardless of sound state
		updateSpeedTrailParticles();
		
		if (!user || user.dead) {
			// Stop sound and clear trail if player is dead
			if (speedRushActive && soundInitialized) {
				stopSpeedRushSound();
				speedRushActive = false;
			}
			trailStartTime = null;
			return;
		}
		
		const inTerritory = isInOwnTerritory(user);
		const now = Date.now();
		
		// If snipped, lose speed buff and visual effects
		if (user.isSnipped) {
			if (trailStartTime !== null) {
				trailStartTime = null;
			}
			if (speedRushActive && soundInitialized) {
				stopSpeedRushSound();
				speedRushActive = false;
			}
			deactivateSpeedSpikes();
			return;
		}
		
		if (inTerritory) {
			// Player is in territory - reset trail time, stop sound and spikes
			if (trailStartTime !== null) {
				trailStartTime = null;
			}
			if (speedRushActive && soundInitialized) {
				stopSpeedRushSound();
				speedRushActive = false;
			}
			deactivateSpeedSpikes();
		} else {
			// Player is outside territory - track time and calculate speed buff
			if (trailStartTime === null) {
				trailStartTime = now;
			}
			
			const timeOutsideSec = (now - trailStartTime) / 1000;
			const speedBuff = calculateSpeedBuff(timeOutsideSec);
			
			// Speed effects only activate when speed buff is >= 10% (1.1x)
			if (speedBuff >= SPEED_TRAIL_THRESHOLD) {
				// Sound effects (only if initialized)
				if (soundInitialized) {
					if (!speedRushActive) {
						startSpeedRushSound();
						speedRushActive = true;
					}
					updateSpeedRushSound(speedBuff);
				}
				
				// Visual spike trail effect
				const speedRatio = Math.min(1.0, (speedBuff - 1.1) / 0.1); // 0 at 1.1x, 1 at 1.2x
				
				// Activate spikes using player's actual color
				if (user.baseColor) {
					activateSpeedSpikes(user.x, user.y, user.angle, speedRatio, user.baseColor);
				}
			} else {
				// Speed buff below threshold - stop sound and spikes
				if (speedRushActive && soundInitialized) {
					stopSpeedRushSound();
					speedRushActive = false;
				}
				deactivateSpeedSpikes();
			}
		}
	}

	// Helper methods
	function centerOnPlayer(player, pos) {
		const xOff = Math.floor(player.x - (gameWidth / zoom) / 2);
		const yOff = Math.floor(player.y - (gameHeight / zoom) / 2);
		pos[0] = xOff;
		pos[1] = yOff;
	}

	function Rolling(value, frames) {
		let lag = 0;
		if (!frames) frames = 24;
		this.value = value;
		Object.defineProperty(this, "lag", {
			get: function() {
				return lag;
			},
			enumerable: true
		});
		this.update = function() {
			const delta = this.value - lag;
			const dir = Math.sign(delta);
			const speed = Math.abs(delta) / frames;
			const mag = Math.min(Math.abs(speed), Math.abs(delta));
			lag += mag * dir;
			return lag;
		};
	}

	// ===== SPEED TRAIL VISUAL EFFECT (SPIKES FROM BACK OF PLAYER) =====

	function updateSpeedTrailParticles() {
		// Update pulse phase based on speed (faster pulse = faster movement)
		if (speedSpikeState.active && user && !user.dead) {
			// Pulse speed: 6-14 radians per second based on speed ratio
			const pulseSpeed = 6 + speedSpikeState.speedRatio * 8;
			speedSpikeState.pulsePhase += pulseSpeed / 60; // Assuming 60fps
			
			// Update position to follow player
			speedSpikeState.playerX = user.x;
			speedSpikeState.playerY = user.y;
			speedSpikeState.playerAngle = user.angle;
		}
	}

	function renderSpeedTrailParticles(ctx) {
		if (!speedSpikeState.active || !speedSpikeState.baseColor) return;
		
		const { playerX, playerY, playerAngle, speedRatio, baseColor, pulsePhase } = speedSpikeState;
		
		// Number of spikes: 3 at low speed, 5 at max speed
		const spikeCount = 3 + Math.floor(speedRatio * 2);
		
		// Spread angle for spikes (wider at higher speeds)
		const totalSpread = 0.8 + speedRatio * 0.6; // ~45 to ~80 degrees total
		
		// Base spike length and width (scales with speed)
		const baseLength = 18 + speedRatio * 25;
		const baseWidth = 8 + speedRatio * 6;
		
		// Distance from player center where spikes start
		const startOffset = 12;
		
		// Get colors from player's base color
		const brightColor = baseColor.deriveLumination(0.3).rgbString();
		const mainColor = baseColor.rgbString();
		baseColor.deriveLumination(-0.2).rgbString();
		
		ctx.save();
		
		for (let i = 0; i < spikeCount; i++) {
			// Calculate angle for this spike (spread behind player)
			const spreadPos = spikeCount > 1 ? (i / (spikeCount - 1)) - 0.5 : 0; // -0.5 to 0.5
			const spikeAngle = playerAngle + Math.PI + spreadPos * totalSpread;
			
			// Each spike has its own phase offset for wave effect
			const phaseOffset = (i / spikeCount) * Math.PI * 2;
			const pulse = Math.sin(pulsePhase + phaseOffset);
			
			// Pulsing size: oscillates between 40% and 100%
			const sizeMult = 0.4 + (pulse * 0.5 + 0.5) * 0.6;
			
			const length = baseLength * sizeMult;
			const width = baseWidth * sizeMult;
			
			if (length < 3) continue;
			
			// Calculate spike start (behind player) and tip
			const startX = playerX + Math.cos(spikeAngle) * startOffset;
			const startY = playerY + Math.sin(spikeAngle) * startOffset;
			const tipX = startX + Math.cos(spikeAngle) * length;
			const tipY = startY + Math.sin(spikeAngle) * length;
			
			// Perpendicular for width
			const perpAngle = spikeAngle + Math.PI / 2;
			const halfWidth = width / 2;
			
			// Alpha based on speed and pulse
			const alpha = (0.6 + speedRatio * 0.3) * (0.6 + sizeMult * 0.4);
			ctx.globalAlpha = alpha;
			
			// Create gradient along spike
			const gradient = ctx.createLinearGradient(startX, startY, tipX, tipY);
			gradient.addColorStop(0, brightColor);
			gradient.addColorStop(0.4, mainColor);
			gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
			
			// Draw spike as triangle
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.moveTo(startX + Math.cos(perpAngle) * halfWidth, startY + Math.sin(perpAngle) * halfWidth);
			ctx.lineTo(startX - Math.cos(perpAngle) * halfWidth, startY - Math.sin(perpAngle) * halfWidth);
			ctx.lineTo(tipX, tipY);
			ctx.closePath();
			ctx.fill();
			
			// Bright core line down the middle
			ctx.globalAlpha = alpha * 0.7;
			ctx.strokeStyle = brightColor;
			ctx.lineWidth = Math.max(1, width * 0.25);
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(tipX, tipY);
			ctx.stroke();
		}
		
		ctx.restore();
	}

	function activateSpeedSpikes(playerX, playerY, playerAngle, speedRatio, baseColor) {
		speedSpikeState.active = true;
		speedSpikeState.playerX = playerX;
		speedSpikeState.playerY = playerY;
		speedSpikeState.playerAngle = playerAngle;
		speedSpikeState.speedRatio = speedRatio;
		speedSpikeState.baseColor = baseColor;
	}

	function deactivateSpeedSpikes() {
		speedSpikeState.active = false;
		speedSpikeState.baseColor = null;
	}

	function clearSpeedTrailParticles() {
		speedSpikeState.active = false;
		speedSpikeState.pulsePhase = 0;
		speedSpikeState.baseColor = null;
	}

	// ===== DEATH ANIMATION SYSTEM =====

	class DeathParticle {
		constructor(x, y, color, type = 'burst') {
			this.x = x;
			this.y = y;
			this.color = color;
			this.type = type;
			
			if (type === 'burst') {
				const angle = Math.random() * Math.PI * 2;
				const speed = 3 + Math.random() * 8;
				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
				this.size = 4 + Math.random() * 8;
				this.life = 1;
				this.decay = 0.015 + Math.random() * 0.02;
				this.rotation = Math.random() * Math.PI * 2;
				this.rotationSpeed = (Math.random() - 0.5) * 0.3;
				this.gravity = 0.15;
			} else if (type === 'spark') {
				const angle = Math.random() * Math.PI * 2;
				const speed = 8 + Math.random() * 12;
				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
				this.size = 2 + Math.random() * 3;
				this.life = 1;
				this.decay = 0.04 + Math.random() * 0.03;
				this.trail = [];
			} else if (type === 'ring') {
				this.radius = 5;
				this.maxRadius = 80 + Math.random() * 40;
				this.expandSpeed = 4 + Math.random() * 2;
				this.life = 1;
				this.decay = 0.025;
				this.lineWidth = 8;
			} else if (type === 'shard') {
				const angle = Math.random() * Math.PI * 2;
				const speed = 2 + Math.random() * 5;
				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
				this.points = this.generateShardShape();
				this.life = 1;
				this.decay = 0.012 + Math.random() * 0.01;
				this.rotation = Math.random() * Math.PI * 2;
				this.rotationSpeed = (Math.random() - 0.5) * 0.15;
				this.gravity = 0.08;
			}
		}
		
		generateShardShape() {
			const points = [];
			const numPoints = 3 + Math.floor(Math.random() * 3);
			const baseSize = 10 + Math.random() * 20;
			for (let i = 0; i < numPoints; i++) {
				const angle = (i / numPoints) * Math.PI * 2;
				const dist = baseSize * (0.5 + Math.random() * 0.5);
				points.push({
					x: Math.cos(angle) * dist,
					y: Math.sin(angle) * dist
				});
			}
			return points;
		}
		
		update() {
			if (this.type === 'burst') {
				this.x += this.vx;
				this.y += this.vy;
				this.vy += this.gravity;
				this.vx *= 0.98;
				this.rotation += this.rotationSpeed;
				this.life -= this.decay;
			} else if (this.type === 'spark') {
				this.trail.push({ x: this.x, y: this.y, life: this.life });
				if (this.trail.length > 8) this.trail.shift();
				this.x += this.vx;
				this.y += this.vy;
				this.vx *= 0.92;
				this.vy *= 0.92;
				this.life -= this.decay;
			} else if (this.type === 'ring') {
				this.radius += this.expandSpeed;
				this.lineWidth *= 0.96;
				this.life -= this.decay;
			} else if (this.type === 'shard') {
				this.x += this.vx;
				this.y += this.vy;
				this.vy += this.gravity;
				this.rotation += this.rotationSpeed;
				this.life -= this.decay;
			}
			return this.life > 0;
		}
		
		render(ctx) {
			const alpha = Math.max(0, this.life);
			
			if (this.type === 'burst') {
				ctx.save();
				ctx.translate(this.x, this.y);
				ctx.rotate(this.rotation);
				ctx.globalAlpha = alpha;
				ctx.fillStyle = this.color;
				ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
				ctx.shadowColor = this.color;
				ctx.shadowBlur = 10 * alpha;
				ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
				ctx.restore();
			} else if (this.type === 'spark') {
				ctx.beginPath();
				ctx.moveTo(this.x, this.y);
				for (let i = this.trail.length - 1; i >= 0; i--) {
					const t = this.trail[i];
					ctx.lineTo(t.x, t.y);
				}
				ctx.strokeStyle = this.color;
				ctx.lineWidth = this.size * alpha;
				ctx.globalAlpha = alpha * 0.6;
				ctx.stroke();
				ctx.globalAlpha = alpha;
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
				ctx.fill();
			} else if (this.type === 'ring') {
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
				ctx.strokeStyle = this.color;
				ctx.lineWidth = Math.max(1, this.lineWidth * alpha);
				ctx.globalAlpha = alpha * 0.7;
				ctx.stroke();
			} else if (this.type === 'shard') {
				ctx.save();
				ctx.translate(this.x, this.y);
				ctx.rotate(this.rotation);
				ctx.globalAlpha = alpha * 0.8;
				ctx.beginPath();
				ctx.moveTo(this.points[0].x, this.points[0].y);
				for (let i = 1; i < this.points.length; i++) {
					ctx.lineTo(this.points[i].x, this.points[i].y);
				}
				ctx.closePath();
				ctx.fillStyle = this.color;
				ctx.fill();
				ctx.restore();
			}
			ctx.globalAlpha = 1;
		}
	}

	// ===== LOOT COIN ANIMATION SYSTEM =====

	class LootCoin {
		constructor(originX, originY, targetX, targetY, value) {
			this.originX = originX;
			this.originY = originY;
			this.targetX = targetX;
			this.targetY = targetY;
			this.value = value;
			
			// Current position (starts at origin)
			this.x = originX;
			this.y = originY;
			
			// Animation timing
			this.spawnTime = Date.now();
			this.duration = 600 + Math.random() * 200; // 600-800ms flight time
			this.delay = Math.random() * 150; // Stagger the coins
			
			// Arc parameters for juicy trajectory
			this.arcHeight = 40 + Math.random() * 60; // How high the arc goes
			this.rotation = 0;
			this.rotationSpeed = (Math.random() - 0.5) * 0.4;
			
			// Visual effects
			this.scale = 0;
			this.targetScale = 0.8 + Math.random() * 0.4;
			this.glowIntensity = 1;
			this.sparkles = [];
			
			// Generate initial sparkles
			for (let i = 0; i < 3; i++) {
				this.sparkles.push({
					angle: Math.random() * Math.PI * 2,
					dist: 8 + Math.random() * 8,
					size: 2 + Math.random() * 2,
					speed: 0.05 + Math.random() * 0.05
				});
			}
			
			this.landed = false;
			this.landTime = 0;
			this.bouncePhase = 0;
		}
		
		update() {
			const now = Date.now();
			const elapsed = now - this.spawnTime - this.delay;
			
			if (elapsed < 0) {
				// Still in delay phase
				return true;
			}
			
			const progress = Math.min(1, elapsed / this.duration);
			
			if (!this.landed) {
				// Ease out cubic for smooth deceleration
				const easeProgress = 1 - Math.pow(1 - progress, 3);
				
				// Linear interpolation for x
				this.x = this.originX + (this.targetX - this.originX) * easeProgress;
				
				// Parabolic arc for y (goes up then down)
				const linearY = this.originY + (this.targetY - this.originY) * easeProgress;
				const arcOffset = Math.sin(easeProgress * Math.PI) * this.arcHeight;
				this.y = linearY - arcOffset;
				
				// Scale up as it flies
				this.scale = this.targetScale * Math.min(1, easeProgress * 2);
				
				// Rotation
				this.rotation += this.rotationSpeed;
				
				// Update sparkles
				for (const sparkle of this.sparkles) {
					sparkle.angle += sparkle.speed;
				}
				
				if (progress >= 1) {
					this.landed = true;
					this.landTime = now;
					this.x = this.targetX;
					this.y = this.targetY;
				}
			} else {
				// Bounce and settle animation
				const landElapsed = now - this.landTime;
				const bounceProgress = Math.min(1, landElapsed / 400);
				
				// Damped bounce
				this.bouncePhase = Math.sin(bounceProgress * Math.PI * 3) * (1 - bounceProgress) * 8;
				this.y = this.targetY - Math.abs(this.bouncePhase);
				
				// Settle rotation
				this.rotation *= 0.95;
				
				// Fade glow
				this.glowIntensity = Math.max(0.3, 1 - bounceProgress * 0.7);
				
				// Done after bounce settles
				if (bounceProgress >= 1) {
					return false; // Remove this loot coin animation
				}
			}
			
			return true;
		}
		
		render(ctx) {
			const now = Date.now();
			const elapsed = now - this.spawnTime - this.delay;
			
			if (elapsed < 0 || this.scale <= 0) return;
			
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rotation);
			ctx.scale(this.scale, this.scale);
			
			const coinRadius = consts.COIN_RADIUS * 1.2;
			
			// Outer glow
			const glowSize = coinRadius * (2 + this.glowIntensity);
			const gradient = ctx.createRadialGradient(0, 0, coinRadius * 0.5, 0, 0, glowSize);
			gradient.addColorStop(0, `rgba(255, 215, 0, ${0.6 * this.glowIntensity})`);
			gradient.addColorStop(0.5, `rgba(255, 180, 0, ${0.3 * this.glowIntensity})`);
			gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
			ctx.fill();
			
			// Main coin body with gradient
			const coinGradient = ctx.createRadialGradient(-coinRadius * 0.3, -coinRadius * 0.3, 0, 0, 0, coinRadius);
			coinGradient.addColorStop(0, '#FFF8DC'); // Light gold highlight
			coinGradient.addColorStop(0.3, '#FFD700'); // Gold
			coinGradient.addColorStop(0.7, '#DAA520'); // Goldenrod
			coinGradient.addColorStop(1, '#B8860B'); // Dark goldenrod edge
			ctx.fillStyle = coinGradient;
			ctx.beginPath();
			ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);
			ctx.fill();
			
			// Inner ring detail
			ctx.strokeStyle = 'rgba(139, 90, 43, 0.5)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(0, 0, coinRadius * 0.7, 0, Math.PI * 2);
			ctx.stroke();
			
			// Shine highlight
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.beginPath();
			ctx.ellipse(-coinRadius * 0.25, -coinRadius * 0.25, coinRadius * 0.35, coinRadius * 0.2, -Math.PI / 4, 0, Math.PI * 2);
			ctx.fill();
			
			ctx.restore();
			
			// Render sparkles (in world space)
			if (!this.landed) {
				for (const sparkle of this.sparkles) {
					const sx = this.x + Math.cos(sparkle.angle) * sparkle.dist * this.scale;
					const sy = this.y + Math.sin(sparkle.angle) * sparkle.dist * this.scale;
					
					ctx.fillStyle = `rgba(255, 255, 200, ${0.8 * this.glowIntensity})`;
					ctx.beginPath();
					ctx.arc(sx, sy, sparkle.size * this.scale, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}
	}

	function spawnLootCoins(originX, originY, coinDataArray) {
		for (const coinData of coinDataArray) {
			const lootCoin = new LootCoin(
				originX,
				originY,
				coinData.x,
				coinData.y,
				coinData.value
			);
			lootCoins.push(lootCoin);
		}
	}

	function updateLootCoins() {
		for (let i = lootCoins.length - 1; i >= 0; i--) {
			if (!lootCoins[i].update()) {
				lootCoins.splice(i, 1);
			}
		}
	}

	function renderLootCoins(ctx) {
		for (const coin of lootCoins) {
			coin.render(ctx);
		}
	}

	function renderPlayerHpBar(ctx, player, isLocalPlayer = false) {
		// Scale with player size
		const sizeScale = player.sizeScale || 1.0;
		const scaledRadius = PLAYER_RADIUS * sizeScale;
		
		// Local player has a slightly larger, more prominent HP bar
		const sizeMult = isLocalPlayer ? 1.2 : 1.0;
		const barWidth = scaledRadius * 2.5 * sizeMult;
		const barHeight = 6 * sizeScale * sizeMult;
		const barX = player.x - barWidth / 2;
		const barY = player.y + scaledRadius + 8; // Below player
		
		// Background (dark)
		ctx.fillStyle = isLocalPlayer ? "rgba(10, 10, 10, 0.9)" : "rgba(20, 20, 20, 0.8)";
		ctx.fillRect(barX, barY, barWidth, barHeight);
		
		// HP fill
		const hpRatio = Math.max(0, player.hp / player.maxHp);
		if (hpRatio > 0.5) {
			ctx.fillStyle = "#44ff44";
		} else if (hpRatio > 0.25) {
			ctx.fillStyle = "#ffcc00";
		} else {
			ctx.fillStyle = "#ff4444";
		}
		ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
		
		// Quarter divider lines (25hp chunks like OW2)
		ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
		ctx.lineWidth = Math.max(1, 1.5 * sizeScale);
		for (let i = 1; i <= 3; i++) {
			const divX = barX + (barWidth * i / 4);
			ctx.beginPath();
			ctx.moveTo(divX, barY);
			ctx.lineTo(divX, barY + barHeight);
			ctx.stroke();
		}
		
		// Black outline (slightly thicker for local player)
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = Math.max(1, (isLocalPlayer ? 2.5 : 2) * sizeScale);
		ctx.strokeRect(barX, barY, barWidth, barHeight);
	}

	// ===== HITSCAN LASER EFFECTS =====

	// Cap active laser effects so big drone fights don't tank FPS.
	const MAX_HITSCAN_EFFECTS = 120;

	class HitscanEffect {
		constructor(fromX, fromY, toX, toY, ownerId, damage, baseColor) {
			this.fromX = fromX;
			this.fromY = fromY;
			this.toX = toX;
			this.toY = toY;
			this.ownerId = ownerId;
			this.damage = damage;
			this.baseColor = baseColor || null;
			this.spawnTime = Date.now();
			this.duration = 300; // ms - visible laser effect
			this.life = 1;
		}
		
		update() {
			const elapsed = Date.now() - this.spawnTime;
			this.life = 1 - (elapsed / this.duration);
			return this.life > 0;
		}
		
		render(ctx) {
			if (this.life <= 0) return;

			const baseColor = this.baseColor;
			
			ctx.save();
			
			// Laser line with glow
			ctx.lineCap = 'round';
			
			// Outer glow (thicker, more transparent)
			ctx.lineWidth = 12 * this.life;
			if (baseColor) {
				ctx.strokeStyle = baseColor.deriveAlpha(0.5 * this.life).rgbString();
			} else {
				ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 * this.life})`;
			}
			ctx.beginPath();
			ctx.moveTo(this.fromX, this.fromY);
			ctx.lineTo(this.toX, this.toY);
			ctx.stroke();
			
			// Core laser line (thinner, brighter)
			ctx.lineWidth = 5 * this.life;
			if (baseColor) {
				ctx.strokeStyle = baseColor.deriveLumination(0.4).deriveAlpha(0.95 * this.life).rgbString();
			} else {
				ctx.strokeStyle = `rgba(255, 150, 150, ${0.95 * this.life})`;
			}
			ctx.beginPath();
			ctx.moveTo(this.fromX, this.fromY);
			ctx.lineTo(this.toX, this.toY);
			ctx.stroke();
			
			// Bright center
			ctx.lineWidth = 2 * this.life;
			ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
			ctx.beginPath();
			ctx.moveTo(this.fromX, this.fromY);
			ctx.lineTo(this.toX, this.toY);
			ctx.stroke();
			
			// Impact flash at target
			const flashSize = 20 * this.life;
			const gradient = ctx.createRadialGradient(this.toX, this.toY, 0, this.toX, this.toY, flashSize);
			if (baseColor) {
				gradient.addColorStop(0, baseColor.deriveLumination(0.6).deriveAlpha(this.life).rgbString());
				gradient.addColorStop(0.4, baseColor.deriveAlpha(0.6 * this.life).rgbString());
				gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
			} else {
				gradient.addColorStop(0, `rgba(255, 255, 200, ${this.life})`);
				gradient.addColorStop(0.4, `rgba(255, 100, 100, ${0.6 * this.life})`);
				gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
			}
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(this.toX, this.toY, flashSize, 0, Math.PI * 2);
			ctx.fill();
			
			ctx.restore();
		}
	}

	function spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage) {
		// Resolve owner color once (avoid O(players) search every render frame).
		let baseColor = null;
		const ownerPlayer = getPlayers().find(p => p.num === ownerId);
		if (ownerPlayer && ownerPlayer.baseColor) baseColor = ownerPlayer.baseColor;

		hitscanEffects.push(new HitscanEffect(fromX, fromY, toX, toY, ownerId, damage, baseColor));

		// Hard cap (drop oldest) to prevent unbounded growth during large fights.
		if (hitscanEffects.length > MAX_HITSCAN_EFFECTS) {
			hitscanEffects.splice(0, hitscanEffects.length - MAX_HITSCAN_EFFECTS);
		}
	}

	function updateHitscanEffects() {
		for (let i = hitscanEffects.length - 1; i >= 0; i--) {
			if (!hitscanEffects[i].update()) {
				hitscanEffects.splice(i, 1);
			}
		}
	}

	function renderHitscanEffects(ctx) {
		for (const effect of hitscanEffects) {
			effect.render(ctx);
		}
	}

	// ===== ENEMY RENDERING =====
	function renderEnemy(ctx, enemy) {
		ctx.save();
		
		const type = enemy.type || 'basic';
		const style = ENEMY_STYLES[type] || ENEMY_STYLES.basic;
		
		// Charging glow effect
		if (enemy.isCharging) {
			const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
			ctx.shadowBlur = 15 + pulse * 10;
			ctx.shadowColor = style.color;
		}
		
		// Shadow
		ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
		ctx.beginPath();
		ctx.arc(enemy.x + 2, enemy.y + 2, enemy.radius, 0, Math.PI * 2);
		ctx.fill();
		
		// Body
		ctx.fillStyle = style.color;
		ctx.beginPath();
		ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
		ctx.fill();
		
		// Outline
		ctx.strokeStyle = style.outline;
		ctx.lineWidth = 2;
		ctx.stroke();
		
		// Type-specific visuals
		if (type === 'charger') {
			// Arrow indicator showing charge direction
			if (enemy.isCharging && enemy.vx !== undefined && enemy.vy !== undefined) {
				const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
				if (speed > 0) {
					const angle = Math.atan2(enemy.vy, enemy.vx);
					ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.moveTo(enemy.x, enemy.y);
					ctx.lineTo(
						enemy.x + Math.cos(angle) * enemy.radius * 1.5,
						enemy.y + Math.sin(angle) * enemy.radius * 1.5
					);
					ctx.stroke();
				}
			}
		} else if (type === 'tank') {
			// Inner ring for tanks
			ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(enemy.x, enemy.y, enemy.radius * 0.6, 0, Math.PI * 2);
			ctx.stroke();
		} else if (type === 'swarm') {
			// Small dot in center for swarm
			ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
			ctx.beginPath();
			ctx.arc(enemy.x, enemy.y, enemy.radius * 0.3, 0, Math.PI * 2);
			ctx.fill();
		}
		
		ctx.restore();
	}

	function renderEnemies(ctx) {
		const enemyList = getEnemies();
		for (const enemy of enemyList) {
			renderEnemy(ctx, enemy);
		}
	}

	// ===== DRONE RENDERING =====

	function renderDrone(ctx, drone, ownerPlayer, isUserDrone) {
		const x = drone.x;
		const y = drone.y;
		const radius = DRONE_VISUAL_RADIUS;
		const baseColor = ownerPlayer ? ownerPlayer.baseColor : null;
		const isDisabled = ownerPlayer && ownerPlayer.isSnipped; // Drones disabled when snipped
		
		ctx.save();
		
		// Shadow
		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.beginPath();
		ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
		ctx.fill();
		
		// Outer glow when targeting (not when disabled)
		if (drone.targetId !== null && !isDisabled) {
			const time = Date.now() / 150;
			const pulse = 0.4 + 0.3 * Math.sin(time * 4);
			ctx.shadowBlur = 12 * pulse;
			ctx.shadowColor = isUserDrone ? '#FFD700' : (baseColor ? baseColor.rgbString() : '#FF6600');
		}
		
		// Main body - filled circle (grayed out when disabled/snipped)
		if (isDisabled) {
			// Grayed out appearance when snipped
			ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
		} else if (baseColor) {
			ctx.fillStyle = baseColor.deriveAlpha(isUserDrone ? 0.95 : 0.8).rgbString();
		} else {
			ctx.fillStyle = isUserDrone ? "rgba(100, 200, 100, 0.95)" : "rgba(200, 100, 100, 0.8)";
		}
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
		
		// Border (darker when disabled)
		if (isDisabled) {
			ctx.strokeStyle = "rgba(60, 60, 60, 0.6)";
		} else {
			ctx.strokeStyle = baseColor ? baseColor.deriveLumination(-0.2).rgbString() : "#444";
		}
		ctx.lineWidth = 2;
		ctx.stroke();
		
		ctx.shadowBlur = 0;
		
		// Inner core (highlight) - dimmed when disabled
		if (isDisabled) {
			ctx.fillStyle = "rgba(80, 80, 80, 0.4)";
		} else {
			ctx.fillStyle = baseColor ? baseColor.deriveLumination(0.3).deriveAlpha(0.7).rgbString() : "rgba(255, 255, 255, 0.5)";
		}
		ctx.beginPath();
		ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
		ctx.fill();
		
		// Targeting indicator (small dot when active) - not shown when disabled
		if (drone.targetId !== null && !isDisabled) {
			const time = Date.now() / 100;
			const pulse = 0.5 + 0.5 * Math.sin(time * 5);
			ctx.fillStyle = `rgba(255, 100, 100, ${0.6 + 0.4 * pulse})`;
			ctx.beginPath();
			ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
			ctx.fill();
		}
		
		// HP bar (only show if damaged and not disabled)
		if (drone.hp < drone.maxHp && !isDisabled) {
			const barWidth = radius * 2.2;
			const barHeight = 3;
			const barX = x - barWidth / 2;
			const barY = y - radius - 6;
			
			// Background
			ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
			ctx.fillRect(barX, barY, barWidth, barHeight);
			
			// HP fill
			const hpRatio = Math.max(0, drone.hp / drone.maxHp);
			if (hpRatio > 0.5) {
				ctx.fillStyle = "#44ff44";
			} else if (hpRatio > 0.25) {
				ctx.fillStyle = "#ffcc00";
			} else {
				ctx.fillStyle = "#ff4444";
			}
			ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
		}
		
		// Disabled indicator (X mark) when snipped
		if (isDisabled) {
			ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
			ctx.lineWidth = 2;
			ctx.lineCap = "round";
			const xSize = radius * 0.5;
			ctx.beginPath();
			ctx.moveTo(x - xSize, y - xSize);
			ctx.lineTo(x + xSize, y + xSize);
			ctx.moveTo(x + xSize, y - xSize);
			ctx.lineTo(x - xSize, y + xSize);
			ctx.stroke();
		}
		
		ctx.restore();
	}

	function renderAllDrones(ctx) {
		const allPlayers = getPlayers();
		
		for (const p of allPlayers) {
			if (!p.drones || p.drones.length === 0) continue;
			
			const isUserDrones = user && p.num === user.num;
			
			for (const drone of p.drones) {
				// Skip rendering drones with 0 HP
				if (drone.hp <= 0) continue;
				renderDrone(ctx, drone, p, isUserDrones);
			}
		}
	}

	function renderDroneRangeCircle(ctx, player) {
		const range = consts.DRONE_RANGE ;
		
		ctx.save();
		
		// Animated dash
		const time = Date.now() / 1000;
		
		// Draw shadow circle only (subtle indicator)
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 10]);
		ctx.lineDashOffset = -time * 30;
		ctx.beginPath();
		ctx.arc(player.x, player.y, range, 0, Math.PI * 2);
		ctx.stroke();
		
		ctx.restore();
	}

	// ===== CAPTURE FEEDBACK EFFECT SYSTEM =====

	class CaptureEffect {
		constructor(x, y, xpGained, player, isLocalPlayer) {
			this.x = x;
			this.y = y;
			this.xpGained = xpGained;
			this.player = player;
			this.isLocalPlayer = isLocalPlayer;
			this.spawnTime = Date.now();
			this.color = player ? player.baseColor : null;
			
			// Pulse ring
			this.pulseRadius = PULSE_RADIUS_START;
			this.pulseLife = 1;
			
			// Particles
			this.particles = [];
			const particleCount = isLocalPlayer ? PARTICLE_COUNT : Math.floor(PARTICLE_COUNT * 0.6);
			for (let i = 0; i < particleCount; i++) {
				const angle = Math.random() * Math.PI * 2;
				const speed = 2 + Math.random() * 6;
				this.particles.push({
					x: x,
					y: y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					size: 3 + Math.random() * 5,
					life: 1,
					decay: 0.015 + Math.random() * 0.02
				});
			}
			
			// Coins text
			this.textY = y - 20;
			this.textAlpha = 1;
			
			// Trigger outline thickening for local player
			if (isLocalPlayer) {
				localOutlineThicken.active = true;
				localOutlineThicken.startTime = Date.now();
			}
		}
		
		update() {
			const elapsed = (Date.now() - this.spawnTime) / 1000;
			const flashProgress = Math.min(1, elapsed / CAPTURE_FLASH_TIME_SEC);
			const pulseProgress = Math.min(1, elapsed / PULSE_TIME);
			
			// Update pulse ring
			this.pulseRadius = PULSE_RADIUS_START + (PULSE_RADIUS_END - PULSE_RADIUS_START) * this.easeOutQuad(pulseProgress);
			this.pulseLife = 1 - pulseProgress;
			
			// Update particles
			for (const p of this.particles) {
				p.x += p.vx;
				p.y += p.vy;
				p.vx *= 0.96;
				p.vy *= 0.96;
				p.vy += 0.1; // gravity
				p.life -= p.decay;
			}
			
			// Update text (float up and fade)
			this.textY -= 0.8;
			this.textAlpha = Math.max(0, 1 - flashProgress);
			
			// Effect is done when flash time expires
			return flashProgress < 1;
		}
		
		easeOutQuad(t) {
			return t * (2 - t);
		}
		
		render(ctx) {
			const colorStr = this.color ? this.color.rgbString() : '#FFD700';
			const lightColorStr = this.color ? this.color.deriveLumination(0.3).rgbString() : '#FFEC8B';
			
			// Render pulse ring
			if (this.pulseLife > 0) {
				ctx.save();
				ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.8).rgbString() : `rgba(255, 215, 0, ${this.pulseLife * 0.8})`;
				ctx.lineWidth = 4 * this.pulseLife;
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.pulseRadius, 0, Math.PI * 2);
				ctx.stroke();
				
				// Inner glow
				ctx.strokeStyle = this.color ? this.color.deriveAlpha(this.pulseLife * 0.4).rgbString() : `rgba(255, 255, 200, ${this.pulseLife * 0.4})`;
				ctx.lineWidth = 8 * this.pulseLife;
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.pulseRadius * 0.8, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			}
			
			// Render particles
			for (const p of this.particles) {
				if (p.life <= 0) continue;
				ctx.save();
				ctx.globalAlpha = Math.max(0, p.life);
				ctx.fillStyle = lightColorStr;
				ctx.shadowColor = colorStr;
				ctx.shadowBlur = 8 * p.life;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			
			// Render XP earned text
			if (this.textAlpha > 0 && this.xpGained > 0) {
				ctx.save();
				ctx.globalAlpha = this.textAlpha;
				ctx.fillStyle = '#9370DB';  // Purple for XP
				ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
				ctx.lineWidth = 3;
				ctx.font = 'bold 18px Changa';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				
				const text = `+${this.xpGained} XP`;
				ctx.strokeText(text, this.x, this.textY);
				ctx.fillText(text, this.x, this.textY);
				ctx.restore();
			}
			
			ctx.globalAlpha = 1;
		}
	}

	function spawnCaptureEffect(x, y, xpGained, player, isLocalPlayer) {
		captureEffects.push(new CaptureEffect(x, y, xpGained, player, isLocalPlayer));
	}

	function updateCaptureEffects() {
		for (let i = captureEffects.length - 1; i >= 0; i--) {
			if (!captureEffects[i].update()) {
				captureEffects.splice(i, 1);
			}
		}
		
		// Update local outline thickening
		if (localOutlineThicken.active) {
			const elapsed = Date.now() - localOutlineThicken.startTime;
			if (elapsed >= localOutlineThicken.duration) {
				localOutlineThicken.active = false;
			}
		}
	}

	function renderCaptureEffects(ctx) {
		for (const effect of captureEffects) {
			effect.render(ctx);
		}
	}

	// Get outline thickness multiplier for a player
	function getOutlineThickness(player) {
		if (user && player.num === user.num && localOutlineThicken.active) {
			const elapsed = Date.now() - localOutlineThicken.startTime;
			const progress = Math.min(1, elapsed / localOutlineThicken.duration);
			// Ease out: starts thick, returns to normal
			const thickenFactor = 1 + 2 * (1 - progress);
			return thickenFactor;
		}
		return 1;
	}

	// Update XP meter tween
	function updateXpMeterTween(currentXp) {
		if (xpMeterTween.targetValue !== currentXp) {
			// New target value - start a new tween
			xpMeterTween.startValue = xpMeterTween.currentValue;
			xpMeterTween.targetValue = currentXp;
			xpMeterTween.startTime = Date.now();
		}
		
		const elapsed = Date.now() - xpMeterTween.startTime;
		const progress = Math.min(1, elapsed / xpMeterTween.duration);
		
		// Ease out quad
		const eased = progress * (2 - progress);
		xpMeterTween.currentValue = xpMeterTween.startValue + (xpMeterTween.targetValue - xpMeterTween.startValue) * eased;
		
		return xpMeterTween.currentValue;
	}

	function spawnDeathEffect(player, isUser = false) {
		const x = player.x;
		const y = player.y;
		const color = player.baseColor.rgbString();
		const lightColor = player.lightBaseColor.rgbString();
		
		const burstCount = isUser ? 40 : 25;
		for (let i = 0; i < burstCount; i++) {
			deathParticles.push(new DeathParticle(x, y, color, 'burst'));
		}
		
		const sparkCount = isUser ? 20 : 12;
		for (let i = 0; i < sparkCount; i++) {
			deathParticles.push(new DeathParticle(x, y, lightColor, 'spark'));
		}
		
		deathParticles.push(new DeathParticle(x, y, color, 'ring'));
		if (isUser) {
			setTimeout(() => {
				deathParticles.push(new DeathParticle(x, y, lightColor, 'ring'));
			}, 100);
		}
		
		if (player.territory && player.territory.length > 3) {
			const shardCount = isUser ? 15 : 8;
			for (let i = 0; i < shardCount; i++) {
				const idx = Math.floor(Math.random() * player.territory.length);
				const pt = player.territory[idx];
				deathParticles.push(new DeathParticle(pt.x, pt.y, color, 'shard'));
			}
		}
		
		if (isUser) {
			screenShake.intensity = 25;
		}
		
		dyingPlayers.push({
			player: player,
			deathTime: Date.now(),
			dissolveProgress: 0
		});
	}

	function updateDeathEffects() {
		for (let i = deathParticles.length - 1; i >= 0; i--) {
			if (!deathParticles[i].update()) {
				deathParticles.splice(i, 1);
			}
		}
		
		// Update loot coin animations
		updateLootCoins();
		
		// Update hitscan effects
		updateHitscanEffects();
		
		// Update capture effects
		updateCaptureEffects();
		
		if (screenShake.intensity > 0.5) {
			screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
			screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
			screenShake.intensity *= screenShake.decay;
		} else {
			screenShake.x = 0;
			screenShake.y = 0;
			screenShake.intensity = 0;
		}
		
		for (let i = dyingPlayers.length - 1; i >= 0; i--) {
			const dp = dyingPlayers[i];
			dp.dissolveProgress = Math.min(1, (Date.now() - dp.deathTime) / 1500);
			if (dp.dissolveProgress >= 1) {
				dyingPlayers.splice(i, 1);
			}
		}
	}

	function renderDeathParticles(ctx) {
		for (const particle of deathParticles) {
			particle.render(ctx);
		}
	}

	function getDyingPlayerEffect(player) {
		const dp = dyingPlayers.find(d => d.player === player);
		return dp ? dp.dissolveProgress : 0;
	}

	function addPlayer(player) {
		playerPortion[player.num] = 0;
		portionsRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
		barProportionRolling[player.num] = new Rolling(0, ANIMATE_FRAMES);
	}
	function disconnect() {
		$$1("#wasted").fadeIn(1000);
	}
	function removePlayer(player) {
		const isUser = user && player.num === user.num;
		spawnDeathEffect(player, isUser);
		
		// Play death sound
		if (soundInitialized && user) {
			if (isUser) {
				// Local player died
				playDeathSound(true);
			} else {
				// Other player died - calculate distance
				const dx = player.x - user.x;
				const dy = player.y - user.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				playDeathSound(false, distance);
			}
		}
		
		delete playerPortion[player.num];
		delete portionsRolling[player.num];
		delete barProportionRolling[player.num];
	}
	// Silent removal for players leaving AOI (not dead, just out of view)
	function removePlayerSilent(player) {
		delete playerPortion[player.num];
		delete portionsRolling[player.num];
		delete barProportionRolling[player.num];
	}
	function setUser(player) {
		user = player;
		centerOnPlayer(user, offset);
	}
	// Coin pickup handler (called from game-client)
	function coinPickup(coin) {
		// Play coin pickup sound
		if (soundInitialized) {
			playCoinPickup();
		}
	}

	// Player kill handler (called from game-client when local player gets a kill)
	function playerKill(killerNum, victimNum, victimName, killType) {
		// Play kill sound
		if (soundInitialized) {
			playKillSound();
		}
	}

	// Player was killed handler (called from game-client when local player is killed)
	function playerWasKilled(killerName, killType) {
		lastKillerName = killerName;
	}

	// Hitscan visual effect handler (called from game-client)
	function hitscan(fromX, fromY, toX, toY, ownerId, damage) {
		spawnHitscanEffect(fromX, fromY, toX, toY, ownerId, damage);
		
		// Play laser sound
		if (soundInitialized && user) {
			const isOwnShot = ownerId === user.num;
			if (isOwnShot) {
				playPlayerLaser();
			} else {
				// Calculate distance from local player to shot
				const dx = fromX - user.x;
				const dy = fromY - user.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				playEnemyLaser(distance);
			}
		}
	}

	// Capture success visual effect handler (called from game-client)
	function captureSuccess(x, y, xpGained, player, isLocalPlayer) {
		spawnCaptureEffect(x, y, xpGained, player, isLocalPlayer);
		
		// Play capture sound
		if (soundInitialized && isLocalPlayer) {
			playCaptureSound(true);
		}
	}


	// Level up visual effect handler (called from game-client)
	function levelUp(x, y, newLevel, player) {
		// Create a special level-up effect at the player's position
		const isLocalPlayer = user && player && player.num === user.num;
		
		// Create a burst effect with golden particles
		player && player.baseColor ? player.baseColor.rgbString() : '#FFD700';
		
		// Add burst particles (keep it lighter for non-local players to avoid periodic stutter)
		const burstCount = isLocalPlayer ? 30 : 8;
		for (let i = 0; i < burstCount; i++) {
			deathParticles.push(new DeathParticle(x, y, '#FFD700', 'burst'));
		}
		
		// Add a ring effect (always)
		deathParticles.push(new DeathParticle(x, y, '#FFD700', 'ring'));
		
		// Screen shake for local player
		if (isLocalPlayer) {
			screenShake.intensity = 10;
		}
		
		// Add the "LEVEL UP!" text only for the local player (bots leveling can be frequent)
		if (isLocalPlayer) {
			captureEffects.push(new LevelUpTextEffect(x, y, newLevel, player, isLocalPlayer));
		}
		
		// Play level up sound
		if (soundInitialized && isLocalPlayer) {
			playLevelUpSound();
		}
	}

	// Special level-up text effect
	class LevelUpTextEffect {
		constructor(x, y, newLevel, player, isLocalPlayer) {
			this.x = x;
			this.y = y;
			this.newLevel = newLevel;
			this.player = player;
			this.isLocalPlayer = isLocalPlayer;
			this.spawnTime = Date.now();
			this.color = player && player.baseColor ? player.baseColor : null;
			
			// Text animation
			this.textY = y - 40;
			this.textAlpha = 1;
			this.scale = 0.5;
		}
		
		update() {
			const elapsed = (Date.now() - this.spawnTime) / 1000;
			const duration = 1.5;
			const progress = Math.min(1, elapsed / duration);
			
			// Float up and fade
			this.textY = this.y - 40 - progress * 60;
			this.textAlpha = Math.max(0, 1 - progress);
			
			// Scale up then back down
			if (progress < 0.3) {
				this.scale = 0.5 + (progress / 0.3) * 1.0;
			} else {
				this.scale = 1.5 - (progress - 0.3) * 0.5;
			}
			
			return progress < 1;
		}
		
		render(ctx) {
			if (this.textAlpha <= 0) return;
			
			ctx.save();
			ctx.globalAlpha = this.textAlpha;
			ctx.translate(this.x, this.textY);
			ctx.scale(this.scale, this.scale);
			
			// Glow effect
			ctx.shadowColor = '#FFD700';
			ctx.shadowBlur = 20 * this.textAlpha;
			
			// Text
			ctx.fillStyle = '#FFD700';
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
			ctx.lineWidth = 4;
			ctx.font = 'bold 24px Changa';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			
			const text = `⬆️ LEVEL ${this.newLevel}! ⬆️`;
			ctx.strokeText(text, 0, 0);
			ctx.fillText(text, 0, 0);
			
			// Bonus info text below
			ctx.font = 'bold 14px Changa';
			ctx.fillStyle = '#88CCFF';
			ctx.strokeText('+1 Drone, +5% Size', 0, 28);
			ctx.fillText('+1 Drone, +5% Size', 0, 28);
			
			ctx.restore();
		}
	}

	// ===== UPGRADE UI EXPORTS =====

	function showUpgradeUI(choices, newLevel) {
		upgradeChoices = choices || [];
		upgradeNewLevel = newLevel || 1;
		upgradeUIVisible = true;
		hoveredUpgrade = -1;
	}

	function hideUpgradeUI() {
		upgradeUIVisible = false;
		upgradeChoices = [];
		hoveredUpgrade = -1;
	}

	var playerRenderer = /*#__PURE__*/Object.freeze({
		__proto__: null,
		addPlayer: addPlayer,
		captureSuccess: captureSuccess,
		coinPickup: coinPickup,
		disconnect: disconnect,
		hideUpgradeUI: hideUpgradeUI,
		hitscan: hitscan,
		levelUp: levelUp,
		paint: paintDoubleBuff,
		playerKill: playerKill,
		playerWasKilled: playerWasKilled,
		removePlayer: removePlayer,
		removePlayerSilent: removePlayerSilent,
		reset: reset,
		setUser: setUser,
		showUpgradeUI: showUpgradeUI,
		spawnLootCoins: spawnLootCoins,
		update: update
	});

	const $ = jquery;

	// Track if sound has been initialized (requires user interaction)
	let menuSoundInitialized = false;

	function initMenuSound() {
		if (!menuSoundInitialized) {
			init();
			resume();
			menuSoundInitialized = true;
			// Start menu music after initialization
			startMenuMusic();
		}
	}

	function run(flag) {
		// Stop menu music when starting the game
		stopMenuMusic();
		
		setRenderer(flag ? godRenderer : playerRenderer);
		const wsUrl = getWsUrl();
		connectGame(wsUrl, $("#name").val(), (success, msg) => {
			if (success) {
				$("#main-ui").fadeIn(1000);
				$("#begin, #wasted").fadeOut(1000);
			}
			else {
				$("#error").text(msg);
				// Restart menu music if game failed to start
				if (menuSoundInitialized) {
					startMenuMusic();
				}
			}
		}, flag);
	}

	function getWsUrl() {
		const protocol = location.protocol === "https:" ? "wss" : "ws";
		return `${protocol}://${location.host}/ws`;
	}

	$(() => {
		const err = $("#error");
		if (!window.WebSocket) {
			err.text("Your browser does not support WebSockets!");
			return;
		}
		err.text("Loading... Please wait");
		
		// Initialize menu sound on first user interaction
		const initOnInteraction = () => {
			initMenuSound();
			// Remove listeners after first interaction
			document.removeEventListener("click", initOnInteraction);
			document.removeEventListener("keydown", initOnInteraction);
		};
		document.addEventListener("click", initOnInteraction);
		document.addEventListener("keydown", initOnInteraction);
		
		(() => {
			const wsUrl = getWsUrl();
			const socket = new WebSocket(wsUrl);
			socket.binaryType = "arraybuffer";
			
			socket.addEventListener("open", () => {
				socket.send(encodePacket(MSG.PING));
			});
			
			socket.addEventListener("message", (event) => {
				const [type] = decodePacket(event.data);
				if (type === MSG.PONG) {
					socket.close();
					err.text("All done, have fun!");
					$("#name").on("keypress", evt => {
						if (evt.key === "Enter") run();
					});
					$(".start").removeAttr("disabled").on("click", evt => {
						run();
					});
					$(".spectate").removeAttr("disabled").click(evt => {
						run(true);
					});
				}
			});
			
			socket.addEventListener("error", () => {
				err.text("Cannot connect with server. This probably is due to misconfigured proxy server. (Try using a different browser)");
			});
		})();
	});

	// Mouse-based controls are now handled in src/mode/player.js
	// No keyboard controls needed for free movement

	$(".menu").on("click", () => {
		disconnect$1();
		$("#main-ui, #wasted").fadeOut(1000);
		$("#begin").fadeIn(1000);
		// Restart menu music when returning to main menu
		if (menuSoundInitialized) {
			startMenuMusic();
		}
	});

	$(".toggle").on("click", () => {
		$("#settings").slideToggle();
	});

})();
