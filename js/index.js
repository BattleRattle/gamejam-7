(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/eventemitter2/lib/eventemitter2.js","/../../node_modules/eventemitter2/lib")
},{"buffer":2,"oMfpAn":5}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer")
},{"base64-js":3,"buffer":2,"ieee754":4,"oMfpAn":5}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")
},{"buffer":2,"oMfpAn":5}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754")
},{"buffer":2,"oMfpAn":5}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process/browser.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process")
},{"buffer":2,"oMfpAn":5}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var GameConsts = {};

// window size in px
GameConsts.GAME_WIDTH 	= 1024;
GameConsts.GAME_HEIGHT 	= 768;

// total field size
GameConsts.SIZE = 3000;

GameConsts.NIGHT_MODE = true;
GameConsts.DRAW_FLOWERS = false;

GameConsts.MONSTER_SPEED = 0.025;

module.exports = GameConsts;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/GameConsts.js","/")
},{"buffer":2,"oMfpAn":5}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var growlSounds = 3; // in seconds

var Vec2d = require('./util/Vector2d'),
	GameConsts = require('./GameConsts');

var Monster = function(x, y, target) {
	var self = this;
	this.target = target;

	this.radius = 90;
	this.maxHealth = this.health = 300;
	this.id = 'monster';
	this.lastGrowlAt = 0;
	this.growlSoundIndex = 0;
	this.bounceVelocity = new Vec2d(0, 0);
	this.speed = 1;
	this.element = new createjs.Container();
	this.velocity = new Vec2d(0, 0);
	this.growlCooldown = 0;

	var image = new createjs.Bitmap('./img/monster.png');
	this.element.scaleX = this.element.scaleY = 0.3;

	image.image.onload = function() {
		self.element.regX = self.element.getBounds().width / 2;
		self.element.regY = self.element.getBounds().height / 2;
	};

	this.element.x = x;
	this.element.y = y;

	this.element.addChild(image);
};

Monster.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
	emitter.on('hit', this.onHit.bind(this));
	this.emitter = emitter;
};

Monster.prototype.onHit = function(event) {
	if (event.hitTarget !== this.id) {
		if (event.damageDealer == this.id) {
			var position = new Vec2d(this.element.x, this.element.y);
			var target_position = new Vec2d(this.target.element.x, this.target.element.y);
			this.target.bounceVelocity =  Vec2d.subtract(target_position, position).norm().times(180);
		}

		return;
	}

	this.bounceVelocity = this.velocity.clone().norm().times(-180);

	this.health -= event.damage;
	this.health = Math.max(0, this.health);

	if (this.health == 0) {
		this.emitter.emit('monster-dead');
	}
};

/**
 * @param event
 */
Monster.prototype.tick = function(event) {
	var current = new Vec2d(this.target.element.x, this.target.element.y);
	var target = new Vec2d(this.element.x, this.element.y);

	var vector_to_destination = Vec2d.subtract(current, target);
	var distance = vector_to_destination.length();

	// calculate new velocity according to current velocity and position of target
	vector_to_destination.norm().times(0.5);
	this.velocity.norm().times(20);
	this.velocity = this.velocity.plus(vector_to_destination);

	// set speed of monster according to distance to target
	this.velocity.times(distance);

	var delta = Vec2d.multiply(this.velocity, event.delta / 1000 * GameConsts.MONSTER_SPEED * this.speed);
	var angle = Vec2d.getAngle(delta);

	if (this.bounceVelocity.length() != 0) {
		var push_delta = Vec2d.multiply(this.bounceVelocity.clone(), event.delta / 80);
		this.bounceVelocity = this.bounceVelocity.minus(push_delta);

		delta.plus(push_delta);

		if (push_delta.length() < 1) {
			this.bounceVelocity = new Vec2d(0, 0);
		}
	}

	this.element.x += delta.x;
	this.element.y += delta.y;

	this.element.x = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.x));
	this.element.y = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.y));

	this.element.rotation = angle;

	if (this.growlCooldown && event.timeStamp - this.lastGrowlAt > this.growlCooldown * 1000) {
		this.growl();
	}
};

Monster.prototype.growl = function() {
	this.lastGrowlAt = new Date().getTime();
	createjs.Sound.play('growl' + this.growlSoundIndex, {volume: 0.8});
	this.growlSoundIndex = (this.growlSoundIndex + 1) % growlSounds;

	this.emitter.emit('growl', {
		x: this.element.x,
		y: this.element.y,
		target: this.target
	});
};

Monster.prototype.getRadius = function() {
	return this.radius;
};

Monster.prototype.isShortAttacking = function() {
	return false;
};

Monster.prototype.onChangeLevel = function(level) {
	this.maxHealth = level.monsterHealth;
	this.health = level.monsterHealth;
	this.speed = level.monsterSpeed;
	this.growlCooldown = level.growlCooldown;
};

module.exports = Monster;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Monster.js","/")
},{"./GameConsts":6,"./util/Vector2d":42,"buffer":2,"oMfpAn":5}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Vec2d = require('./util/Vector2d'),
    GameConsts = require('./GameConsts');

var funFactor = 3;

/**
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Player = function (x, y) {
    var self = this;

    this.radius = 30;
    this.maxHealth = this.health = 100;
    this.id = 'player';
    this.angle = 0;
	this.footstepsPlayed = 0;
	this.footstepNumber = 1;

	this.attackStarted = 0;
    this.velocity = new Vec2d(0, 0);
    this.bounceVelocity = new Vec2d(0, 0);

    this.element = new createjs.Container();

	var ss = new createjs.SpriteSheet({
		"animations":
		{
			"walk": {
				frames: [1, 2],
				next:"walk",
				speed: 0.2
			},
			"wait": {
				frames: [0],
				next:"wait",
				speed: 0.2
			}
		},
		"images": ["./img/player_sprite.png"],
		"frames":
		{
			"height": 1024,
			"width":1024,
			"regX": 0,
			"regY": 0,
			"count": 3
		}
	});

	this.sprite = new createjs.Sprite(ss, "wait");

    this.element.scaleX = this.element.scaleY = 0.1;
	self.element.regX = self.element.regY = 512;

	this.element.x = x;
	this.element.y = y;

    this.hasFun = false;

    this.element.addChild(this.sprite);
};

Player.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('attack', this.onAttack.bind(this));
    emitter.on('stagemousemove', this.onMouseMove.bind(this));
    emitter.on('fun', this.onFun.bind(this));
    emitter.on('change-level', this.onChangeLevel.bind(this));
    emitter.on('heal-me', this.onHealMe.bind(this));
    emitter.on('player-weapon-lifetime', this.onPlayerWeaponLifetime.bind(this));

	this.emitter = emitter;
};

Player.prototype.onHit = function(event) {
    if (event.hitTarget !== this.id) {
        return;
    }

    if (this.hasFun) {
        return;
    }

    this.health -= event.damage;
    this.health = Math.max(0, this.health);

	if (this.health == 0) {
		this.emitter.emit('player-dead');
	}
};

Player.prototype.onAttack = function(event) {
	this.attackStarted = new Date().getTime();
};


Player.prototype.onMouseMove = function(event) {
    var current_speed = this.velocity.length();

    var mouse_delta = new Vec2d(
        event.stageX - GameConsts.GAME_WIDTH / 2,
        event.stageY - GameConsts.GAME_HEIGHT / 2
    );

    this.angle = Vec2d.getAngle(mouse_delta);

    if (this.hasFun) {
        mouse_delta.times(funFactor);
        this.emitter.emit('has-fun', {x: this.element.x, y: this.element.y});
    }

    if (mouse_delta.length() < 60) {
        this.velocity.x = 0;
        this.velocity.y = 0;

        if (current_speed) {
            this.sprite.gotoAndPlay('wait');
        }

        return;
    } else if(current_speed == 0) {
        this.sprite.gotoAndPlay('walk');
    }

    this.velocity = mouse_delta;
};

Player.prototype.onFun = function(event) {
    this.hasFun = event.status;
};

Player.prototype.onHealMe = function(event) {
    this.health = this.maxHealth;
};

Player.prototype.onPlayerWeaponLifetime = function(event) {
    if (!this.weapon) {
        return;
    }

    this.weapon.lifetime = 1000000;
    this.weapon.triggerUpdate();
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
    var delta = Vec2d.multiply(this.velocity, event.delta / 1000);

    if (this.bounceVelocity.length() != 0) {
        var push_delta = Vec2d.multiply(this.bounceVelocity.clone(), event.delta / 80);
        this.bounceVelocity = this.bounceVelocity.minus(push_delta);

        delta.plus(push_delta);

        if (push_delta.length() < 1) {
            this.bounceVelocity = new Vec2d(0, 0);
        }
    }

    this.element.x += delta.x;
    this.element.y += delta.y;

    this.element.x = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.x));
    this.element.y = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.y));

    this.element.rotation = this.angle;

	// change speed of animation
    this.sprite.framerate = delta.length() * 6;

    if (this.weapon) {
        if (!this.weapon.equipped) {
            this.element.removeChild(this.weapon.element);
            this.weapon = null;
            this.emitter.emit('unequip');
        } else {
            var attackStartedDiff = event.timeStamp - this.attackStarted;
            if (attackStartedDiff < 500) {
                this.element.rotation = Math.round(this.element.rotation + 1080 / 500 * attackStartedDiff);
            }

            this.weapon.tick(event);
        }
    }

	if (this.velocity.length() > 0 && (event.timeStamp - this.footstepsPlayed) > 45000 / this.velocity.length()) {
		createjs.Sound.play('footstep' + this.footstepNumber, {volume: 0.6});
		this.footstepsPlayed = event.timeStamp;
		this.footstepNumber = (this.footstepNumber + 1) % 2;
	}
};

Player.prototype.equip = function(weapon) {
    weapon.equip();
    this.weapon = weapon;
    this.weapon.registerEvents(this.emitter);
    this.element.addChild(weapon.element);
    this.emitter.emit('equip', {
        id: this.weapon.id,
        lifetime: this.weapon.lifetime
    })
};

Player.prototype.getRadius = function () {
    if (this.isShortAttacking()) {
        if (this.weapon) {
            return this.weapon.radius;
        }

        return this.radius;
    }

    return this.radius;
};

Player.prototype.isShortAttacking = function() {
    if (this.hasFun) {
        return true;
    }

    if (this.weapon && this.weapon.id == 'short-weapon' && this.weapon.isActive) {
        return true;
    }

    return false;
};

Player.prototype.onChangeLevel = function(level) {
    this.maxHealth = level.playerHealth;
    this.health = level.playerHealth;
};

module.exports = Player;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Player.js","/")
},{"./GameConsts":6,"./util/Vector2d":42,"buffer":2,"oMfpAn":5}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var EventEmitter = require('eventemitter2').EventEmitter2;

function Preloader() {
	this.queue = new createjs.LoadQueue();
	this.queue.installPlugin(createjs.Sound);
}

Preloader.prototype.load = function(files) {
	this.queue.loadManifest(files);
};

Preloader.prototype.onComplete = function(callback) {
	this.queue.on('complete', callback);
};

module.exports = Preloader;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Preloader.js","/")
},{"buffer":2,"eventemitter2":1,"oMfpAn":5}],10:[function(require,module,exports){
module.exports=[
    {
        "id": "fireball",
        "src": "./img/fireball.png"
    },
    {
        "id": "gameover",
        "src": "./img/gameover.png"
    },
    {
        "id": "grass",
        "src": "./img/grass.png"
    },
    {
        "id": "monster",
        "src": "./img/monster.png"
    },
    {
        "id": "nightmode",
        "src": "./img/nightmode.png"
    },
    {
        "id": "player",
        "src": "./img/player.png"
    },
    {
        "id": "player_sprite",
        "src": "./img/player_sprite.png"
    },
    {
        "id": "poof",
        "src": "./img/poof.png"
    },
    {
        "id": "schwert",
        "src": "./img/schwert.png"
    },
    {
        "id": "tree",
        "src": "./img/tree.png"
    },
    {
        "id": "background",
        "src": "./sounds/background.mp3"
    },
    {
        "id": "defeat",
        "src": "./sounds/defeat.mp3"
    },
    {
        "id": "footstep0",
        "src": "./sounds/footstep0.mp3"
    },
    {
        "id": "footstep1",
        "src": "./sounds/footstep1.mp3"
    },
    {
        "id": "fun",
        "src": "./sounds/fun.mp3"
    },
    {
        "id": "girl-hurt",
        "src": "./sounds/girl-hurt.mp3"
    },
    {
        "id": "growl0",
        "src": "./sounds/growl0.mp3"
    },
    {
        "id": "growl1",
        "src": "./sounds/growl1.mp3"
    },
    {
        "id": "growl2",
        "src": "./sounds/growl2.mp3"
    },
    {
        "id": "launch-fireball",
        "src": "./sounds/launch-fireball.mp3"
    },
    {
        "id": "magic0",
        "src": "./sounds/magic0.mp3"
    },
    {
        "id": "magic1",
        "src": "./sounds/magic1.mp3"
    },
    {
        "id": "magic2",
        "src": "./sounds/magic2.mp3"
    },
    {
        "id": "magic3",
        "src": "./sounds/magic3.mp3"
    },
    {
        "id": "magic4",
        "src": "./sounds/magic4.mp3"
    },
    {
        "id": "magic5",
        "src": "./sounds/magic5.mp3"
    },
    {
        "id": "monster-hurt",
        "src": "./sounds/monster-hurt.mp3"
    },
    {
        "id": "swing1",
        "src": "./sounds/swing1.mp3"
    },
    {
        "id": "victory",
        "src": "./sounds/victory.mp3"
    }
]
},{}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Game = require('./game'),
	Preloader = require('./Preloader'),
	assets = require('./assets');

var preloader = new Preloader();
var game = new Game('game_canvas');
game.init();

preloader.onComplete(function() {
	game.assetsReady();
});

preloader.load(assets);

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_42441c1.js","/")
},{"./Preloader":9,"./assets":10,"./game":12,"buffer":2,"oMfpAn":5}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var EventEmitter = require('eventemitter2').EventEmitter2,
    GameScreen = require('./screens/GameScreen'),
    MarioIsInAnotherCastleScreen = require('./screens/MarioIsInAnotherCastleScreen'),
    HomeScreen = require('./screens/HomeScreen'),
    StoryScreen = require('./screens/StoryScreen'),
    GameOverScreen = require('./screens/GameOverScreen');

'use strict';

var Game = function(gameCanvasId) {
    var self = this;

    this.emitter = new EventEmitter();
    this.stage = new createjs.Stage(gameCanvasId);

    this.stage.mouseChildren = false;
    this.stage.mouseEnabled = false;

    this.gameScreen = new GameScreen(this.stage);
    this.gameOverScreen = new GameOverScreen();
    this.marioIsInAnotherCastleScreen = new MarioIsInAnotherCastleScreen();
    this.homeScreen = new HomeScreen();
    this.storyScreen = new StoryScreen();
    this.stage.addChild(this.gameScreen.element);
    this.stage.addChild(this.gameOverScreen.element);
    this.stage.addChild(this.marioIsInAnotherCastleScreen.element);
    this.stage.addChild(this.homeScreen.element);
    this.stage.addChild(this.storyScreen.element);

    this.gameScreen.registerEvent(this.emitter);
    this.registerEvents(this.emitter);

    createjs.Ticker.setFPS(60);
    createjs.Ticker.setPaused(true);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });
};

Game.prototype.registerEvents = function(emitter) {
    emitter.on('player-dead', this.onGameOver.bind(this));
    emitter.on('monster-dead', this.onNextCastleScreen.bind(this));

    this.stage.on('stagemousemove', function(event) {
        emitter.emit('stagemousemove', event);
    });
};

Game.prototype.init = function() {
    this.homeScreen.start();
};

Game.prototype.assetsReady = function() {
    this.homeScreen.isReady();
    this.stage.on('stagemouseup', function() {
        this.homeScreen.reset();
        this.startNewgame();
    }.bind(this));
};

Game.prototype.startNewgame = function() {
    this.doStart(true);
};

Game.prototype.doStart = function(newGame) {
    this.storyScreen.start('test', 'me');
    this.stage.on('stagemouseup', function() {
        this.storyScreen.reset();
        this.start(newGame);

        this.emitter.emit('start-level', true);
    }.bind(this));
};

Game.prototype.start = function() {
    this.changeScreen();

    this.gameScreen.start();

    createjs.Ticker.setPaused(false);
};

Game.prototype.onNextCastleScreen = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.marioIsInAnotherCastleScreen.start();
    this.stage.on('stagemouseup', function() {
        this.marioIsInAnotherCastleScreen.reset();
        this.doStart(false);
    }.bind(this));
};

Game.prototype.onGameOver = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.gameOverScreen.start();
    this.stage.on('stagemouseup', function() {
        this.gameOverScreen.reset();
        this.start();
        this.emitter.emit('game-over');

    }.bind(this));
};

Game.prototype.changeScreen = function() {
    this.emitter.removeAllListeners();
    this.stage.removeAllEventListeners();
    this.registerEvents(this.emitter);
};

Game.prototype.tick = function(event) {
    this.stage.update(event);

	if (event.paused) {
		return;
	}

    this.gameScreen.tick(event);
};

module.exports = Game;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/game.js","/")
},{"./screens/GameOverScreen":36,"./screens/GameScreen":37,"./screens/HomeScreen":38,"./screens/MarioIsInAnotherCastleScreen":39,"./screens/StoryScreen":40,"buffer":2,"eventemitter2":1,"oMfpAn":5}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var numPetals = 12;

var Flower = function(x, y, color) {
    this.element = new createjs.Container();
	this.element.x = x;
	this.element.y = y;
	this.element.scaleX = this.element.scaleY = 0.1;

	for(var n = 0; n < numPetals; n++) {
		var petal = new createjs.Shape();

		petal.graphics
			.beginFill('#ff0')
			.drawCircle(0, 0, 20)
			//.beginStroke('#fff')
			.setStrokeStyle(3)
			.beginFill(color)
			.moveTo(-5, -20)
			.bezierCurveTo(-40, -90, 40, -90, 5, -20)
			.closePath();
		petal.rotation = 360 * n / numPetals;

		this.element.addChild(petal);
	}

	//this.element.cache(-100, -100, 200, 200);
};

module.exports = Flower;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ground/Flower.js","/ground")
},{"buffer":2,"oMfpAn":5}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var GameConsts = require('../GameConsts'),
	PseudoRand = require('../util/PseudoRand'),
	Tree = require('./Tree'),
	Flower = require('./Flower');

var Ground = function() {
	this.pseudoRandom = new PseudoRand();

	this.element = new createjs.Container();
	this.element.mouseChildren = false;
	this.element.mouseEnabled = false;
	this.shape = new createjs.Shape();

	this.decorations = new createjs.Container();

	this.treeCount = 0;
	this.flowerCount = 0;

	var img = new Image();
	img.onload = function() {
		this.shape.graphics
			.beginBitmapFill(img, 'repeat')
			.drawRect(0, 0, GameConsts.SIZE * 2, GameConsts.SIZE * 2);
	}.bind(this);
	img.src = './img/grass.png';

	this.element.addChild(this.shape);
	this.element.addChild(this.decorations);
	this.element.x = -GameConsts.SIZE;
	this.element.y = -GameConsts.SIZE;
};

Ground.prototype.spawnFlowers = function() {
	var x, y, color, i;

	var colors = ['#f33', '#88f', '#f70', '#f0f', '#ddf'];

	for (i = 0; i <= this.flowerCount; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		color = colors[(Math.random() * colors.length | 0)];

		this.decorations.addChild(new Flower(x, y, color).element);
	}
};

Ground.prototype.spawnTrees = function() {
	var x, y, r, i;

	for (i = 0; i <= this.treeCount; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		r = 70 + this.pseudoRandom.getRandom() % 100;

		this.decorations.addChild(new Tree(x, y, r).element);
	}
};

Ground.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

Ground.prototype.onChangeLevel = function(level) {
	this.pseudoRandom.setSeed(level.itemSeed);
	this.treeCount = level.trees;
	this.flowerCount = level.trees * 20;

	if (GameConsts.DRAW_FLOWERS) {
		this.spawnFlowers();
		this.spawnTrees();

		this.decorations.cache(0, 0, GameConsts.SIZE * 2, GameConsts.SIZE * 2);
		this.decorations.removeAllChildren();
	} else {
		this.spawnTrees();
	}
};

module.exports = Ground;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ground/Ground.js","/ground")
},{"../GameConsts":6,"../util/PseudoRand":41,"./Flower":13,"./Tree":16,"buffer":2,"oMfpAn":5}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function RainbowRoad() {
    this.element = new createjs.Container();
	this.hasFan = 0;
}

RainbowRoad.prototype.paint = function(event) {
	for (var i = 0; i < 6; i++) {
		this.spawnJuicyStar(event.x, event.y);
	}
};

RainbowRoad.prototype.tick = function(event) {
    // remove old paintings
};

RainbowRoad.prototype.spawnJuicyStar = function(x, y) {
	var size = 8 + 7 * Math.random();

	var star = new createjs.Shape();
	star.x = x - 15 + 30 * Math.random();
	star.y = y - 15 + 30 * Math.random();
	star.rotation = parseInt(Math.random() * 360);
	star.graphics.beginStroke("#f0f").beginFill('#ff0').setStrokeStyle(1).drawPolyStar(0, 0, size / 2, 5, 0.6).closePath();
	this.element.addChild(star);

	createjs.Tween.get(star)
		.to({alpha: 0, rotation: star.rotation + 180}, 500 + 500 * Math.random(), createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(star);
		}.bind(this));
};

module.exports = RainbowRoad;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ground/RainbowRoad.js","/ground")
},{"buffer":2,"oMfpAn":5}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Tree = function(x, y, r) {
    this.element = new createjs.Container();

    var bitmap = new createjs.Bitmap("./img/tree.png");
    bitmap.x = x;
    bitmap.y = y;
    bitmap.scaleX = bitmap.scaleY = r / 100;
    this.element.addChild(bitmap);
};

module.exports = Tree;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ground/Tree.js","/ground")
},{"buffer":2,"oMfpAn":5}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var messages = [
    'Trying to fight the impossible?',
    '#cheatergate',
    'Y U n00b?',
    'This wont help you!',
    'Ever heard of #fairplay?',
    'Are we trying to be god?'
];

var Rand = require('../util/PseudoRand'),
    constants = require('../GameConsts');

function CheaterBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 95;
    this.element.y = 200;

    this.rand = new Rand();
    this.rand.setSeed(new Date().getTime());
}

CheaterBar.prototype.registerEvents = function(emitter) {
    emitter.on('cheater', this.onCheater.bind(this));
};

CheaterBar.prototype.onCheater = function() {
    var text = messages[this.rand.getRandom() % messages.length];
    var message = new createjs.Text(text, '30px Komika', "#fff");
    message.x = 95 - message.getMeasuredWidth() / 2;
    message.y = 150;
    this.element.addChild(message);

createjs.Tween.get(message)
        .to({y: 0, alpha: 0}, 2500, createjs.Ease.linear)
        .call(function() {
        this.element.removeChild(message);
        }.bind(this));
};

module.exports = CheaterBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/CheaterBar.js","/hud")
},{"../GameConsts":6,"../util/PseudoRand":41,"buffer":2,"oMfpAn":5}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var autoDecreasePerSecond = 0.5;
var maxWidth = 240;
var juicyStarCount = 15;
var maxMagicLevel = 5;

var constants = require('../GameConsts');

function FunBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 95;
	this.element.y = 10;
    this.current = 0;
	this.lastIncrease = 0;
    this.border = new createjs.Shape();
    this.border.graphics.beginFill("#333").drawRect(0, 0, 250, 50);
    this.element.addChild(this.border);

	this.maxFunValue = 0;
	this.funTime = 0;

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);

	this.isFunTime = false;
	this.isFunTimeReset = true;

	this.funText = new createjs.Text("Fun", "24px Komika", "#fff");
	this.funText.x = -60;
	this.funText.y = 3;
	this.element.addChild(this.funText);

	this.funBarText = new createjs.Text("0.0", "25px Komika", '#fff');
	this.funBarText.x = 90;
	this.funBarText.y = 1;
	this.element.addChild(this.funBarText);
}

FunBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('combo', this.onCombo.bind(this));
	emitter.on('force-fun', this.onForceFun.bind(this));
	emitter.on('change-level', this.onChangeLevel.bind(this));

	this.emitter = emitter;
};

FunBar.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	this.increase(1);
};

FunBar.prototype.onCombo = function(event) {
    this.increase(event.level);
	this.spawnComboMessage(event.level);
};

FunBar.prototype.increase = function(value) {
	this.current += value;
	if (this.current >= this.maxFunValue && this.isFunTime == false) {
		this.canFunTime = true;
		this.emitter.emit('fun', {status: 1});
	}

	this.current = Math.min(this.current, this.maxFunValue);

	this.lastIncrease = new Date().getTime();

	for (var i = 0; i < juicyStarCount + 1; i++) {
		this.spawnJuicyStar(5 + this.getMaxOffsetOnBar() / juicyStarCount * i - 20 + 40 * Math.random(), 50 * Math.random(), 40);
	}

	var magicLevel = Math.min(maxMagicLevel, value);
	createjs.Sound.play('magic' + magicLevel);
};

FunBar.prototype.onForceFun = function() {
	this.increase(this.maxFunValue);
};

FunBar.prototype.tick = function(event) {
    if (this.current > 0) {
		if (this.isFunTime && event.timeStamp < this.funTimeEnd) {
			this.spawnJuicyStar(5 + this.getMaxOffsetOnBar() * Math.random() - 20 + 40 * Math.random(), 50 * Math.random(), 40);
		} else {
			this.isFunTime = false;

			if (!this.isFunTimeReset) {
				this.current = 0;
				this.isFunTimeReset = true;
				this.emitter.emit('fun', {status: 0});
			}

			this.current -= (event.delta / 1000) * autoDecreasePerSecond;
			this.current = Math.max(this.current, 0);

			var lastIncreaseDiff = event.timeStamp - this.lastIncrease;
			if (lastIncreaseDiff < 1000) {
				// fade from rgb(255, 0, 255) to rgb(255, 255, 0)
				this.drawFill('rgb(255, ' + Math.round(255 / 1000 * lastIncreaseDiff) + ', ' + Math.round(255 - 255 / 1000 * lastIncreaseDiff) + ')');
			} else {
				this.drawFill();
			}
		}
    }

	this.funBarText.text = (Math.round(this.current * 10) / 10).toFixed(1) + '/' + this.maxFunValue;

	if (this.canFunTime) {
		this.isFunTime = true;
		this.canFunTime = false;
		this.isFunTimeReset = false;
		this.funTimeEnd = event.timeStamp + this.funTime;
	}
};

FunBar.prototype.getMaxOffsetOnBar = function() {
	return (this.current / this.maxFunValue) * maxWidth;
};

FunBar.prototype.drawFill = function(color) {
	color = (color === undefined) ? '#ff0' : color;
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.current / this.maxFunValue) * maxWidth, 40);
};

FunBar.prototype.spawnJuicyStar = function(x, y, size) {
	size *= (0.8 + 0.4 * Math.random());

	var star = new createjs.Shape();
	star.x = x;
	star.y = y;
	star.rotation = parseInt(Math.random() * 360);
	star.graphics.beginStroke("#f0f").beginFill('#ff0').setStrokeStyle(2).drawPolyStar(0, 0, size / 2 - 15, 5, 0.6).closePath();
	this.element.addChild(star);

	createjs.Tween.get(star)
		.to({y: y + 200, alpha: 0, rotation: star.rotation + 180}, 500 + 500 * Math.random(), createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(star);
		}.bind(this));
};

FunBar.prototype.spawnComboMessage = function(level) {
	var message = new createjs.Text(level + 'x Combo', '30px Komika', "#fff");
	message.x = 95 - message.getMeasuredWidth() / 2;
	message.y = 150;
	this.element.addChild(message);

	createjs.Tween.get(message)
		.to({y: 0, alpha: 0}, 1500, createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(message);
		}.bind(this));
};

FunBar.prototype.onChangeLevel = function(level) {
	this.maxFunValue = level.maxFunValue;
	this.funTime = level.funTime;
};

module.exports = FunBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/FunBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var maxWidth = 240;

var constants = require('../GameConsts');

function HealthBar(left, object) {
    this.object = object;

    this.element = new createjs.Container();
    this.element.x = left ? 45 : constants.GAME_WIDTH - 260;
	this.element.y = 10;
    this.current = 0;

    this.border = new createjs.Shape();
    this.border.graphics.beginFill("#444").drawRect(0, 0, 250, 50);
    this.element.addChild(this.border);

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);

	this.funText = new createjs.Text(left ? "♥" : "☠", "30px Komika", left ? '#f8f' : '#d00');
	this.funText.x = -35;
	this.funText.y = -4;
	this.element.addChild(this.funText);

	this.remainingHitsText = new createjs.Text("", "25px Komika", '#fff');
	this.remainingHitsText.x = 70;
	this.remainingHitsText.y = 1;
	this.element.addChild(this.remainingHitsText);
}

HealthBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('heal-me', this.onHealMe.bind(this));
};

HealthBar.prototype.tick = function(event) {
    this.remainingHitsText.text = this.object.health + '/' + this.object.maxHealth;
};

HealthBar.prototype.onHit = function(event) {
    if (event.hitTarget !== this.object.id ) {
        return;
    }

    this.drawFill();
};

HealthBar.prototype.onHealMe = function(event) {
    this.drawFill();
};

HealthBar.prototype.drawFill = function() {
	var color = (this.object.id === 'player') ? '#f8f' : '#d00';
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.object.health / this.object.maxHealth) * maxWidth, 40);
};

module.exports = HealthBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/HealthBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var constants = require('../GameConsts');

function LevelBar() {
	this.element = new createjs.Container();
	this.element.x = constants.GAME_WIDTH - 130;
	this.element.y = constants.GAME_HEIGHT - 60;

	this.text = new createjs.Text(" ", "25px Komika", '#fff');
	this.text.x = 0;
	this.text.y = 0;
	this.element.addChild(this.text);
}

LevelBar.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

LevelBar.prototype.onChangeLevel = function(level) {
	this.text.text = "Level " + level.levelId;
};

module.exports = LevelBar;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/LevelBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var constants = require('../GameConsts'),
	iconHand = '☃',
	iconSword = '⚔';

function WeaponBar() {
	this.element = new createjs.Container();
	this.element.x = 10;
	this.element.y = constants.GAME_HEIGHT - 60;

	this.icon = iconHand;

	this.remainingHitsText = new createjs.Text(iconHand + " 0", "25px Komika", '#fff');
	this.remainingHitsText.x = 50;
	this.remainingHitsText.y = 0;
	this.element.addChild(this.remainingHitsText);
}

WeaponBar.prototype.updateWeapon = function(weapon, remaining) {
	switch (weapon) {
		case 'short-weapon':
			this.icon = iconSword;
			break;

		default:
			this.icon = iconHand;
			break;
	}

	this.updateRemainingHits(remaining);
};

WeaponBar.prototype.updateRemainingHits = function(remaining) {
	this.remainingHitsText.text = this.icon + ' ' + parseInt(remaining || 0);
};

module.exports = WeaponBar;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/WeaponBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth, trees, growlCooldown, itemCooldown, itemSwordAmount, itemSwordLifetime, comboInterval, maxFunValue, funTime) {
    this.levelId = levelId;
    this.darkness = darkness;
    this.monsterSpeed = monsterSpeed;
    this.darkness = darkness;
    this.itemSeed = itemSeed;
    this.terrainSeed = terrainSeed;
    this.playerHealth = playerHealth;
    this.monsterHealth = monsterHealth;
    this.trees = trees;
    this.growlCooldown = growlCooldown;
    this.itemCooldown = itemCooldown;
    this.itemSwordAmount = itemSwordAmount;
    this.itemSwordLifetime = itemSwordLifetime;
    this.comboInterval = comboInterval;
    this.maxFunValue = maxFunValue;
    this.funTime = funTime;
};

module.exports = Level;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/level/Level.js","/level")
},{"buffer":2,"oMfpAn":5}],23:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var levelData = require('./levels'),
    Level = require('./Level');

var LevelBuilder = function() {
};

/**
 * @param {Number} levelId
 * @returns {Level}
 */
LevelBuilder.prototype.getLevel = function(levelId) {
    var raw_level = levelData[levelId - 1];
    var level = new Level(
        raw_level.level,
        raw_level.darkness,
        raw_level.monsterSpeed,
        raw_level.itemSeed,
        raw_level.terrainSeed,
        raw_level.playerHealth,
        raw_level.monsterHealth,
        raw_level.trees,
        raw_level.growlCooldown,
        raw_level.itemCooldown,
        raw_level.itemSwordAmount,
        raw_level.itemSwordLifetime,
        raw_level.comboInterval,
        raw_level.maxFunValue,
        raw_level.funTime
    );

    return level;
};

module.exports = LevelBuilder;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/level/LevelBuilder.js","/level")
},{"./Level":22,"./levels":24,"buffer":2,"oMfpAn":5}],24:[function(require,module,exports){
module.exports=[
  {
    "level": 1,
    "darkness": 0,
    "monsterSpeed": 0.7,
    "itemSeed": 2,
    "terrainSeed": 101,
    "trees": 200,
    "playerHealth": 250,
    "monsterHealth": 150,
    "itemCooldown": 10,
    "itemSwordAmount": 20,
    "itemSwordLifetime": 20,
    "comboInterval": 1500,
    "maxFunValue": 7,
    "funTime": 6000
  },
  {
    "level": 2,
    "darkness": 0.5,
    "monsterSpeed": 0.9,
    "itemSeed": 3,
    "terrainSeed": 102,
    "trees": 500,
    "playerHealth": 150,
    "monsterHealth": 150,
    "growlCooldown": 10,
    "itemCooldown": 10,
    "itemSwordAmount": 10,
    "itemSwordLifetime": 15,
    "comboInterval": 1500,
    "maxFunValue": 10,
    "funTime": 5000
  },
  {
    "level": 3,
    "darkness": 0.7,
    "monsterSpeed": 1,
    "itemSeed": 4,
    "terrainSeed": 103,
    "trees": 50,
    "playerHealth": 100,
    "monsterHealth": 200,
    "growlCooldown": 8,
    "itemCooldown": 10,
    "itemSwordAmount": 6,
    "itemSwordLifetime": 10,
    "comboInterval": 1500,
    "maxFunValue": 5,
    "funTime": 1500
  },
  {
    "level": 4,
    "darkness": 0.75,
    "monsterSpeed": 1.1,
    "itemSeed": 5,
    "terrainSeed": 104,
    "trees": 375,
    "playerHealth": 100,
    "monsterHealth": 250,
    "growlCooldown": 5,
    "itemCooldown": 10,
    "itemSwordAmount": 5,
    "itemSwordLifetime": 10,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 4000
  },
  {
    "level": 5,
    "darkness": 0.78,
    "monsterSpeed": 1.2,
    "itemSeed": 6,
    "terrainSeed": 105,
    "trees": 100,
    "playerHealth": 100,
    "monsterHealth": 300,
    "growlCooldown": 5,
    "itemCooldown": 10,
    "itemSwordAmount": 5,
    "itemSwordLifetime": 10,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 3500
  },
  {
    "level": 6,
    "darkness": 0.81,
    "monsterSpeed": 1.3,
    "itemSeed": 7,
    "terrainSeed": 106,
    "trees": 100,
    "playerHealth": 125,
    "monsterHealth": 325,
    "growlCooldown": 5,
    "itemCooldown": 10,
    "itemSwordAmount": 4,
    "itemSwordLifetime": 10,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 3000
  },
  {
    "level": 7,
    "darkness": 0.84,
    "monsterSpeed": 1.4,
    "itemSeed": 8,
    "terrainSeed": 107,
    "trees": 750,
    "playerHealth": 125,
    "monsterHealth": 350,
    "growlCooldown": 4,
    "itemCooldown": 10,
    "itemSwordAmount": 4,
    "itemSwordLifetime": 10,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 2500
  },
  {
    "level": 8,
    "darkness": 0.88,
    "monsterSpeed": 1.5,
    "itemSeed": 9,
    "terrainSeed": 108,
    "trees": 10,
    "playerHealth": 150,
    "monsterHealth": 375,
    "growlCooldown": 4,
    "itemCooldown": 10,
    "itemSwordAmount": 4,
    "itemSwordLifetime": 5,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 2000
  },
  {
    "level": 9,
    "darkness": 0.9,
    "monsterSpeed": 1.6,
    "itemSeed": 10,
    "terrainSeed": 109,
    "trees": 500,
    "playerHealth": 150,
    "monsterHealth": 400,
    "growlCooldown": 4,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 5,
    "comboInterval": 1500,
    "maxFunValue": 15,
    "funTime": 2000
  },
  {
    "level": 10,
    "darkness": 0.92,
    "monsterSpeed": 1.7,
    "itemSeed": 11,
    "terrainSeed": 110,
    "trees": 150,
    "playerHealth": 150,
    "monsterHealth": 425,
    "growlCooldown": 3,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 5,
    "comboInterval": 1500,
    "maxFunValue": 20,
    "funTime": 2000
  },
  {
    "level": 11,
    "darkness": 0.94,
    "monsterSpeed": 1.8,
    "itemSeed": 12,
    "terrainSeed": 111,
    "trees": 20,
    "playerHealth": 150,
    "monsterHealth": 450,
    "growlCooldown": 3,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 5,
    "comboInterval": 1500,
    "maxFunValue": 20,
    "funTime": 2000
  },
  {
    "level": 12,
    "darkness": 0.96,
    "monsterSpeed": 1.9,
    "itemSeed": 13,
    "terrainSeed": 112,
    "trees": 570,
    "playerHealth": 150,
    "monsterHealth": 500,
    "growlCooldown": 3,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 5,
    "comboInterval": 1500,
    "maxFunValue": 20,
    "funTime": 2000
  },
  {
    "level": 13,
    "darkness": 0.97,
    "monsterSpeed": 2,
    "itemSeed": 14,
    "terrainSeed": 113,
    "trees": 210,
    "playerHealth": 150,
    "monsterHealth": 525,
    "growlCooldown": 3,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 4,
    "comboInterval": 1500,
    "maxFunValue": 20,
    "funTime": 2000
  },
  {
    "level": 14,
    "darkness": 0.98,
    "monsterSpeed": 2.1,
    "itemSeed": 15,
    "terrainSeed": 114,
    "trees": 10,
    "playerHealth": 150,
    "monsterHealth": 550,
    "growlCooldown": 2,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 4,
    "comboInterval": 1500,
    "maxFunValue": 25,
    "funTime": 2000
  },
  {
    "level": 15,
    "darkness": 0.99,
    "monsterSpeed": 2.2,
    "itemSeed": 16,
    "terrainSeed": 115,
    "trees": 8,
    "playerHealth": 150,
    "monsterHealth": 600,
    "growlCooldown": 2,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 4,
    "comboInterval": 1500,
    "maxFunValue": 26,
    "funTime": 2000
  },
  {
    "level": 16,
    "darkness": 1,
    "monsterSpeed": 2.3,
    "itemSeed": 17,
    "terrainSeed": 116,
    "trees": 100,
    "playerHealth": 150,
    "monsterHealth": 750,
    "growlCooldown": 2,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 4,
    "comboInterval": 1500,
    "maxFunValue": 27,
    "funTime": 2000
  },
  {
    "level": 17,
    "darkness": 1,
    "monsterSpeed": 2.4,
    "itemSeed": 18,
    "terrainSeed": 117,
    "trees": 100,
    "playerHealth": 150,
    "monsterHealth": 800,
    "growlCooldown": 2,
    "itemCooldown": 10,
    "itemSwordAmount": 3,
    "itemSwordLifetime": 4,
    "comboInterval": 1500,
    "maxFunValue": 28,
    "funTime": 2000
  }
]
},{}],25:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var attackDelay = 1000;

function AttackListener(stage, object) {
    this.stage = stage;
    this.object = object;

    this.lastAttack = 0;
    this.canAttack = true;
    this.isAttacking = false;
}

AttackListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;

    var self = this;
    window.document.onclick = function(event) {
        if (self.canAttack) {
            self.isAttacking = true;
        }
    };
};

AttackListener.prototype.tick = function(event) {
    if (!this.canAttack && event.timeStamp > this.lastAttack + attackDelay) {
        this.canAttack = true;
    }

    if (this.isAttacking) {
        this.canAttack = false;
        this.isAttacking = false;
        this.lastAttack = event.timeStamp;
        this.emitter.emit('attack', { damageDealer: this.object.id });
    }
};

module.exports = AttackListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/AttackListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],26:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var cheats = [
    {
        keys: [102, 117, 110], //fun
        event: "force-fun"
    },
    {
        keys: [ 119, 105, 110], // win
        event: 'monster-dead'
    },
    {
        keys: [ 104, 108, 112], // hlp
        event: 'heal-me'
    },
    {
        keys: [ 112, 108, 122], // plz
        event: 'player-weapon-lifetime'
    }
];

function CheatListener() {
    this.lastKeys = [0, 0, 0];
}

CheatListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    document.onkeypress = this.onKeyUp.bind(this);

};

CheatListener.prototype.onKeyUp = function(event) {
    this.lastKeys.shift();
    this.lastKeys.push(event.charCode);

    for (var i = 0; i < cheats.length; i++) {
        if (cheats[i].keys.join(',') == this.lastKeys.join(',')) {
            this.emitter.emit('cheater');
            this.emitter.emit(cheats[i].event);
        }
    }
};

module.exports = CheatListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/CheatListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],27:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function CollisionListener(a, b, eventType) {
    this.a = a;
    this.b = b;
    this.eventType = eventType;
}

CollisionListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
};

CollisionListener.prototype.tick = function(event) {
    var dist = Math.sqrt(Math.pow(this.b.element.x - this.a.element.x, 2) + Math.pow(this.b.element.y - this.a.element.y, 2));
    var addedRadius = this.a.getRadius() + this.b.getRadius();
    if (dist < addedRadius) {
        if (this.eventType == 'hit') {
            this.handleHitDetection(event);
        } else if (this.eventType == 'pickup') {
            this.handlePickupDetection(event);
        }
    }
};

CollisionListener.prototype.handleHitDetection = function(event) {
    var attack = false;
    if (this.a.isShortAttacking() && this.b.id !== 'growl') {
        this.emitter.emit(this.eventType, {
            timeStamp: event.timeStamp,
            hitTarget: this.b.id,
            damage: 10,
            damageDealer: this.a.id
        });

        attack = true;
    }

    if (this.b.isShortAttacking() && this.a.id !== 'growl') {
        this.emitter.emit(this.eventType, {
            timeStamp: event.timeStamp,
            hitTarget: this.a.id,
            damage: 10,
            damageDealer: this.b.id
        });

        attack = true;
    }

    var damageDealer = this.a.id == 'player' ? this.b.id : this.a.id;
    if (!attack) {
        this.emitter.emit(this.eventType, {
            timeStamp: event.timeStamp,
            hitTarget: 'player',
            damage: 10,
            damageDealer: damageDealer
        });
    } else {
        if (this.a.id == 'growl') {
            this.a.hit();
        } else if (this.b.id == 'growl') {
            this.b.hit();
        }
    }
};

CollisionListener.prototype.handlePickupDetection = function(event) {
    if (this.a.weapon) {
        return;
    }

    if (this.b.equipped) {
        return;
    }

    this.a.equip(this.b);
};

module.exports = CollisionListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/CollisionListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],28:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function ComboListener() {
    this.level = 0;
	this.lastHit = 0;
	this.comboInterval = 0;
}

ComboListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;
    emitter.on('hit', this.onHit.bind(this));
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

ComboListener.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	if (event.timeStamp - this.lastHit > this.comboInterval) {
		this.reset();
	}

	this.increaseCombo(event.timeStamp);
	this.lastHit = event.timeStamp;

	if (this.level > 1) {
		this.emitter.emit('combo', {
			level: this.level
		});
	}
};

ComboListener.prototype.tick = function(event) {

};

ComboListener.prototype.reset = function() {
    this.level = 0;
};

ComboListener.prototype.increaseCombo = function(timeStamp) {
    this.level++;
};

ComboListener.prototype.onChangeLevel = function(level) {
	this.comboInterval = level.comboInterval;
};

module.exports = ComboListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/ComboListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],29:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function GrowlListener(growlHandler) {
    this.growlHandler = growlHandler;
}

GrowlListener.prototype.registerEvents = function(emitter) {
    emitter.on('growl', this.onGrowl.bind(this));
};

GrowlListener.prototype.onGrowl = function(event) {
    this.growlHandler.span(event);
};

module.exports = GrowlListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/GrowlListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],30:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

function ItemListener(itemHandler) {
    this.currentItems = 0;
    this.nextItem = 0;
    this.maxItems = 0;
    this.cooldown = 0;
    this.itemHandler = itemHandler;
}

ItemListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    this.emitter.on('unequip', this.onUnequip.bind(this));
    this.emitter.on('change-level', this.onChangeLevel.bind(this));
};

ItemListener.prototype.onChangeLevel = function(level) {
    this.maxItems = level.itemSwordAmount;
    this.cooldown = level.itemCooldown;
};

ItemListener.prototype.onUnequip = function() {
    this.currentItems--;
};

ItemListener.prototype.tick = function (event) {
    if (this.currentItems >= this.maxItems) {
        return;
    }

    if (this.nextItem > event.timeStamp) {
        return;
    }

    this.itemHandler.spawn();
    this.nextItem = event.timeStamp + this.cooldown * 1000;
    this.currentItems++;
};

module.exports = ItemListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/ItemListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],31:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

var LevelBuilder = require('../level/LevelBuilder');

var currentLevelId = 0;

function LevelUpListener() {
	this.levelBuidler = new LevelBuilder();
}

LevelUpListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;

	//emitter.on('monster-dead', this.onLevelUp.bind(this));
	emitter.on('start-level', this.onStartLevel.bind(this));
	emitter.on('game-over', this.onGameOver.bind(this));
};

LevelUpListener.prototype.onStartLevel = function() {
	currentLevelId++;

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	this.emitter.emit('change-level', newLevel);
};

LevelUpListener.prototype.onGameOver = function() {
	currentLevelId = 1;

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	this.emitter.emit('change-level', newLevel);
};

module.exports = LevelUpListener;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/LevelUpListener.js","/listener")
},{"../level/LevelBuilder":23,"buffer":2,"oMfpAn":5}],32:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function RainbowRoadListener(rainbowRoad) {
    this.rainbowRoad = rainbowRoad;
}

RainbowRoadListener.prototype.registerEvents = function(emitter) {
    emitter.on('has-fun', this.onHasFun.bind(this));
};

RainbowRoadListener.prototype.onHasFun = function(event) {
    this.rainbowRoad.paint(event);
};

module.exports = RainbowRoadListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/RainbowRoadListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],33:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function SoundListener() {
	this.funSound = createjs.Sound.play('fun');
	this.funSound.stop();
}

SoundListener.prototype.registerEvent = function(emitter) {
	this.emitter = emitter;

	emitter.on('hit', this.onHit.bind(this));
	emitter.on('fun', this.onFun.bind(this));
};

SoundListener.prototype.onHit = function(event) {
	if (event.hitTarget == 'player') {
		createjs.Sound.play('girl-hurt');
	} else if (event.hitTarget == 'monster') {
		createjs.Sound.play('monster-hurt');
	}
};

SoundListener.prototype.onFun = function(event) {
	if (event.status) {
		this.funSound.play();
	} else {
		this.funSound.stop();
	}
};

module.exports = SoundListener;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/SoundListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],34:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function WeaponBarListener(weaponBar) {
    this.weaponBar = weaponBar;
}

WeaponBarListener.prototype.registerEvents = function(emitter) {
    emitter.on('unequip', this.onUnequip.bind(this));
    emitter.on('equip', this.onEquip.bind(this));
    emitter.on('weapon-update', this.onWeaponUpdate.bind(this));
};

WeaponBarListener.prototype.onUnequip = function() {
    this.weaponBar.updateWeapon('hands');
};

WeaponBarListener.prototype.onEquip = function(event) {
    this.weaponBar.updateWeapon(event.id, event.lifetime);
};

WeaponBarListener.prototype.onWeaponUpdate = function(event) {
    this.weaponBar.updateRemainingHits(event.lifetime);
};


module.exports = WeaponBarListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/WeaponBarListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],35:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

var NightOverlay = function(player) {
	this.c = 0;

	this.element = new createjs.Container();

	var img = new createjs.Bitmap('./img/nightmode.png');
	this.player = player;

	this.element.alpha = 0;
	img.scaleX = img.scaleY = 0.6;
	img.x = 1024 / 2;
	img.y = 768/2;

	img.regX = 1150;
	img.regY = 1450;

	this.img = img;
	this.element.addChild(img);
};

NightOverlay.prototype.tick = function(event) {
	var speed = this.player.velocity.length();

	this.c += event.delta * speed  / (80 * 1000);
	this.img.rotation = this.player.element.rotation - 35 + Math.sin(this.c) * 10;
};

NightOverlay.prototype.onChangeLevel = function(level) {
	this.element.alpha = level.darkness;
};

NightOverlay.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

module.exports = NightOverlay;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/nightOverlay/NightOverlay.js","/nightOverlay")
},{"buffer":2,"oMfpAn":5}],36:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var GameOverScreen = function() {
	this.element = new createjs.Container();
};

GameOverScreen.prototype.start = function() {
	this.element.addChild(new createjs.Bitmap('./img/gameover.png'));

	this.element.scaleX = 0.54;
	this.element.scaleY = 0.72;

	createjs.Sound.play('defeat');
};

GameOverScreen.prototype.reset = function() {
	this.element.removeAllChildren();
};

module.exports = GameOverScreen;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/screens/GameOverScreen.js","/screens")
},{"buffer":2,"oMfpAn":5}],37:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var View = require('../views/View'),
    Player = require('../Player'),
    Monster = require('../Monster'),
    FunBar = require('../hud/FunBar'),
    HealthBar = require('../hud/HealthBar'),
    LevelBar = require('../hud/LevelBar'),
    WeaponBar = require('../hud/WeaponBar'),
    CheaterBar = require('../hud/CheaterBar'),
    ComboListener = require('../listener/ComboListener'),
    CollisionListener = require('../listener/CollisionListener'),
    AttackListener = require('../listener/AttackListener'),
    SoundListener = require('../listener/SoundListener'),
    GrowlListener = require('../listener/GrowlListener'),
    LevelUpListener = require('../listener/LevelUpListener'),
    ItemListener = require('../listener/ItemListener'),
    CheatListener = require('../listener/CheatListener'),
    GrowlHandler = require('../weapons/GrowlHandler'),
    ItemHandler = require('../weapons/ItemHandler'),
    Ground = require('../ground/Ground'),
    RainbowRoad = require('../ground/RainbowRoad'),
    RainbowRoadListener = require('../listener/RainbowRoadListener'),
    WeaponBarListener = require('../listener/WeaponBarListener'),
    NightOverlay = require('../nightOverlay/NightOverlay'),
    GameConsts = require('../GameConsts');

function GameScreen(stage) {
    this.element = new createjs.Container();
    this.gameView = new View();
    this.hudView = new View();
    this.growlHandler = new GrowlHandler();
    this.itemHandler = new ItemHandler();
    this.element = new createjs.Container();

    this.listeners = [];

    this.stage = stage;
	this.backgroundMusic = null;
}

GameScreen.prototype.registerEvent = function(emitter) {
    this.emitter = emitter;
};

GameScreen.prototype.start = function() {
    this.element.addChild(this.gameView.element);
    this.element.addChild(this.hudView.element);
    this.gameView.addChild(this.growlHandler);
    this.gameView.addChild(this.itemHandler);

    var funBar = new FunBar();
    this.hudView.addChild(funBar);
    this.hudView.addChild(new CheaterBar());

	var rainbowRoad = new RainbowRoad();
	this.gameView.addChild(rainbowRoad);

    this.player = new Player(200, 200);
    this.growlHandler.setTarget(this.player);
    this.itemHandler.setTarget(this.player);
    this.gameView.addChild(this.player);
    this.gameView.attach(this.player);

    var monster = new Monster(700, 300, this.player);
    this.gameView.addChild(monster);

    var healthBar1 = new HealthBar(true, this.player);
    this.hudView.addChild(healthBar1);

    var healthBar2 = new HealthBar(false, monster);
    this.hudView.addChild(healthBar2);

	var weaponBar = new WeaponBar();
	this.hudView.addChild(weaponBar);

    var levelBar = new LevelBar();
    this.hudView.addChild(levelBar);

    var ground = new Ground();
    this.gameView.addChildAt(ground, 0);

    if (GameConsts.NIGHT_MODE) {
        var nightOverlay = new NightOverlay(this.player);
        this.hudView.addChildAt(nightOverlay, 0);
    }

    var comboListener = new ComboListener();
    comboListener.registerEvents(this.emitter);
    this.listeners.push(comboListener);
    var collisionListener = new CollisionListener(this.player, monster, 'hit');
    collisionListener.registerEvents(this.emitter);
    this.listeners.push(collisionListener);
    var attackListener = new AttackListener(this.stage, this.player);
    attackListener.registerEvents(this.emitter);
    this.listeners.push(attackListener);
	var soundListener = new SoundListener();
	soundListener.registerEvent(this.emitter);
	this.listeners.push(soundListener);
    var growlListener = new GrowlListener(this.growlHandler);
    growlListener.registerEvents(this.emitter);
    this.listeners.push(growlListener);
    var levelUpListener = new LevelUpListener();
    levelUpListener.registerEvents(this.emitter);
    this.listeners.push(levelUpListener);
    var itemListener = new ItemListener(this.itemHandler);
    itemListener.registerEvents(this.emitter);
    this.listeners.push(itemListener);
    var rainbowRoadListener = new RainbowRoadListener(rainbowRoad);
    rainbowRoadListener.registerEvents(this.emitter);
    this.listeners.push(rainbowRoadListener);
    var weaponBarListener = new WeaponBarListener(weaponBar);
    weaponBarListener.registerEvents(this.emitter);
    this.listeners.push(weaponBarListener);
    var cheatListener = new CheatListener();
    cheatListener.registerEvents(this.emitter);
    this.listeners.push(cheatListener);

    this.gameView.registerEvents(this.emitter);
    this.hudView.registerEvents(this.emitter);

    if (!this.backgroundMusic) {
		this.backgroundMusic = createjs.Sound.play('background', {loops: -1, volume: 0.2});
	} else {
		this.backgroundMusic.resume();
	}
};

GameScreen.prototype.reset = function() {
    this.hudView.reset();
    this.gameView.reset();
    this.growlHandler.reset();
    this.itemHandler.reset();
    this.element.removeAllChildren();
    this.listeners = [];
	this.backgroundMusic.pause();
};

GameScreen.prototype.tick = function(event) {
    this.gameView.tick(event);
    this.hudView.tick(event);

    for (var i = 0; i < this.listeners.length; i++) {
        if (typeof this.listeners[i]['tick'] == 'function') {
            this.listeners[i].tick(event);
        }
    }
};

module.exports = GameScreen;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/screens/GameScreen.js","/screens")
},{"../GameConsts":6,"../Monster":7,"../Player":8,"../ground/Ground":14,"../ground/RainbowRoad":15,"../hud/CheaterBar":17,"../hud/FunBar":18,"../hud/HealthBar":19,"../hud/LevelBar":20,"../hud/WeaponBar":21,"../listener/AttackListener":25,"../listener/CheatListener":26,"../listener/CollisionListener":27,"../listener/ComboListener":28,"../listener/GrowlListener":29,"../listener/ItemListener":30,"../listener/LevelUpListener":31,"../listener/RainbowRoadListener":32,"../listener/SoundListener":33,"../listener/WeaponBarListener":34,"../nightOverlay/NightOverlay":35,"../views/View":43,"../weapons/GrowlHandler":45,"../weapons/ItemHandler":46,"buffer":2,"oMfpAn":5}],38:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function HomeScreen() {
    this.element = new createjs.Container();
}

HomeScreen.prototype.start = function() {
    var textBox = new createjs.Container();
    var headline = new createjs.Text("Welcome!", "100px Silkscreen", "#ff7700");
    textBox.addChild(headline);

    var to = new createjs.Text("to", "50px Silkscreen", "#ff7700");
    to.y = 125;
    to.x = 150;
    textBox.addChild(to);

    var gameName = new createjs.Text("{GameName}!", "100px Silkscreen", "#ff7700");
    gameName.y = 200;
    textBox.addChild(gameName);

    textBox.y = 100;
    textBox.x = 150;

    this.loading = new createjs.Text("Loading ...", "75px Silkscreen", "#ff7700");
    this.loading.y = 500;
    this.loading.x = 150;
    this.element.addChild(this.loading);

    this.element.addChild(textBox);
};

HomeScreen.prototype.isReady = function() {
    this.element.removeChild(this.loading);

    this.loading = new createjs.Text("Click to Start Game!", "66px Silkscreen", "#ff7700");
    this.loading.y = 500;
    this.loading.x = 150;

    this.element.addChild(this.loading);
};

HomeScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = HomeScreen;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/screens/HomeScreen.js","/screens")
},{"buffer":2,"oMfpAn":5}],39:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function MarioIsInAnotherCastleScreen() {
    this.element = new createjs.Container();
}

MarioIsInAnotherCastleScreen.prototype.start = function() {
    var textBox = new createjs.Container();
    var headline = new createjs.Text("Thank You, little girl!", "56px Silkscreen", "#ff7700");
    textBox.addChild(headline);

    var info = new createjs.Text("But Mario is in another Castle!", "32px Silkscreen", "#ff7700");
    info.y = 100;
    textBox.addChild(info);

    var action = new createjs.Text("Click to try the next Castle!", "32px Silkscreen", "#ff7700");
    action.y = 300;
    textBox.addChild(action);

    var b = textBox.getBounds();
    textBox.x = 100;
    textBox.y = 200;
    this.element.addChild(textBox);

	createjs.Sound.play('victory');
};

MarioIsInAnotherCastleScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = MarioIsInAnotherCastleScreen;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/screens/MarioIsInAnotherCastleScreen.js","/screens")
},{"buffer":2,"oMfpAn":5}],40:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
function StoryScreen() {
    this.element = new createjs.Container();
}

StoryScreen.prototype.start = function() {

};

StoryScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = StoryScreen;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/screens/StoryScreen.js","/screens")
},{"buffer":2,"oMfpAn":5}],41:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * @constructor
 */
var PseudoRand = function() {};

/**
 * @param seed
 */
PseudoRand.prototype.setSeed = function(seed) {
	this._w = Math.abs(seed & 0xffff);
	this._z = Math.abs(seed >> 16);

	if (this._w == 0) this._w = 1;
	if (this._z == 0) this._z = 1;
};

/**
 * @returns {int}
 */
PseudoRand.prototype.getRandom = function() {
	this._z = Math.abs((36969 * (this._z & 65535) + (this._z >> 16))&0xfffffff);
	this._w = Math.abs((18000 * (this._w & 65535) + (this._w >> 16))&0xfffffff);
	return Math.abs(((this._z << 16) + this._w) & 0xfffffff); // exclude last bit
};

module.exports = PseudoRand;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/util/PseudoRand.js","/util")
},{"buffer":2,"oMfpAn":5}],42:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Vector2D = function (x, y) {
	this.x = x;
	this.y = y;
};

Vector2D.prototype.clone = function() {
	return new Vector2D(this.x, this.y);
};

/**
 * @param {Vector2D} another_vector
 * @return {Vector2D}
 */
Vector2D.prototype.plus = function(another_vector) {
	this.x += another_vector.x;
	this.y += another_vector.y;

	return this;
};

/**
 * @param {Vector2D} another_vector
 * @return {Vector2D}
 */
Vector2D.prototype.minus = function(another_vector) {
	return this.plus(another_vector.clone().times(-1));
};

/**
 * @param {Number} factor
 * @return {Vector2D}
 */
Vector2D.prototype.times = function(factor) {
	this.x *= factor;
	this.y *= factor;

	return this;
};

/**
 * @return {Number}
 */
Vector2D.prototype.length = function () {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};

/**
 * @return {Vector2D}
 */
Vector2D.prototype.norm = function () {
	var length = this.length();
	if (length != 0 ) {
		return this.times(1 / this.length());
	} else {
		return this;
	}
};

module.exports = Vector2D;

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @param {Number} t
 * @return {Vector2D}
 */
module.exports.lerp = function(vector_a, vector_b, t) {
	return vector_a.clone().times(1-t).plus(vector_b.clone().times(t));
};

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @return {Vector2D}
 */
module.exports.add = function(vector_a, vector_b) {
	return vector_a.clone().plus(vector_b)
};

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @return {Vector2D}
 */
module.exports.subtract = function(vector_a, vector_b) {
	return vector_a.clone().minus(vector_b)
};

/**
 * @param {Vector2D} vector_a
 * @param {Number} factor
 * @return {Vector2D}
 */
module.exports.multiply = function(vector_a, factor) {
	return vector_a.clone().times(factor)
};

/**
 * @param {Vector2D} vector
 * @return {Number}
 */
module.exports.getAngle = function(vector) {
	var angle = Math.asin(vector.y / vector.length()) * (180 / Math.PI) + 90;

	return vector.x < 0 ? 360 - angle : angle;
};

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/util/Vector2d.js","/util")
},{"buffer":2,"oMfpAn":5}],43:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var GameConsts = require('../GameConsts');

var View = function() {
	this.element = new createjs.Container();
	this.elements = [];
};

View.prototype.reset = function() {
	this.element.removeAllChildren();
	this.elements = [];
};

View.prototype.addChild = function(element) {
	this.element.addChild(element.element);
	this.elements.push(element);
};

View.prototype.addChildAt = function(element, idx) {
	this.element.addChildAt(element.element, idx);
	this.elements.push(element);
};

View.prototype.registerEvents = function(emitter) {
	for (var i = 0; i < this.elements.length; i++) {
		if (typeof this.elements[i]['registerEvents'] == 'function') {
			this.elements[i].registerEvents(emitter);
		}
	}
};

View.prototype.tick = function(event) {
	for (var i = 0; i < this.elements.length; i++) {
		if (typeof this.elements[i]['tick'] == 'function') {
			this.elements[i].tick(event);
		}
	}

	if (this.attachedTo) {
		this.element.setTransform(
			-this.attachedTo.x + GameConsts.GAME_WIDTH / 2,
			-this.attachedTo.y + GameConsts.GAME_HEIGHT / 2
		);
	}
};

View.prototype.attach = function(element) {
	this.attachedTo = element.element;
};

module.exports = View;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/views/View.js","/views")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],44:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Vec2d = require('../util/Vector2d'),
    GameConsts = require('../GameConsts');

function Growl(x, y, target, lifetime, relativeLifetime) {
    this.id = 'growl';

    this.element = new createjs.Container();

    this.fireball = new createjs.Container();
	var fireball = new createjs.Bitmap("./img/fireball.png");

	this.fireball.scaleX = this.fireball.scaleY = 0.3;

    fireball.image.onload = function() {
		this.fireball.regX = this.fireball.getBounds().width / 2;
		this.fireball.regY = this.fireball.getBounds().height / 2;
	}.bind(this);

	this.fireball.addChild(fireball);
    this.element.addChild(this.fireball);

	this.target = target;
    this.element.x = x;
    this.element.y = y;
    this.lifetime = lifetime;
    this.velocity = new Vec2d(0, 0);

	createjs.Tween.get(this.fireball)
		.to({rotation: relativeLifetime}, relativeLifetime - 500)
		.call(function() {
			this.element.removeChild(this.fireball);
		}.bind(this));

    var data = new createjs.SpriteSheet({
        "images": ['./img/poof.png'],
        "frames": {
            "regX": 0,
            "height": 128,
            "count": 64,
            "regY": 0,
            "width": 128
        },
        "animations": {"empty": [0], "default": [1, 64, "empty"]}
    });

    createjs.Tween.get(this.element)
        .wait(relativeLifetime - 1000)
        .call(function() {
            var animation = new createjs.Sprite(data, "default");
            animation.x = -64;
            animation.y = -64;
            animation.framerate = 60;
            this.element.addChild(animation);
        }.bind(this));
}

Growl.prototype.hit = function() {
    this.lifetime = 0;
};

Growl.prototype.isShortAttacking = function() {
    return true;
};

Growl.prototype.getRadius = function() {
    return 20;
};

Growl.prototype.tick = function(event) {
    var current = new Vec2d(this.target.element.x, this.target.element.y);
    var target  = new Vec2d(this.element.x, this.element.y);

    var vector_to_destination = Vec2d.subtract(current, target);
    var distance = vector_to_destination.length();

    // calculate new velocity according to current velocity and position of target
    vector_to_destination.norm().times(0.7);
    this.velocity.norm().times(20);
    this.velocity = this.velocity.plus(vector_to_destination);

    // set speed of monster according to distance to target
    this.velocity.times(100 + distance / 2.5);

    var delta = Vec2d.multiply(this.velocity, event.delta / 8000);

    this.element.x += delta.x;
    this.element.y += delta.y;
};

module.exports = Growl;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/weapons/Growl.js","/weapons")
},{"../GameConsts":6,"../util/Vector2d":42,"buffer":2,"oMfpAn":5}],45:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Growl = require('./Growl'),
    CollisionListener = require('../listener/CollisionListener');

var growlLifeTime = 6000;

function GrowlHandler() {
    this.element = new createjs.Container();
    this.growls = [];

    this.shouldSpan = false;
    this.listeners = [];
}

GrowlHandler.prototype.setTarget = function(target) {
    this.target = target;
};

GrowlHandler.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
};

GrowlHandler.prototype.reset = function() {
    this.growls = [];
    this.listeners = [];
    this.element.removeAllChildren();
};

GrowlHandler.prototype.span = function(event) {
    this.shouldSpan = true;
    this.nextSpan = event;
	createjs.Sound.play('launch-fireball');
};

GrowlHandler.prototype.tick = function(event) {
    if (this.shouldSpan) {
        var growl = new Growl(this.nextSpan.x, this.nextSpan.y, this.nextSpan.target, event.timeStamp + growlLifeTime, growlLifeTime);
        this.element.addChild(growl.element);
        this.shouldSpan = false;
        this.growls.push(growl);
        var listener = new CollisionListener(this.target, growl, 'hit');
        listener.registerEvents(this.emitter);
        this.listeners.push(listener);
    }

    for (var i = this.growls.length - 1; i >= 0; i--) {
        if (this.growls[i].lifetime < event.timeStamp) {
            this.element.removeChild(this.growls[i].element);
            this.growls.splice(i, 1);
            this.listeners.splice(i, 1);
            continue;
        }

        if (typeof this.growls[i]['tick'] == 'function') {
            this.growls[i].tick(event);
        }
    }

    for (i = 0; i < this.listeners.length; i++) {
        this.listeners[i].tick(event);
    }
};

module.exports = GrowlHandler;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/weapons/GrowlHandler.js","/weapons")
},{"../listener/CollisionListener":27,"./Growl":44,"buffer":2,"oMfpAn":5}],46:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var ShortWeapon = require('./ShortWeapon'),
    PseudoRand = require('../util/PseudoRand'),
    CollisionListener = require('../listener/CollisionListener'),
    GameConstants = require('../GameConsts');

function ItemHandler() {
    this.element = new createjs.Container();
    this.items = [];

    this.shouldSpawn = false;
    this.listeners = [];
    this.itemSwordLifetime = 10;

    this.rand = new PseudoRand();
}

ItemHandler.prototype.setTarget = function(target) {
    this.target = target;
};

ItemHandler.prototype.spawn = function() {
    this.shouldSpawn = true;
};

ItemHandler.prototype.reset = function() {
    this.items = [];
    this.listeners = [];
    this.element.removeAllChildren();
};

ItemHandler.prototype.tick = function(event) {
    if (this.shouldSpawn) {
        var item = new ShortWeapon(
            this.rand.getRandom() % GameConstants.GAME_WIDTH,
            this.rand.getRandom() & GameConstants.GAME_HEIGHT,
            this.rand.getRandom() % 360,
            this.itemSwordLifetime
        );
        this.element.addChild(item.element);
        this.shouldSpawn = false;
        this.items.push(item);

        var listener = new CollisionListener(this.target, item, 'pickup');
        listener.registerEvents(this.emitter);
        this.listeners.push(listener);
    }

    for (var i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].equipped && this.items[i].lifetime <= 0) {
            this.element.removeChild(this.items[i].element);
            this.items.splice(i, 1);
            this.listeners.splice(i, 1);
            continue;
        }

        if (typeof this.items[i]['tick'] == 'function') {
            this.items[i].tick(event);
        }

        if (!this.items[i].equipped && this.items[i].lifetime > 0) {
            this.listeners[i].tick(event);
        }
    }
};

ItemHandler.prototype.registerEvents = function(emitter) {
    emitter.on('change-level', this.onChangeLevel.bind(this));
};

ItemHandler.prototype.onChangeLevel = function(level) {
    this.rand.setSeed(level.itemSeed);
    this.itemSwordLifetime = level.itemSwordLifetime;
};

module.exports = ItemHandler;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/weapons/ItemHandler.js","/weapons")
},{"../GameConsts":6,"../listener/CollisionListener":27,"../util/PseudoRand":41,"./ShortWeapon":47,"buffer":2,"oMfpAn":5}],47:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var attackDuration = 500;

function ShortWeapon(x, y, rotation, lifetime) {
    this.radius = 20;
    this.element = new createjs.Container();
    this.id = 'item';
    this.element.x = x;
    this.element.y = y;
    this.element.rotation = rotation;

    this.equipped = false;
    this.lifetime = lifetime;

    var image = new createjs.Bitmap('./img/schwert.png');

    var self = this;
    image.image.onload = function() {
        self.element.regX = self.element.getBounds().width / 2;
        self.element.regY = self.element.getBounds().height / 2;
    };
    this.image = image;
    this.element.scaleX = this.element.scaleY = 0.1;
    this.element.addChild(image);
}

ShortWeapon.prototype.registerEvents = function(emitter) {
    emitter.on('attack', this.onAttack.bind(this));
    this.emitter = emitter;
};

ShortWeapon.prototype.onAttack = function(event) {
    if (this.lifetime <= 0) {
        return;
    }

    this.canActive = true;
};

ShortWeapon.prototype.tick = function(event) {
    if (this.canActive) {
        this.isActive = true;
        this.canActive = false;
        this.cooldown = event.timeStamp + attackDuration;
        this.lifetime--;

        this.triggerUpdate();

        if (this.lifetime <= 0) {
            this.equipped = false;
        }
    }

    if (this.isActive && this.cooldown < event.timeStamp) {
        this.canActive = false;
        this.isActive = false;
    }
};

ShortWeapon.prototype.triggerUpdate = function() {
    this.emitter.emit('weapon-update', {
        id: this.id,
        lifetime: this.lifetime
    });
};

ShortWeapon.prototype.getRadius = function () {
    return this.radius;
};

ShortWeapon.prototype.equip = function() {
    this.element.x = 900;
    this.element.y = 0;
    this.element.rotation = 0;
    this.radius = 80;
    this.id = 'short-weapon';
    this.equipped = true;
    this.element.scaleX = this.element.scaleY = 1;
};

module.exports = ShortWeapon;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/weapons/ShortWeapon.js","/weapons")
},{"buffer":2,"oMfpAn":5}]},{},[11])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ldmVudGVtaXR0ZXIyL2xpYi9ldmVudGVtaXR0ZXIyLmpzIiwiL3d3dy9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL3d3dy9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9HYW1lQ29uc3RzLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL01vbnN0ZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvUGxheWVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL1ByZWxvYWRlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9hc3NldHMuanNvbiIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9mYWtlXzQyNDQxYzEuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvZ2FtZS5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9ncm91bmQvRmxvd2VyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2dyb3VuZC9Hcm91bmQuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvZ3JvdW5kL1JhaW5ib3dSb2FkLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2dyb3VuZC9UcmVlLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2h1ZC9DaGVhdGVyQmFyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2h1ZC9GdW5CYXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvaHVkL0hlYWx0aEJhci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9odWQvTGV2ZWxCYXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvaHVkL1dlYXBvbkJhci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9sZXZlbC9MZXZlbC5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9sZXZlbC9MZXZlbEJ1aWxkZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGV2ZWwvbGV2ZWxzLmpzb24iLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvQXR0YWNrTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvQ2hlYXRMaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Db21ib0xpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0dyb3dsTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvSXRlbUxpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0xldmVsVXBMaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9SYWluYm93Um9hZExpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL1NvdW5kTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvV2VhcG9uQmFyTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbmlnaHRPdmVybGF5L05pZ2h0T3ZlcmxheS5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9zY3JlZW5zL0dhbWVPdmVyU2NyZWVuLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3NjcmVlbnMvR2FtZVNjcmVlbi5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9zY3JlZW5zL0hvbWVTY3JlZW4uanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvc2NyZWVucy9NYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3NjcmVlbnMvU3RvcnlTY3JlZW4uanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvdXRpbC9Qc2V1ZG9SYW5kLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3V0aWwvVmVjdG9yMmQuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvdmlld3MvVmlldy5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy93ZWFwb25zL0dyb3dsLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3dlYXBvbnMvR3Jvd2xIYW5kbGVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3dlYXBvbnMvSXRlbUhhbmRsZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvd2VhcG9ucy9TaG9ydFdlYXBvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmxDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKiBFdmVudEVtaXR0ZXIyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vaGlqMW54L0V2ZW50RW1pdHRlcjJcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgaGlqMW54XG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cbjshZnVuY3Rpb24odW5kZWZpbmVkKSB7XG5cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5ID8gQXJyYXkuaXNBcnJheSA6IGZ1bmN0aW9uIF9pc0FycmF5KG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICB9O1xuICB2YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4gIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgaWYgKHRoaXMuX2NvbmYpIHtcbiAgICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIHRoaXMuX2NvbmYpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbmZpZ3VyZShjb25mKSB7XG4gICAgaWYgKGNvbmYpIHtcblxuICAgICAgdGhpcy5fY29uZiA9IGNvbmY7XG5cbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcbiAgICAgIGNvbmYubWF4TGlzdGVuZXJzICYmICh0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gY29uZi5tYXhMaXN0ZW5lcnMpO1xuICAgICAgY29uZi53aWxkY2FyZCAmJiAodGhpcy53aWxkY2FyZCA9IGNvbmYud2lsZGNhcmQpO1xuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xuXG4gICAgICBpZiAodGhpcy53aWxkY2FyZCkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyVHJlZSA9IHt9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEV2ZW50RW1pdHRlcihjb25mKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgdGhpcy5uZXdMaXN0ZW5lciA9IGZhbHNlO1xuICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIGNvbmYpO1xuICB9XG5cbiAgLy9cbiAgLy8gQXR0ZW50aW9uLCBmdW5jdGlvbiByZXR1cm4gdHlwZSBub3cgaXMgYXJyYXksIGFsd2F5cyAhXG4gIC8vIEl0IGhhcyB6ZXJvIGVsZW1lbnRzIGlmIG5vIGFueSBtYXRjaGVzIGZvdW5kIGFuZCBvbmUgb3IgbW9yZVxuICAvLyBlbGVtZW50cyAobGVhZnMpIGlmIHRoZXJlIGFyZSBtYXRjaGVzXG4gIC8vXG4gIGZ1bmN0aW9uIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgaSkge1xuICAgIGlmICghdHJlZSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzPVtdLCBsZWFmLCBsZW4sIGJyYW5jaCwgeFRyZWUsIHh4VHJlZSwgaXNvbGF0ZWRCcmFuY2gsIGVuZFJlYWNoZWQsXG4gICAgICAgIHR5cGVMZW5ndGggPSB0eXBlLmxlbmd0aCwgY3VycmVudFR5cGUgPSB0eXBlW2ldLCBuZXh0VHlwZSA9IHR5cGVbaSsxXTtcbiAgICBpZiAoaSA9PT0gdHlwZUxlbmd0aCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiBhdCB0aGUgZW5kIG9mIHRoZSBldmVudChzKSBsaXN0IGFuZCB0aGUgdHJlZSBoYXMgbGlzdGVuZXJzXG4gICAgICAvLyBpbnZva2UgdGhvc2UgbGlzdGVuZXJzLlxuICAgICAgLy9cbiAgICAgIGlmICh0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGVhZiA9IDAsIGxlbiA9IHRyZWUuX2xpc3RlbmVycy5sZW5ndGg7IGxlYWYgPCBsZW47IGxlYWYrKykge1xuICAgICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzW2xlYWZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY3VycmVudFR5cGUgPT09ICcqJyB8fCBjdXJyZW50VHlwZSA9PT0gJyoqJykgfHwgdHJlZVtjdXJyZW50VHlwZV0pIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgZXZlbnQgZW1pdHRlZCBpcyAnKicgYXQgdGhpcyBwYXJ0XG4gICAgICAvLyBvciB0aGVyZSBpcyBhIGNvbmNyZXRlIG1hdGNoIGF0IHRoaXMgcGF0Y2hcbiAgICAgIC8vXG4gICAgICBpZiAoY3VycmVudFR5cGUgPT09ICcqJykge1xuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsxKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9IGVsc2UgaWYoY3VycmVudFR5cGUgPT09ICcqKicpIHtcbiAgICAgICAgZW5kUmVhY2hlZCA9IChpKzEgPT09IHR5cGVMZW5ndGggfHwgKGkrMiA9PT0gdHlwZUxlbmd0aCAmJiBuZXh0VHlwZSA9PT0gJyonKSk7XG4gICAgICAgIGlmKGVuZFJlYWNoZWQgJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gVGhlIG5leHQgZWxlbWVudCBoYXMgYSBfbGlzdGVuZXJzLCBhZGQgaXQgdG8gdGhlIGhhbmRsZXJzLlxuICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSAnKicgfHwgYnJhbmNoID09PSAnKionKSB7XG4gICAgICAgICAgICAgIGlmKHRyZWVbYnJhbmNoXS5fbGlzdGVuZXJzICYmICFlbmRSZWFjaGVkKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gTm8gbWF0Y2ggb24gdGhpcyBvbmUsIHNoaWZ0IGludG8gdGhlIHRyZWUgYnV0IG5vdCBpbiB0aGUgdHlwZSBhcnJheS5cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfVxuXG4gICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVtjdXJyZW50VHlwZV0sIGkrMSkpO1xuICAgIH1cblxuICAgIHhUcmVlID0gdHJlZVsnKiddO1xuICAgIGlmICh4VHJlZSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBsaXN0ZW5lciB0cmVlIHdpbGwgYWxsb3cgYW55IG1hdGNoIGZvciB0aGlzIHBhcnQsXG4gICAgICAvLyB0aGVuIHJlY3Vyc2l2ZWx5IGV4cGxvcmUgYWxsIGJyYW5jaGVzIG9mIHRoZSB0cmVlXG4gICAgICAvL1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4VHJlZSwgaSsxKTtcbiAgICB9XG5cbiAgICB4eFRyZWUgPSB0cmVlWycqKiddO1xuICAgIGlmKHh4VHJlZSkge1xuICAgICAgaWYoaSA8IHR5cGVMZW5ndGgpIHtcbiAgICAgICAgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGEgbGlzdGVuZXIgb24gYSAnKionLCBpdCB3aWxsIGNhdGNoIGFsbCwgc28gYWRkIGl0cyBoYW5kbGVyLlxuICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1aWxkIGFycmF5cyBvZiBtYXRjaGluZyBuZXh0IGJyYW5jaGVzIGFuZCBvdGhlcnMuXG4gICAgICAgIGZvcihicmFuY2ggaW4geHhUcmVlKSB7XG4gICAgICAgICAgaWYoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgeHhUcmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gV2Uga25vdyB0aGUgbmV4dCBlbGVtZW50IHdpbGwgbWF0Y2gsIHNvIGp1bXAgdHdpY2UuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMik7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBjdXJyZW50VHlwZSkge1xuICAgICAgICAgICAgICAvLyBDdXJyZW50IG5vZGUgbWF0Y2hlcywgbW92ZSBpbnRvIHRoZSB0cmVlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2ggPSB7fTtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2hbYnJhbmNoXSA9IHh4VHJlZVticmFuY2hdO1xuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHsgJyoqJzogaXNvbGF0ZWRCcmFuY2ggfSwgaSsxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAvLyBXZSBoYXZlIHJlYWNoZWQgdGhlIGVuZCBhbmQgc3RpbGwgb24gYSAnKionXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH0gZWxzZSBpZih4eFRyZWVbJyonXSAmJiB4eFRyZWVbJyonXS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlWycqJ10sIHR5cGVMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gIH1cblxuICBmdW5jdGlvbiBncm93TGlzdGVuZXJUcmVlKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICB0eXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG5cbiAgICAvL1xuICAgIC8vIExvb2tzIGZvciB0d28gY29uc2VjdXRpdmUgJyoqJywgaWYgc28sIGRvbid0IGFkZCB0aGUgZXZlbnQgYXQgYWxsLlxuICAgIC8vXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdHlwZS5sZW5ndGg7IGkrMSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZih0eXBlW2ldID09PSAnKionICYmIHR5cGVbaSsxXSA9PT0gJyoqJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHRyZWUgPSB0aGlzLmxpc3RlbmVyVHJlZTtcbiAgICB2YXIgbmFtZSA9IHR5cGUuc2hpZnQoKTtcblxuICAgIHdoaWxlIChuYW1lKSB7XG5cbiAgICAgIGlmICghdHJlZVtuYW1lXSkge1xuICAgICAgICB0cmVlW25hbWVdID0ge307XG4gICAgICB9XG5cbiAgICAgIHRyZWUgPSB0cmVlW25hbWVdO1xuXG4gICAgICBpZiAodHlwZS5sZW5ndGggPT09IDApIHtcblxuICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IGxpc3RlbmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IFt0cmVlLl9saXN0ZW5lcnMsIGxpc3RlbmVyXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc0FycmF5KHRyZWUuX2xpc3RlbmVycykpIHtcblxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzLndhcm5lZCkge1xuXG4gICAgICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtID4gMCAmJiB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhblxuICAvLyAxMCBsaXN0ZW5lcnMgYXJlIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2hcbiAgLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG4gIC8vXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmRlbGltaXRlciA9ICcuJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xuICAgIGlmICghdGhpcy5fY29uZikgdGhpcy5fY29uZiA9IHt9O1xuICAgIHRoaXMuX2NvbmYubWF4TGlzdGVuZXJzID0gbjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmV2ZW50ID0gJyc7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKSB7XG4gICAgdGhpcy5tYW55KGV2ZW50LCAxLCBmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5tYW55ID0gZnVuY3Rpb24oZXZlbnQsIHR0bCwgZm4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKCkge1xuICAgICAgaWYgKC0tdHRsID09PSAwKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGxpc3RlbmVyLl9vcmlnaW4gPSBmbjtcblxuICAgIHRoaXMub24oZXZlbnQsIGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIHZhciB0eXBlID0gYXJndW1lbnRzWzBdO1xuXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIH1cblxuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgKl9hbGwqIGZ1bmN0aW9ucyBhbmQgaW52b2tlIHRoZW0uXG4gICAgaWYgKHRoaXMuX2FsbCkge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuX2FsbC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIHRoaXMuX2FsbFtpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcblxuICAgICAgaWYgKCF0aGlzLl9hbGwgJiZcbiAgICAgICAgIXRoaXMuX2V2ZW50cy5lcnJvciAmJlxuICAgICAgICAhKHRoaXMud2lsZGNhcmQgJiYgdGhpcy5saXN0ZW5lclRyZWUuZXJyb3IpKSB7XG5cbiAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgYXJndW1lbnRzWzFdOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuY2F1Z2h0LCB1bnNwZWNpZmllZCAnZXJyb3InIGV2ZW50LlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXI7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBoYW5kbGVyID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpXG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIHNsb3dlclxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaGFuZGxlcikge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgICB2YXIgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gKGxpc3RlbmVycy5sZW5ndGggPiAwKSB8fCAhIXRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gISF0aGlzLl9hbGw7XG4gICAgfVxuXG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMub25BbnkodHlwZSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT0gXCJuZXdMaXN0ZW5lcnNcIiEgQmVmb3JlXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lcnNcIi5cbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgZ3Jvd0xpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB7XG4gICAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICAgIH1cbiAgICBlbHNlIGlmKHR5cGVvZiB0aGlzLl9ldmVudHNbdHlwZV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuXG4gICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uQW55ID0gZnVuY3Rpb24oZm4pIHtcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb25Bbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLl9hbGwpIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXG4gICAgdGhpcy5fYWxsLnB1c2goZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gZG9lcyBub3QgdXNlIGxpc3RlbmVycygpLCBzbyBubyBzaWRlIGVmZmVjdCBvZiBjcmVhdGluZyBfZXZlbnRzW3R5cGVdXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgIGxlYWZzLnB1c2goe19saXN0ZW5lcnM6aGFuZGxlcnN9KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICBpZiAoaXNBcnJheShoYW5kbGVycykpIHtcblxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0ubGlzdGVuZXIgJiYgaGFuZGxlcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLl9vcmlnaW4gJiYgaGFuZGxlcnNbaV0uX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zaXRpb24gPCAwKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgbGVhZi5fbGlzdGVuZXJzLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFuZGxlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGhhbmRsZXJzID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAoaGFuZGxlcnMuX29yaWdpbiAmJiBoYW5kbGVycy5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmQW55ID0gZnVuY3Rpb24oZm4pIHtcbiAgICB2YXIgaSA9IDAsIGwgPSAwLCBmbnM7XG4gICAgaWYgKGZuICYmIHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoID4gMCkge1xuICAgICAgZm5zID0gdGhpcy5fYWxsO1xuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZihmbiA9PT0gZm5zW2ldKSB7XG4gICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgdmFyIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcblxuICAgICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgICBsZWFmLl9saXN0ZW5lcnMgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBoYW5kbGVycyA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVycywgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICAgIHJldHVybiBoYW5kbGVycztcbiAgICB9XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFtdO1xuICAgIGlmICghaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyc0FueSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgaWYodGhpcy5fYWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgfTtcblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRFbWl0dGVyO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIENvbW1vbkpTXG4gICAgZXhwb3J0cy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsLlxuICAgIHdpbmRvdy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG59KCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMi9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYlwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgR2FtZUNvbnN0cyA9IHt9O1xuXG4vLyB3aW5kb3cgc2l6ZSBpbiBweFxuR2FtZUNvbnN0cy5HQU1FX1dJRFRIIFx0PSAxMDI0O1xuR2FtZUNvbnN0cy5HQU1FX0hFSUdIVCBcdD0gNzY4O1xuXG4vLyB0b3RhbCBmaWVsZCBzaXplXG5HYW1lQ29uc3RzLlNJWkUgPSAzMDAwO1xuXG5HYW1lQ29uc3RzLk5JR0hUX01PREUgPSB0cnVlO1xuR2FtZUNvbnN0cy5EUkFXX0ZMT1dFUlMgPSBmYWxzZTtcblxuR2FtZUNvbnN0cy5NT05TVEVSX1NQRUVEID0gMC4wMjU7XG5cbm1vZHVsZS5leHBvcnRzID0gR2FtZUNvbnN0cztcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9HYW1lQ29uc3RzLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGdyb3dsU291bmRzID0gMzsgLy8gaW4gc2Vjb25kc1xuXG52YXIgVmVjMmQgPSByZXF1aXJlKCcuL3V0aWwvVmVjdG9yMmQnKSxcblx0R2FtZUNvbnN0cyA9IHJlcXVpcmUoJy4vR2FtZUNvbnN0cycpO1xuXG52YXIgTW9uc3RlciA9IGZ1bmN0aW9uKHgsIHksIHRhcmdldCkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuXG5cdHRoaXMucmFkaXVzID0gOTA7XG5cdHRoaXMubWF4SGVhbHRoID0gdGhpcy5oZWFsdGggPSAzMDA7XG5cdHRoaXMuaWQgPSAnbW9uc3Rlcic7XG5cdHRoaXMubGFzdEdyb3dsQXQgPSAwO1xuXHR0aGlzLmdyb3dsU291bmRJbmRleCA9IDA7XG5cdHRoaXMuYm91bmNlVmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG5cdHRoaXMuc3BlZWQgPSAxO1xuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cdHRoaXMudmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG5cdHRoaXMuZ3Jvd2xDb29sZG93biA9IDA7XG5cblx0dmFyIGltYWdlID0gbmV3IGNyZWF0ZWpzLkJpdG1hcCgnLi9pbWcvbW9uc3Rlci5wbmcnKTtcblx0dGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjM7XG5cblx0aW1hZ2UuaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0c2VsZi5lbGVtZW50LnJlZ1ggPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRzKCkud2lkdGggLyAyO1xuXHRcdHNlbGYuZWxlbWVudC5yZWdZID0gc2VsZi5lbGVtZW50LmdldEJvdW5kcygpLmhlaWdodCAvIDI7XG5cdH07XG5cblx0dGhpcy5lbGVtZW50LnggPSB4O1xuXHR0aGlzLmVsZW1lbnQueSA9IHk7XG5cblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKGltYWdlKTtcbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHRlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ2hpdCcsIHRoaXMub25IaXQuYmluZCh0aGlzKSk7XG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdGlmIChldmVudC5oaXRUYXJnZXQgIT09IHRoaXMuaWQpIHtcblx0XHRpZiAoZXZlbnQuZGFtYWdlRGVhbGVyID09IHRoaXMuaWQpIHtcblx0XHRcdHZhciBwb3NpdGlvbiA9IG5ldyBWZWMyZCh0aGlzLmVsZW1lbnQueCwgdGhpcy5lbGVtZW50LnkpO1xuXHRcdFx0dmFyIHRhcmdldF9wb3NpdGlvbiA9IG5ldyBWZWMyZCh0aGlzLnRhcmdldC5lbGVtZW50LngsIHRoaXMudGFyZ2V0LmVsZW1lbnQueSk7XG5cdFx0XHR0aGlzLnRhcmdldC5ib3VuY2VWZWxvY2l0eSA9ICBWZWMyZC5zdWJ0cmFjdCh0YXJnZXRfcG9zaXRpb24sIHBvc2l0aW9uKS5ub3JtKCkudGltZXMoMTgwKTtcblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHR0aGlzLmJvdW5jZVZlbG9jaXR5ID0gdGhpcy52ZWxvY2l0eS5jbG9uZSgpLm5vcm0oKS50aW1lcygtMTgwKTtcblxuXHR0aGlzLmhlYWx0aCAtPSBldmVudC5kYW1hZ2U7XG5cdHRoaXMuaGVhbHRoID0gTWF0aC5tYXgoMCwgdGhpcy5oZWFsdGgpO1xuXG5cdGlmICh0aGlzLmhlYWx0aCA9PSAwKSB7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ21vbnN0ZXItZGVhZCcpO1xuXHR9XG59O1xuXG4vKipcbiAqIEBwYXJhbSBldmVudFxuICovXG5Nb25zdGVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0dmFyIGN1cnJlbnQgPSBuZXcgVmVjMmQodGhpcy50YXJnZXQuZWxlbWVudC54LCB0aGlzLnRhcmdldC5lbGVtZW50LnkpO1xuXHR2YXIgdGFyZ2V0ID0gbmV3IFZlYzJkKHRoaXMuZWxlbWVudC54LCB0aGlzLmVsZW1lbnQueSk7XG5cblx0dmFyIHZlY3Rvcl90b19kZXN0aW5hdGlvbiA9IFZlYzJkLnN1YnRyYWN0KGN1cnJlbnQsIHRhcmdldCk7XG5cdHZhciBkaXN0YW5jZSA9IHZlY3Rvcl90b19kZXN0aW5hdGlvbi5sZW5ndGgoKTtcblxuXHQvLyBjYWxjdWxhdGUgbmV3IHZlbG9jaXR5IGFjY29yZGluZyB0byBjdXJyZW50IHZlbG9jaXR5IGFuZCBwb3NpdGlvbiBvZiB0YXJnZXRcblx0dmVjdG9yX3RvX2Rlc3RpbmF0aW9uLm5vcm0oKS50aW1lcygwLjUpO1xuXHR0aGlzLnZlbG9jaXR5Lm5vcm0oKS50aW1lcygyMCk7XG5cdHRoaXMudmVsb2NpdHkgPSB0aGlzLnZlbG9jaXR5LnBsdXModmVjdG9yX3RvX2Rlc3RpbmF0aW9uKTtcblxuXHQvLyBzZXQgc3BlZWQgb2YgbW9uc3RlciBhY2NvcmRpbmcgdG8gZGlzdGFuY2UgdG8gdGFyZ2V0XG5cdHRoaXMudmVsb2NpdHkudGltZXMoZGlzdGFuY2UpO1xuXG5cdHZhciBkZWx0YSA9IFZlYzJkLm11bHRpcGx5KHRoaXMudmVsb2NpdHksIGV2ZW50LmRlbHRhIC8gMTAwMCAqIEdhbWVDb25zdHMuTU9OU1RFUl9TUEVFRCAqIHRoaXMuc3BlZWQpO1xuXHR2YXIgYW5nbGUgPSBWZWMyZC5nZXRBbmdsZShkZWx0YSk7XG5cblx0aWYgKHRoaXMuYm91bmNlVmVsb2NpdHkubGVuZ3RoKCkgIT0gMCkge1xuXHRcdHZhciBwdXNoX2RlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy5ib3VuY2VWZWxvY2l0eS5jbG9uZSgpLCBldmVudC5kZWx0YSAvIDgwKTtcblx0XHR0aGlzLmJvdW5jZVZlbG9jaXR5ID0gdGhpcy5ib3VuY2VWZWxvY2l0eS5taW51cyhwdXNoX2RlbHRhKTtcblxuXHRcdGRlbHRhLnBsdXMocHVzaF9kZWx0YSk7XG5cblx0XHRpZiAocHVzaF9kZWx0YS5sZW5ndGgoKSA8IDEpIHtcblx0XHRcdHRoaXMuYm91bmNlVmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG5cdFx0fVxuXHR9XG5cblx0dGhpcy5lbGVtZW50LnggKz0gZGVsdGEueDtcblx0dGhpcy5lbGVtZW50LnkgKz0gZGVsdGEueTtcblxuXHR0aGlzLmVsZW1lbnQueCA9IE1hdGgubWluKEdhbWVDb25zdHMuU0laRSwgTWF0aC5tYXgoLUdhbWVDb25zdHMuU0laRSwgdGhpcy5lbGVtZW50LngpKTtcblx0dGhpcy5lbGVtZW50LnkgPSBNYXRoLm1pbihHYW1lQ29uc3RzLlNJWkUsIE1hdGgubWF4KC1HYW1lQ29uc3RzLlNJWkUsIHRoaXMuZWxlbWVudC55KSk7XG5cblx0dGhpcy5lbGVtZW50LnJvdGF0aW9uID0gYW5nbGU7XG5cblx0aWYgKHRoaXMuZ3Jvd2xDb29sZG93biAmJiBldmVudC50aW1lU3RhbXAgLSB0aGlzLmxhc3RHcm93bEF0ID4gdGhpcy5ncm93bENvb2xkb3duICogMTAwMCkge1xuXHRcdHRoaXMuZ3Jvd2woKTtcblx0fVxufTtcblxuTW9uc3Rlci5wcm90b3R5cGUuZ3Jvd2wgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5sYXN0R3Jvd2xBdCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdncm93bCcgKyB0aGlzLmdyb3dsU291bmRJbmRleCwge3ZvbHVtZTogMC44fSk7XG5cdHRoaXMuZ3Jvd2xTb3VuZEluZGV4ID0gKHRoaXMuZ3Jvd2xTb3VuZEluZGV4ICsgMSkgJSBncm93bFNvdW5kcztcblxuXHR0aGlzLmVtaXR0ZXIuZW1pdCgnZ3Jvd2wnLCB7XG5cdFx0eDogdGhpcy5lbGVtZW50LngsXG5cdFx0eTogdGhpcy5lbGVtZW50LnksXG5cdFx0dGFyZ2V0OiB0aGlzLnRhcmdldFxuXHR9KTtcbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLmdldFJhZGl1cyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5yYWRpdXM7XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5pc1Nob3J0QXR0YWNraW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmYWxzZTtcbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR0aGlzLm1heEhlYWx0aCA9IGxldmVsLm1vbnN0ZXJIZWFsdGg7XG5cdHRoaXMuaGVhbHRoID0gbGV2ZWwubW9uc3RlckhlYWx0aDtcblx0dGhpcy5zcGVlZCA9IGxldmVsLm1vbnN0ZXJTcGVlZDtcblx0dGhpcy5ncm93bENvb2xkb3duID0gbGV2ZWwuZ3Jvd2xDb29sZG93bjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTW9uc3RlcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9Nb25zdGVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVmVjMmQgPSByZXF1aXJlKCcuL3V0aWwvVmVjdG9yMmQnKSxcbiAgICBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi9HYW1lQ29uc3RzJyk7XG5cbnZhciBmdW5GYWN0b3IgPSAzO1xuXG4vKipcbiAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gKiBAcGFyYW0ge051bWJlcn0geVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBQbGF5ZXIgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXMucmFkaXVzID0gMzA7XG4gICAgdGhpcy5tYXhIZWFsdGggPSB0aGlzLmhlYWx0aCA9IDEwMDtcbiAgICB0aGlzLmlkID0gJ3BsYXllcic7XG4gICAgdGhpcy5hbmdsZSA9IDA7XG5cdHRoaXMuZm9vdHN0ZXBzUGxheWVkID0gMDtcblx0dGhpcy5mb290c3RlcE51bWJlciA9IDE7XG5cblx0dGhpcy5hdHRhY2tTdGFydGVkID0gMDtcbiAgICB0aGlzLnZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuICAgIHRoaXMuYm91bmNlVmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG5cbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cblx0dmFyIHNzID0gbmV3IGNyZWF0ZWpzLlNwcml0ZVNoZWV0KHtcblx0XHRcImFuaW1hdGlvbnNcIjpcblx0XHR7XG5cdFx0XHRcIndhbGtcIjoge1xuXHRcdFx0XHRmcmFtZXM6IFsxLCAyXSxcblx0XHRcdFx0bmV4dDpcIndhbGtcIixcblx0XHRcdFx0c3BlZWQ6IDAuMlxuXHRcdFx0fSxcblx0XHRcdFwid2FpdFwiOiB7XG5cdFx0XHRcdGZyYW1lczogWzBdLFxuXHRcdFx0XHRuZXh0Olwid2FpdFwiLFxuXHRcdFx0XHRzcGVlZDogMC4yXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRcImltYWdlc1wiOiBbXCIuL2ltZy9wbGF5ZXJfc3ByaXRlLnBuZ1wiXSxcblx0XHRcImZyYW1lc1wiOlxuXHRcdHtcblx0XHRcdFwiaGVpZ2h0XCI6IDEwMjQsXG5cdFx0XHRcIndpZHRoXCI6MTAyNCxcblx0XHRcdFwicmVnWFwiOiAwLFxuXHRcdFx0XCJyZWdZXCI6IDAsXG5cdFx0XHRcImNvdW50XCI6IDNcblx0XHR9XG5cdH0pO1xuXG5cdHRoaXMuc3ByaXRlID0gbmV3IGNyZWF0ZWpzLlNwcml0ZShzcywgXCJ3YWl0XCIpO1xuXG4gICAgdGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjE7XG5cdHNlbGYuZWxlbWVudC5yZWdYID0gc2VsZi5lbGVtZW50LnJlZ1kgPSA1MTI7XG5cblx0dGhpcy5lbGVtZW50LnggPSB4O1xuXHR0aGlzLmVsZW1lbnQueSA9IHk7XG5cbiAgICB0aGlzLmhhc0Z1biA9IGZhbHNlO1xuXG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuc3ByaXRlKTtcbn07XG5cblBsYXllci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdhdHRhY2snLCB0aGlzLm9uQXR0YWNrLmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ3N0YWdlbW91c2Vtb3ZlJywgdGhpcy5vbk1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdmdW4nLCB0aGlzLm9uRnVuLmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdoZWFsLW1lJywgdGhpcy5vbkhlYWxNZS5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdwbGF5ZXItd2VhcG9uLWxpZmV0aW1lJywgdGhpcy5vblBsYXllcldlYXBvbkxpZmV0aW1lLmJpbmQodGhpcykpO1xuXG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ICE9PSB0aGlzLmlkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5oYXNGdW4pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuaGVhbHRoIC09IGV2ZW50LmRhbWFnZTtcbiAgICB0aGlzLmhlYWx0aCA9IE1hdGgubWF4KDAsIHRoaXMuaGVhbHRoKTtcblxuXHRpZiAodGhpcy5oZWFsdGggPT0gMCkge1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdwbGF5ZXItZGVhZCcpO1xuXHR9XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uQXR0YWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0dGhpcy5hdHRhY2tTdGFydGVkID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG59O1xuXG5cblBsYXllci5wcm90b3R5cGUub25Nb3VzZU1vdmUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBjdXJyZW50X3NwZWVkID0gdGhpcy52ZWxvY2l0eS5sZW5ndGgoKTtcblxuICAgIHZhciBtb3VzZV9kZWx0YSA9IG5ldyBWZWMyZChcbiAgICAgICAgZXZlbnQuc3RhZ2VYIC0gR2FtZUNvbnN0cy5HQU1FX1dJRFRIIC8gMixcbiAgICAgICAgZXZlbnQuc3RhZ2VZIC0gR2FtZUNvbnN0cy5HQU1FX0hFSUdIVCAvIDJcbiAgICApO1xuXG4gICAgdGhpcy5hbmdsZSA9IFZlYzJkLmdldEFuZ2xlKG1vdXNlX2RlbHRhKTtcblxuICAgIGlmICh0aGlzLmhhc0Z1bikge1xuICAgICAgICBtb3VzZV9kZWx0YS50aW1lcyhmdW5GYWN0b3IpO1xuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnaGFzLWZ1bicsIHt4OiB0aGlzLmVsZW1lbnQueCwgeTogdGhpcy5lbGVtZW50Lnl9KTtcbiAgICB9XG5cbiAgICBpZiAobW91c2VfZGVsdGEubGVuZ3RoKCkgPCA2MCkge1xuICAgICAgICB0aGlzLnZlbG9jaXR5LnggPSAwO1xuICAgICAgICB0aGlzLnZlbG9jaXR5LnkgPSAwO1xuXG4gICAgICAgIGlmIChjdXJyZW50X3NwZWVkKSB7XG4gICAgICAgICAgICB0aGlzLnNwcml0ZS5nb3RvQW5kUGxheSgnd2FpdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZihjdXJyZW50X3NwZWVkID09IDApIHtcbiAgICAgICAgdGhpcy5zcHJpdGUuZ290b0FuZFBsYXkoJ3dhbGsnKTtcbiAgICB9XG5cbiAgICB0aGlzLnZlbG9jaXR5ID0gbW91c2VfZGVsdGE7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uRnVuID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmhhc0Z1biA9IGV2ZW50LnN0YXR1cztcbn07XG5cblBsYXllci5wcm90b3R5cGUub25IZWFsTWUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuaGVhbHRoID0gdGhpcy5tYXhIZWFsdGg7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uUGxheWVyV2VhcG9uTGlmZXRpbWUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICghdGhpcy53ZWFwb24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMud2VhcG9uLmxpZmV0aW1lID0gMTAwMDAwMDtcbiAgICB0aGlzLndlYXBvbi50cmlnZ2VyVXBkYXRlKCk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSBldmVudFxuICovXG5QbGF5ZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBkZWx0YSA9IFZlYzJkLm11bHRpcGx5KHRoaXMudmVsb2NpdHksIGV2ZW50LmRlbHRhIC8gMTAwMCk7XG5cbiAgICBpZiAodGhpcy5ib3VuY2VWZWxvY2l0eS5sZW5ndGgoKSAhPSAwKSB7XG4gICAgICAgIHZhciBwdXNoX2RlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy5ib3VuY2VWZWxvY2l0eS5jbG9uZSgpLCBldmVudC5kZWx0YSAvIDgwKTtcbiAgICAgICAgdGhpcy5ib3VuY2VWZWxvY2l0eSA9IHRoaXMuYm91bmNlVmVsb2NpdHkubWludXMocHVzaF9kZWx0YSk7XG5cbiAgICAgICAgZGVsdGEucGx1cyhwdXNoX2RlbHRhKTtcblxuICAgICAgICBpZiAocHVzaF9kZWx0YS5sZW5ndGgoKSA8IDEpIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmNlVmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVsZW1lbnQueCArPSBkZWx0YS54O1xuICAgIHRoaXMuZWxlbWVudC55ICs9IGRlbHRhLnk7XG5cbiAgICB0aGlzLmVsZW1lbnQueCA9IE1hdGgubWluKEdhbWVDb25zdHMuU0laRSwgTWF0aC5tYXgoLUdhbWVDb25zdHMuU0laRSwgdGhpcy5lbGVtZW50LngpKTtcbiAgICB0aGlzLmVsZW1lbnQueSA9IE1hdGgubWluKEdhbWVDb25zdHMuU0laRSwgTWF0aC5tYXgoLUdhbWVDb25zdHMuU0laRSwgdGhpcy5lbGVtZW50LnkpKTtcblxuICAgIHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IHRoaXMuYW5nbGU7XG5cblx0Ly8gY2hhbmdlIHNwZWVkIG9mIGFuaW1hdGlvblxuICAgIHRoaXMuc3ByaXRlLmZyYW1lcmF0ZSA9IGRlbHRhLmxlbmd0aCgpICogNjtcblxuICAgIGlmICh0aGlzLndlYXBvbikge1xuICAgICAgICBpZiAoIXRoaXMud2VhcG9uLmVxdWlwcGVkKSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy53ZWFwb24uZWxlbWVudCk7XG4gICAgICAgICAgICB0aGlzLndlYXBvbiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgndW5lcXVpcCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGF0dGFja1N0YXJ0ZWREaWZmID0gZXZlbnQudGltZVN0YW1wIC0gdGhpcy5hdHRhY2tTdGFydGVkO1xuICAgICAgICAgICAgaWYgKGF0dGFja1N0YXJ0ZWREaWZmIDwgNTAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50LnJvdGF0aW9uID0gTWF0aC5yb3VuZCh0aGlzLmVsZW1lbnQucm90YXRpb24gKyAxMDgwIC8gNTAwICogYXR0YWNrU3RhcnRlZERpZmYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLndlYXBvbi50aWNrKGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuXHRpZiAodGhpcy52ZWxvY2l0eS5sZW5ndGgoKSA+IDAgJiYgKGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMuZm9vdHN0ZXBzUGxheWVkKSA+IDQ1MDAwIC8gdGhpcy52ZWxvY2l0eS5sZW5ndGgoKSkge1xuXHRcdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2Zvb3RzdGVwJyArIHRoaXMuZm9vdHN0ZXBOdW1iZXIsIHt2b2x1bWU6IDAuNn0pO1xuXHRcdHRoaXMuZm9vdHN0ZXBzUGxheWVkID0gZXZlbnQudGltZVN0YW1wO1xuXHRcdHRoaXMuZm9vdHN0ZXBOdW1iZXIgPSAodGhpcy5mb290c3RlcE51bWJlciArIDEpICUgMjtcblx0fVxufTtcblxuUGxheWVyLnByb3RvdHlwZS5lcXVpcCA9IGZ1bmN0aW9uKHdlYXBvbikge1xuICAgIHdlYXBvbi5lcXVpcCgpO1xuICAgIHRoaXMud2VhcG9uID0gd2VhcG9uO1xuICAgIHRoaXMud2VhcG9uLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHdlYXBvbi5lbGVtZW50KTtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnZXF1aXAnLCB7XG4gICAgICAgIGlkOiB0aGlzLndlYXBvbi5pZCxcbiAgICAgICAgbGlmZXRpbWU6IHRoaXMud2VhcG9uLmxpZmV0aW1lXG4gICAgfSlcbn07XG5cblBsYXllci5wcm90b3R5cGUuZ2V0UmFkaXVzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmlzU2hvcnRBdHRhY2tpbmcoKSkge1xuICAgICAgICBpZiAodGhpcy53ZWFwb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5yYWRpdXM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5yYWRpdXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmFkaXVzO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5pc1Nob3J0QXR0YWNraW5nID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFzRnVuKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLndlYXBvbiAmJiB0aGlzLndlYXBvbi5pZCA9PSAnc2hvcnQtd2VhcG9uJyAmJiB0aGlzLndlYXBvbi5pc0FjdGl2ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuICAgIHRoaXMubWF4SGVhbHRoID0gbGV2ZWwucGxheWVySGVhbHRoO1xuICAgIHRoaXMuaGVhbHRoID0gbGV2ZWwucGxheWVySGVhbHRoO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5ZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvUGxheWVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyO1xuXG5mdW5jdGlvbiBQcmVsb2FkZXIoKSB7XG5cdHRoaXMucXVldWUgPSBuZXcgY3JlYXRlanMuTG9hZFF1ZXVlKCk7XG5cdHRoaXMucXVldWUuaW5zdGFsbFBsdWdpbihjcmVhdGVqcy5Tb3VuZCk7XG59XG5cblByZWxvYWRlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGZpbGVzKSB7XG5cdHRoaXMucXVldWUubG9hZE1hbmlmZXN0KGZpbGVzKTtcbn07XG5cblByZWxvYWRlci5wcm90b3R5cGUub25Db21wbGV0ZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdHRoaXMucXVldWUub24oJ2NvbXBsZXRlJywgY2FsbGJhY2spO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcmVsb2FkZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvUHJlbG9hZGVyLmpzXCIsXCIvXCIpIiwibW9kdWxlLmV4cG9ydHM9W1xuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImZpcmViYWxsXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZmlyZWJhbGwucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdhbWVvdmVyXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZ2FtZW92ZXIucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdyYXNzXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZ3Jhc3MucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1vbnN0ZXJcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9tb25zdGVyLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJuaWdodG1vZGVcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9uaWdodG1vZGUucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInBsYXllclwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3BsYXllci5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwicGxheWVyX3Nwcml0ZVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3BsYXllcl9zcHJpdGUucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInBvb2ZcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9wb29mLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJzY2h3ZXJ0XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvc2Nod2VydC5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwidHJlZVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3RyZWUucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImJhY2tncm91bmRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9iYWNrZ3JvdW5kLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJkZWZlYXRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9kZWZlYXQubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImZvb3RzdGVwMFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2Zvb3RzdGVwMC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZm9vdHN0ZXAxXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZm9vdHN0ZXAxLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJmdW5cIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9mdW4ubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdpcmwtaHVydFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2dpcmwtaHVydC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZ3Jvd2wwXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZ3Jvd2wwLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJncm93bDFcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9ncm93bDEubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdyb3dsMlwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2dyb3dsMi5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibGF1bmNoLWZpcmViYWxsXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbGF1bmNoLWZpcmViYWxsLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzBcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzAubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljMVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljMS5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWMyXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWMyLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzNcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzMubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljNFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljNC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWM1XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWM1Lm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtb25zdGVyLWh1cnRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tb25zdGVyLWh1cnQubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInN3aW5nMVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL3N3aW5nMS5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwidmljdG9yeVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL3ZpY3RvcnkubXAzXCJcbiAgICB9XG5dIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgR2FtZSA9IHJlcXVpcmUoJy4vZ2FtZScpLFxuXHRQcmVsb2FkZXIgPSByZXF1aXJlKCcuL1ByZWxvYWRlcicpLFxuXHRhc3NldHMgPSByZXF1aXJlKCcuL2Fzc2V0cycpO1xuXG52YXIgcHJlbG9hZGVyID0gbmV3IFByZWxvYWRlcigpO1xudmFyIGdhbWUgPSBuZXcgR2FtZSgnZ2FtZV9jYW52YXMnKTtcbmdhbWUuaW5pdCgpO1xuXG5wcmVsb2FkZXIub25Db21wbGV0ZShmdW5jdGlvbigpIHtcblx0Z2FtZS5hc3NldHNSZWFkeSgpO1xufSk7XG5cbnByZWxvYWRlci5sb2FkKGFzc2V0cyk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZmFrZV80MjQ0MWMxLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyLFxuICAgIEdhbWVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvR2FtZVNjcmVlbicpLFxuICAgIE1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbicpLFxuICAgIEhvbWVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvSG9tZVNjcmVlbicpLFxuICAgIFN0b3J5U2NyZWVuID0gcmVxdWlyZSgnLi9zY3JlZW5zL1N0b3J5U2NyZWVuJyksXG4gICAgR2FtZU92ZXJTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvR2FtZU92ZXJTY3JlZW4nKTtcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgR2FtZSA9IGZ1bmN0aW9uKGdhbWVDYW52YXNJZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXMuZW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICB0aGlzLnN0YWdlID0gbmV3IGNyZWF0ZWpzLlN0YWdlKGdhbWVDYW52YXNJZCk7XG5cbiAgICB0aGlzLnN0YWdlLm1vdXNlQ2hpbGRyZW4gPSBmYWxzZTtcbiAgICB0aGlzLnN0YWdlLm1vdXNlRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5nYW1lU2NyZWVuID0gbmV3IEdhbWVTY3JlZW4odGhpcy5zdGFnZSk7XG4gICAgdGhpcy5nYW1lT3ZlclNjcmVlbiA9IG5ldyBHYW1lT3ZlclNjcmVlbigpO1xuICAgIHRoaXMubWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbiA9IG5ldyBNYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuKCk7XG4gICAgdGhpcy5ob21lU2NyZWVuID0gbmV3IEhvbWVTY3JlZW4oKTtcbiAgICB0aGlzLnN0b3J5U2NyZWVuID0gbmV3IFN0b3J5U2NyZWVuKCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLmdhbWVTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLmdhbWVPdmVyU2NyZWVuLmVsZW1lbnQpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5tYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLmVsZW1lbnQpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5ob21lU2NyZWVuLmVsZW1lbnQpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5zdG9yeVNjcmVlbi5lbGVtZW50KTtcblxuICAgIHRoaXMuZ2FtZVNjcmVlbi5yZWdpc3RlckV2ZW50KHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuXG4gICAgY3JlYXRlanMuVGlja2VyLnNldEZQUyg2MCk7XG4gICAgY3JlYXRlanMuVGlja2VyLnNldFBhdXNlZCh0cnVlKTtcbiAgICBjcmVhdGVqcy5UaWNrZXIuYWRkRXZlbnRMaXN0ZW5lcigndGljaycsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHNlbGYudGljayhldmVudCk7XG4gICAgfSk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdwbGF5ZXItZGVhZCcsIHRoaXMub25HYW1lT3Zlci5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdtb25zdGVyLWRlYWQnLCB0aGlzLm9uTmV4dENhc3RsZVNjcmVlbi5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuc3RhZ2Uub24oJ3N0YWdlbW91c2Vtb3ZlJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgZW1pdHRlci5lbWl0KCdzdGFnZW1vdXNlbW92ZScsIGV2ZW50KTtcbiAgICB9KTtcbn07XG5cbkdhbWUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmhvbWVTY3JlZW4uc3RhcnQoKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLmFzc2V0c1JlYWR5ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5ob21lU2NyZWVuLmlzUmVhZHkoKTtcbiAgICB0aGlzLnN0YWdlLm9uKCdzdGFnZW1vdXNldXAnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5ob21lU2NyZWVuLnJlc2V0KCk7XG4gICAgICAgIHRoaXMuc3RhcnROZXdnYW1lKCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLnN0YXJ0TmV3Z2FtZSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZG9TdGFydCh0cnVlKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLmRvU3RhcnQgPSBmdW5jdGlvbihuZXdHYW1lKSB7XG4gICAgdGhpcy5zdG9yeVNjcmVlbi5zdGFydCgndGVzdCcsICdtZScpO1xuICAgIHRoaXMuc3RhZ2Uub24oJ3N0YWdlbW91c2V1cCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnN0b3J5U2NyZWVuLnJlc2V0KCk7XG4gICAgICAgIHRoaXMuc3RhcnQobmV3R2FtZSk7XG5cbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ3N0YXJ0LWxldmVsJywgdHJ1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jaGFuZ2VTY3JlZW4oKTtcblxuICAgIHRoaXMuZ2FtZVNjcmVlbi5zdGFydCgpO1xuXG4gICAgY3JlYXRlanMuVGlja2VyLnNldFBhdXNlZChmYWxzZSk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5vbk5leHRDYXN0bGVTY3JlZW4gPSBmdW5jdGlvbihldmVudCkge1xuICAgIGNyZWF0ZWpzLlRpY2tlci5zZXRQYXVzZWQodHJ1ZSk7XG4gICAgdGhpcy5nYW1lU2NyZWVuLnJlc2V0KCk7XG4gICAgdGhpcy5jaGFuZ2VTY3JlZW4oKTtcblxuICAgIHRoaXMubWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5zdGFydCgpO1xuICAgIHRoaXMuc3RhZ2Uub24oJ3N0YWdlbW91c2V1cCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4ucmVzZXQoKTtcbiAgICAgICAgdGhpcy5kb1N0YXJ0KGZhbHNlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuR2FtZS5wcm90b3R5cGUub25HYW1lT3ZlciA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgY3JlYXRlanMuVGlja2VyLnNldFBhdXNlZCh0cnVlKTtcbiAgICB0aGlzLmdhbWVTY3JlZW4ucmVzZXQoKTtcbiAgICB0aGlzLmNoYW5nZVNjcmVlbigpO1xuXG4gICAgdGhpcy5nYW1lT3ZlclNjcmVlbi5zdGFydCgpO1xuICAgIHRoaXMuc3RhZ2Uub24oJ3N0YWdlbW91c2V1cCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmdhbWVPdmVyU2NyZWVuLnJlc2V0KCk7XG4gICAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2dhbWUtb3ZlcicpO1xuXG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLmNoYW5nZVNjcmVlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZW1pdHRlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnN0YWdlLnJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzKCk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xufTtcblxuR2FtZS5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5zdGFnZS51cGRhdGUoZXZlbnQpO1xuXG5cdGlmIChldmVudC5wYXVzZWQpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuICAgIHRoaXMuZ2FtZVNjcmVlbi50aWNrKGV2ZW50KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR2FtZTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9nYW1lLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbnVtUGV0YWxzID0gMTI7XG5cbnZhciBGbG93ZXIgPSBmdW5jdGlvbih4LCB5LCBjb2xvcikge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5lbGVtZW50LnggPSB4O1xuXHR0aGlzLmVsZW1lbnQueSA9IHk7XG5cdHRoaXMuZWxlbWVudC5zY2FsZVggPSB0aGlzLmVsZW1lbnQuc2NhbGVZID0gMC4xO1xuXG5cdGZvcih2YXIgbiA9IDA7IG4gPCBudW1QZXRhbHM7IG4rKykge1xuXHRcdHZhciBwZXRhbCA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXG5cdFx0cGV0YWwuZ3JhcGhpY3Ncblx0XHRcdC5iZWdpbkZpbGwoJyNmZjAnKVxuXHRcdFx0LmRyYXdDaXJjbGUoMCwgMCwgMjApXG5cdFx0XHQvLy5iZWdpblN0cm9rZSgnI2ZmZicpXG5cdFx0XHQuc2V0U3Ryb2tlU3R5bGUoMylcblx0XHRcdC5iZWdpbkZpbGwoY29sb3IpXG5cdFx0XHQubW92ZVRvKC01LCAtMjApXG5cdFx0XHQuYmV6aWVyQ3VydmVUbygtNDAsIC05MCwgNDAsIC05MCwgNSwgLTIwKVxuXHRcdFx0LmNsb3NlUGF0aCgpO1xuXHRcdHBldGFsLnJvdGF0aW9uID0gMzYwICogbiAvIG51bVBldGFscztcblxuXHRcdHRoaXMuZWxlbWVudC5hZGRDaGlsZChwZXRhbCk7XG5cdH1cblxuXHQvL3RoaXMuZWxlbWVudC5jYWNoZSgtMTAwLCAtMTAwLCAyMDAsIDIwMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsb3dlcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL0Zsb3dlci5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEdhbWVDb25zdHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyksXG5cdFBzZXVkb1JhbmQgPSByZXF1aXJlKCcuLi91dGlsL1BzZXVkb1JhbmQnKSxcblx0VHJlZSA9IHJlcXVpcmUoJy4vVHJlZScpLFxuXHRGbG93ZXIgPSByZXF1aXJlKCcuL0Zsb3dlcicpO1xuXG52YXIgR3JvdW5kID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMucHNldWRvUmFuZG9tID0gbmV3IFBzZXVkb1JhbmQoKTtcblxuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cdHRoaXMuZWxlbWVudC5tb3VzZUNoaWxkcmVuID0gZmFsc2U7XG5cdHRoaXMuZWxlbWVudC5tb3VzZUVuYWJsZWQgPSBmYWxzZTtcblx0dGhpcy5zaGFwZSA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXG5cdHRoaXMuZGVjb3JhdGlvbnMgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cblx0dGhpcy50cmVlQ291bnQgPSAwO1xuXHR0aGlzLmZsb3dlckNvdW50ID0gMDtcblxuXHR2YXIgaW1nID0gbmV3IEltYWdlKCk7XG5cdGltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnNoYXBlLmdyYXBoaWNzXG5cdFx0XHQuYmVnaW5CaXRtYXBGaWxsKGltZywgJ3JlcGVhdCcpXG5cdFx0XHQuZHJhd1JlY3QoMCwgMCwgR2FtZUNvbnN0cy5TSVpFICogMiwgR2FtZUNvbnN0cy5TSVpFICogMik7XG5cdH0uYmluZCh0aGlzKTtcblx0aW1nLnNyYyA9ICcuL2ltZy9ncmFzcy5wbmcnO1xuXG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLnNoYXBlKTtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZGVjb3JhdGlvbnMpO1xuXHR0aGlzLmVsZW1lbnQueCA9IC1HYW1lQ29uc3RzLlNJWkU7XG5cdHRoaXMuZWxlbWVudC55ID0gLUdhbWVDb25zdHMuU0laRTtcbn07XG5cbkdyb3VuZC5wcm90b3R5cGUuc3Bhd25GbG93ZXJzID0gZnVuY3Rpb24oKSB7XG5cdHZhciB4LCB5LCBjb2xvciwgaTtcblxuXHR2YXIgY29sb3JzID0gWycjZjMzJywgJyM4OGYnLCAnI2Y3MCcsICcjZjBmJywgJyNkZGYnXTtcblxuXHRmb3IgKGkgPSAwOyBpIDw9IHRoaXMuZmxvd2VyQ291bnQ7IGkrKykge1xuXHRcdHggPSB0aGlzLnBzZXVkb1JhbmRvbS5nZXRSYW5kb20oKSAlIEdhbWVDb25zdHMuU0laRSAqIDI7XG5cdFx0eSA9IHRoaXMucHNldWRvUmFuZG9tLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0cy5TSVpFICogMjtcblx0XHRjb2xvciA9IGNvbG9yc1soTWF0aC5yYW5kb20oKSAqIGNvbG9ycy5sZW5ndGggfCAwKV07XG5cblx0XHR0aGlzLmRlY29yYXRpb25zLmFkZENoaWxkKG5ldyBGbG93ZXIoeCwgeSwgY29sb3IpLmVsZW1lbnQpO1xuXHR9XG59O1xuXG5Hcm91bmQucHJvdG90eXBlLnNwYXduVHJlZXMgPSBmdW5jdGlvbigpIHtcblx0dmFyIHgsIHksIHIsIGk7XG5cblx0Zm9yIChpID0gMDsgaSA8PSB0aGlzLnRyZWVDb3VudDsgaSsrKSB7XG5cdFx0eCA9IHRoaXMucHNldWRvUmFuZG9tLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0cy5TSVpFICogMjtcblx0XHR5ID0gdGhpcy5wc2V1ZG9SYW5kb20uZ2V0UmFuZG9tKCkgJSBHYW1lQ29uc3RzLlNJWkUgKiAyO1xuXHRcdHIgPSA3MCArIHRoaXMucHNldWRvUmFuZG9tLmdldFJhbmRvbSgpICUgMTAwO1xuXG5cdFx0dGhpcy5kZWNvcmF0aW9ucy5hZGRDaGlsZChuZXcgVHJlZSh4LCB5LCByKS5lbGVtZW50KTtcblx0fVxufTtcblxuR3JvdW5kLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxuR3JvdW5kLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy5wc2V1ZG9SYW5kb20uc2V0U2VlZChsZXZlbC5pdGVtU2VlZCk7XG5cdHRoaXMudHJlZUNvdW50ID0gbGV2ZWwudHJlZXM7XG5cdHRoaXMuZmxvd2VyQ291bnQgPSBsZXZlbC50cmVlcyAqIDIwO1xuXG5cdGlmIChHYW1lQ29uc3RzLkRSQVdfRkxPV0VSUykge1xuXHRcdHRoaXMuc3Bhd25GbG93ZXJzKCk7XG5cdFx0dGhpcy5zcGF3blRyZWVzKCk7XG5cblx0XHR0aGlzLmRlY29yYXRpb25zLmNhY2hlKDAsIDAsIEdhbWVDb25zdHMuU0laRSAqIDIsIEdhbWVDb25zdHMuU0laRSAqIDIpO1xuXHRcdHRoaXMuZGVjb3JhdGlvbnMucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLnNwYXduVHJlZXMoKTtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcm91bmQ7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL0dyb3VuZC5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFJhaW5ib3dSb2FkKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5oYXNGYW4gPSAwO1xufVxuXG5SYWluYm93Um9hZC5wcm90b3R5cGUucGFpbnQgPSBmdW5jdGlvbihldmVudCkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKykge1xuXHRcdHRoaXMuc3Bhd25KdWljeVN0YXIoZXZlbnQueCwgZXZlbnQueSk7XG5cdH1cbn07XG5cblJhaW5ib3dSb2FkLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAvLyByZW1vdmUgb2xkIHBhaW50aW5nc1xufTtcblxuUmFpbmJvd1JvYWQucHJvdG90eXBlLnNwYXduSnVpY3lTdGFyID0gZnVuY3Rpb24oeCwgeSkge1xuXHR2YXIgc2l6ZSA9IDggKyA3ICogTWF0aC5yYW5kb20oKTtcblxuXHR2YXIgc3RhciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXHRzdGFyLnggPSB4IC0gMTUgKyAzMCAqIE1hdGgucmFuZG9tKCk7XG5cdHN0YXIueSA9IHkgLSAxNSArIDMwICogTWF0aC5yYW5kb20oKTtcblx0c3Rhci5yb3RhdGlvbiA9IHBhcnNlSW50KE1hdGgucmFuZG9tKCkgKiAzNjApO1xuXHRzdGFyLmdyYXBoaWNzLmJlZ2luU3Ryb2tlKFwiI2YwZlwiKS5iZWdpbkZpbGwoJyNmZjAnKS5zZXRTdHJva2VTdHlsZSgxKS5kcmF3UG9seVN0YXIoMCwgMCwgc2l6ZSAvIDIsIDUsIDAuNikuY2xvc2VQYXRoKCk7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChzdGFyKTtcblxuXHRjcmVhdGVqcy5Ud2Vlbi5nZXQoc3Rhcilcblx0XHQudG8oe2FscGhhOiAwLCByb3RhdGlvbjogc3Rhci5yb3RhdGlvbiArIDE4MH0sIDUwMCArIDUwMCAqIE1hdGgucmFuZG9tKCksIGNyZWF0ZWpzLkVhc2UubGluZWFyKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHN0YXIpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJhaW5ib3dSb2FkO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2dyb3VuZC9SYWluYm93Um9hZC5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFRyZWUgPSBmdW5jdGlvbih4LCB5LCByKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG4gICAgdmFyIGJpdG1hcCA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoXCIuL2ltZy90cmVlLnBuZ1wiKTtcbiAgICBiaXRtYXAueCA9IHg7XG4gICAgYml0bWFwLnkgPSB5O1xuICAgIGJpdG1hcC5zY2FsZVggPSBiaXRtYXAuc2NhbGVZID0gciAvIDEwMDtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoYml0bWFwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVHJlZTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL1RyZWUuanNcIixcIi9ncm91bmRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbWVzc2FnZXMgPSBbXG4gICAgJ1RyeWluZyB0byBmaWdodCB0aGUgaW1wb3NzaWJsZT8nLFxuICAgICcjY2hlYXRlcmdhdGUnLFxuICAgICdZIFUgbjAwYj8nLFxuICAgICdUaGlzIHdvbnQgaGVscCB5b3UhJyxcbiAgICAnRXZlciBoZWFyZCBvZiAjZmFpcnBsYXk/JyxcbiAgICAnQXJlIHdlIHRyeWluZyB0byBiZSBnb2Q/J1xuXTtcblxudmFyIFJhbmQgPSByZXF1aXJlKCcuLi91dGlsL1BzZXVkb1JhbmQnKSxcbiAgICBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIENoZWF0ZXJCYXIoKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuZWxlbWVudC54ID0gY29uc3RhbnRzLkdBTUVfV0lEVEggLyAyIC0gOTU7XG4gICAgdGhpcy5lbGVtZW50LnkgPSAyMDA7XG5cbiAgICB0aGlzLnJhbmQgPSBuZXcgUmFuZCgpO1xuICAgIHRoaXMucmFuZC5zZXRTZWVkKG5ldyBEYXRlKCkuZ2V0VGltZSgpKTtcbn1cblxuQ2hlYXRlckJhci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignY2hlYXRlcicsIHRoaXMub25DaGVhdGVyLmJpbmQodGhpcykpO1xufTtcblxuQ2hlYXRlckJhci5wcm90b3R5cGUub25DaGVhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHQgPSBtZXNzYWdlc1t0aGlzLnJhbmQuZ2V0UmFuZG9tKCkgJSBtZXNzYWdlcy5sZW5ndGhdO1xuICAgIHZhciBtZXNzYWdlID0gbmV3IGNyZWF0ZWpzLlRleHQodGV4dCwgJzMwcHggS29taWthJywgXCIjZmZmXCIpO1xuICAgIG1lc3NhZ2UueCA9IDk1IC0gbWVzc2FnZS5nZXRNZWFzdXJlZFdpZHRoKCkgLyAyO1xuICAgIG1lc3NhZ2UueSA9IDE1MDtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQobWVzc2FnZSk7XG5cbmNyZWF0ZWpzLlR3ZWVuLmdldChtZXNzYWdlKVxuICAgICAgICAudG8oe3k6IDAsIGFscGhhOiAwfSwgMjUwMCwgY3JlYXRlanMuRWFzZS5saW5lYXIpXG4gICAgICAgIC5jYWxsKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQobWVzc2FnZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENoZWF0ZXJCYXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaHVkL0NoZWF0ZXJCYXIuanNcIixcIi9odWRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgYXV0b0RlY3JlYXNlUGVyU2Vjb25kID0gMC41O1xudmFyIG1heFdpZHRoID0gMjQwO1xudmFyIGp1aWN5U3RhckNvdW50ID0gMTU7XG52YXIgbWF4TWFnaWNMZXZlbCA9IDU7XG5cbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIEZ1bkJhcigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5lbGVtZW50LnggPSBjb25zdGFudHMuR0FNRV9XSURUSCAvIDIgLSA5NTtcblx0dGhpcy5lbGVtZW50LnkgPSAxMDtcbiAgICB0aGlzLmN1cnJlbnQgPSAwO1xuXHR0aGlzLmxhc3RJbmNyZWFzZSA9IDA7XG4gICAgdGhpcy5ib3JkZXIgPSBuZXcgY3JlYXRlanMuU2hhcGUoKTtcbiAgICB0aGlzLmJvcmRlci5ncmFwaGljcy5iZWdpbkZpbGwoXCIjMzMzXCIpLmRyYXdSZWN0KDAsIDAsIDI1MCwgNTApO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmJvcmRlcik7XG5cblx0dGhpcy5tYXhGdW5WYWx1ZSA9IDA7XG5cdHRoaXMuZnVuVGltZSA9IDA7XG5cbiAgICB0aGlzLmZpbGwgPSBuZXcgY3JlYXRlanMuU2hhcGUoKTtcbiAgICB0aGlzLmRyYXdGaWxsKCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZmlsbCk7XG5cblx0dGhpcy5pc0Z1blRpbWUgPSBmYWxzZTtcblx0dGhpcy5pc0Z1blRpbWVSZXNldCA9IHRydWU7XG5cblx0dGhpcy5mdW5UZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJGdW5cIiwgXCIyNHB4IEtvbWlrYVwiLCBcIiNmZmZcIik7XG5cdHRoaXMuZnVuVGV4dC54ID0gLTYwO1xuXHR0aGlzLmZ1blRleHQueSA9IDM7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmZ1blRleHQpO1xuXG5cdHRoaXMuZnVuQmFyVGV4dCA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiMC4wXCIsIFwiMjVweCBLb21pa2FcIiwgJyNmZmYnKTtcblx0dGhpcy5mdW5CYXJUZXh0LnggPSA5MDtcblx0dGhpcy5mdW5CYXJUZXh0LnkgPSAxO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5mdW5CYXJUZXh0KTtcbn1cblxuRnVuQmFyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ2NvbWJvJywgdGhpcy5vbkNvbWJvLmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdmb3JjZS1mdW4nLCB0aGlzLm9uRm9yY2VGdW4uYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcblxuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmhpdFRhcmdldCA9PSAncGxheWVyJykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cdHRoaXMuaW5jcmVhc2UoMSk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLm9uQ29tYm8gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuaW5jcmVhc2UoZXZlbnQubGV2ZWwpO1xuXHR0aGlzLnNwYXduQ29tYm9NZXNzYWdlKGV2ZW50LmxldmVsKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUuaW5jcmVhc2UgPSBmdW5jdGlvbih2YWx1ZSkge1xuXHR0aGlzLmN1cnJlbnQgKz0gdmFsdWU7XG5cdGlmICh0aGlzLmN1cnJlbnQgPj0gdGhpcy5tYXhGdW5WYWx1ZSAmJiB0aGlzLmlzRnVuVGltZSA9PSBmYWxzZSkge1xuXHRcdHRoaXMuY2FuRnVuVGltZSA9IHRydWU7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ2Z1bicsIHtzdGF0dXM6IDF9KTtcblx0fVxuXG5cdHRoaXMuY3VycmVudCA9IE1hdGgubWluKHRoaXMuY3VycmVudCwgdGhpcy5tYXhGdW5WYWx1ZSk7XG5cblx0dGhpcy5sYXN0SW5jcmVhc2UgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGp1aWN5U3RhckNvdW50ICsgMTsgaSsrKSB7XG5cdFx0dGhpcy5zcGF3bkp1aWN5U3Rhcig1ICsgdGhpcy5nZXRNYXhPZmZzZXRPbkJhcigpIC8ganVpY3lTdGFyQ291bnQgKiBpIC0gMjAgKyA0MCAqIE1hdGgucmFuZG9tKCksIDUwICogTWF0aC5yYW5kb20oKSwgNDApO1xuXHR9XG5cblx0dmFyIG1hZ2ljTGV2ZWwgPSBNYXRoLm1pbihtYXhNYWdpY0xldmVsLCB2YWx1ZSk7XG5cdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ21hZ2ljJyArIG1hZ2ljTGV2ZWwpO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5vbkZvcmNlRnVuID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaW5jcmVhc2UodGhpcy5tYXhGdW5WYWx1ZSk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmN1cnJlbnQgPiAwKSB7XG5cdFx0aWYgKHRoaXMuaXNGdW5UaW1lICYmIGV2ZW50LnRpbWVTdGFtcCA8IHRoaXMuZnVuVGltZUVuZCkge1xuXHRcdFx0dGhpcy5zcGF3bkp1aWN5U3Rhcig1ICsgdGhpcy5nZXRNYXhPZmZzZXRPbkJhcigpICogTWF0aC5yYW5kb20oKSAtIDIwICsgNDAgKiBNYXRoLnJhbmRvbSgpLCA1MCAqIE1hdGgucmFuZG9tKCksIDQwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pc0Z1blRpbWUgPSBmYWxzZTtcblxuXHRcdFx0aWYgKCF0aGlzLmlzRnVuVGltZVJlc2V0KSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudCA9IDA7XG5cdFx0XHRcdHRoaXMuaXNGdW5UaW1lUmVzZXQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmVtaXR0ZXIuZW1pdCgnZnVuJywge3N0YXR1czogMH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmN1cnJlbnQgLT0gKGV2ZW50LmRlbHRhIC8gMTAwMCkgKiBhdXRvRGVjcmVhc2VQZXJTZWNvbmQ7XG5cdFx0XHR0aGlzLmN1cnJlbnQgPSBNYXRoLm1heCh0aGlzLmN1cnJlbnQsIDApO1xuXG5cdFx0XHR2YXIgbGFzdEluY3JlYXNlRGlmZiA9IGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMubGFzdEluY3JlYXNlO1xuXHRcdFx0aWYgKGxhc3RJbmNyZWFzZURpZmYgPCAxMDAwKSB7XG5cdFx0XHRcdC8vIGZhZGUgZnJvbSByZ2IoMjU1LCAwLCAyNTUpIHRvIHJnYigyNTUsIDI1NSwgMClcblx0XHRcdFx0dGhpcy5kcmF3RmlsbCgncmdiKDI1NSwgJyArIE1hdGgucm91bmQoMjU1IC8gMTAwMCAqIGxhc3RJbmNyZWFzZURpZmYpICsgJywgJyArIE1hdGgucm91bmQoMjU1IC0gMjU1IC8gMTAwMCAqIGxhc3RJbmNyZWFzZURpZmYpICsgJyknKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZHJhd0ZpbGwoKTtcblx0XHRcdH1cblx0XHR9XG4gICAgfVxuXG5cdHRoaXMuZnVuQmFyVGV4dC50ZXh0ID0gKE1hdGgucm91bmQodGhpcy5jdXJyZW50ICogMTApIC8gMTApLnRvRml4ZWQoMSkgKyAnLycgKyB0aGlzLm1heEZ1blZhbHVlO1xuXG5cdGlmICh0aGlzLmNhbkZ1blRpbWUpIHtcblx0XHR0aGlzLmlzRnVuVGltZSA9IHRydWU7XG5cdFx0dGhpcy5jYW5GdW5UaW1lID0gZmFsc2U7XG5cdFx0dGhpcy5pc0Z1blRpbWVSZXNldCA9IGZhbHNlO1xuXHRcdHRoaXMuZnVuVGltZUVuZCA9IGV2ZW50LnRpbWVTdGFtcCArIHRoaXMuZnVuVGltZTtcblx0fVxufTtcblxuRnVuQmFyLnByb3RvdHlwZS5nZXRNYXhPZmZzZXRPbkJhciA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gKHRoaXMuY3VycmVudCAvIHRoaXMubWF4RnVuVmFsdWUpICogbWF4V2lkdGg7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLmRyYXdGaWxsID0gZnVuY3Rpb24oY29sb3IpIHtcblx0Y29sb3IgPSAoY29sb3IgPT09IHVuZGVmaW5lZCkgPyAnI2ZmMCcgOiBjb2xvcjtcbiAgICB0aGlzLmZpbGwuZ3JhcGhpY3MuY2xlYXIoKS5iZWdpbkZpbGwoY29sb3IpLmRyYXdSZWN0KDUsIDUsICh0aGlzLmN1cnJlbnQgLyB0aGlzLm1heEZ1blZhbHVlKSAqIG1heFdpZHRoLCA0MCk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLnNwYXduSnVpY3lTdGFyID0gZnVuY3Rpb24oeCwgeSwgc2l6ZSkge1xuXHRzaXplICo9ICgwLjggKyAwLjQgKiBNYXRoLnJhbmRvbSgpKTtcblxuXHR2YXIgc3RhciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXHRzdGFyLnggPSB4O1xuXHRzdGFyLnkgPSB5O1xuXHRzdGFyLnJvdGF0aW9uID0gcGFyc2VJbnQoTWF0aC5yYW5kb20oKSAqIDM2MCk7XG5cdHN0YXIuZ3JhcGhpY3MuYmVnaW5TdHJva2UoXCIjZjBmXCIpLmJlZ2luRmlsbCgnI2ZmMCcpLnNldFN0cm9rZVN0eWxlKDIpLmRyYXdQb2x5U3RhcigwLCAwLCBzaXplIC8gMiAtIDE1LCA1LCAwLjYpLmNsb3NlUGF0aCgpO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoc3Rhcik7XG5cblx0Y3JlYXRlanMuVHdlZW4uZ2V0KHN0YXIpXG5cdFx0LnRvKHt5OiB5ICsgMjAwLCBhbHBoYTogMCwgcm90YXRpb246IHN0YXIucm90YXRpb24gKyAxODB9LCA1MDAgKyA1MDAgKiBNYXRoLnJhbmRvbSgpLCBjcmVhdGVqcy5FYXNlLmxpbmVhcilcblx0XHQuY2FsbChmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZChzdGFyKTtcblx0XHR9LmJpbmQodGhpcykpO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5zcGF3bkNvbWJvTWVzc2FnZSA9IGZ1bmN0aW9uKGxldmVsKSB7XG5cdHZhciBtZXNzYWdlID0gbmV3IGNyZWF0ZWpzLlRleHQobGV2ZWwgKyAneCBDb21ibycsICczMHB4IEtvbWlrYScsIFwiI2ZmZlwiKTtcblx0bWVzc2FnZS54ID0gOTUgLSBtZXNzYWdlLmdldE1lYXN1cmVkV2lkdGgoKSAvIDI7XG5cdG1lc3NhZ2UueSA9IDE1MDtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKG1lc3NhZ2UpO1xuXG5cdGNyZWF0ZWpzLlR3ZWVuLmdldChtZXNzYWdlKVxuXHRcdC50byh7eTogMCwgYWxwaGE6IDB9LCAxNTAwLCBjcmVhdGVqcy5FYXNlLmxpbmVhcilcblx0XHQuY2FsbChmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZChtZXNzYWdlKTtcblx0XHR9LmJpbmQodGhpcykpO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy5tYXhGdW5WYWx1ZSA9IGxldmVsLm1heEZ1blZhbHVlO1xuXHR0aGlzLmZ1blRpbWUgPSBsZXZlbC5mdW5UaW1lO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGdW5CYXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaHVkL0Z1bkJhci5qc1wiLFwiL2h1ZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBtYXhXaWR0aCA9IDI0MDtcblxudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gSGVhbHRoQmFyKGxlZnQsIG9iamVjdCkge1xuICAgIHRoaXMub2JqZWN0ID0gb2JqZWN0O1xuXG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuZWxlbWVudC54ID0gbGVmdCA/IDQ1IDogY29uc3RhbnRzLkdBTUVfV0lEVEggLSAyNjA7XG5cdHRoaXMuZWxlbWVudC55ID0gMTA7XG4gICAgdGhpcy5jdXJyZW50ID0gMDtcblxuICAgIHRoaXMuYm9yZGVyID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG4gICAgdGhpcy5ib3JkZXIuZ3JhcGhpY3MuYmVnaW5GaWxsKFwiIzQ0NFwiKS5kcmF3UmVjdCgwLCAwLCAyNTAsIDUwKTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5ib3JkZXIpO1xuXG4gICAgdGhpcy5maWxsID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG4gICAgdGhpcy5kcmF3RmlsbCgpO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmZpbGwpO1xuXG5cdHRoaXMuZnVuVGV4dCA9IG5ldyBjcmVhdGVqcy5UZXh0KGxlZnQgPyBcIuKZpVwiIDogXCLimKBcIiwgXCIzMHB4IEtvbWlrYVwiLCBsZWZ0ID8gJyNmOGYnIDogJyNkMDAnKTtcblx0dGhpcy5mdW5UZXh0LnggPSAtMzU7XG5cdHRoaXMuZnVuVGV4dC55ID0gLTQ7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmZ1blRleHQpO1xuXG5cdHRoaXMucmVtYWluaW5nSGl0c1RleHQgPSBuZXcgY3JlYXRlanMuVGV4dChcIlwiLCBcIjI1cHggS29taWthXCIsICcjZmZmJyk7XG5cdHRoaXMucmVtYWluaW5nSGl0c1RleHQueCA9IDcwO1xuXHR0aGlzLnJlbWFpbmluZ0hpdHNUZXh0LnkgPSAxO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5yZW1haW5pbmdIaXRzVGV4dCk7XG59XG5cbkhlYWx0aEJhci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdoZWFsLW1lJywgdGhpcy5vbkhlYWxNZS5iaW5kKHRoaXMpKTtcbn07XG5cbkhlYWx0aEJhci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5yZW1haW5pbmdIaXRzVGV4dC50ZXh0ID0gdGhpcy5vYmplY3QuaGVhbHRoICsgJy8nICsgdGhpcy5vYmplY3QubWF4SGVhbHRoO1xufTtcblxuSGVhbHRoQmFyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmhpdFRhcmdldCAhPT0gdGhpcy5vYmplY3QuaWQgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmRyYXdGaWxsKCk7XG59O1xuXG5IZWFsdGhCYXIucHJvdG90eXBlLm9uSGVhbE1lID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmRyYXdGaWxsKCk7XG59O1xuXG5IZWFsdGhCYXIucHJvdG90eXBlLmRyYXdGaWxsID0gZnVuY3Rpb24oKSB7XG5cdHZhciBjb2xvciA9ICh0aGlzLm9iamVjdC5pZCA9PT0gJ3BsYXllcicpID8gJyNmOGYnIDogJyNkMDAnO1xuICAgIHRoaXMuZmlsbC5ncmFwaGljcy5jbGVhcigpLmJlZ2luRmlsbChjb2xvcikuZHJhd1JlY3QoNSwgNSwgKHRoaXMub2JqZWN0LmhlYWx0aCAvIHRoaXMub2JqZWN0Lm1heEhlYWx0aCkgKiBtYXhXaWR0aCwgNDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIZWFsdGhCYXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaHVkL0hlYWx0aEJhci5qc1wiLFwiL2h1ZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIExldmVsQmFyKCkge1xuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cdHRoaXMuZWxlbWVudC54ID0gY29uc3RhbnRzLkdBTUVfV0lEVEggLSAxMzA7XG5cdHRoaXMuZWxlbWVudC55ID0gY29uc3RhbnRzLkdBTUVfSEVJR0hUIC0gNjA7XG5cblx0dGhpcy50ZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQoXCIgXCIsIFwiMjVweCBLb21pa2FcIiwgJyNmZmYnKTtcblx0dGhpcy50ZXh0LnggPSAwO1xuXHR0aGlzLnRleHQueSA9IDA7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLnRleHQpO1xufVxuXG5MZXZlbEJhci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcbn07XG5cbkxldmVsQmFyLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy50ZXh0LnRleHQgPSBcIkxldmVsIFwiICsgbGV2ZWwubGV2ZWxJZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxCYXI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2h1ZC9MZXZlbEJhci5qc1wiLFwiL2h1ZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyksXG5cdGljb25IYW5kID0gJ+KYgycsXG5cdGljb25Td29yZCA9ICfimpQnO1xuXG5mdW5jdGlvbiBXZWFwb25CYXIoKSB7XG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5lbGVtZW50LnggPSAxMDtcblx0dGhpcy5lbGVtZW50LnkgPSBjb25zdGFudHMuR0FNRV9IRUlHSFQgLSA2MDtcblxuXHR0aGlzLmljb24gPSBpY29uSGFuZDtcblxuXHR0aGlzLnJlbWFpbmluZ0hpdHNUZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQoaWNvbkhhbmQgKyBcIiAwXCIsIFwiMjVweCBLb21pa2FcIiwgJyNmZmYnKTtcblx0dGhpcy5yZW1haW5pbmdIaXRzVGV4dC54ID0gNTA7XG5cdHRoaXMucmVtYWluaW5nSGl0c1RleHQueSA9IDA7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLnJlbWFpbmluZ0hpdHNUZXh0KTtcbn1cblxuV2VhcG9uQmFyLnByb3RvdHlwZS51cGRhdGVXZWFwb24gPSBmdW5jdGlvbih3ZWFwb24sIHJlbWFpbmluZykge1xuXHRzd2l0Y2ggKHdlYXBvbikge1xuXHRcdGNhc2UgJ3Nob3J0LXdlYXBvbic6XG5cdFx0XHR0aGlzLmljb24gPSBpY29uU3dvcmQ7XG5cdFx0XHRicmVhaztcblxuXHRcdGRlZmF1bHQ6XG5cdFx0XHR0aGlzLmljb24gPSBpY29uSGFuZDtcblx0XHRcdGJyZWFrO1xuXHR9XG5cblx0dGhpcy51cGRhdGVSZW1haW5pbmdIaXRzKHJlbWFpbmluZyk7XG59O1xuXG5XZWFwb25CYXIucHJvdG90eXBlLnVwZGF0ZVJlbWFpbmluZ0hpdHMgPSBmdW5jdGlvbihyZW1haW5pbmcpIHtcblx0dGhpcy5yZW1haW5pbmdIaXRzVGV4dC50ZXh0ID0gdGhpcy5pY29uICsgJyAnICsgcGFyc2VJbnQocmVtYWluaW5nIHx8IDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWFwb25CYXI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2h1ZC9XZWFwb25CYXIuanNcIixcIi9odWRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBMZXZlbCA9IGZ1bmN0aW9uKGxldmVsSWQsIGRhcmtuZXNzLCBtb25zdGVyU3BlZWQsIGl0ZW1TZWVkLCB0ZXJyYWluU2VlZCwgcGxheWVySGVhbHRoLCBtb25zdGVySGVhbHRoLCB0cmVlcywgZ3Jvd2xDb29sZG93biwgaXRlbUNvb2xkb3duLCBpdGVtU3dvcmRBbW91bnQsIGl0ZW1Td29yZExpZmV0aW1lLCBjb21ib0ludGVydmFsLCBtYXhGdW5WYWx1ZSwgZnVuVGltZSkge1xuICAgIHRoaXMubGV2ZWxJZCA9IGxldmVsSWQ7XG4gICAgdGhpcy5kYXJrbmVzcyA9IGRhcmtuZXNzO1xuICAgIHRoaXMubW9uc3RlclNwZWVkID0gbW9uc3RlclNwZWVkO1xuICAgIHRoaXMuZGFya25lc3MgPSBkYXJrbmVzcztcbiAgICB0aGlzLml0ZW1TZWVkID0gaXRlbVNlZWQ7XG4gICAgdGhpcy50ZXJyYWluU2VlZCA9IHRlcnJhaW5TZWVkO1xuICAgIHRoaXMucGxheWVySGVhbHRoID0gcGxheWVySGVhbHRoO1xuICAgIHRoaXMubW9uc3RlckhlYWx0aCA9IG1vbnN0ZXJIZWFsdGg7XG4gICAgdGhpcy50cmVlcyA9IHRyZWVzO1xuICAgIHRoaXMuZ3Jvd2xDb29sZG93biA9IGdyb3dsQ29vbGRvd247XG4gICAgdGhpcy5pdGVtQ29vbGRvd24gPSBpdGVtQ29vbGRvd247XG4gICAgdGhpcy5pdGVtU3dvcmRBbW91bnQgPSBpdGVtU3dvcmRBbW91bnQ7XG4gICAgdGhpcy5pdGVtU3dvcmRMaWZldGltZSA9IGl0ZW1Td29yZExpZmV0aW1lO1xuICAgIHRoaXMuY29tYm9JbnRlcnZhbCA9IGNvbWJvSW50ZXJ2YWw7XG4gICAgdGhpcy5tYXhGdW5WYWx1ZSA9IG1heEZ1blZhbHVlO1xuICAgIHRoaXMuZnVuVGltZSA9IGZ1blRpbWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExldmVsO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9sZXZlbC9MZXZlbC5qc1wiLFwiL2xldmVsXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbGV2ZWxEYXRhID0gcmVxdWlyZSgnLi9sZXZlbHMnKSxcbiAgICBMZXZlbCA9IHJlcXVpcmUoJy4vTGV2ZWwnKTtcblxudmFyIExldmVsQnVpbGRlciA9IGZ1bmN0aW9uKCkge1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge051bWJlcn0gbGV2ZWxJZFxuICogQHJldHVybnMge0xldmVsfVxuICovXG5MZXZlbEJ1aWxkZXIucHJvdG90eXBlLmdldExldmVsID0gZnVuY3Rpb24obGV2ZWxJZCkge1xuICAgIHZhciByYXdfbGV2ZWwgPSBsZXZlbERhdGFbbGV2ZWxJZCAtIDFdO1xuICAgIHZhciBsZXZlbCA9IG5ldyBMZXZlbChcbiAgICAgICAgcmF3X2xldmVsLmxldmVsLFxuICAgICAgICByYXdfbGV2ZWwuZGFya25lc3MsXG4gICAgICAgIHJhd19sZXZlbC5tb25zdGVyU3BlZWQsXG4gICAgICAgIHJhd19sZXZlbC5pdGVtU2VlZCxcbiAgICAgICAgcmF3X2xldmVsLnRlcnJhaW5TZWVkLFxuICAgICAgICByYXdfbGV2ZWwucGxheWVySGVhbHRoLFxuICAgICAgICByYXdfbGV2ZWwubW9uc3RlckhlYWx0aCxcbiAgICAgICAgcmF3X2xldmVsLnRyZWVzLFxuICAgICAgICByYXdfbGV2ZWwuZ3Jvd2xDb29sZG93bixcbiAgICAgICAgcmF3X2xldmVsLml0ZW1Db29sZG93bixcbiAgICAgICAgcmF3X2xldmVsLml0ZW1Td29yZEFtb3VudCxcbiAgICAgICAgcmF3X2xldmVsLml0ZW1Td29yZExpZmV0aW1lLFxuICAgICAgICByYXdfbGV2ZWwuY29tYm9JbnRlcnZhbCxcbiAgICAgICAgcmF3X2xldmVsLm1heEZ1blZhbHVlLFxuICAgICAgICByYXdfbGV2ZWwuZnVuVGltZVxuICAgICk7XG5cbiAgICByZXR1cm4gbGV2ZWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExldmVsQnVpbGRlcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGV2ZWwvTGV2ZWxCdWlsZGVyLmpzXCIsXCIvbGV2ZWxcIikiLCJtb2R1bGUuZXhwb3J0cz1bXG4gIHtcbiAgICBcImxldmVsXCI6IDEsXG4gICAgXCJkYXJrbmVzc1wiOiAwLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDAuNyxcbiAgICBcIml0ZW1TZWVkXCI6IDIsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDEsXG4gICAgXCJ0cmVlc1wiOiAyMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMjUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAxNTAsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMjAsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiAyMCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDcsXG4gICAgXCJmdW5UaW1lXCI6IDYwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMixcbiAgICBcImRhcmtuZXNzXCI6IDAuNSxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAwLjksXG4gICAgXCJpdGVtU2VlZFwiOiAzLFxuICAgIFwidGVycmFpblNlZWRcIjogMTAyLFxuICAgIFwidHJlZXNcIjogNTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiAxMCxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDE1LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMTAsXG4gICAgXCJmdW5UaW1lXCI6IDUwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMyxcbiAgICBcImRhcmtuZXNzXCI6IDAuNyxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLFxuICAgIFwiaXRlbVNlZWRcIjogNCxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwMyxcbiAgICBcInRyZWVzXCI6IDUwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEwMCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMjAwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiA4LFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDYsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiAxMCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDUsXG4gICAgXCJmdW5UaW1lXCI6IDE1MDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogNCxcbiAgICBcImRhcmtuZXNzXCI6IDAuNzUsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS4xLFxuICAgIFwiaXRlbVNlZWRcIjogNSxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwNCxcbiAgICBcInRyZWVzXCI6IDM3NSxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxMDAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDI1MCxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogNSxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiA1LFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogMTAsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxNSxcbiAgICBcImZ1blRpbWVcIjogNDAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiA1LFxuICAgIFwiZGFya25lc3NcIjogMC43OCxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjIsXG4gICAgXCJpdGVtU2VlZFwiOiA2LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA1LFxuICAgIFwidHJlZXNcIjogMTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEwMCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMzAwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiA1LFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDUsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiAxMCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDE1LFxuICAgIFwiZnVuVGltZVwiOiAzNTAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDYsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjgxLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuMyxcbiAgICBcIml0ZW1TZWVkXCI6IDcsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDYsXG4gICAgXCJ0cmVlc1wiOiAxMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTI1LFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAzMjUsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDUsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogNCxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDEwLFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMTUsXG4gICAgXCJmdW5UaW1lXCI6IDMwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogNyxcbiAgICBcImRhcmtuZXNzXCI6IDAuODQsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS40LFxuICAgIFwiaXRlbVNlZWRcIjogOCxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwNyxcbiAgICBcInRyZWVzXCI6IDc1MCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxMjUsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDM1MCxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogNCxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiA0LFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogMTAsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxNSxcbiAgICBcImZ1blRpbWVcIjogMjUwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiA4LFxuICAgIFwiZGFya25lc3NcIjogMC44OCxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjUsXG4gICAgXCJpdGVtU2VlZFwiOiA5LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA4LFxuICAgIFwidHJlZXNcIjogMTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAzNzUsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDQsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogNCxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxNSxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiA5LFxuICAgIFwiZGFya25lc3NcIjogMC45LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuNixcbiAgICBcIml0ZW1TZWVkXCI6IDEwLFxuICAgIFwidGVycmFpblNlZWRcIjogMTA5LFxuICAgIFwidHJlZXNcIjogNTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNDAwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiA0LFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA1LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMTUsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMTAsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjkyLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuNyxcbiAgICBcIml0ZW1TZWVkXCI6IDExLFxuICAgIFwidGVycmFpblNlZWRcIjogMTEwLFxuICAgIFwidHJlZXNcIjogMTUwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNDI1LFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAzLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA1LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMjAsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMTEsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjk0LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuOCxcbiAgICBcIml0ZW1TZWVkXCI6IDEyLFxuICAgIFwidGVycmFpblNlZWRcIjogMTExLFxuICAgIFwidHJlZXNcIjogMjAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA0NTAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDMsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyMCxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxMixcbiAgICBcImRhcmtuZXNzXCI6IDAuOTYsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS45LFxuICAgIFwiaXRlbVNlZWRcIjogMTMsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTIsXG4gICAgXCJ0cmVlc1wiOiA1NzAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA1MDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDMsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyMCxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxMyxcbiAgICBcImRhcmtuZXNzXCI6IDAuOTcsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMixcbiAgICBcIml0ZW1TZWVkXCI6IDE0LFxuICAgIFwidGVycmFpblNlZWRcIjogMTEzLFxuICAgIFwidHJlZXNcIjogMjEwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNTI1LFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAzLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA0LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMjAsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMTQsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjk4LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDIuMSxcbiAgICBcIml0ZW1TZWVkXCI6IDE1LFxuICAgIFwidGVycmFpblNlZWRcIjogMTE0LFxuICAgIFwidHJlZXNcIjogMTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA1NTAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDIsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDQsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyNSxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxNSxcbiAgICBcImRhcmtuZXNzXCI6IDAuOTksXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMi4yLFxuICAgIFwiaXRlbVNlZWRcIjogMTYsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTUsXG4gICAgXCJ0cmVlc1wiOiA4LFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNjAwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAyLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA0LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMjYsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMTYsXG4gICAgXCJkYXJrbmVzc1wiOiAxLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDIuMyxcbiAgICBcIml0ZW1TZWVkXCI6IDE3LFxuICAgIFwidGVycmFpblNlZWRcIjogMTE2LFxuICAgIFwidHJlZXNcIjogMTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNzUwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAyLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA0LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMjcsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogMTcsXG4gICAgXCJkYXJrbmVzc1wiOiAxLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDIuNCxcbiAgICBcIml0ZW1TZWVkXCI6IDE4LFxuICAgIFwidGVycmFpblNlZWRcIjogMTE3LFxuICAgIFwidHJlZXNcIjogMTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDE1MCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogODAwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiAyLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDMsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiA0LFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMjgsXG4gICAgXCJmdW5UaW1lXCI6IDIwMDBcbiAgfVxuXSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBhdHRhY2tEZWxheSA9IDEwMDA7XG5cbmZ1bmN0aW9uIEF0dGFja0xpc3RlbmVyKHN0YWdlLCBvYmplY3QpIHtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5vYmplY3QgPSBvYmplY3Q7XG5cbiAgICB0aGlzLmxhc3RBdHRhY2sgPSAwO1xuICAgIHRoaXMuY2FuQXR0YWNrID0gdHJ1ZTtcbiAgICB0aGlzLmlzQXR0YWNraW5nID0gZmFsc2U7XG59XG5cbkF0dGFja0xpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdpbmRvdy5kb2N1bWVudC5vbmNsaWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKHNlbGYuY2FuQXR0YWNrKSB7XG4gICAgICAgICAgICBzZWxmLmlzQXR0YWNraW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5BdHRhY2tMaXN0ZW5lci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKCF0aGlzLmNhbkF0dGFjayAmJiBldmVudC50aW1lU3RhbXAgPiB0aGlzLmxhc3RBdHRhY2sgKyBhdHRhY2tEZWxheSkge1xuICAgICAgICB0aGlzLmNhbkF0dGFjayA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNBdHRhY2tpbmcpIHtcbiAgICAgICAgdGhpcy5jYW5BdHRhY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pc0F0dGFja2luZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmxhc3RBdHRhY2sgPSBldmVudC50aW1lU3RhbXA7XG4gICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdhdHRhY2snLCB7IGRhbWFnZURlYWxlcjogdGhpcy5vYmplY3QuaWQgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdHRhY2tMaXN0ZW5lcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9BdHRhY2tMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGNoZWF0cyA9IFtcbiAgICB7XG4gICAgICAgIGtleXM6IFsxMDIsIDExNywgMTEwXSwgLy9mdW5cbiAgICAgICAgZXZlbnQ6IFwiZm9yY2UtZnVuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAga2V5czogWyAxMTksIDEwNSwgMTEwXSwgLy8gd2luXG4gICAgICAgIGV2ZW50OiAnbW9uc3Rlci1kZWFkJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXlzOiBbIDEwNCwgMTA4LCAxMTJdLCAvLyBobHBcbiAgICAgICAgZXZlbnQ6ICdoZWFsLW1lJ1xuICAgIH0sXG4gICAge1xuICAgICAgICBrZXlzOiBbIDExMiwgMTA4LCAxMjJdLCAvLyBwbHpcbiAgICAgICAgZXZlbnQ6ICdwbGF5ZXItd2VhcG9uLWxpZmV0aW1lJ1xuICAgIH1cbl07XG5cbmZ1bmN0aW9uIENoZWF0TGlzdGVuZXIoKSB7XG4gICAgdGhpcy5sYXN0S2V5cyA9IFswLCAwLCAwXTtcbn1cblxuQ2hlYXRMaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbiAgICBkb2N1bWVudC5vbmtleXByZXNzID0gdGhpcy5vbktleVVwLmJpbmQodGhpcyk7XG5cbn07XG5cbkNoZWF0TGlzdGVuZXIucHJvdG90eXBlLm9uS2V5VXAgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMubGFzdEtleXMuc2hpZnQoKTtcbiAgICB0aGlzLmxhc3RLZXlzLnB1c2goZXZlbnQuY2hhckNvZGUpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGVhdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGNoZWF0c1tpXS5rZXlzLmpvaW4oJywnKSA9PSB0aGlzLmxhc3RLZXlzLmpvaW4oJywnKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2NoZWF0ZXInKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KGNoZWF0c1tpXS5ldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENoZWF0TGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvQ2hlYXRMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gQ29sbGlzaW9uTGlzdGVuZXIoYSwgYiwgZXZlbnRUeXBlKSB7XG4gICAgdGhpcy5hID0gYTtcbiAgICB0aGlzLmIgPSBiO1xuICAgIHRoaXMuZXZlbnRUeXBlID0gZXZlbnRUeXBlO1xufVxuXG5Db2xsaXNpb25MaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbn07XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgZGlzdCA9IE1hdGguc3FydChNYXRoLnBvdyh0aGlzLmIuZWxlbWVudC54IC0gdGhpcy5hLmVsZW1lbnQueCwgMikgKyBNYXRoLnBvdyh0aGlzLmIuZWxlbWVudC55IC0gdGhpcy5hLmVsZW1lbnQueSwgMikpO1xuICAgIHZhciBhZGRlZFJhZGl1cyA9IHRoaXMuYS5nZXRSYWRpdXMoKSArIHRoaXMuYi5nZXRSYWRpdXMoKTtcbiAgICBpZiAoZGlzdCA8IGFkZGVkUmFkaXVzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50VHlwZSA9PSAnaGl0Jykge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVIaXREZXRlY3Rpb24oZXZlbnQpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXZlbnRUeXBlID09ICdwaWNrdXAnKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZVBpY2t1cERldGVjdGlvbihldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Db2xsaXNpb25MaXN0ZW5lci5wcm90b3R5cGUuaGFuZGxlSGl0RGV0ZWN0aW9uID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgYXR0YWNrID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuYS5pc1Nob3J0QXR0YWNraW5nKCkgJiYgdGhpcy5iLmlkICE9PSAnZ3Jvd2wnKSB7XG4gICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KHRoaXMuZXZlbnRUeXBlLCB7XG4gICAgICAgICAgICB0aW1lU3RhbXA6IGV2ZW50LnRpbWVTdGFtcCxcbiAgICAgICAgICAgIGhpdFRhcmdldDogdGhpcy5iLmlkLFxuICAgICAgICAgICAgZGFtYWdlOiAxMCxcbiAgICAgICAgICAgIGRhbWFnZURlYWxlcjogdGhpcy5hLmlkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF0dGFjayA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYi5pc1Nob3J0QXR0YWNraW5nKCkgJiYgdGhpcy5hLmlkICE9PSAnZ3Jvd2wnKSB7XG4gICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KHRoaXMuZXZlbnRUeXBlLCB7XG4gICAgICAgICAgICB0aW1lU3RhbXA6IGV2ZW50LnRpbWVTdGFtcCxcbiAgICAgICAgICAgIGhpdFRhcmdldDogdGhpcy5hLmlkLFxuICAgICAgICAgICAgZGFtYWdlOiAxMCxcbiAgICAgICAgICAgIGRhbWFnZURlYWxlcjogdGhpcy5iLmlkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF0dGFjayA9IHRydWU7XG4gICAgfVxuXG4gICAgdmFyIGRhbWFnZURlYWxlciA9IHRoaXMuYS5pZCA9PSAncGxheWVyJyA/IHRoaXMuYi5pZCA6IHRoaXMuYS5pZDtcbiAgICBpZiAoIWF0dGFjaykge1xuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCh0aGlzLmV2ZW50VHlwZSwge1xuICAgICAgICAgICAgdGltZVN0YW1wOiBldmVudC50aW1lU3RhbXAsXG4gICAgICAgICAgICBoaXRUYXJnZXQ6ICdwbGF5ZXInLFxuICAgICAgICAgICAgZGFtYWdlOiAxMCxcbiAgICAgICAgICAgIGRhbWFnZURlYWxlcjogZGFtYWdlRGVhbGVyXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLmEuaWQgPT0gJ2dyb3dsJykge1xuICAgICAgICAgICAgdGhpcy5hLmhpdCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuYi5pZCA9PSAnZ3Jvd2wnKSB7XG4gICAgICAgICAgICB0aGlzLmIuaGl0KCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Db2xsaXNpb25MaXN0ZW5lci5wcm90b3R5cGUuaGFuZGxlUGlja3VwRGV0ZWN0aW9uID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAodGhpcy5hLndlYXBvbikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYi5lcXVpcHBlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hLmVxdWlwKHRoaXMuYik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbGxpc2lvbkxpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0NvbGxpc2lvbkxpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBDb21ib0xpc3RlbmVyKCkge1xuICAgIHRoaXMubGV2ZWwgPSAwO1xuXHR0aGlzLmxhc3RIaXQgPSAwO1xuXHR0aGlzLmNvbWJvSW50ZXJ2YWwgPSAwO1xufVxuXG5Db21ib0xpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0dGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbiAgICBlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG59O1xuXG5Db21ib0xpc3RlbmVyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmhpdFRhcmdldCA9PSAncGxheWVyJykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cdGlmIChldmVudC50aW1lU3RhbXAgLSB0aGlzLmxhc3RIaXQgPiB0aGlzLmNvbWJvSW50ZXJ2YWwpIHtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdH1cblxuXHR0aGlzLmluY3JlYXNlQ29tYm8oZXZlbnQudGltZVN0YW1wKTtcblx0dGhpcy5sYXN0SGl0ID0gZXZlbnQudGltZVN0YW1wO1xuXG5cdGlmICh0aGlzLmxldmVsID4gMSkge1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdjb21ibycsIHtcblx0XHRcdGxldmVsOiB0aGlzLmxldmVsXG5cdFx0fSk7XG5cdH1cbn07XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuXG59O1xuXG5Db21ib0xpc3RlbmVyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubGV2ZWwgPSAwO1xufTtcblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUuaW5jcmVhc2VDb21ibyA9IGZ1bmN0aW9uKHRpbWVTdGFtcCkge1xuICAgIHRoaXMubGV2ZWwrKztcbn07XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR0aGlzLmNvbWJvSW50ZXJ2YWwgPSBsZXZlbC5jb21ib0ludGVydmFsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb21ib0xpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0NvbWJvTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIEdyb3dsTGlzdGVuZXIoZ3Jvd2xIYW5kbGVyKSB7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIgPSBncm93bEhhbmRsZXI7XG59XG5cbkdyb3dsTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2dyb3dsJywgdGhpcy5vbkdyb3dsLmJpbmQodGhpcykpO1xufTtcblxuR3Jvd2xMaXN0ZW5lci5wcm90b3R5cGUub25Hcm93bCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIuc3BhbihldmVudCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyb3dsTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvR3Jvd2xMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuXG5mdW5jdGlvbiBJdGVtTGlzdGVuZXIoaXRlbUhhbmRsZXIpIHtcbiAgICB0aGlzLmN1cnJlbnRJdGVtcyA9IDA7XG4gICAgdGhpcy5uZXh0SXRlbSA9IDA7XG4gICAgdGhpcy5tYXhJdGVtcyA9IDA7XG4gICAgdGhpcy5jb29sZG93biA9IDA7XG4gICAgdGhpcy5pdGVtSGFuZGxlciA9IGl0ZW1IYW5kbGVyO1xufVxuXG5JdGVtTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG4gICAgdGhpcy5lbWl0dGVyLm9uKCd1bmVxdWlwJywgdGhpcy5vblVuZXF1aXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5lbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG59O1xuXG5JdGVtTGlzdGVuZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuICAgIHRoaXMubWF4SXRlbXMgPSBsZXZlbC5pdGVtU3dvcmRBbW91bnQ7XG4gICAgdGhpcy5jb29sZG93biA9IGxldmVsLml0ZW1Db29sZG93bjtcbn07XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUub25VbmVxdWlwID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jdXJyZW50SXRlbXMtLTtcbn07XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGlmICh0aGlzLmN1cnJlbnRJdGVtcyA+PSB0aGlzLm1heEl0ZW1zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5uZXh0SXRlbSA+IGV2ZW50LnRpbWVTdGFtcCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5pdGVtSGFuZGxlci5zcGF3bigpO1xuICAgIHRoaXMubmV4dEl0ZW0gPSBldmVudC50aW1lU3RhbXAgKyB0aGlzLmNvb2xkb3duICogMTAwMDtcbiAgICB0aGlzLmN1cnJlbnRJdGVtcysrO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJdGVtTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvSXRlbUxpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5cbnZhciBMZXZlbEJ1aWxkZXIgPSByZXF1aXJlKCcuLi9sZXZlbC9MZXZlbEJ1aWxkZXInKTtcblxudmFyIGN1cnJlbnRMZXZlbElkID0gMDtcblxuZnVuY3Rpb24gTGV2ZWxVcExpc3RlbmVyKCkge1xuXHR0aGlzLmxldmVsQnVpZGxlciA9IG5ldyBMZXZlbEJ1aWxkZXIoKTtcbn1cblxuTGV2ZWxVcExpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0dGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcblxuXHQvL2VtaXR0ZXIub24oJ21vbnN0ZXItZGVhZCcsIHRoaXMub25MZXZlbFVwLmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdzdGFydC1sZXZlbCcsIHRoaXMub25TdGFydExldmVsLmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdnYW1lLW92ZXInLCB0aGlzLm9uR2FtZU92ZXIuYmluZCh0aGlzKSk7XG59O1xuXG5MZXZlbFVwTGlzdGVuZXIucHJvdG90eXBlLm9uU3RhcnRMZXZlbCA9IGZ1bmN0aW9uKCkge1xuXHRjdXJyZW50TGV2ZWxJZCsrO1xuXG5cdHZhciBuZXdMZXZlbCA9IHRoaXMubGV2ZWxCdWlkbGVyLmdldExldmVsKGN1cnJlbnRMZXZlbElkKTtcblxuXHR0aGlzLmVtaXR0ZXIuZW1pdCgnY2hhbmdlLWxldmVsJywgbmV3TGV2ZWwpO1xufTtcblxuTGV2ZWxVcExpc3RlbmVyLnByb3RvdHlwZS5vbkdhbWVPdmVyID0gZnVuY3Rpb24oKSB7XG5cdGN1cnJlbnRMZXZlbElkID0gMTtcblxuXHR2YXIgbmV3TGV2ZWwgPSB0aGlzLmxldmVsQnVpZGxlci5nZXRMZXZlbChjdXJyZW50TGV2ZWxJZCk7XG5cblx0dGhpcy5lbWl0dGVyLmVtaXQoJ2NoYW5nZS1sZXZlbCcsIG5ld0xldmVsKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxVcExpc3RlbmVyO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9MZXZlbFVwTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFJhaW5ib3dSb2FkTGlzdGVuZXIocmFpbmJvd1JvYWQpIHtcbiAgICB0aGlzLnJhaW5ib3dSb2FkID0gcmFpbmJvd1JvYWQ7XG59XG5cblJhaW5ib3dSb2FkTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2hhcy1mdW4nLCB0aGlzLm9uSGFzRnVuLmJpbmQodGhpcykpO1xufTtcblxuUmFpbmJvd1JvYWRMaXN0ZW5lci5wcm90b3R5cGUub25IYXNGdW4gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMucmFpbmJvd1JvYWQucGFpbnQoZXZlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSYWluYm93Um9hZExpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL1JhaW5ib3dSb2FkTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFNvdW5kTGlzdGVuZXIoKSB7XG5cdHRoaXMuZnVuU291bmQgPSBjcmVhdGVqcy5Tb3VuZC5wbGF5KCdmdW4nKTtcblx0dGhpcy5mdW5Tb3VuZC5zdG9wKCk7XG59XG5cblNvdW5kTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnQgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG5cblx0ZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcblx0ZW1pdHRlci5vbignZnVuJywgdGhpcy5vbkZ1bi5iaW5kKHRoaXMpKTtcbn07XG5cblNvdW5kTGlzdGVuZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0aWYgKGV2ZW50LmhpdFRhcmdldCA9PSAncGxheWVyJykge1xuXHRcdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2dpcmwtaHVydCcpO1xuXHR9IGVsc2UgaWYgKGV2ZW50LmhpdFRhcmdldCA9PSAnbW9uc3RlcicpIHtcblx0XHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdtb25zdGVyLWh1cnQnKTtcblx0fVxufTtcblxuU291bmRMaXN0ZW5lci5wcm90b3R5cGUub25GdW4gPSBmdW5jdGlvbihldmVudCkge1xuXHRpZiAoZXZlbnQuc3RhdHVzKSB7XG5cdFx0dGhpcy5mdW5Tb3VuZC5wbGF5KCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5mdW5Tb3VuZC5zdG9wKCk7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU291bmRMaXN0ZW5lcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvU291bmRMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gV2VhcG9uQmFyTGlzdGVuZXIod2VhcG9uQmFyKSB7XG4gICAgdGhpcy53ZWFwb25CYXIgPSB3ZWFwb25CYXI7XG59XG5cbldlYXBvbkJhckxpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCd1bmVxdWlwJywgdGhpcy5vblVuZXF1aXAuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignZXF1aXAnLCB0aGlzLm9uRXF1aXAuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignd2VhcG9uLXVwZGF0ZScsIHRoaXMub25XZWFwb25VcGRhdGUuYmluZCh0aGlzKSk7XG59O1xuXG5XZWFwb25CYXJMaXN0ZW5lci5wcm90b3R5cGUub25VbmVxdWlwID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy53ZWFwb25CYXIudXBkYXRlV2VhcG9uKCdoYW5kcycpO1xufTtcblxuV2VhcG9uQmFyTGlzdGVuZXIucHJvdG90eXBlLm9uRXF1aXAgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMud2VhcG9uQmFyLnVwZGF0ZVdlYXBvbihldmVudC5pZCwgZXZlbnQubGlmZXRpbWUpO1xufTtcblxuV2VhcG9uQmFyTGlzdGVuZXIucHJvdG90eXBlLm9uV2VhcG9uVXBkYXRlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLndlYXBvbkJhci51cGRhdGVSZW1haW5pbmdIaXRzKGV2ZW50LmxpZmV0aW1lKTtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBXZWFwb25CYXJMaXN0ZW5lcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9XZWFwb25CYXJMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuXG52YXIgTmlnaHRPdmVybGF5ID0gZnVuY3Rpb24ocGxheWVyKSB7XG5cdHRoaXMuYyA9IDA7XG5cblx0dGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG5cdHZhciBpbWcgPSBuZXcgY3JlYXRlanMuQml0bWFwKCcuL2ltZy9uaWdodG1vZGUucG5nJyk7XG5cdHRoaXMucGxheWVyID0gcGxheWVyO1xuXG5cdHRoaXMuZWxlbWVudC5hbHBoYSA9IDA7XG5cdGltZy5zY2FsZVggPSBpbWcuc2NhbGVZID0gMC42O1xuXHRpbWcueCA9IDEwMjQgLyAyO1xuXHRpbWcueSA9IDc2OC8yO1xuXG5cdGltZy5yZWdYID0gMTE1MDtcblx0aW1nLnJlZ1kgPSAxNDUwO1xuXG5cdHRoaXMuaW1nID0gaW1nO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoaW1nKTtcbn07XG5cbk5pZ2h0T3ZlcmxheS5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdHZhciBzcGVlZCA9IHRoaXMucGxheWVyLnZlbG9jaXR5Lmxlbmd0aCgpO1xuXG5cdHRoaXMuYyArPSBldmVudC5kZWx0YSAqIHNwZWVkICAvICg4MCAqIDEwMDApO1xuXHR0aGlzLmltZy5yb3RhdGlvbiA9IHRoaXMucGxheWVyLmVsZW1lbnQucm90YXRpb24gLSAzNSArIE1hdGguc2luKHRoaXMuYykgKiAxMDtcbn07XG5cbk5pZ2h0T3ZlcmxheS5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG5cdHRoaXMuZWxlbWVudC5hbHBoYSA9IGxldmVsLmRhcmtuZXNzO1xufTtcblxuTmlnaHRPdmVybGF5LnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOaWdodE92ZXJsYXk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbmlnaHRPdmVybGF5L05pZ2h0T3ZlcmxheS5qc1wiLFwiL25pZ2h0T3ZlcmxheVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBHYW1lT3ZlclNjcmVlbiA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG59O1xuXG5HYW1lT3ZlclNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKG5ldyBjcmVhdGVqcy5CaXRtYXAoJy4vaW1nL2dhbWVvdmVyLnBuZycpKTtcblxuXHR0aGlzLmVsZW1lbnQuc2NhbGVYID0gMC41NDtcblx0dGhpcy5lbGVtZW50LnNjYWxlWSA9IDAuNzI7XG5cblx0Y3JlYXRlanMuU291bmQucGxheSgnZGVmZWF0Jyk7XG59O1xuXG5HYW1lT3ZlclNjcmVlbi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdhbWVPdmVyU2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvR2FtZU92ZXJTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFZpZXcgPSByZXF1aXJlKCcuLi92aWV3cy9WaWV3JyksXG4gICAgUGxheWVyID0gcmVxdWlyZSgnLi4vUGxheWVyJyksXG4gICAgTW9uc3RlciA9IHJlcXVpcmUoJy4uL01vbnN0ZXInKSxcbiAgICBGdW5CYXIgPSByZXF1aXJlKCcuLi9odWQvRnVuQmFyJyksXG4gICAgSGVhbHRoQmFyID0gcmVxdWlyZSgnLi4vaHVkL0hlYWx0aEJhcicpLFxuICAgIExldmVsQmFyID0gcmVxdWlyZSgnLi4vaHVkL0xldmVsQmFyJyksXG4gICAgV2VhcG9uQmFyID0gcmVxdWlyZSgnLi4vaHVkL1dlYXBvbkJhcicpLFxuICAgIENoZWF0ZXJCYXIgPSByZXF1aXJlKCcuLi9odWQvQ2hlYXRlckJhcicpLFxuICAgIENvbWJvTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db21ib0xpc3RlbmVyJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpLFxuICAgIEF0dGFja0xpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvQXR0YWNrTGlzdGVuZXInKSxcbiAgICBTb3VuZExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvU291bmRMaXN0ZW5lcicpLFxuICAgIEdyb3dsTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Hcm93bExpc3RlbmVyJyksXG4gICAgTGV2ZWxVcExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvTGV2ZWxVcExpc3RlbmVyJyksXG4gICAgSXRlbUxpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvSXRlbUxpc3RlbmVyJyksXG4gICAgQ2hlYXRMaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0NoZWF0TGlzdGVuZXInKSxcbiAgICBHcm93bEhhbmRsZXIgPSByZXF1aXJlKCcuLi93ZWFwb25zL0dyb3dsSGFuZGxlcicpLFxuICAgIEl0ZW1IYW5kbGVyID0gcmVxdWlyZSgnLi4vd2VhcG9ucy9JdGVtSGFuZGxlcicpLFxuICAgIEdyb3VuZCA9IHJlcXVpcmUoJy4uL2dyb3VuZC9Hcm91bmQnKSxcbiAgICBSYWluYm93Um9hZCA9IHJlcXVpcmUoJy4uL2dyb3VuZC9SYWluYm93Um9hZCcpLFxuICAgIFJhaW5ib3dSb2FkTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9SYWluYm93Um9hZExpc3RlbmVyJyksXG4gICAgV2VhcG9uQmFyTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9XZWFwb25CYXJMaXN0ZW5lcicpLFxuICAgIE5pZ2h0T3ZlcmxheSA9IHJlcXVpcmUoJy4uL25pZ2h0T3ZlcmxheS9OaWdodE92ZXJsYXknKSxcbiAgICBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpO1xuXG5mdW5jdGlvbiBHYW1lU2NyZWVuKHN0YWdlKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuZ2FtZVZpZXcgPSBuZXcgVmlldygpO1xuICAgIHRoaXMuaHVkVmlldyA9IG5ldyBWaWV3KCk7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIgPSBuZXcgR3Jvd2xIYW5kbGVyKCk7XG4gICAgdGhpcy5pdGVtSGFuZGxlciA9IG5ldyBJdGVtSGFuZGxlcigpO1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblxuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG5cbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG5cdHRoaXMuYmFja2dyb3VuZE11c2ljID0gbnVsbDtcbn1cblxuR2FtZVNjcmVlbi5wcm90b3R5cGUucmVnaXN0ZXJFdmVudCA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuR2FtZVNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5nYW1lVmlldy5lbGVtZW50KTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5odWRWaWV3LmVsZW1lbnQpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQodGhpcy5ncm93bEhhbmRsZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQodGhpcy5pdGVtSGFuZGxlcik7XG5cbiAgICB2YXIgZnVuQmFyID0gbmV3IEZ1bkJhcigpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChmdW5CYXIpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChuZXcgQ2hlYXRlckJhcigpKTtcblxuXHR2YXIgcmFpbmJvd1JvYWQgPSBuZXcgUmFpbmJvd1JvYWQoKTtcblx0dGhpcy5nYW1lVmlldy5hZGRDaGlsZChyYWluYm93Um9hZCk7XG5cbiAgICB0aGlzLnBsYXllciA9IG5ldyBQbGF5ZXIoMjAwLCAyMDApO1xuICAgIHRoaXMuZ3Jvd2xIYW5kbGVyLnNldFRhcmdldCh0aGlzLnBsYXllcik7XG4gICAgdGhpcy5pdGVtSGFuZGxlci5zZXRUYXJnZXQodGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQodGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYXR0YWNoKHRoaXMucGxheWVyKTtcblxuICAgIHZhciBtb25zdGVyID0gbmV3IE1vbnN0ZXIoNzAwLCAzMDAsIHRoaXMucGxheWVyKTtcbiAgICB0aGlzLmdhbWVWaWV3LmFkZENoaWxkKG1vbnN0ZXIpO1xuXG4gICAgdmFyIGhlYWx0aEJhcjEgPSBuZXcgSGVhbHRoQmFyKHRydWUsIHRoaXMucGxheWVyKTtcbiAgICB0aGlzLmh1ZFZpZXcuYWRkQ2hpbGQoaGVhbHRoQmFyMSk7XG5cbiAgICB2YXIgaGVhbHRoQmFyMiA9IG5ldyBIZWFsdGhCYXIoZmFsc2UsIG1vbnN0ZXIpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChoZWFsdGhCYXIyKTtcblxuXHR2YXIgd2VhcG9uQmFyID0gbmV3IFdlYXBvbkJhcigpO1xuXHR0aGlzLmh1ZFZpZXcuYWRkQ2hpbGQod2VhcG9uQmFyKTtcblxuICAgIHZhciBsZXZlbEJhciA9IG5ldyBMZXZlbEJhcigpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChsZXZlbEJhcik7XG5cbiAgICB2YXIgZ3JvdW5kID0gbmV3IEdyb3VuZCgpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGRBdChncm91bmQsIDApO1xuXG4gICAgaWYgKEdhbWVDb25zdHMuTklHSFRfTU9ERSkge1xuICAgICAgICB2YXIgbmlnaHRPdmVybGF5ID0gbmV3IE5pZ2h0T3ZlcmxheSh0aGlzLnBsYXllcik7XG4gICAgICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZEF0KG5pZ2h0T3ZlcmxheSwgMCk7XG4gICAgfVxuXG4gICAgdmFyIGNvbWJvTGlzdGVuZXIgPSBuZXcgQ29tYm9MaXN0ZW5lcigpO1xuICAgIGNvbWJvTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGNvbWJvTGlzdGVuZXIpO1xuICAgIHZhciBjb2xsaXNpb25MaXN0ZW5lciA9IG5ldyBDb2xsaXNpb25MaXN0ZW5lcih0aGlzLnBsYXllciwgbW9uc3RlciwgJ2hpdCcpO1xuICAgIGNvbGxpc2lvbkxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChjb2xsaXNpb25MaXN0ZW5lcik7XG4gICAgdmFyIGF0dGFja0xpc3RlbmVyID0gbmV3IEF0dGFja0xpc3RlbmVyKHRoaXMuc3RhZ2UsIHRoaXMucGxheWVyKTtcbiAgICBhdHRhY2tMaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2goYXR0YWNrTGlzdGVuZXIpO1xuXHR2YXIgc291bmRMaXN0ZW5lciA9IG5ldyBTb3VuZExpc3RlbmVyKCk7XG5cdHNvdW5kTGlzdGVuZXIucmVnaXN0ZXJFdmVudCh0aGlzLmVtaXR0ZXIpO1xuXHR0aGlzLmxpc3RlbmVycy5wdXNoKHNvdW5kTGlzdGVuZXIpO1xuICAgIHZhciBncm93bExpc3RlbmVyID0gbmV3IEdyb3dsTGlzdGVuZXIodGhpcy5ncm93bEhhbmRsZXIpO1xuICAgIGdyb3dsTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGdyb3dsTGlzdGVuZXIpO1xuICAgIHZhciBsZXZlbFVwTGlzdGVuZXIgPSBuZXcgTGV2ZWxVcExpc3RlbmVyKCk7XG4gICAgbGV2ZWxVcExpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChsZXZlbFVwTGlzdGVuZXIpO1xuICAgIHZhciBpdGVtTGlzdGVuZXIgPSBuZXcgSXRlbUxpc3RlbmVyKHRoaXMuaXRlbUhhbmRsZXIpO1xuICAgIGl0ZW1MaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2goaXRlbUxpc3RlbmVyKTtcbiAgICB2YXIgcmFpbmJvd1JvYWRMaXN0ZW5lciA9IG5ldyBSYWluYm93Um9hZExpc3RlbmVyKHJhaW5ib3dSb2FkKTtcbiAgICByYWluYm93Um9hZExpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChyYWluYm93Um9hZExpc3RlbmVyKTtcbiAgICB2YXIgd2VhcG9uQmFyTGlzdGVuZXIgPSBuZXcgV2VhcG9uQmFyTGlzdGVuZXIod2VhcG9uQmFyKTtcbiAgICB3ZWFwb25CYXJMaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2god2VhcG9uQmFyTGlzdGVuZXIpO1xuICAgIHZhciBjaGVhdExpc3RlbmVyID0gbmV3IENoZWF0TGlzdGVuZXIoKTtcbiAgICBjaGVhdExpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChjaGVhdExpc3RlbmVyKTtcblxuICAgIHRoaXMuZ2FtZVZpZXcucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmh1ZFZpZXcucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcblxuICAgIGlmICghdGhpcy5iYWNrZ3JvdW5kTXVzaWMpIHtcblx0XHR0aGlzLmJhY2tncm91bmRNdXNpYyA9IGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2JhY2tncm91bmQnLCB7bG9vcHM6IC0xLCB2b2x1bWU6IDAuMn0pO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuYmFja2dyb3VuZE11c2ljLnJlc3VtZSgpO1xuXHR9XG59O1xuXG5HYW1lU2NyZWVuLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaHVkVmlldy5yZXNldCgpO1xuICAgIHRoaXMuZ2FtZVZpZXcucmVzZXQoKTtcbiAgICB0aGlzLmdyb3dsSGFuZGxlci5yZXNldCgpO1xuICAgIHRoaXMuaXRlbUhhbmRsZXIucmVzZXQoKTtcbiAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuXHR0aGlzLmJhY2tncm91bmRNdXNpYy5wYXVzZSgpO1xufTtcblxuR2FtZVNjcmVlbi5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5nYW1lVmlldy50aWNrKGV2ZW50KTtcbiAgICB0aGlzLmh1ZFZpZXcudGljayhldmVudCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5saXN0ZW5lcnNbaV1bJ3RpY2snXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyc1tpXS50aWNrKGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR2FtZVNjcmVlbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zY3JlZW5zL0dhbWVTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gSG9tZVNjcmVlbigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG59XG5cbkhvbWVTY3JlZW4ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRCb3ggPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdmFyIGhlYWRsaW5lID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJXZWxjb21lIVwiLCBcIjEwMHB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIHRleHRCb3guYWRkQ2hpbGQoaGVhZGxpbmUpO1xuXG4gICAgdmFyIHRvID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJ0b1wiLCBcIjUwcHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgdG8ueSA9IDEyNTtcbiAgICB0by54ID0gMTUwO1xuICAgIHRleHRCb3guYWRkQ2hpbGQodG8pO1xuXG4gICAgdmFyIGdhbWVOYW1lID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJ7R2FtZU5hbWV9IVwiLCBcIjEwMHB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIGdhbWVOYW1lLnkgPSAyMDA7XG4gICAgdGV4dEJveC5hZGRDaGlsZChnYW1lTmFtZSk7XG5cbiAgICB0ZXh0Qm94LnkgPSAxMDA7XG4gICAgdGV4dEJveC54ID0gMTUwO1xuXG4gICAgdGhpcy5sb2FkaW5nID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJMb2FkaW5nIC4uLlwiLCBcIjc1cHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgdGhpcy5sb2FkaW5nLnkgPSA1MDA7XG4gICAgdGhpcy5sb2FkaW5nLnggPSAxNTA7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMubG9hZGluZyk7XG5cbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGV4dEJveCk7XG59O1xuXG5Ib21lU2NyZWVuLnByb3RvdHlwZS5pc1JlYWR5ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubG9hZGluZyk7XG5cbiAgICB0aGlzLmxvYWRpbmcgPSBuZXcgY3JlYXRlanMuVGV4dChcIkNsaWNrIHRvIFN0YXJ0IEdhbWUhXCIsIFwiNjZweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICB0aGlzLmxvYWRpbmcueSA9IDUwMDtcbiAgICB0aGlzLmxvYWRpbmcueCA9IDE1MDtcblxuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmxvYWRpbmcpO1xufTtcblxuSG9tZVNjcmVlbi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSG9tZVNjcmVlbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zY3JlZW5zL0hvbWVTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG59XG5cbk1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRCb3ggPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdmFyIGhlYWRsaW5lID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJUaGFuayBZb3UsIGxpdHRsZSBnaXJsIVwiLCBcIjU2cHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgdGV4dEJveC5hZGRDaGlsZChoZWFkbGluZSk7XG5cbiAgICB2YXIgaW5mbyA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiQnV0IE1hcmlvIGlzIGluIGFub3RoZXIgQ2FzdGxlIVwiLCBcIjMycHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgaW5mby55ID0gMTAwO1xuICAgIHRleHRCb3guYWRkQ2hpbGQoaW5mbyk7XG5cbiAgICB2YXIgYWN0aW9uID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJDbGljayB0byB0cnkgdGhlIG5leHQgQ2FzdGxlIVwiLCBcIjMycHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgYWN0aW9uLnkgPSAzMDA7XG4gICAgdGV4dEJveC5hZGRDaGlsZChhY3Rpb24pO1xuXG4gICAgdmFyIGIgPSB0ZXh0Qm94LmdldEJvdW5kcygpO1xuICAgIHRleHRCb3gueCA9IDEwMDtcbiAgICB0ZXh0Qm94LnkgPSAyMDA7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRleHRCb3gpO1xuXG5cdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ3ZpY3RvcnknKTtcbn07XG5cbk1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4ucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc2NyZWVucy9NYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLmpzXCIsXCIvc2NyZWVuc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFN0b3J5U2NyZWVuKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbn1cblxuU3RvcnlTY3JlZW4ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XG5cbn07XG5cblN0b3J5U2NyZWVuLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdG9yeVNjcmVlbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zY3JlZW5zL1N0b3J5U2NyZWVuLmpzXCIsXCIvc2NyZWVuc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFBzZXVkb1JhbmQgPSBmdW5jdGlvbigpIHt9O1xuXG4vKipcbiAqIEBwYXJhbSBzZWVkXG4gKi9cblBzZXVkb1JhbmQucHJvdG90eXBlLnNldFNlZWQgPSBmdW5jdGlvbihzZWVkKSB7XG5cdHRoaXMuX3cgPSBNYXRoLmFicyhzZWVkICYgMHhmZmZmKTtcblx0dGhpcy5feiA9IE1hdGguYWJzKHNlZWQgPj4gMTYpO1xuXG5cdGlmICh0aGlzLl93ID09IDApIHRoaXMuX3cgPSAxO1xuXHRpZiAodGhpcy5feiA9PSAwKSB0aGlzLl96ID0gMTtcbn07XG5cbi8qKlxuICogQHJldHVybnMge2ludH1cbiAqL1xuUHNldWRvUmFuZC5wcm90b3R5cGUuZ2V0UmFuZG9tID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuX3ogPSBNYXRoLmFicygoMzY5NjkgKiAodGhpcy5feiAmIDY1NTM1KSArICh0aGlzLl96ID4+IDE2KSkmMHhmZmZmZmZmKTtcblx0dGhpcy5fdyA9IE1hdGguYWJzKCgxODAwMCAqICh0aGlzLl93ICYgNjU1MzUpICsgKHRoaXMuX3cgPj4gMTYpKSYweGZmZmZmZmYpO1xuXHRyZXR1cm4gTWF0aC5hYnMoKCh0aGlzLl96IDw8IDE2KSArIHRoaXMuX3cpICYgMHhmZmZmZmZmKTsgLy8gZXhjbHVkZSBsYXN0IGJpdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQc2V1ZG9SYW5kO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3V0aWwvUHNldWRvUmFuZC5qc1wiLFwiL3V0aWxcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFZlY3RvcjJEID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0dGhpcy54ID0geDtcblx0dGhpcy55ID0geTtcbn07XG5cblZlY3RvcjJELnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gbmV3IFZlY3RvcjJEKHRoaXMueCwgdGhpcy55KTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gYW5vdGhlcl92ZWN0b3JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5WZWN0b3IyRC5wcm90b3R5cGUucGx1cyA9IGZ1bmN0aW9uKGFub3RoZXJfdmVjdG9yKSB7XG5cdHRoaXMueCArPSBhbm90aGVyX3ZlY3Rvci54O1xuXHR0aGlzLnkgKz0gYW5vdGhlcl92ZWN0b3IueTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gYW5vdGhlcl92ZWN0b3JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5WZWN0b3IyRC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbihhbm90aGVyX3ZlY3Rvcikge1xuXHRyZXR1cm4gdGhpcy5wbHVzKGFub3RoZXJfdmVjdG9yLmNsb25lKCkudGltZXMoLTEpKTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtOdW1iZXJ9IGZhY3RvclxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cblZlY3RvcjJELnByb3RvdHlwZS50aW1lcyA9IGZ1bmN0aW9uKGZhY3Rvcikge1xuXHR0aGlzLnggKj0gZmFjdG9yO1xuXHR0aGlzLnkgKj0gZmFjdG9yO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKi9cblZlY3RvcjJELnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55KTtcbn07XG5cbi8qKlxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cblZlY3RvcjJELnByb3RvdHlwZS5ub3JtID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGgoKTtcblx0aWYgKGxlbmd0aCAhPSAwICkge1xuXHRcdHJldHVybiB0aGlzLnRpbWVzKDEgLyB0aGlzLmxlbmd0aCgpKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3IyRDtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYVxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2JcbiAqIEBwYXJhbSB7TnVtYmVyfSB0XG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xubW9kdWxlLmV4cG9ydHMubGVycCA9IGZ1bmN0aW9uKHZlY3Rvcl9hLCB2ZWN0b3JfYiwgdCkge1xuXHRyZXR1cm4gdmVjdG9yX2EuY2xvbmUoKS50aW1lcygxLXQpLnBsdXModmVjdG9yX2IuY2xvbmUoKS50aW1lcyh0KSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9hXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYlxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cbm1vZHVsZS5leHBvcnRzLmFkZCA9IGZ1bmN0aW9uKHZlY3Rvcl9hLCB2ZWN0b3JfYikge1xuXHRyZXR1cm4gdmVjdG9yX2EuY2xvbmUoKS5wbHVzKHZlY3Rvcl9iKVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYVxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5tb2R1bGUuZXhwb3J0cy5zdWJ0cmFjdCA9IGZ1bmN0aW9uKHZlY3Rvcl9hLCB2ZWN0b3JfYikge1xuXHRyZXR1cm4gdmVjdG9yX2EuY2xvbmUoKS5taW51cyh2ZWN0b3JfYilcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2FcbiAqIEBwYXJhbSB7TnVtYmVyfSBmYWN0b3JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5tb2R1bGUuZXhwb3J0cy5tdWx0aXBseSA9IGZ1bmN0aW9uKHZlY3Rvcl9hLCBmYWN0b3IpIHtcblx0cmV0dXJuIHZlY3Rvcl9hLmNsb25lKCkudGltZXMoZmFjdG9yKVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqL1xubW9kdWxlLmV4cG9ydHMuZ2V0QW5nbGUgPSBmdW5jdGlvbih2ZWN0b3IpIHtcblx0dmFyIGFuZ2xlID0gTWF0aC5hc2luKHZlY3Rvci55IC8gdmVjdG9yLmxlbmd0aCgpKSAqICgxODAgLyBNYXRoLlBJKSArIDkwO1xuXG5cdHJldHVybiB2ZWN0b3IueCA8IDAgPyAzNjAgLSBhbmdsZSA6IGFuZ2xlO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi91dGlsL1ZlY3RvcjJkLmpzXCIsXCIvdXRpbFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEdhbWVDb25zdHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbnZhciBWaWV3ID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5lbGVtZW50cyA9IFtdO1xufTtcblxuVmlldy5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG5cdHRoaXMuZWxlbWVudHMgPSBbXTtcbn07XG5cblZpZXcucHJvdG90eXBlLmFkZENoaWxkID0gZnVuY3Rpb24oZWxlbWVudCkge1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoZWxlbWVudC5lbGVtZW50KTtcblx0dGhpcy5lbGVtZW50cy5wdXNoKGVsZW1lbnQpO1xufTtcblxuVmlldy5wcm90b3R5cGUuYWRkQ2hpbGRBdCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGlkeCkge1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGRBdChlbGVtZW50LmVsZW1lbnQsIGlkeCk7XG5cdHRoaXMuZWxlbWVudHMucHVzaChlbGVtZW50KTtcbn07XG5cblZpZXcucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuZWxlbWVudHNbaV1bJ3JlZ2lzdGVyRXZlbnRzJ10gPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhpcy5lbGVtZW50c1tpXS5yZWdpc3RlckV2ZW50cyhlbWl0dGVyKTtcblx0XHR9XG5cdH1cbn07XG5cblZpZXcucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuZWxlbWVudHNbaV1bJ3RpY2snXSA9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRzW2ldLnRpY2soZXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdGlmICh0aGlzLmF0dGFjaGVkVG8pIHtcblx0XHR0aGlzLmVsZW1lbnQuc2V0VHJhbnNmb3JtKFxuXHRcdFx0LXRoaXMuYXR0YWNoZWRUby54ICsgR2FtZUNvbnN0cy5HQU1FX1dJRFRIIC8gMixcblx0XHRcdC10aGlzLmF0dGFjaGVkVG8ueSArIEdhbWVDb25zdHMuR0FNRV9IRUlHSFQgLyAyXG5cdFx0KTtcblx0fVxufTtcblxuVmlldy5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24oZWxlbWVudCkge1xuXHR0aGlzLmF0dGFjaGVkVG8gPSBlbGVtZW50LmVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXc7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdmlld3MvVmlldy5qc1wiLFwiL3ZpZXdzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFZlYzJkID0gcmVxdWlyZSgnLi4vdXRpbC9WZWN0b3IyZCcpLFxuICAgIEdhbWVDb25zdHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIEdyb3dsKHgsIHksIHRhcmdldCwgbGlmZXRpbWUsIHJlbGF0aXZlTGlmZXRpbWUpIHtcbiAgICB0aGlzLmlkID0gJ2dyb3dsJztcblxuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblxuICAgIHRoaXMuZmlyZWJhbGwgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cdHZhciBmaXJlYmFsbCA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoXCIuL2ltZy9maXJlYmFsbC5wbmdcIik7XG5cblx0dGhpcy5maXJlYmFsbC5zY2FsZVggPSB0aGlzLmZpcmViYWxsLnNjYWxlWSA9IDAuMztcblxuICAgIGZpcmViYWxsLmltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZmlyZWJhbGwucmVnWCA9IHRoaXMuZmlyZWJhbGwuZ2V0Qm91bmRzKCkud2lkdGggLyAyO1xuXHRcdHRoaXMuZmlyZWJhbGwucmVnWSA9IHRoaXMuZmlyZWJhbGwuZ2V0Qm91bmRzKCkuaGVpZ2h0IC8gMjtcblx0fS5iaW5kKHRoaXMpO1xuXG5cdHRoaXMuZmlyZWJhbGwuYWRkQ2hpbGQoZmlyZWJhbGwpO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmZpcmViYWxsKTtcblxuXHR0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICB0aGlzLmVsZW1lbnQueCA9IHg7XG4gICAgdGhpcy5lbGVtZW50LnkgPSB5O1xuICAgIHRoaXMubGlmZXRpbWUgPSBsaWZldGltZTtcbiAgICB0aGlzLnZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuXG5cdGNyZWF0ZWpzLlR3ZWVuLmdldCh0aGlzLmZpcmViYWxsKVxuXHRcdC50byh7cm90YXRpb246IHJlbGF0aXZlTGlmZXRpbWV9LCByZWxhdGl2ZUxpZmV0aW1lIC0gNTAwKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuZmlyZWJhbGwpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG5cbiAgICB2YXIgZGF0YSA9IG5ldyBjcmVhdGVqcy5TcHJpdGVTaGVldCh7XG4gICAgICAgIFwiaW1hZ2VzXCI6IFsnLi9pbWcvcG9vZi5wbmcnXSxcbiAgICAgICAgXCJmcmFtZXNcIjoge1xuICAgICAgICAgICAgXCJyZWdYXCI6IDAsXG4gICAgICAgICAgICBcImhlaWdodFwiOiAxMjgsXG4gICAgICAgICAgICBcImNvdW50XCI6IDY0LFxuICAgICAgICAgICAgXCJyZWdZXCI6IDAsXG4gICAgICAgICAgICBcIndpZHRoXCI6IDEyOFxuICAgICAgICB9LFxuICAgICAgICBcImFuaW1hdGlvbnNcIjoge1wiZW1wdHlcIjogWzBdLCBcImRlZmF1bHRcIjogWzEsIDY0LCBcImVtcHR5XCJdfVxuICAgIH0pO1xuXG4gICAgY3JlYXRlanMuVHdlZW4uZ2V0KHRoaXMuZWxlbWVudClcbiAgICAgICAgLndhaXQocmVsYXRpdmVMaWZldGltZSAtIDEwMDApXG4gICAgICAgIC5jYWxsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGFuaW1hdGlvbiA9IG5ldyBjcmVhdGVqcy5TcHJpdGUoZGF0YSwgXCJkZWZhdWx0XCIpO1xuICAgICAgICAgICAgYW5pbWF0aW9uLnggPSAtNjQ7XG4gICAgICAgICAgICBhbmltYXRpb24ueSA9IC02NDtcbiAgICAgICAgICAgIGFuaW1hdGlvbi5mcmFtZXJhdGUgPSA2MDtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChhbmltYXRpb24pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xufVxuXG5Hcm93bC5wcm90b3R5cGUuaGl0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5saWZldGltZSA9IDA7XG59O1xuXG5Hcm93bC5wcm90b3R5cGUuaXNTaG9ydEF0dGFja2luZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuR3Jvd2wucHJvdG90eXBlLmdldFJhZGl1cyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAyMDtcbn07XG5cbkdyb3dsLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgY3VycmVudCA9IG5ldyBWZWMyZCh0aGlzLnRhcmdldC5lbGVtZW50LngsIHRoaXMudGFyZ2V0LmVsZW1lbnQueSk7XG4gICAgdmFyIHRhcmdldCAgPSBuZXcgVmVjMmQodGhpcy5lbGVtZW50LngsIHRoaXMuZWxlbWVudC55KTtcblxuICAgIHZhciB2ZWN0b3JfdG9fZGVzdGluYXRpb24gPSBWZWMyZC5zdWJ0cmFjdChjdXJyZW50LCB0YXJnZXQpO1xuICAgIHZhciBkaXN0YW5jZSA9IHZlY3Rvcl90b19kZXN0aW5hdGlvbi5sZW5ndGgoKTtcblxuICAgIC8vIGNhbGN1bGF0ZSBuZXcgdmVsb2NpdHkgYWNjb3JkaW5nIHRvIGN1cnJlbnQgdmVsb2NpdHkgYW5kIHBvc2l0aW9uIG9mIHRhcmdldFxuICAgIHZlY3Rvcl90b19kZXN0aW5hdGlvbi5ub3JtKCkudGltZXMoMC43KTtcbiAgICB0aGlzLnZlbG9jaXR5Lm5vcm0oKS50aW1lcygyMCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IHRoaXMudmVsb2NpdHkucGx1cyh2ZWN0b3JfdG9fZGVzdGluYXRpb24pO1xuXG4gICAgLy8gc2V0IHNwZWVkIG9mIG1vbnN0ZXIgYWNjb3JkaW5nIHRvIGRpc3RhbmNlIHRvIHRhcmdldFxuICAgIHRoaXMudmVsb2NpdHkudGltZXMoMTAwICsgZGlzdGFuY2UgLyAyLjUpO1xuXG4gICAgdmFyIGRlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy52ZWxvY2l0eSwgZXZlbnQuZGVsdGEgLyA4MDAwKTtcblxuICAgIHRoaXMuZWxlbWVudC54ICs9IGRlbHRhLng7XG4gICAgdGhpcy5lbGVtZW50LnkgKz0gZGVsdGEueTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3Jvd2w7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9Hcm93bC5qc1wiLFwiL3dlYXBvbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgR3Jvd2wgPSByZXF1aXJlKCcuL0dyb3dsJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpO1xuXG52YXIgZ3Jvd2xMaWZlVGltZSA9IDYwMDA7XG5cbmZ1bmN0aW9uIEdyb3dsSGFuZGxlcigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5ncm93bHMgPSBbXTtcblxuICAgIHRoaXMuc2hvdWxkU3BhbiA9IGZhbHNlO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG59XG5cbkdyb3dsSGFuZGxlci5wcm90b3R5cGUuc2V0VGFyZ2V0ID0gZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5ncm93bHMgPSBbXTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxuR3Jvd2xIYW5kbGVyLnByb3RvdHlwZS5zcGFuID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLnNob3VsZFNwYW4gPSB0cnVlO1xuICAgIHRoaXMubmV4dFNwYW4gPSBldmVudDtcblx0Y3JlYXRlanMuU291bmQucGxheSgnbGF1bmNoLWZpcmViYWxsJyk7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLnNob3VsZFNwYW4pIHtcbiAgICAgICAgdmFyIGdyb3dsID0gbmV3IEdyb3dsKHRoaXMubmV4dFNwYW4ueCwgdGhpcy5uZXh0U3Bhbi55LCB0aGlzLm5leHRTcGFuLnRhcmdldCwgZXZlbnQudGltZVN0YW1wICsgZ3Jvd2xMaWZlVGltZSwgZ3Jvd2xMaWZlVGltZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChncm93bC5lbGVtZW50KTtcbiAgICAgICAgdGhpcy5zaG91bGRTcGFuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZ3Jvd2xzLnB1c2goZ3Jvd2wpO1xuICAgICAgICB2YXIgbGlzdGVuZXIgPSBuZXcgQ29sbGlzaW9uTGlzdGVuZXIodGhpcy50YXJnZXQsIGdyb3dsLCAnaGl0Jyk7XG4gICAgICAgIGxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSB0aGlzLmdyb3dscy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAodGhpcy5ncm93bHNbaV0ubGlmZXRpbWUgPCBldmVudC50aW1lU3RhbXApIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLmdyb3dsc1tpXS5lbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMuZ3Jvd2xzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmdyb3dsc1tpXVsndGljayddID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuZ3Jvd2xzW2ldLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzW2ldLnRpY2soZXZlbnQpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3Jvd2xIYW5kbGVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3dlYXBvbnMvR3Jvd2xIYW5kbGVyLmpzXCIsXCIvd2VhcG9uc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBTaG9ydFdlYXBvbiA9IHJlcXVpcmUoJy4vU2hvcnRXZWFwb24nKSxcbiAgICBQc2V1ZG9SYW5kID0gcmVxdWlyZSgnLi4vdXRpbC9Qc2V1ZG9SYW5kJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpLFxuICAgIEdhbWVDb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIEl0ZW1IYW5kbGVyKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB0aGlzLml0ZW1zID0gW107XG5cbiAgICB0aGlzLnNob3VsZFNwYXduID0gZmFsc2U7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcbiAgICB0aGlzLml0ZW1Td29yZExpZmV0aW1lID0gMTA7XG5cbiAgICB0aGlzLnJhbmQgPSBuZXcgUHNldWRvUmFuZCgpO1xufVxuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUuc2V0VGFyZ2V0ID0gZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUuc3Bhd24gPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNob3VsZFNwYXduID0gdHJ1ZTtcbn07XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxuSXRlbUhhbmRsZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLnNob3VsZFNwYXduKSB7XG4gICAgICAgIHZhciBpdGVtID0gbmV3IFNob3J0V2VhcG9uKFxuICAgICAgICAgICAgdGhpcy5yYW5kLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0YW50cy5HQU1FX1dJRFRILFxuICAgICAgICAgICAgdGhpcy5yYW5kLmdldFJhbmRvbSgpICYgR2FtZUNvbnN0YW50cy5HQU1FX0hFSUdIVCxcbiAgICAgICAgICAgIHRoaXMucmFuZC5nZXRSYW5kb20oKSAlIDM2MCxcbiAgICAgICAgICAgIHRoaXMuaXRlbVN3b3JkTGlmZXRpbWVcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKGl0ZW0uZWxlbWVudCk7XG4gICAgICAgIHRoaXMuc2hvdWxkU3Bhd24gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pdGVtcy5wdXNoKGl0ZW0pO1xuXG4gICAgICAgIHZhciBsaXN0ZW5lciA9IG5ldyBDb2xsaXNpb25MaXN0ZW5lcih0aGlzLnRhcmdldCwgaXRlbSwgJ3BpY2t1cCcpO1xuICAgICAgICBsaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgICAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gdGhpcy5pdGVtcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAoIXRoaXMuaXRlbXNbaV0uZXF1aXBwZWQgJiYgdGhpcy5pdGVtc1tpXS5saWZldGltZSA8PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5pdGVtc1tpXS5lbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuaXRlbXNbaV1bJ3RpY2snXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zW2ldLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLml0ZW1zW2ldLmVxdWlwcGVkICYmIHRoaXMuaXRlbXNbaV0ubGlmZXRpbWUgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyc1tpXS50aWNrKGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG59O1xuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgdGhpcy5yYW5kLnNldFNlZWQobGV2ZWwuaXRlbVNlZWQpO1xuICAgIHRoaXMuaXRlbVN3b3JkTGlmZXRpbWUgPSBsZXZlbC5pdGVtU3dvcmRMaWZldGltZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSXRlbUhhbmRsZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9JdGVtSGFuZGxlci5qc1wiLFwiL3dlYXBvbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgYXR0YWNrRHVyYXRpb24gPSA1MDA7XG5cbmZ1bmN0aW9uIFNob3J0V2VhcG9uKHgsIHksIHJvdGF0aW9uLCBsaWZldGltZSkge1xuICAgIHRoaXMucmFkaXVzID0gMjA7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuaWQgPSAnaXRlbSc7XG4gICAgdGhpcy5lbGVtZW50LnggPSB4O1xuICAgIHRoaXMuZWxlbWVudC55ID0geTtcbiAgICB0aGlzLmVsZW1lbnQucm90YXRpb24gPSByb3RhdGlvbjtcblxuICAgIHRoaXMuZXF1aXBwZWQgPSBmYWxzZTtcbiAgICB0aGlzLmxpZmV0aW1lID0gbGlmZXRpbWU7XG5cbiAgICB2YXIgaW1hZ2UgPSBuZXcgY3JlYXRlanMuQml0bWFwKCcuL2ltZy9zY2h3ZXJ0LnBuZycpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGltYWdlLmltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLmVsZW1lbnQucmVnWCA9IHNlbGYuZWxlbWVudC5nZXRCb3VuZHMoKS53aWR0aCAvIDI7XG4gICAgICAgIHNlbGYuZWxlbWVudC5yZWdZID0gc2VsZi5lbGVtZW50LmdldEJvdW5kcygpLmhlaWdodCAvIDI7XG4gICAgfTtcbiAgICB0aGlzLmltYWdlID0gaW1hZ2U7XG4gICAgdGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjE7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKGltYWdlKTtcbn1cblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2F0dGFjaycsIHRoaXMub25BdHRhY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbn07XG5cblNob3J0V2VhcG9uLnByb3RvdHlwZS5vbkF0dGFjayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5jYW5BY3RpdmUgPSB0cnVlO1xufTtcblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmNhbkFjdGl2ZSkge1xuICAgICAgICB0aGlzLmlzQWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jYW5BY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb29sZG93biA9IGV2ZW50LnRpbWVTdGFtcCArIGF0dGFja0R1cmF0aW9uO1xuICAgICAgICB0aGlzLmxpZmV0aW1lLS07XG5cbiAgICAgICAgdGhpcy50cmlnZ2VyVXBkYXRlKCk7XG5cbiAgICAgICAgaWYgKHRoaXMubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgdGhpcy5lcXVpcHBlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNBY3RpdmUgJiYgdGhpcy5jb29sZG93biA8IGV2ZW50LnRpbWVTdGFtcCkge1xuICAgICAgICB0aGlzLmNhbkFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzQWN0aXZlID0gZmFsc2U7XG4gICAgfVxufTtcblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLnRyaWdnZXJVcGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnd2VhcG9uLXVwZGF0ZScsIHtcbiAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgIGxpZmV0aW1lOiB0aGlzLmxpZmV0aW1lXG4gICAgfSk7XG59O1xuXG5TaG9ydFdlYXBvbi5wcm90b3R5cGUuZ2V0UmFkaXVzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJhZGl1cztcbn07XG5cblNob3J0V2VhcG9uLnByb3RvdHlwZS5lcXVpcCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC54ID0gOTAwO1xuICAgIHRoaXMuZWxlbWVudC55ID0gMDtcbiAgICB0aGlzLmVsZW1lbnQucm90YXRpb24gPSAwO1xuICAgIHRoaXMucmFkaXVzID0gODA7XG4gICAgdGhpcy5pZCA9ICdzaG9ydC13ZWFwb24nO1xuICAgIHRoaXMuZXF1aXBwZWQgPSB0cnVlO1xuICAgIHRoaXMuZWxlbWVudC5zY2FsZVggPSB0aGlzLmVsZW1lbnQuc2NhbGVZID0gMTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2hvcnRXZWFwb247XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9TaG9ydFdlYXBvbi5qc1wiLFwiL3dlYXBvbnNcIikiXX0=
