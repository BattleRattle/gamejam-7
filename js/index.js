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

GameConsts.MONSTER_SPEED = 0.025;

module.exports = GameConsts;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/GameConsts.js","/")
},{"buffer":2,"oMfpAn":5}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var growlMinDelay = 5,
	growlSounds = 3; // in seconds


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

	if (event.timeStamp - this.lastGrowlAt > growlMinDelay * 1000) {
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
};

module.exports = Monster;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Monster.js","/")
},{"./GameConsts":6,"./util/Vector2d":35,"buffer":2,"oMfpAn":5}],8:[function(require,module,exports){
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
};

Player.prototype.getRadius = function () {
    if (this.isShortAttacking()) {
        return this.weapon.radius;
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
},{"./GameConsts":6,"./util/Vector2d":35,"buffer":2,"oMfpAn":5}],9:[function(require,module,exports){
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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_aef030f0.js","/")
},{"./Preloader":9,"./assets":10,"./game":12,"buffer":2,"oMfpAn":5}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var EventEmitter = require('eventemitter2').EventEmitter2,
    GameScreen = require('./screens/GameScreen'),
    MarioIsInAnotherCastleScreen = require('./screens/MarioIsInAnotherCastleScreen'),
    HomeScreen = require('./screens/HomeScreen'),
    GameOverScreen = require('./screens/GameOverScreen');

'use strict';

var Game = function(gameCanvasId) {
    var self = this;

    this.emitter = new EventEmitter();
    this.stage = new createjs.Stage(gameCanvasId);

    this.gameScreen = new GameScreen(this.stage);
    this.gameOverScreen = new GameOverScreen();
    this.marioIsInAnotherCastleScreen = new MarioIsInAnotherCastleScreen();
    this.homeScreen = new HomeScreen();
    this.stage.addChild(this.gameScreen.element);
    this.stage.addChild(this.gameOverScreen.element);
    this.stage.addChild(this.marioIsInAnotherCastleScreen.element);
    this.stage.addChild(this.homeScreen.element);

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
    this.start(true);
};

Game.prototype.start = function(reachedNewLevel) {
    this.changeScreen();

    this.gameScreen.start();
    this.emitter.emit('start-level', reachedNewLevel);

    createjs.Ticker.setPaused(false);
};

Game.prototype.onNextCastleScreen = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.marioIsInAnotherCastleScreen.start();
    this.stage.on('stagemouseup', function() {
        this.marioIsInAnotherCastleScreen.reset();
        this.start(true);
    }.bind(this));
};

Game.prototype.onGameOver = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.gameOverScreen.start();
    this.stage.on('stagemouseup', function() {
        this.gameOverScreen.reset();
        this.start(false);
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
},{"./screens/GameOverScreen":30,"./screens/GameScreen":31,"./screens/HomeScreen":32,"./screens/MarioIsInAnotherCastleScreen":33,"buffer":2,"eventemitter2":1,"oMfpAn":5}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var GameConsts = require('../GameConsts'),
	PseudoRand = require('../util/PseudoRand'),
	Tree = require('./Tree');

var Ground = function() {
	var self = this;

	this.pseudoRandom = new PseudoRand();

	this.element = new createjs.Container();
	this.shape = new createjs.Shape();
	this.treeCount = 0;

	var img = new Image();
	img.onload = function() {
		self.shape.graphics
			.beginBitmapFill(img, 'repeat')
			.drawRect(0, 0, 10000, 10000);
	};
	img.src = './img/grass.png';

	this.element.addChild(this.shape);
	this.element.x = -GameConsts.SIZE;
	this.element.y = -GameConsts.SIZE;
};

Ground.prototype.spawnTrees = function() {
	var x, y, r, i;

	for (i = 0; i <= this.treeCount; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		r = 70 + this.pseudoRandom.getRandom() % 100;

		this.element.addChild(new Tree(x, y, r).element);
	}
};

Ground.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

Ground.prototype.onChangeLevel = function(level) {
	this.pseudoRandom.setSeed(level.itemSeed);
	this.treeCount = level.trees;
	this.spawnTrees();
};

module.exports = Ground;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ground/Ground.js","/ground")
},{"../GameConsts":6,"../util/PseudoRand":34,"./Tree":15,"buffer":2,"oMfpAn":5}],14:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],15:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var maxValue = 15;
var funTime = 7500;
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

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);

	this.isFunTime = false;
	this.isFunTimeReset = true;

	this.funText = new createjs.Text("Fun", "24px Komika", "#fff");
	this.funText.x = -60;
	this.funText.y = 3;
	this.element.addChild(this.funText);

	this.funBarText = new createjs.Text("0", "25px Komika", '#fff');
	this.funBarText.x = 110;
	this.funBarText.y = 1;
	this.element.addChild(this.funBarText);
}

FunBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('combo', this.onCombo.bind(this));

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
	if (this.current >= maxValue && this.isFunTime == false) {
		this.canFunTime = true;
		this.emitter.emit('fun', {status: 1});
	}

	this.current = Math.min(this.current, maxValue);

	this.lastIncrease = new Date().getTime();

	for (var i = 0; i < juicyStarCount + 1; i++) {
		this.spawnJuicyStar(5 + this.getMaxOffsetOnBar() / juicyStarCount * i - 20 + 40 * Math.random(), 50 * Math.random(), 40);
	}

	var magicLevel = Math.min(maxMagicLevel, value);
	createjs.Sound.play('magic' + magicLevel);
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

	this.funBarText.text = Math.round(this.current * 10) / 10;

	if (this.canFunTime) {
		this.isFunTime = true;
		this.canFunTime = false;
		this.isFunTimeReset = false;
		this.funTimeEnd = event.timeStamp + funTime;
	}
};

FunBar.prototype.getMaxOffsetOnBar = function() {
	return (this.current / maxValue) * maxWidth;
};

FunBar.prototype.drawFill = function(color) {
	color = (color === undefined) ? '#ff0' : color;
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.current / maxValue) * maxWidth, 40);
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

module.exports = FunBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/FunBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],17:[function(require,module,exports){
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

	this.healthText = new createjs.Text("", "25px Komika", '#fff');
	this.healthText.x = 70;
	this.healthText.y = 1;
	this.element.addChild(this.healthText);
}

HealthBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
};

HealthBar.prototype.tick = function(event) {
    this.healthText.text = this.object.health + '/' + this.object.maxHealth;
};

HealthBar.prototype.onHit = function(event) {
    if (event.hitTarget !== this.object.id ) {
        return;
    }

    this.drawFill();
};

HealthBar.prototype.drawFill = function() {
	var color = (this.object.id === 'player') ? '#f8f' : '#d00';
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.object.health / this.object.maxHealth) * maxWidth, 40);
};

module.exports = HealthBar;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/hud/HealthBar.js","/hud")
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Level = function(levelId, darkness, monsterSpeed, itemSeed, terrainSeed, playerHealth, monsterHealth, trees) {
    this.levelId = levelId;
    this.darkness = darkness;
    this.monsterSpeed = monsterSpeed;
    this.darkness = darkness;
    this.itemSeed = itemSeed;
    this.terrainSeed = terrainSeed;
    this.playerHealth = playerHealth;
    this.monsterHealth = monsterHealth;
    this.trees = trees;
};

module.exports = Level;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/level/Level.js","/level")
},{"buffer":2,"oMfpAn":5}],19:[function(require,module,exports){
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
    var raw_level = levelData[levelId];
    var level = new Level(
        levelId,
        raw_level.darkness,
        raw_level.monsterSpeed,
        raw_level.itemSeed,
        raw_level.terrainSeed,
        raw_level.playerHealth,
        raw_level.monsterHealth,
        raw_level.trees
    );

    return level;
};

module.exports = LevelBuilder;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/level/LevelBuilder.js","/level")
},{"./Level":18,"./levels":20,"buffer":2,"oMfpAn":5}],20:[function(require,module,exports){
module.exports={
  "1": {
    "darkness": 0.0,
    "monsterSpeed": 0.8,
    "itemSeed": 2,
    "terrainSeed": 101,
    "trees": 200,
    "playerHealth": 200,
    "monsterHealth": 100
  },
  "2": {
    "darkness": 0.60,
    "monsterSpeed": 0.9,
    "itemSeed": 3,
    "terrainSeed": 102,
    "trees": 500,
    "playerHealth": 150,
    "monsterHealth": 150
  },
  "3": {
    "darkness": 0.75,
    "monsterSpeed": 1.2,
    "itemSeed": 4,
    "terrainSeed": 103,
    "trees": 50,
    "playerHealth": 100,
    "monsterHealth": 200
  },
  "4": {
    "darkness": 0.80,
    "monsterSpeed": 1.5,
    "itemSeed": 5,
    "terrainSeed": 104,
    "trees": 375,
    "playerHealth": 100,
    "monsterHealth": 250
  },
  "5": {
    "darkness": 0.85,
    "monsterSpeed": 1.7,
    "itemSeed": 6,
    "terrainSeed": 105,
    "trees": 100,
    "playerHealth": 100,
    "monsterHealth": 300
  },
  "6": {
    "darkness": 0.90,
    "monsterSpeed": 2,
    "itemSeed": 7,
    "terrainSeed": 106,
    "trees": 100,
    "playerHealth": 100,
    "monsterHealth": 400
  },
  "7": {
    "darkness": 1,
    "monsterSpeed": 2.2,
    "itemSeed": 8,
    "terrainSeed": 107,
    "trees": 250,
    "playerHealth": 100,
    "monsterHealth": 500
  }
}
},{}],21:[function(require,module,exports){
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
    this.stage.on('click', function() {
        if (self.canAttack) {
            self.isAttacking = true;
        }
    });
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
},{"buffer":2,"oMfpAn":5}],22:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],23:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var comboInterval = 1500;

function ComboListener() {
    this.level = 0;
	this.lastHit = 0;
}

ComboListener.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    this.emitter = emitter;
};

ComboListener.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	if (event.timeStamp - this.lastHit > comboInterval) {
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

module.exports = ComboListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/ComboListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],24:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],25:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var maxItems = 7,
    cooldown = 10000;

function ItemListener(itemHandler) {
    this.currentItems = 0;
    this.nextItem = 0;

    this.itemHandler = itemHandler;
}

ItemListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    this.emitter.on('unequip', this.onUnequip.bind(this));
};

ItemListener.prototype.onUnequip = function() {
    this.currentItems--;
};

ItemListener.prototype.tick = function (event) {
    if (this.currentItems >= maxItems) {
        return;
    }

    if (this.nextItem > event.timeStamp) {
        return;
    }

    this.itemHandler.spawn();
    this.nextItem = event.timeStamp + cooldown;
    this.currentItems++;
};

module.exports = ItemListener;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/ItemListener.js","/listener")
},{"buffer":2,"oMfpAn":5}],26:[function(require,module,exports){
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
};

LevelUpListener.prototype.onStartLevel = function(reachedNewLevel) {
	if (reachedNewLevel) {
		currentLevelId++;
	}

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	//console.log('levelup', newLevel);

	this.emitter.emit('change-level', newLevel);
};

module.exports = LevelUpListener;
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/listener/LevelUpListener.js","/listener")
},{"../level/LevelBuilder":19,"buffer":2,"oMfpAn":5}],27:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],28:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],29:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],30:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],31:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var View = require('../views/View'),
    Player = require('../Player'),
    Monster = require('../Monster'),
    FunBar = require('../hud/FunBar'),
    HealthBar = require('../hud/HealthBar'),
    ComboListener = require('../listener/ComboListener'),
    CollisionListener = require('../listener/CollisionListener'),
    AttackListener = require('../listener/AttackListener'),
    SoundListener = require('../listener/SoundListener'),
    GrowlListener = require('../listener/GrowlListener'),
    LevelUpListener = require('../listener/LevelUpListener'),
    ItemListener = require('../listener/ItemListener'),
    GrowlHandler = require('../weapons/GrowlHandler'),
    ItemHandler = require('../weapons/ItemHandler'),
    Ground = require('../ground/Ground'),
    RainbowRoad = require('../ground/RainbowRoad'),
    RainbowRoadListener = require('../listener/RainbowRoadListener'),
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
},{"../GameConsts":6,"../Monster":7,"../Player":8,"../ground/Ground":13,"../ground/RainbowRoad":14,"../hud/FunBar":16,"../hud/HealthBar":17,"../listener/AttackListener":21,"../listener/CollisionListener":22,"../listener/ComboListener":23,"../listener/GrowlListener":24,"../listener/ItemListener":25,"../listener/LevelUpListener":26,"../listener/RainbowRoadListener":27,"../listener/SoundListener":28,"../nightOverlay/NightOverlay":29,"../views/View":36,"../weapons/GrowlHandler":38,"../weapons/ItemHandler":39,"buffer":2,"oMfpAn":5}],32:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],33:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],34:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],35:[function(require,module,exports){
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
},{"buffer":2,"oMfpAn":5}],36:[function(require,module,exports){
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
},{"../GameConsts":6,"buffer":2,"oMfpAn":5}],37:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var Vec2d = require('../util/Vector2d'),
    GameConsts = require('../GameConsts');

function Growl(x, y, target, lifetime, relativeLifetime) {
    this.id = 'growl';

    this.element = new createjs.Container();

	var fireball = new createjs.Bitmap("./img/fireball.png");
	this.element.scaleX = this.element.scaleY = 0.3;

    fireball.image.onload = function() {
		this.element.regX = this.element.getBounds().width / 2;
		this.element.regY = this.element.getBounds().height / 2;
	}.bind(this);

	this.element.addChild(fireball);

	this.target = target;
    this.element.x = x;
    this.element.y = y;
    this.lifetime = lifetime;
    this.velocity = new Vec2d(0, 0);

	createjs.Tween.get(this.element)
		.to({rotation: relativeLifetime}, relativeLifetime)
		.call(function() {
			this.element.removeChild(fireball);
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
},{"../GameConsts":6,"../util/Vector2d":35,"buffer":2,"oMfpAn":5}],38:[function(require,module,exports){
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
},{"../listener/CollisionListener":22,"./Growl":37,"buffer":2,"oMfpAn":5}],39:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var ShortWeapon = require('./ShortWeapon'),
    PseudoRand = require('../util/PseudoRand'),
    CollisionListener = require('../listener/CollisionListener'),
    GameConstants = require('../GameConsts');

var weaponLifeTime = 10;

function ItemHandler() {
    this.element = new createjs.Container();
    this.items = [];

    this.shouldSpawn = false;
    this.listeners = [];

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
            weaponLifeTime
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
};

module.exports = ItemHandler;

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/weapons/ItemHandler.js","/weapons")
},{"../GameConsts":6,"../listener/CollisionListener":22,"../util/PseudoRand":34,"./ShortWeapon":40,"buffer":2,"oMfpAn":5}],40:[function(require,module,exports){
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
};

ShortWeapon.prototype.onAttack = function(event) {
    this.canActive = true;
};

ShortWeapon.prototype.tick = function(event) {
    if (this.canActive) {
        this.isActive = true;
        this.canActive = false;
        this.cooldown = event.timeStamp + attackDuration;
        this.lifetime--;

        if (this.lifetime <= 0) {
            this.equipped = false;
        }
    }

    if (this.isActive && this.cooldown < event.timeStamp) {
        this.canActive = false;
        this.isActive = false;
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvR2FtZUNvbnN0cy5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvTW9uc3Rlci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvUGxheWVyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9QcmVsb2FkZXIuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvc3RhdGljL2pzL2Fzc2V0cy5qc29uIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9mYWtlX2FlZjAzMGYwLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9nYW1lLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9ncm91bmQvR3JvdW5kLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9ncm91bmQvUmFpbmJvd1JvYWQuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvc3RhdGljL2pzL2dyb3VuZC9UcmVlLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9odWQvRnVuQmFyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9odWQvSGVhbHRoQmFyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9sZXZlbC9MZXZlbC5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvbGV2ZWwvTGV2ZWxCdWlsZGVyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9sZXZlbC9sZXZlbHMuanNvbiIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvQXR0YWNrTGlzdGVuZXIuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0NvbGxpc2lvbkxpc3RlbmVyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Db21ib0xpc3RlbmVyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Hcm93bExpc3RlbmVyLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9JdGVtTGlzdGVuZXIuanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0xldmVsVXBMaXN0ZW5lci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvUmFpbmJvd1JvYWRMaXN0ZW5lci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvU291bmRMaXN0ZW5lci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvbmlnaHRPdmVybGF5L05pZ2h0T3ZlcmxheS5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvc2NyZWVucy9HYW1lT3ZlclNjcmVlbi5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvc2NyZWVucy9HYW1lU2NyZWVuLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy9zY3JlZW5zL0hvbWVTY3JlZW4uanMiLCIvVXNlcnMvc3RlcGhhbnZvY2svUHJvamVjdHMvZ2FtZXMvZ2FtZWphbS9nYW1lamFtLTcvc3RhdGljL2pzL3NjcmVlbnMvTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvdXRpbC9Qc2V1ZG9SYW5kLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy91dGlsL1ZlY3RvcjJkLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy92aWV3cy9WaWV3LmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy93ZWFwb25zL0dyb3dsLmpzIiwiL1VzZXJzL3N0ZXBoYW52b2NrL1Byb2plY3RzL2dhbWVzL2dhbWVqYW0vZ2FtZWphbS03L3N0YXRpYy9qcy93ZWFwb25zL0dyb3dsSGFuZGxlci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvd2VhcG9ucy9JdGVtSGFuZGxlci5qcyIsIi9Vc2Vycy9zdGVwaGFudm9jay9Qcm9qZWN0cy9nYW1lcy9nYW1lamFtL2dhbWVqYW0tNy9zdGF0aWMvanMvd2VhcG9ucy9TaG9ydFdlYXBvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmxDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKiBFdmVudEVtaXR0ZXIyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vaGlqMW54L0V2ZW50RW1pdHRlcjJcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgaGlqMW54XG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cbjshZnVuY3Rpb24odW5kZWZpbmVkKSB7XG5cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5ID8gQXJyYXkuaXNBcnJheSA6IGZ1bmN0aW9uIF9pc0FycmF5KG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuICB9O1xuICB2YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4gIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgaWYgKHRoaXMuX2NvbmYpIHtcbiAgICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIHRoaXMuX2NvbmYpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbmZpZ3VyZShjb25mKSB7XG4gICAgaWYgKGNvbmYpIHtcblxuICAgICAgdGhpcy5fY29uZiA9IGNvbmY7XG5cbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcbiAgICAgIGNvbmYubWF4TGlzdGVuZXJzICYmICh0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gY29uZi5tYXhMaXN0ZW5lcnMpO1xuICAgICAgY29uZi53aWxkY2FyZCAmJiAodGhpcy53aWxkY2FyZCA9IGNvbmYud2lsZGNhcmQpO1xuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xuXG4gICAgICBpZiAodGhpcy53aWxkY2FyZCkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyVHJlZSA9IHt9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEV2ZW50RW1pdHRlcihjb25mKSB7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgdGhpcy5uZXdMaXN0ZW5lciA9IGZhbHNlO1xuICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIGNvbmYpO1xuICB9XG5cbiAgLy9cbiAgLy8gQXR0ZW50aW9uLCBmdW5jdGlvbiByZXR1cm4gdHlwZSBub3cgaXMgYXJyYXksIGFsd2F5cyAhXG4gIC8vIEl0IGhhcyB6ZXJvIGVsZW1lbnRzIGlmIG5vIGFueSBtYXRjaGVzIGZvdW5kIGFuZCBvbmUgb3IgbW9yZVxuICAvLyBlbGVtZW50cyAobGVhZnMpIGlmIHRoZXJlIGFyZSBtYXRjaGVzXG4gIC8vXG4gIGZ1bmN0aW9uIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgaSkge1xuICAgIGlmICghdHJlZSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzPVtdLCBsZWFmLCBsZW4sIGJyYW5jaCwgeFRyZWUsIHh4VHJlZSwgaXNvbGF0ZWRCcmFuY2gsIGVuZFJlYWNoZWQsXG4gICAgICAgIHR5cGVMZW5ndGggPSB0eXBlLmxlbmd0aCwgY3VycmVudFR5cGUgPSB0eXBlW2ldLCBuZXh0VHlwZSA9IHR5cGVbaSsxXTtcbiAgICBpZiAoaSA9PT0gdHlwZUxlbmd0aCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiBhdCB0aGUgZW5kIG9mIHRoZSBldmVudChzKSBsaXN0IGFuZCB0aGUgdHJlZSBoYXMgbGlzdGVuZXJzXG4gICAgICAvLyBpbnZva2UgdGhvc2UgbGlzdGVuZXJzLlxuICAgICAgLy9cbiAgICAgIGlmICh0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGVhZiA9IDAsIGxlbiA9IHRyZWUuX2xpc3RlbmVycy5sZW5ndGg7IGxlYWYgPCBsZW47IGxlYWYrKykge1xuICAgICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzW2xlYWZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY3VycmVudFR5cGUgPT09ICcqJyB8fCBjdXJyZW50VHlwZSA9PT0gJyoqJykgfHwgdHJlZVtjdXJyZW50VHlwZV0pIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgZXZlbnQgZW1pdHRlZCBpcyAnKicgYXQgdGhpcyBwYXJ0XG4gICAgICAvLyBvciB0aGVyZSBpcyBhIGNvbmNyZXRlIG1hdGNoIGF0IHRoaXMgcGF0Y2hcbiAgICAgIC8vXG4gICAgICBpZiAoY3VycmVudFR5cGUgPT09ICcqJykge1xuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsxKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9IGVsc2UgaWYoY3VycmVudFR5cGUgPT09ICcqKicpIHtcbiAgICAgICAgZW5kUmVhY2hlZCA9IChpKzEgPT09IHR5cGVMZW5ndGggfHwgKGkrMiA9PT0gdHlwZUxlbmd0aCAmJiBuZXh0VHlwZSA9PT0gJyonKSk7XG4gICAgICAgIGlmKGVuZFJlYWNoZWQgJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gVGhlIG5leHQgZWxlbWVudCBoYXMgYSBfbGlzdGVuZXJzLCBhZGQgaXQgdG8gdGhlIGhhbmRsZXJzLlxuICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XG4gICAgICAgICAgaWYgKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSAnKicgfHwgYnJhbmNoID09PSAnKionKSB7XG4gICAgICAgICAgICAgIGlmKHRyZWVbYnJhbmNoXS5fbGlzdGVuZXJzICYmICFlbmRSZWFjaGVkKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gTm8gbWF0Y2ggb24gdGhpcyBvbmUsIHNoaWZ0IGludG8gdGhlIHRyZWUgYnV0IG5vdCBpbiB0aGUgdHlwZSBhcnJheS5cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfVxuXG4gICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVtjdXJyZW50VHlwZV0sIGkrMSkpO1xuICAgIH1cblxuICAgIHhUcmVlID0gdHJlZVsnKiddO1xuICAgIGlmICh4VHJlZSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBsaXN0ZW5lciB0cmVlIHdpbGwgYWxsb3cgYW55IG1hdGNoIGZvciB0aGlzIHBhcnQsXG4gICAgICAvLyB0aGVuIHJlY3Vyc2l2ZWx5IGV4cGxvcmUgYWxsIGJyYW5jaGVzIG9mIHRoZSB0cmVlXG4gICAgICAvL1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4VHJlZSwgaSsxKTtcbiAgICB9XG5cbiAgICB4eFRyZWUgPSB0cmVlWycqKiddO1xuICAgIGlmKHh4VHJlZSkge1xuICAgICAgaWYoaSA8IHR5cGVMZW5ndGgpIHtcbiAgICAgICAgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGEgbGlzdGVuZXIgb24gYSAnKionLCBpdCB3aWxsIGNhdGNoIGFsbCwgc28gYWRkIGl0cyBoYW5kbGVyLlxuICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1aWxkIGFycmF5cyBvZiBtYXRjaGluZyBuZXh0IGJyYW5jaGVzIGFuZCBvdGhlcnMuXG4gICAgICAgIGZvcihicmFuY2ggaW4geHhUcmVlKSB7XG4gICAgICAgICAgaWYoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgeHhUcmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gV2Uga25vdyB0aGUgbmV4dCBlbGVtZW50IHdpbGwgbWF0Y2gsIHNvIGp1bXAgdHdpY2UuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMik7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBjdXJyZW50VHlwZSkge1xuICAgICAgICAgICAgICAvLyBDdXJyZW50IG5vZGUgbWF0Y2hlcywgbW92ZSBpbnRvIHRoZSB0cmVlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2ggPSB7fTtcbiAgICAgICAgICAgICAgaXNvbGF0ZWRCcmFuY2hbYnJhbmNoXSA9IHh4VHJlZVticmFuY2hdO1xuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHsgJyoqJzogaXNvbGF0ZWRCcmFuY2ggfSwgaSsxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAvLyBXZSBoYXZlIHJlYWNoZWQgdGhlIGVuZCBhbmQgc3RpbGwgb24gYSAnKionXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH0gZWxzZSBpZih4eFRyZWVbJyonXSAmJiB4eFRyZWVbJyonXS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlWycqJ10sIHR5cGVMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gIH1cblxuICBmdW5jdGlvbiBncm93TGlzdGVuZXJUcmVlKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICB0eXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG5cbiAgICAvL1xuICAgIC8vIExvb2tzIGZvciB0d28gY29uc2VjdXRpdmUgJyoqJywgaWYgc28sIGRvbid0IGFkZCB0aGUgZXZlbnQgYXQgYWxsLlxuICAgIC8vXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdHlwZS5sZW5ndGg7IGkrMSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZih0eXBlW2ldID09PSAnKionICYmIHR5cGVbaSsxXSA9PT0gJyoqJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHRyZWUgPSB0aGlzLmxpc3RlbmVyVHJlZTtcbiAgICB2YXIgbmFtZSA9IHR5cGUuc2hpZnQoKTtcblxuICAgIHdoaWxlIChuYW1lKSB7XG5cbiAgICAgIGlmICghdHJlZVtuYW1lXSkge1xuICAgICAgICB0cmVlW25hbWVdID0ge307XG4gICAgICB9XG5cbiAgICAgIHRyZWUgPSB0cmVlW25hbWVdO1xuXG4gICAgICBpZiAodHlwZS5sZW5ndGggPT09IDApIHtcblxuICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IGxpc3RlbmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycyA9IFt0cmVlLl9saXN0ZW5lcnMsIGxpc3RlbmVyXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc0FycmF5KHRyZWUuX2xpc3RlbmVycykpIHtcblxuICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzLndhcm5lZCkge1xuXG4gICAgICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtID4gMCAmJiB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhblxuICAvLyAxMCBsaXN0ZW5lcnMgYXJlIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2hcbiAgLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG4gIC8vXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmRlbGltaXRlciA9ICcuJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xuICAgIGlmICghdGhpcy5fY29uZikgdGhpcy5fY29uZiA9IHt9O1xuICAgIHRoaXMuX2NvbmYubWF4TGlzdGVuZXJzID0gbjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmV2ZW50ID0gJyc7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKSB7XG4gICAgdGhpcy5tYW55KGV2ZW50LCAxLCBmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5tYW55ID0gZnVuY3Rpb24oZXZlbnQsIHR0bCwgZm4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKCkge1xuICAgICAgaWYgKC0tdHRsID09PSAwKSB7XG4gICAgICAgIHNlbGYub2ZmKGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGxpc3RlbmVyLl9vcmlnaW4gPSBmbjtcblxuICAgIHRoaXMub24oZXZlbnQsIGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIHZhciB0eXBlID0gYXJndW1lbnRzWzBdO1xuXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIH1cblxuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgKl9hbGwqIGZ1bmN0aW9ucyBhbmQgaW52b2tlIHRoZW0uXG4gICAgaWYgKHRoaXMuX2FsbCkge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuX2FsbC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIHRoaXMuX2FsbFtpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcblxuICAgICAgaWYgKCF0aGlzLl9hbGwgJiZcbiAgICAgICAgIXRoaXMuX2V2ZW50cy5lcnJvciAmJlxuICAgICAgICAhKHRoaXMud2lsZGNhcmQgJiYgdGhpcy5saXN0ZW5lclRyZWUuZXJyb3IpKSB7XG5cbiAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgYXJndW1lbnRzWzFdOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuY2F1Z2h0LCB1bnNwZWNpZmllZCAnZXJyb3InIGV2ZW50LlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXI7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBoYW5kbGVyID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpXG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIHNsb3dlclxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaGFuZGxlcikge1xuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgICB2YXIgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gKGxpc3RlbmVycy5sZW5ndGggPiAwKSB8fCAhIXRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gISF0aGlzLl9hbGw7XG4gICAgfVxuXG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG5cbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMub25BbnkodHlwZSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT0gXCJuZXdMaXN0ZW5lcnNcIiEgQmVmb3JlXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lcnNcIi5cbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgZ3Jvd0xpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB7XG4gICAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICAgIH1cbiAgICBlbHNlIGlmKHR5cGVvZiB0aGlzLl9ldmVudHNbdHlwZV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuICAgIH1cbiAgICBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblxuICAgICAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuXG4gICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uQW55ID0gZnVuY3Rpb24oZm4pIHtcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb25Bbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLl9hbGwpIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXG4gICAgdGhpcy5fYWxsLnB1c2goZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gZG9lcyBub3QgdXNlIGxpc3RlbmVycygpLCBzbyBubyBzaWRlIGVmZmVjdCBvZiBjcmVhdGluZyBfZXZlbnRzW3R5cGVdXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgIGxlYWZzLnB1c2goe19saXN0ZW5lcnM6aGFuZGxlcnN9KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICBpZiAoaXNBcnJheShoYW5kbGVycykpIHtcblxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0ubGlzdGVuZXIgJiYgaGFuZGxlcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLl9vcmlnaW4gJiYgaGFuZGxlcnNbaV0uX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zaXRpb24gPCAwKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgbGVhZi5fbGlzdGVuZXJzLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFuZGxlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGhhbmRsZXJzID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxuICAgICAgICAoaGFuZGxlcnMuX29yaWdpbiAmJiBoYW5kbGVycy5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmQW55ID0gZnVuY3Rpb24oZm4pIHtcbiAgICB2YXIgaSA9IDAsIGwgPSAwLCBmbnM7XG4gICAgaWYgKGZuICYmIHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoID4gMCkge1xuICAgICAgZm5zID0gdGhpcy5fYWxsO1xuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZihmbiA9PT0gZm5zW2ldKSB7XG4gICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgdmFyIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcblxuICAgICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICAgIHZhciBsZWFmID0gbGVhZnNbaUxlYWZdO1xuICAgICAgICBsZWFmLl9saXN0ZW5lcnMgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBoYW5kbGVycyA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVycywgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICAgIHJldHVybiBoYW5kbGVycztcbiAgICB9XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFtdO1xuICAgIGlmICghaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyc0FueSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgaWYodGhpcy5fYWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgfTtcblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRFbWl0dGVyO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIENvbW1vbkpTXG4gICAgZXhwb3J0cy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsLlxuICAgIHdpbmRvdy5FdmVudEVtaXR0ZXIyID0gRXZlbnRFbWl0dGVyO1xuICB9XG59KCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMi9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYlwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgR2FtZUNvbnN0cyA9IHt9O1xuXG4vLyB3aW5kb3cgc2l6ZSBpbiBweFxuR2FtZUNvbnN0cy5HQU1FX1dJRFRIIFx0PSAxMDI0O1xuR2FtZUNvbnN0cy5HQU1FX0hFSUdIVCBcdD0gNzY4O1xuXG4vLyB0b3RhbCBmaWVsZCBzaXplXG5HYW1lQ29uc3RzLlNJWkUgPSAzMDAwO1xuXG5HYW1lQ29uc3RzLk5JR0hUX01PREUgPSB0cnVlO1xuXG5HYW1lQ29uc3RzLk1PTlNURVJfU1BFRUQgPSAwLjAyNTtcblxubW9kdWxlLmV4cG9ydHMgPSBHYW1lQ29uc3RzO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0dhbWVDb25zdHMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgZ3Jvd2xNaW5EZWxheSA9IDUsXG5cdGdyb3dsU291bmRzID0gMzsgLy8gaW4gc2Vjb25kc1xuXG5cbnZhciBWZWMyZCA9IHJlcXVpcmUoJy4vdXRpbC9WZWN0b3IyZCcpLFxuXHRHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi9HYW1lQ29uc3RzJyk7XG5cbnZhciBNb25zdGVyID0gZnVuY3Rpb24oeCwgeSwgdGFyZ2V0KSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XG5cblx0dGhpcy5yYWRpdXMgPSA5MDtcblx0dGhpcy5tYXhIZWFsdGggPSB0aGlzLmhlYWx0aCA9IDMwMDtcblx0dGhpcy5pZCA9ICdtb25zdGVyJztcblx0dGhpcy5sYXN0R3Jvd2xBdCA9IDA7XG5cdHRoaXMuZ3Jvd2xTb3VuZEluZGV4ID0gMDtcblx0dGhpcy5ib3VuY2VWZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcblx0dGhpcy5zcGVlZCA9IDE7XG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy52ZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcblxuXHR2YXIgaW1hZ2UgPSBuZXcgY3JlYXRlanMuQml0bWFwKCcuL2ltZy9tb25zdGVyLnBuZycpO1xuXHR0aGlzLmVsZW1lbnQuc2NhbGVYID0gdGhpcy5lbGVtZW50LnNjYWxlWSA9IDAuMztcblxuXHRpbWFnZS5pbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRzZWxmLmVsZW1lbnQucmVnWCA9IHNlbGYuZWxlbWVudC5nZXRCb3VuZHMoKS53aWR0aCAvIDI7XG5cdFx0c2VsZi5lbGVtZW50LnJlZ1kgPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRzKCkuaGVpZ2h0IC8gMjtcblx0fTtcblxuXHR0aGlzLmVsZW1lbnQueCA9IHg7XG5cdHRoaXMuZWxlbWVudC55ID0geTtcblxuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoaW1hZ2UpO1xufTtcblxuTW9uc3Rlci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcblx0ZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcblx0dGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0aWYgKGV2ZW50LmhpdFRhcmdldCAhPT0gdGhpcy5pZCkge1xuXHRcdGlmIChldmVudC5kYW1hZ2VEZWFsZXIgPT0gdGhpcy5pZCkge1xuXHRcdFx0dmFyIHBvc2l0aW9uID0gbmV3IFZlYzJkKHRoaXMuZWxlbWVudC54LCB0aGlzLmVsZW1lbnQueSk7XG5cdFx0XHR2YXIgdGFyZ2V0X3Bvc2l0aW9uID0gbmV3IFZlYzJkKHRoaXMudGFyZ2V0LmVsZW1lbnQueCwgdGhpcy50YXJnZXQuZWxlbWVudC55KTtcblx0XHRcdHRoaXMudGFyZ2V0LmJvdW5jZVZlbG9jaXR5ID0gIFZlYzJkLnN1YnRyYWN0KHRhcmdldF9wb3NpdGlvbiwgcG9zaXRpb24pLm5vcm0oKS50aW1lcygxODApO1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fVxuXG5cdHRoaXMuYm91bmNlVmVsb2NpdHkgPSB0aGlzLnZlbG9jaXR5LmNsb25lKCkubm9ybSgpLnRpbWVzKC0xODApO1xuXG5cdHRoaXMuaGVhbHRoIC09IGV2ZW50LmRhbWFnZTtcblx0dGhpcy5oZWFsdGggPSBNYXRoLm1heCgwLCB0aGlzLmhlYWx0aCk7XG5cblx0aWYgKHRoaXMuaGVhbHRoID09IDApIHtcblx0XHR0aGlzLmVtaXR0ZXIuZW1pdCgnbW9uc3Rlci1kZWFkJyk7XG5cdH1cbn07XG5cbi8qKlxuICogQHBhcmFtIGV2ZW50XG4gKi9cbk1vbnN0ZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuXHR2YXIgY3VycmVudCA9IG5ldyBWZWMyZCh0aGlzLnRhcmdldC5lbGVtZW50LngsIHRoaXMudGFyZ2V0LmVsZW1lbnQueSk7XG5cdHZhciB0YXJnZXQgPSBuZXcgVmVjMmQodGhpcy5lbGVtZW50LngsIHRoaXMuZWxlbWVudC55KTtcblxuXHR2YXIgdmVjdG9yX3RvX2Rlc3RpbmF0aW9uID0gVmVjMmQuc3VidHJhY3QoY3VycmVudCwgdGFyZ2V0KTtcblx0dmFyIGRpc3RhbmNlID0gdmVjdG9yX3RvX2Rlc3RpbmF0aW9uLmxlbmd0aCgpO1xuXG5cdC8vIGNhbGN1bGF0ZSBuZXcgdmVsb2NpdHkgYWNjb3JkaW5nIHRvIGN1cnJlbnQgdmVsb2NpdHkgYW5kIHBvc2l0aW9uIG9mIHRhcmdldFxuXHR2ZWN0b3JfdG9fZGVzdGluYXRpb24ubm9ybSgpLnRpbWVzKDAuNSk7XG5cdHRoaXMudmVsb2NpdHkubm9ybSgpLnRpbWVzKDIwKTtcblx0dGhpcy52ZWxvY2l0eSA9IHRoaXMudmVsb2NpdHkucGx1cyh2ZWN0b3JfdG9fZGVzdGluYXRpb24pO1xuXG5cdC8vIHNldCBzcGVlZCBvZiBtb25zdGVyIGFjY29yZGluZyB0byBkaXN0YW5jZSB0byB0YXJnZXRcblx0dGhpcy52ZWxvY2l0eS50aW1lcyhkaXN0YW5jZSk7XG5cblx0dmFyIGRlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy52ZWxvY2l0eSwgZXZlbnQuZGVsdGEgLyAxMDAwICogR2FtZUNvbnN0cy5NT05TVEVSX1NQRUVEICogdGhpcy5zcGVlZCk7XG5cdHZhciBhbmdsZSA9IFZlYzJkLmdldEFuZ2xlKGRlbHRhKTtcblxuXHRpZiAodGhpcy5ib3VuY2VWZWxvY2l0eS5sZW5ndGgoKSAhPSAwKSB7XG5cdFx0dmFyIHB1c2hfZGVsdGEgPSBWZWMyZC5tdWx0aXBseSh0aGlzLmJvdW5jZVZlbG9jaXR5LmNsb25lKCksIGV2ZW50LmRlbHRhIC8gODApO1xuXHRcdHRoaXMuYm91bmNlVmVsb2NpdHkgPSB0aGlzLmJvdW5jZVZlbG9jaXR5Lm1pbnVzKHB1c2hfZGVsdGEpO1xuXG5cdFx0ZGVsdGEucGx1cyhwdXNoX2RlbHRhKTtcblxuXHRcdGlmIChwdXNoX2RlbHRhLmxlbmd0aCgpIDwgMSkge1xuXHRcdFx0dGhpcy5ib3VuY2VWZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcblx0XHR9XG5cdH1cblxuXHR0aGlzLmVsZW1lbnQueCArPSBkZWx0YS54O1xuXHR0aGlzLmVsZW1lbnQueSArPSBkZWx0YS55O1xuXG5cdHRoaXMuZWxlbWVudC54ID0gTWF0aC5taW4oR2FtZUNvbnN0cy5TSVpFLCBNYXRoLm1heCgtR2FtZUNvbnN0cy5TSVpFLCB0aGlzLmVsZW1lbnQueCkpO1xuXHR0aGlzLmVsZW1lbnQueSA9IE1hdGgubWluKEdhbWVDb25zdHMuU0laRSwgTWF0aC5tYXgoLUdhbWVDb25zdHMuU0laRSwgdGhpcy5lbGVtZW50LnkpKTtcblxuXHR0aGlzLmVsZW1lbnQucm90YXRpb24gPSBhbmdsZTtcblxuXHRpZiAoZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0R3Jvd2xBdCA+IGdyb3dsTWluRGVsYXkgKiAxMDAwKSB7XG5cdFx0dGhpcy5ncm93bCgpO1xuXHR9XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5ncm93bCA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmxhc3RHcm93bEF0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2dyb3dsJyArIHRoaXMuZ3Jvd2xTb3VuZEluZGV4LCB7dm9sdW1lOiAwLjh9KTtcblx0dGhpcy5ncm93bFNvdW5kSW5kZXggPSAodGhpcy5ncm93bFNvdW5kSW5kZXggKyAxKSAlIGdyb3dsU291bmRzO1xuXG5cdHRoaXMuZW1pdHRlci5lbWl0KCdncm93bCcsIHtcblx0XHR4OiB0aGlzLmVsZW1lbnQueCxcblx0XHR5OiB0aGlzLmVsZW1lbnQueSxcblx0XHR0YXJnZXQ6IHRoaXMudGFyZ2V0XG5cdH0pO1xufTtcblxuTW9uc3Rlci5wcm90b3R5cGUuZ2V0UmFkaXVzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnJhZGl1cztcbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLmlzU2hvcnRBdHRhY2tpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZhbHNlO1xufTtcblxuTW9uc3Rlci5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG5cdHRoaXMubWF4SGVhbHRoID0gbGV2ZWwubW9uc3RlckhlYWx0aDtcblx0dGhpcy5oZWFsdGggPSBsZXZlbC5tb25zdGVySGVhbHRoO1xuXHR0aGlzLnNwZWVkID0gbGV2ZWwubW9uc3RlclNwZWVkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb25zdGVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL01vbnN0ZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBWZWMyZCA9IHJlcXVpcmUoJy4vdXRpbC9WZWN0b3IyZCcpLFxuICAgIEdhbWVDb25zdHMgPSByZXF1aXJlKCcuL0dhbWVDb25zdHMnKTtcblxudmFyIGZ1bkZhY3RvciA9IDM7XG5cbi8qKlxuICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xudmFyIFBsYXllciA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5yYWRpdXMgPSAzMDtcbiAgICB0aGlzLm1heEhlYWx0aCA9IHRoaXMuaGVhbHRoID0gMTAwO1xuICAgIHRoaXMuaWQgPSAncGxheWVyJztcbiAgICB0aGlzLmFuZ2xlID0gMDtcblx0dGhpcy5mb290c3RlcHNQbGF5ZWQgPSAwO1xuXHR0aGlzLmZvb3RzdGVwTnVtYmVyID0gMTtcblxuXHR0aGlzLmF0dGFja1N0YXJ0ZWQgPSAwO1xuICAgIHRoaXMudmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG4gICAgdGhpcy5ib3VuY2VWZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcblxuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblxuXHR2YXIgc3MgPSBuZXcgY3JlYXRlanMuU3ByaXRlU2hlZXQoe1xuXHRcdFwiYW5pbWF0aW9uc1wiOlxuXHRcdHtcblx0XHRcdFwid2Fsa1wiOiB7XG5cdFx0XHRcdGZyYW1lczogWzEsIDJdLFxuXHRcdFx0XHRuZXh0Olwid2Fsa1wiLFxuXHRcdFx0XHRzcGVlZDogMC4yXG5cdFx0XHR9LFxuXHRcdFx0XCJ3YWl0XCI6IHtcblx0XHRcdFx0ZnJhbWVzOiBbMF0sXG5cdFx0XHRcdG5leHQ6XCJ3YWl0XCIsXG5cdFx0XHRcdHNwZWVkOiAwLjJcblx0XHRcdH1cblx0XHR9LFxuXHRcdFwiaW1hZ2VzXCI6IFtcIi4vaW1nL3BsYXllcl9zcHJpdGUucG5nXCJdLFxuXHRcdFwiZnJhbWVzXCI6XG5cdFx0e1xuXHRcdFx0XCJoZWlnaHRcIjogMTAyNCxcblx0XHRcdFwid2lkdGhcIjoxMDI0LFxuXHRcdFx0XCJyZWdYXCI6IDAsXG5cdFx0XHRcInJlZ1lcIjogMCxcblx0XHRcdFwiY291bnRcIjogM1xuXHRcdH1cblx0fSk7XG5cblx0dGhpcy5zcHJpdGUgPSBuZXcgY3JlYXRlanMuU3ByaXRlKHNzLCBcIndhaXRcIik7XG5cbiAgICB0aGlzLmVsZW1lbnQuc2NhbGVYID0gdGhpcy5lbGVtZW50LnNjYWxlWSA9IDAuMTtcblx0c2VsZi5lbGVtZW50LnJlZ1ggPSBzZWxmLmVsZW1lbnQucmVnWSA9IDUxMjtcblxuXHR0aGlzLmVsZW1lbnQueCA9IHg7XG5cdHRoaXMuZWxlbWVudC55ID0geTtcblxuICAgIHRoaXMuaGFzRnVuID0gZmFsc2U7XG5cbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5zcHJpdGUpO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ2F0dGFjaycsIHRoaXMub25BdHRhY2suYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignc3RhZ2Vtb3VzZW1vdmUnLCB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ2Z1bicsIHRoaXMub25GdW4uYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xuXG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ICE9PSB0aGlzLmlkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5oYXNGdW4pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuaGVhbHRoIC09IGV2ZW50LmRhbWFnZTtcbiAgICB0aGlzLmhlYWx0aCA9IE1hdGgubWF4KDAsIHRoaXMuaGVhbHRoKTtcblxuXHRpZiAodGhpcy5oZWFsdGggPT0gMCkge1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdwbGF5ZXItZGVhZCcpO1xuXHR9XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uQXR0YWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0dGhpcy5hdHRhY2tTdGFydGVkID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG59O1xuXG5cblBsYXllci5wcm90b3R5cGUub25Nb3VzZU1vdmUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBjdXJyZW50X3NwZWVkID0gdGhpcy52ZWxvY2l0eS5sZW5ndGgoKTtcblxuICAgIHZhciBtb3VzZV9kZWx0YSA9IG5ldyBWZWMyZChcbiAgICAgICAgZXZlbnQuc3RhZ2VYIC0gR2FtZUNvbnN0cy5HQU1FX1dJRFRIIC8gMixcbiAgICAgICAgZXZlbnQuc3RhZ2VZIC0gR2FtZUNvbnN0cy5HQU1FX0hFSUdIVCAvIDJcbiAgICApO1xuXG4gICAgdGhpcy5hbmdsZSA9IFZlYzJkLmdldEFuZ2xlKG1vdXNlX2RlbHRhKTtcblxuICAgIGlmICh0aGlzLmhhc0Z1bikge1xuICAgICAgICBtb3VzZV9kZWx0YS50aW1lcyhmdW5GYWN0b3IpO1xuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnaGFzLWZ1bicsIHt4OiB0aGlzLmVsZW1lbnQueCwgeTogdGhpcy5lbGVtZW50Lnl9KTtcbiAgICB9XG5cbiAgICBpZiAobW91c2VfZGVsdGEubGVuZ3RoKCkgPCA2MCkge1xuICAgICAgICB0aGlzLnZlbG9jaXR5LnggPSAwO1xuICAgICAgICB0aGlzLnZlbG9jaXR5LnkgPSAwO1xuXG4gICAgICAgIGlmIChjdXJyZW50X3NwZWVkKSB7XG4gICAgICAgICAgICB0aGlzLnNwcml0ZS5nb3RvQW5kUGxheSgnd2FpdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZihjdXJyZW50X3NwZWVkID09IDApIHtcbiAgICAgICAgdGhpcy5zcHJpdGUuZ290b0FuZFBsYXkoJ3dhbGsnKTtcbiAgICB9XG5cbiAgICB0aGlzLnZlbG9jaXR5ID0gbW91c2VfZGVsdGE7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uRnVuID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmhhc0Z1biA9IGV2ZW50LnN0YXR1cztcbn07XG5cbi8qKlxuICogQHBhcmFtIGV2ZW50XG4gKi9cblBsYXllci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdmFyIGRlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy52ZWxvY2l0eSwgZXZlbnQuZGVsdGEgLyAxMDAwKTtcblxuICAgIGlmICh0aGlzLmJvdW5jZVZlbG9jaXR5Lmxlbmd0aCgpICE9IDApIHtcbiAgICAgICAgdmFyIHB1c2hfZGVsdGEgPSBWZWMyZC5tdWx0aXBseSh0aGlzLmJvdW5jZVZlbG9jaXR5LmNsb25lKCksIGV2ZW50LmRlbHRhIC8gODApO1xuICAgICAgICB0aGlzLmJvdW5jZVZlbG9jaXR5ID0gdGhpcy5ib3VuY2VWZWxvY2l0eS5taW51cyhwdXNoX2RlbHRhKTtcblxuICAgICAgICBkZWx0YS5wbHVzKHB1c2hfZGVsdGEpO1xuXG4gICAgICAgIGlmIChwdXNoX2RlbHRhLmxlbmd0aCgpIDwgMSkge1xuICAgICAgICAgICAgdGhpcy5ib3VuY2VWZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudC54ICs9IGRlbHRhLng7XG4gICAgdGhpcy5lbGVtZW50LnkgKz0gZGVsdGEueTtcblxuICAgIHRoaXMuZWxlbWVudC54ID0gTWF0aC5taW4oR2FtZUNvbnN0cy5TSVpFLCBNYXRoLm1heCgtR2FtZUNvbnN0cy5TSVpFLCB0aGlzLmVsZW1lbnQueCkpO1xuICAgIHRoaXMuZWxlbWVudC55ID0gTWF0aC5taW4oR2FtZUNvbnN0cy5TSVpFLCBNYXRoLm1heCgtR2FtZUNvbnN0cy5TSVpFLCB0aGlzLmVsZW1lbnQueSkpO1xuXG4gICAgdGhpcy5lbGVtZW50LnJvdGF0aW9uID0gdGhpcy5hbmdsZTtcblxuXHQvLyBjaGFuZ2Ugc3BlZWQgb2YgYW5pbWF0aW9uXG4gICAgdGhpcy5zcHJpdGUuZnJhbWVyYXRlID0gZGVsdGEubGVuZ3RoKCkgKiA2O1xuXG4gICAgaWYgKHRoaXMud2VhcG9uKSB7XG4gICAgICAgIGlmICghdGhpcy53ZWFwb24uZXF1aXBwZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLndlYXBvbi5lbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMud2VhcG9uID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCd1bmVxdWlwJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYXR0YWNrU3RhcnRlZERpZmYgPSBldmVudC50aW1lU3RhbXAgLSB0aGlzLmF0dGFja1N0YXJ0ZWQ7XG4gICAgICAgICAgICBpZiAoYXR0YWNrU3RhcnRlZERpZmYgPCA1MDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnQucm90YXRpb24gPSBNYXRoLnJvdW5kKHRoaXMuZWxlbWVudC5yb3RhdGlvbiArIDEwODAgLyA1MDAgKiBhdHRhY2tTdGFydGVkRGlmZik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMud2VhcG9uLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG5cdGlmICh0aGlzLnZlbG9jaXR5Lmxlbmd0aCgpID4gMCAmJiAoZXZlbnQudGltZVN0YW1wIC0gdGhpcy5mb290c3RlcHNQbGF5ZWQpID4gNDUwMDAgLyB0aGlzLnZlbG9jaXR5Lmxlbmd0aCgpKSB7XG5cdFx0Y3JlYXRlanMuU291bmQucGxheSgnZm9vdHN0ZXAnICsgdGhpcy5mb290c3RlcE51bWJlciwge3ZvbHVtZTogMC42fSk7XG5cdFx0dGhpcy5mb290c3RlcHNQbGF5ZWQgPSBldmVudC50aW1lU3RhbXA7XG5cdFx0dGhpcy5mb290c3RlcE51bWJlciA9ICh0aGlzLmZvb3RzdGVwTnVtYmVyICsgMSkgJSAyO1xuXHR9XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLmVxdWlwID0gZnVuY3Rpb24od2VhcG9uKSB7XG4gICAgd2VhcG9uLmVxdWlwKCk7XG4gICAgdGhpcy53ZWFwb24gPSB3ZWFwb247XG4gICAgdGhpcy53ZWFwb24ucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQod2VhcG9uLmVsZW1lbnQpO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5nZXRSYWRpdXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuaXNTaG9ydEF0dGFja2luZygpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5yYWRpdXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmFkaXVzO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5pc1Nob3J0QXR0YWNraW5nID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFzRnVuKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLndlYXBvbiAmJiB0aGlzLndlYXBvbi5pZCA9PSAnc2hvcnQtd2VhcG9uJyAmJiB0aGlzLndlYXBvbi5pc0FjdGl2ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuICAgIHRoaXMubWF4SGVhbHRoID0gbGV2ZWwucGxheWVySGVhbHRoO1xuICAgIHRoaXMuaGVhbHRoID0gbGV2ZWwucGxheWVySGVhbHRoO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5ZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvUGxheWVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyO1xuXG5mdW5jdGlvbiBQcmVsb2FkZXIoKSB7XG5cdHRoaXMucXVldWUgPSBuZXcgY3JlYXRlanMuTG9hZFF1ZXVlKCk7XG5cdHRoaXMucXVldWUuaW5zdGFsbFBsdWdpbihjcmVhdGVqcy5Tb3VuZCk7XG59XG5cblByZWxvYWRlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKGZpbGVzKSB7XG5cdHRoaXMucXVldWUubG9hZE1hbmlmZXN0KGZpbGVzKTtcbn07XG5cblByZWxvYWRlci5wcm90b3R5cGUub25Db21wbGV0ZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdHRoaXMucXVldWUub24oJ2NvbXBsZXRlJywgY2FsbGJhY2spO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcmVsb2FkZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvUHJlbG9hZGVyLmpzXCIsXCIvXCIpIiwibW9kdWxlLmV4cG9ydHM9W1xuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImZpcmViYWxsXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZmlyZWJhbGwucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdhbWVvdmVyXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZ2FtZW92ZXIucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdyYXNzXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvZ3Jhc3MucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1vbnN0ZXJcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9tb25zdGVyLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJuaWdodG1vZGVcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9uaWdodG1vZGUucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInBsYXllclwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3BsYXllci5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwicGxheWVyX3Nwcml0ZVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3BsYXllcl9zcHJpdGUucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInNjaHdlcnRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9zY2h3ZXJ0LnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJ0cmVlXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvdHJlZS5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiYmFja2dyb3VuZFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2JhY2tncm91bmQubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImRlZmVhdFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2RlZmVhdC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZm9vdHN0ZXAwXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZm9vdHN0ZXAwLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJmb290c3RlcDFcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9mb290c3RlcDEubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImZ1blwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2Z1bi5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZ2lybC1odXJ0XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZ2lybC1odXJ0Lm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJncm93bDBcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9ncm93bDAubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdyb3dsMVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2dyb3dsMS5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZ3Jvd2wyXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZ3Jvd2wyLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJsYXVuY2gtZmlyZWJhbGxcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9sYXVuY2gtZmlyZWJhbGwubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljMFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljMC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWMxXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWMxLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzJcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzIubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljM1wiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljMy5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWM0XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWM0Lm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzVcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzUubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1vbnN0ZXItaHVydFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21vbnN0ZXItaHVydC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwic3dpbmcxXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvc3dpbmcxLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJ2aWN0b3J5XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvdmljdG9yeS5tcDNcIlxuICAgIH1cbl0iLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBHYW1lID0gcmVxdWlyZSgnLi9nYW1lJyksXG5cdFByZWxvYWRlciA9IHJlcXVpcmUoJy4vUHJlbG9hZGVyJyksXG5cdGFzc2V0cyA9IHJlcXVpcmUoJy4vYXNzZXRzJyk7XG5cbnZhciBwcmVsb2FkZXIgPSBuZXcgUHJlbG9hZGVyKCk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKCdnYW1lX2NhbnZhcycpO1xuZ2FtZS5pbml0KCk7XG5cbnByZWxvYWRlci5vbkNvbXBsZXRlKGZ1bmN0aW9uKCkge1xuXHRnYW1lLmFzc2V0c1JlYWR5KCk7XG59KTtcblxucHJlbG9hZGVyLmxvYWQoYXNzZXRzKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9mYWtlX2FlZjAzMGYwLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyLFxuICAgIEdhbWVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvR2FtZVNjcmVlbicpLFxuICAgIE1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbicpLFxuICAgIEhvbWVTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvSG9tZVNjcmVlbicpLFxuICAgIEdhbWVPdmVyU2NyZWVuID0gcmVxdWlyZSgnLi9zY3JlZW5zL0dhbWVPdmVyU2NyZWVuJyk7XG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEdhbWUgPSBmdW5jdGlvbihnYW1lQ2FudmFzSWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzLmVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgdGhpcy5zdGFnZSA9IG5ldyBjcmVhdGVqcy5TdGFnZShnYW1lQ2FudmFzSWQpO1xuXG4gICAgdGhpcy5nYW1lU2NyZWVuID0gbmV3IEdhbWVTY3JlZW4odGhpcy5zdGFnZSk7XG4gICAgdGhpcy5nYW1lT3ZlclNjcmVlbiA9IG5ldyBHYW1lT3ZlclNjcmVlbigpO1xuICAgIHRoaXMubWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbiA9IG5ldyBNYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuKCk7XG4gICAgdGhpcy5ob21lU2NyZWVuID0gbmV3IEhvbWVTY3JlZW4oKTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuZ2FtZVNjcmVlbi5lbGVtZW50KTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuZ2FtZU92ZXJTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLm1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLmhvbWVTY3JlZW4uZWxlbWVudCk7XG5cbiAgICB0aGlzLmdhbWVTY3JlZW4ucmVnaXN0ZXJFdmVudCh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcblxuICAgIGNyZWF0ZWpzLlRpY2tlci5zZXRGUFMoNjApO1xuICAgIGNyZWF0ZWpzLlRpY2tlci5zZXRQYXVzZWQodHJ1ZSk7XG4gICAgY3JlYXRlanMuVGlja2VyLmFkZEV2ZW50TGlzdGVuZXIoJ3RpY2snLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBzZWxmLnRpY2soZXZlbnQpO1xuICAgIH0pO1xufTtcblxuR2FtZS5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbigncGxheWVyLWRlYWQnLCB0aGlzLm9uR2FtZU92ZXIuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignbW9uc3Rlci1kZWFkJywgdGhpcy5vbk5leHRDYXN0bGVTY3JlZW4uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLnN0YWdlLm9uKCdzdGFnZW1vdXNlbW92ZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGVtaXR0ZXIuZW1pdCgnc3RhZ2Vtb3VzZW1vdmUnLCBldmVudCk7XG4gICAgfSk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5ob21lU2NyZWVuLnN0YXJ0KCk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5hc3NldHNSZWFkeSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaG9tZVNjcmVlbi5pc1JlYWR5KCk7XG4gICAgdGhpcy5zdGFnZS5vbignc3RhZ2Vtb3VzZXVwJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaG9tZVNjcmVlbi5yZXNldCgpO1xuICAgICAgICB0aGlzLnN0YXJ0TmV3Z2FtZSgpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5zdGFydE5ld2dhbWUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YXJ0KHRydWUpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihyZWFjaGVkTmV3TGV2ZWwpIHtcbiAgICB0aGlzLmNoYW5nZVNjcmVlbigpO1xuXG4gICAgdGhpcy5nYW1lU2NyZWVuLnN0YXJ0KCk7XG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoJ3N0YXJ0LWxldmVsJywgcmVhY2hlZE5ld0xldmVsKTtcblxuICAgIGNyZWF0ZWpzLlRpY2tlci5zZXRQYXVzZWQoZmFsc2UpO1xufTtcblxuR2FtZS5wcm90b3R5cGUub25OZXh0Q2FzdGxlU2NyZWVuID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjcmVhdGVqcy5UaWNrZXIuc2V0UGF1c2VkKHRydWUpO1xuICAgIHRoaXMuZ2FtZVNjcmVlbi5yZXNldCgpO1xuICAgIHRoaXMuY2hhbmdlU2NyZWVuKCk7XG5cbiAgICB0aGlzLm1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4uc3RhcnQoKTtcbiAgICB0aGlzLnN0YWdlLm9uKCdzdGFnZW1vdXNldXAnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5tYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLnJlc2V0KCk7XG4gICAgICAgIHRoaXMuc3RhcnQodHJ1ZSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLm9uR2FtZU92ZXIgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGNyZWF0ZWpzLlRpY2tlci5zZXRQYXVzZWQodHJ1ZSk7XG4gICAgdGhpcy5nYW1lU2NyZWVuLnJlc2V0KCk7XG4gICAgdGhpcy5jaGFuZ2VTY3JlZW4oKTtcblxuICAgIHRoaXMuZ2FtZU92ZXJTY3JlZW4uc3RhcnQoKTtcbiAgICB0aGlzLnN0YWdlLm9uKCdzdGFnZW1vdXNldXAnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5nYW1lT3ZlclNjcmVlbi5yZXNldCgpO1xuICAgICAgICB0aGlzLnN0YXJ0KGZhbHNlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuY2hhbmdlU2NyZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbWl0dGVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIHRoaXMuc3RhZ2UucmVtb3ZlQWxsRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG59O1xuXG5HYW1lLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLnN0YWdlLnVwZGF0ZShldmVudCk7XG5cblx0aWYgKGV2ZW50LnBhdXNlZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG4gICAgdGhpcy5nYW1lU2NyZWVuLnRpY2soZXZlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHYW1lO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2dhbWUuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpLFxuXHRQc2V1ZG9SYW5kID0gcmVxdWlyZSgnLi4vdXRpbC9Qc2V1ZG9SYW5kJyksXG5cdFRyZWUgPSByZXF1aXJlKCcuL1RyZWUnKTtcblxudmFyIEdyb3VuZCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dGhpcy5wc2V1ZG9SYW5kb20gPSBuZXcgUHNldWRvUmFuZCgpO1xuXG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5zaGFwZSA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXHR0aGlzLnRyZWVDb3VudCA9IDA7XG5cblx0dmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuXHRpbWcub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0c2VsZi5zaGFwZS5ncmFwaGljc1xuXHRcdFx0LmJlZ2luQml0bWFwRmlsbChpbWcsICdyZXBlYXQnKVxuXHRcdFx0LmRyYXdSZWN0KDAsIDAsIDEwMDAwLCAxMDAwMCk7XG5cdH07XG5cdGltZy5zcmMgPSAnLi9pbWcvZ3Jhc3MucG5nJztcblxuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5zaGFwZSk7XG5cdHRoaXMuZWxlbWVudC54ID0gLUdhbWVDb25zdHMuU0laRTtcblx0dGhpcy5lbGVtZW50LnkgPSAtR2FtZUNvbnN0cy5TSVpFO1xufTtcblxuR3JvdW5kLnByb3RvdHlwZS5zcGF3blRyZWVzID0gZnVuY3Rpb24oKSB7XG5cdHZhciB4LCB5LCByLCBpO1xuXG5cdGZvciAoaSA9IDA7IGkgPD0gdGhpcy50cmVlQ291bnQ7IGkrKykge1xuXHRcdHggPSB0aGlzLnBzZXVkb1JhbmRvbS5nZXRSYW5kb20oKSAlIEdhbWVDb25zdHMuU0laRSAqIDI7XG5cdFx0eSA9IHRoaXMucHNldWRvUmFuZG9tLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0cy5TSVpFICogMjtcblx0XHRyID0gNzAgKyB0aGlzLnBzZXVkb1JhbmRvbS5nZXRSYW5kb20oKSAlIDEwMDtcblxuXHRcdHRoaXMuZWxlbWVudC5hZGRDaGlsZChuZXcgVHJlZSh4LCB5LCByKS5lbGVtZW50KTtcblx0fVxufTtcblxuR3JvdW5kLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxuR3JvdW5kLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy5wc2V1ZG9SYW5kb20uc2V0U2VlZChsZXZlbC5pdGVtU2VlZCk7XG5cdHRoaXMudHJlZUNvdW50ID0gbGV2ZWwudHJlZXM7XG5cdHRoaXMuc3Bhd25UcmVlcygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcm91bmQ7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL0dyb3VuZC5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFJhaW5ib3dSb2FkKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5oYXNGYW4gPSAwO1xufVxuXG5SYWluYm93Um9hZC5wcm90b3R5cGUucGFpbnQgPSBmdW5jdGlvbihldmVudCkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKykge1xuXHRcdHRoaXMuc3Bhd25KdWljeVN0YXIoZXZlbnQueCwgZXZlbnQueSk7XG5cdH1cbn07XG5cblJhaW5ib3dSb2FkLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAvLyByZW1vdmUgb2xkIHBhaW50aW5nc1xufTtcblxuUmFpbmJvd1JvYWQucHJvdG90eXBlLnNwYXduSnVpY3lTdGFyID0gZnVuY3Rpb24oeCwgeSkge1xuXHR2YXIgc2l6ZSA9IDggKyA3ICogTWF0aC5yYW5kb20oKTtcblxuXHR2YXIgc3RhciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuXHRzdGFyLnggPSB4IC0gMTUgKyAzMCAqIE1hdGgucmFuZG9tKCk7XG5cdHN0YXIueSA9IHkgLSAxNSArIDMwICogTWF0aC5yYW5kb20oKTtcblx0c3Rhci5yb3RhdGlvbiA9IHBhcnNlSW50KE1hdGgucmFuZG9tKCkgKiAzNjApO1xuXHRzdGFyLmdyYXBoaWNzLmJlZ2luU3Ryb2tlKFwiI2YwZlwiKS5iZWdpbkZpbGwoJyNmZjAnKS5zZXRTdHJva2VTdHlsZSgxKS5kcmF3UG9seVN0YXIoMCwgMCwgc2l6ZSAvIDIsIDUsIDAuNikuY2xvc2VQYXRoKCk7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChzdGFyKTtcblxuXHRjcmVhdGVqcy5Ud2Vlbi5nZXQoc3Rhcilcblx0XHQudG8oe2FscGhhOiAwLCByb3RhdGlvbjogc3Rhci5yb3RhdGlvbiArIDE4MH0sIDUwMCArIDUwMCAqIE1hdGgucmFuZG9tKCksIGNyZWF0ZWpzLkVhc2UubGluZWFyKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHN0YXIpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJhaW5ib3dSb2FkO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2dyb3VuZC9SYWluYm93Um9hZC5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFRyZWUgPSBmdW5jdGlvbih4LCB5LCByKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG4gICAgdmFyIGJpdG1hcCA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoXCIuL2ltZy90cmVlLnBuZ1wiKTtcbiAgICBiaXRtYXAueCA9IHg7XG4gICAgYml0bWFwLnkgPSB5O1xuICAgIGJpdG1hcC5zY2FsZVggPSBiaXRtYXAuc2NhbGVZID0gciAvIDEwMDtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoYml0bWFwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVHJlZTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL1RyZWUuanNcIixcIi9ncm91bmRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbWF4VmFsdWUgPSAxNTtcbnZhciBmdW5UaW1lID0gNzUwMDtcbnZhciBhdXRvRGVjcmVhc2VQZXJTZWNvbmQgPSAwLjU7XG52YXIgbWF4V2lkdGggPSAyNDA7XG52YXIganVpY3lTdGFyQ291bnQgPSAxNTtcbnZhciBtYXhNYWdpY0xldmVsID0gNTtcblxudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gRnVuQmFyKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB0aGlzLmVsZW1lbnQueCA9IGNvbnN0YW50cy5HQU1FX1dJRFRIIC8gMiAtIDk1O1xuXHR0aGlzLmVsZW1lbnQueSA9IDEwO1xuICAgIHRoaXMuY3VycmVudCA9IDA7XG5cdHRoaXMubGFzdEluY3JlYXNlID0gMDtcbiAgICB0aGlzLmJvcmRlciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuYm9yZGVyLmdyYXBoaWNzLmJlZ2luRmlsbChcIiMzMzNcIikuZHJhd1JlY3QoMCwgMCwgMjUwLCA1MCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuYm9yZGVyKTtcblxuICAgIHRoaXMuZmlsbCA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5maWxsKTtcblxuXHR0aGlzLmlzRnVuVGltZSA9IGZhbHNlO1xuXHR0aGlzLmlzRnVuVGltZVJlc2V0ID0gdHJ1ZTtcblxuXHR0aGlzLmZ1blRleHQgPSBuZXcgY3JlYXRlanMuVGV4dChcIkZ1blwiLCBcIjI0cHggS29taWthXCIsIFwiI2ZmZlwiKTtcblx0dGhpcy5mdW5UZXh0LnggPSAtNjA7XG5cdHRoaXMuZnVuVGV4dC55ID0gMztcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZnVuVGV4dCk7XG5cblx0dGhpcy5mdW5CYXJUZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQoXCIwXCIsIFwiMjVweCBLb21pa2FcIiwgJyNmZmYnKTtcblx0dGhpcy5mdW5CYXJUZXh0LnggPSAxMTA7XG5cdHRoaXMuZnVuQmFyVGV4dC55ID0gMTtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZnVuQmFyVGV4dCk7XG59XG5cbkZ1bkJhci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdjb21ibycsIHRoaXMub25Db21iby5iaW5kKHRoaXMpKTtcblxuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmhpdFRhcmdldCA9PSAncGxheWVyJykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cdHRoaXMuaW5jcmVhc2UoMSk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLm9uQ29tYm8gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuaW5jcmVhc2UoZXZlbnQubGV2ZWwpO1xuXHR0aGlzLnNwYXduQ29tYm9NZXNzYWdlKGV2ZW50LmxldmVsKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUuaW5jcmVhc2UgPSBmdW5jdGlvbih2YWx1ZSkge1xuXHR0aGlzLmN1cnJlbnQgKz0gdmFsdWU7XG5cdGlmICh0aGlzLmN1cnJlbnQgPj0gbWF4VmFsdWUgJiYgdGhpcy5pc0Z1blRpbWUgPT0gZmFsc2UpIHtcblx0XHR0aGlzLmNhbkZ1blRpbWUgPSB0cnVlO1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdmdW4nLCB7c3RhdHVzOiAxfSk7XG5cdH1cblxuXHR0aGlzLmN1cnJlbnQgPSBNYXRoLm1pbih0aGlzLmN1cnJlbnQsIG1heFZhbHVlKTtcblxuXHR0aGlzLmxhc3RJbmNyZWFzZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXG5cdGZvciAodmFyIGkgPSAwOyBpIDwganVpY3lTdGFyQ291bnQgKyAxOyBpKyspIHtcblx0XHR0aGlzLnNwYXduSnVpY3lTdGFyKDUgKyB0aGlzLmdldE1heE9mZnNldE9uQmFyKCkgLyBqdWljeVN0YXJDb3VudCAqIGkgLSAyMCArIDQwICogTWF0aC5yYW5kb20oKSwgNTAgKiBNYXRoLnJhbmRvbSgpLCA0MCk7XG5cdH1cblxuXHR2YXIgbWFnaWNMZXZlbCA9IE1hdGgubWluKG1heE1hZ2ljTGV2ZWwsIHZhbHVlKTtcblx0Y3JlYXRlanMuU291bmQucGxheSgnbWFnaWMnICsgbWFnaWNMZXZlbCk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmN1cnJlbnQgPiAwKSB7XG5cdFx0aWYgKHRoaXMuaXNGdW5UaW1lICYmIGV2ZW50LnRpbWVTdGFtcCA8IHRoaXMuZnVuVGltZUVuZCkge1xuXHRcdFx0dGhpcy5zcGF3bkp1aWN5U3Rhcig1ICsgdGhpcy5nZXRNYXhPZmZzZXRPbkJhcigpICogTWF0aC5yYW5kb20oKSAtIDIwICsgNDAgKiBNYXRoLnJhbmRvbSgpLCA1MCAqIE1hdGgucmFuZG9tKCksIDQwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pc0Z1blRpbWUgPSBmYWxzZTtcblxuXHRcdFx0aWYgKCF0aGlzLmlzRnVuVGltZVJlc2V0KSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudCA9IDA7XG5cdFx0XHRcdHRoaXMuaXNGdW5UaW1lUmVzZXQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmVtaXR0ZXIuZW1pdCgnZnVuJywge3N0YXR1czogMH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmN1cnJlbnQgLT0gKGV2ZW50LmRlbHRhIC8gMTAwMCkgKiBhdXRvRGVjcmVhc2VQZXJTZWNvbmQ7XG5cdFx0XHR0aGlzLmN1cnJlbnQgPSBNYXRoLm1heCh0aGlzLmN1cnJlbnQsIDApO1xuXG5cdFx0XHR2YXIgbGFzdEluY3JlYXNlRGlmZiA9IGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMubGFzdEluY3JlYXNlO1xuXHRcdFx0aWYgKGxhc3RJbmNyZWFzZURpZmYgPCAxMDAwKSB7XG5cdFx0XHRcdC8vIGZhZGUgZnJvbSByZ2IoMjU1LCAwLCAyNTUpIHRvIHJnYigyNTUsIDI1NSwgMClcblx0XHRcdFx0dGhpcy5kcmF3RmlsbCgncmdiKDI1NSwgJyArIE1hdGgucm91bmQoMjU1IC8gMTAwMCAqIGxhc3RJbmNyZWFzZURpZmYpICsgJywgJyArIE1hdGgucm91bmQoMjU1IC0gMjU1IC8gMTAwMCAqIGxhc3RJbmNyZWFzZURpZmYpICsgJyknKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZHJhd0ZpbGwoKTtcblx0XHRcdH1cblx0XHR9XG4gICAgfVxuXG5cdHRoaXMuZnVuQmFyVGV4dC50ZXh0ID0gTWF0aC5yb3VuZCh0aGlzLmN1cnJlbnQgKiAxMCkgLyAxMDtcblxuXHRpZiAodGhpcy5jYW5GdW5UaW1lKSB7XG5cdFx0dGhpcy5pc0Z1blRpbWUgPSB0cnVlO1xuXHRcdHRoaXMuY2FuRnVuVGltZSA9IGZhbHNlO1xuXHRcdHRoaXMuaXNGdW5UaW1lUmVzZXQgPSBmYWxzZTtcblx0XHR0aGlzLmZ1blRpbWVFbmQgPSBldmVudC50aW1lU3RhbXAgKyBmdW5UaW1lO1xuXHR9XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLmdldE1heE9mZnNldE9uQmFyID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiAodGhpcy5jdXJyZW50IC8gbWF4VmFsdWUpICogbWF4V2lkdGg7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLmRyYXdGaWxsID0gZnVuY3Rpb24oY29sb3IpIHtcblx0Y29sb3IgPSAoY29sb3IgPT09IHVuZGVmaW5lZCkgPyAnI2ZmMCcgOiBjb2xvcjtcbiAgICB0aGlzLmZpbGwuZ3JhcGhpY3MuY2xlYXIoKS5iZWdpbkZpbGwoY29sb3IpLmRyYXdSZWN0KDUsIDUsICh0aGlzLmN1cnJlbnQgLyBtYXhWYWx1ZSkgKiBtYXhXaWR0aCwgNDApO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5zcGF3bkp1aWN5U3RhciA9IGZ1bmN0aW9uKHgsIHksIHNpemUpIHtcblx0c2l6ZSAqPSAoMC44ICsgMC40ICogTWF0aC5yYW5kb20oKSk7XG5cblx0dmFyIHN0YXIgPSBuZXcgY3JlYXRlanMuU2hhcGUoKTtcblx0c3Rhci54ID0geDtcblx0c3Rhci55ID0geTtcblx0c3Rhci5yb3RhdGlvbiA9IHBhcnNlSW50KE1hdGgucmFuZG9tKCkgKiAzNjApO1xuXHRzdGFyLmdyYXBoaWNzLmJlZ2luU3Ryb2tlKFwiI2YwZlwiKS5iZWdpbkZpbGwoJyNmZjAnKS5zZXRTdHJva2VTdHlsZSgyKS5kcmF3UG9seVN0YXIoMCwgMCwgc2l6ZSAvIDIgLSAxNSwgNSwgMC42KS5jbG9zZVBhdGgoKTtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHN0YXIpO1xuXG5cdGNyZWF0ZWpzLlR3ZWVuLmdldChzdGFyKVxuXHRcdC50byh7eTogeSArIDIwMCwgYWxwaGE6IDAsIHJvdGF0aW9uOiBzdGFyLnJvdGF0aW9uICsgMTgwfSwgNTAwICsgNTAwICogTWF0aC5yYW5kb20oKSwgY3JlYXRlanMuRWFzZS5saW5lYXIpXG5cdFx0LmNhbGwoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQoc3Rhcik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUuc3Bhd25Db21ib01lc3NhZ2UgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR2YXIgbWVzc2FnZSA9IG5ldyBjcmVhdGVqcy5UZXh0KGxldmVsICsgJ3ggQ29tYm8nLCAnMzBweCBLb21pa2EnLCBcIiNmZmZcIik7XG5cdG1lc3NhZ2UueCA9IDk1IC0gbWVzc2FnZS5nZXRNZWFzdXJlZFdpZHRoKCkgLyAyO1xuXHRtZXNzYWdlLnkgPSAxNTA7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChtZXNzYWdlKTtcblxuXHRjcmVhdGVqcy5Ud2Vlbi5nZXQobWVzc2FnZSlcblx0XHQudG8oe3k6IDAsIGFscGhhOiAwfSwgMTUwMCwgY3JlYXRlanMuRWFzZS5saW5lYXIpXG5cdFx0LmNhbGwoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQobWVzc2FnZSk7XG5cdFx0fS5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRnVuQmFyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2h1ZC9GdW5CYXIuanNcIixcIi9odWRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbWF4V2lkdGggPSAyNDA7XG5cbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIEhlYWx0aEJhcihsZWZ0LCBvYmplY3QpIHtcbiAgICB0aGlzLm9iamVjdCA9IG9iamVjdDtcblxuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB0aGlzLmVsZW1lbnQueCA9IGxlZnQgPyA0NSA6IGNvbnN0YW50cy5HQU1FX1dJRFRIIC0gMjYwO1xuXHR0aGlzLmVsZW1lbnQueSA9IDEwO1xuICAgIHRoaXMuY3VycmVudCA9IDA7XG5cbiAgICB0aGlzLmJvcmRlciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuYm9yZGVyLmdyYXBoaWNzLmJlZ2luRmlsbChcIiM0NDRcIikuZHJhd1JlY3QoMCwgMCwgMjUwLCA1MCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuYm9yZGVyKTtcblxuICAgIHRoaXMuZmlsbCA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5maWxsKTtcblxuXHR0aGlzLmZ1blRleHQgPSBuZXcgY3JlYXRlanMuVGV4dChsZWZ0ID8gXCLimaVcIiA6IFwi4pigXCIsIFwiMzBweCBLb21pa2FcIiwgbGVmdCA/ICcjZjhmJyA6ICcjZDAwJyk7XG5cdHRoaXMuZnVuVGV4dC54ID0gLTM1O1xuXHR0aGlzLmZ1blRleHQueSA9IC00O1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5mdW5UZXh0KTtcblxuXHR0aGlzLmhlYWx0aFRleHQgPSBuZXcgY3JlYXRlanMuVGV4dChcIlwiLCBcIjI1cHggS29taWthXCIsICcjZmZmJyk7XG5cdHRoaXMuaGVhbHRoVGV4dC54ID0gNzA7XG5cdHRoaXMuaGVhbHRoVGV4dC55ID0gMTtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuaGVhbHRoVGV4dCk7XG59XG5cbkhlYWx0aEJhci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcbn07XG5cbkhlYWx0aEJhci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5oZWFsdGhUZXh0LnRleHQgPSB0aGlzLm9iamVjdC5oZWFsdGggKyAnLycgKyB0aGlzLm9iamVjdC5tYXhIZWFsdGg7XG59O1xuXG5IZWFsdGhCYXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ICE9PSB0aGlzLm9iamVjdC5pZCApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbn07XG5cbkhlYWx0aEJhci5wcm90b3R5cGUuZHJhd0ZpbGwgPSBmdW5jdGlvbigpIHtcblx0dmFyIGNvbG9yID0gKHRoaXMub2JqZWN0LmlkID09PSAncGxheWVyJykgPyAnI2Y4ZicgOiAnI2QwMCc7XG4gICAgdGhpcy5maWxsLmdyYXBoaWNzLmNsZWFyKCkuYmVnaW5GaWxsKGNvbG9yKS5kcmF3UmVjdCg1LCA1LCAodGhpcy5vYmplY3QuaGVhbHRoIC8gdGhpcy5vYmplY3QubWF4SGVhbHRoKSAqIG1heFdpZHRoLCA0MCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWx0aEJhcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9odWQvSGVhbHRoQmFyLmpzXCIsXCIvaHVkXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTGV2ZWwgPSBmdW5jdGlvbihsZXZlbElkLCBkYXJrbmVzcywgbW9uc3RlclNwZWVkLCBpdGVtU2VlZCwgdGVycmFpblNlZWQsIHBsYXllckhlYWx0aCwgbW9uc3RlckhlYWx0aCwgdHJlZXMpIHtcbiAgICB0aGlzLmxldmVsSWQgPSBsZXZlbElkO1xuICAgIHRoaXMuZGFya25lc3MgPSBkYXJrbmVzcztcbiAgICB0aGlzLm1vbnN0ZXJTcGVlZCA9IG1vbnN0ZXJTcGVlZDtcbiAgICB0aGlzLmRhcmtuZXNzID0gZGFya25lc3M7XG4gICAgdGhpcy5pdGVtU2VlZCA9IGl0ZW1TZWVkO1xuICAgIHRoaXMudGVycmFpblNlZWQgPSB0ZXJyYWluU2VlZDtcbiAgICB0aGlzLnBsYXllckhlYWx0aCA9IHBsYXllckhlYWx0aDtcbiAgICB0aGlzLm1vbnN0ZXJIZWFsdGggPSBtb25zdGVySGVhbHRoO1xuICAgIHRoaXMudHJlZXMgPSB0cmVlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWw7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xldmVsL0xldmVsLmpzXCIsXCIvbGV2ZWxcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBsZXZlbERhdGEgPSByZXF1aXJlKCcuL2xldmVscycpLFxuICAgIExldmVsID0gcmVxdWlyZSgnLi9MZXZlbCcpO1xuXG52YXIgTGV2ZWxCdWlsZGVyID0gZnVuY3Rpb24oKSB7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7TnVtYmVyfSBsZXZlbElkXG4gKiBAcmV0dXJucyB7TGV2ZWx9XG4gKi9cbkxldmVsQnVpbGRlci5wcm90b3R5cGUuZ2V0TGV2ZWwgPSBmdW5jdGlvbihsZXZlbElkKSB7XG4gICAgdmFyIHJhd19sZXZlbCA9IGxldmVsRGF0YVtsZXZlbElkXTtcbiAgICB2YXIgbGV2ZWwgPSBuZXcgTGV2ZWwoXG4gICAgICAgIGxldmVsSWQsXG4gICAgICAgIHJhd19sZXZlbC5kYXJrbmVzcyxcbiAgICAgICAgcmF3X2xldmVsLm1vbnN0ZXJTcGVlZCxcbiAgICAgICAgcmF3X2xldmVsLml0ZW1TZWVkLFxuICAgICAgICByYXdfbGV2ZWwudGVycmFpblNlZWQsXG4gICAgICAgIHJhd19sZXZlbC5wbGF5ZXJIZWFsdGgsXG4gICAgICAgIHJhd19sZXZlbC5tb25zdGVySGVhbHRoLFxuICAgICAgICByYXdfbGV2ZWwudHJlZXNcbiAgICApO1xuXG4gICAgcmV0dXJuIGxldmVsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMZXZlbEJ1aWxkZXI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xldmVsL0xldmVsQnVpbGRlci5qc1wiLFwiL2xldmVsXCIpIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIjFcIjoge1xuICAgIFwiZGFya25lc3NcIjogMC4wLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDAuOCxcbiAgICBcIml0ZW1TZWVkXCI6IDIsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDEsXG4gICAgXCJ0cmVlc1wiOiAyMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMjAwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAxMDBcbiAgfSxcbiAgXCIyXCI6IHtcbiAgICBcImRhcmtuZXNzXCI6IDAuNjAsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMC45LFxuICAgIFwiaXRlbVNlZWRcIjogMyxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwMixcbiAgICBcInRyZWVzXCI6IDUwMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDE1MFxuICB9LFxuICBcIjNcIjoge1xuICAgIFwiZGFya25lc3NcIjogMC43NSxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjIsXG4gICAgXCJpdGVtU2VlZFwiOiA0LFxuICAgIFwidGVycmFpblNlZWRcIjogMTAzLFxuICAgIFwidHJlZXNcIjogNTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTAwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAyMDBcbiAgfSxcbiAgXCI0XCI6IHtcbiAgICBcImRhcmtuZXNzXCI6IDAuODAsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS41LFxuICAgIFwiaXRlbVNlZWRcIjogNSxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwNCxcbiAgICBcInRyZWVzXCI6IDM3NSxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxMDAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDI1MFxuICB9LFxuICBcIjVcIjoge1xuICAgIFwiZGFya25lc3NcIjogMC44NSxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjcsXG4gICAgXCJpdGVtU2VlZFwiOiA2LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA1LFxuICAgIFwidHJlZXNcIjogMTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEwMCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMzAwXG4gIH0sXG4gIFwiNlwiOiB7XG4gICAgXCJkYXJrbmVzc1wiOiAwLjkwLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDIsXG4gICAgXCJpdGVtU2VlZFwiOiA3LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA2LFxuICAgIFwidHJlZXNcIjogMTAwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEwMCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogNDAwXG4gIH0sXG4gIFwiN1wiOiB7XG4gICAgXCJkYXJrbmVzc1wiOiAxLFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDIuMixcbiAgICBcIml0ZW1TZWVkXCI6IDgsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDcsXG4gICAgXCJ0cmVlc1wiOiAyNTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTAwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA1MDBcbiAgfVxufSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBhdHRhY2tEZWxheSA9IDEwMDA7XG5cbmZ1bmN0aW9uIEF0dGFja0xpc3RlbmVyKHN0YWdlLCBvYmplY3QpIHtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5vYmplY3QgPSBvYmplY3Q7XG5cbiAgICB0aGlzLmxhc3RBdHRhY2sgPSAwO1xuICAgIHRoaXMuY2FuQXR0YWNrID0gdHJ1ZTtcbiAgICB0aGlzLmlzQXR0YWNraW5nID0gZmFsc2U7XG59XG5cbkF0dGFja0xpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuc3RhZ2Uub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzZWxmLmNhbkF0dGFjaykge1xuICAgICAgICAgICAgc2VsZi5pc0F0dGFja2luZyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbkF0dGFja0xpc3RlbmVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMuY2FuQXR0YWNrICYmIGV2ZW50LnRpbWVTdGFtcCA+IHRoaXMubGFzdEF0dGFjayArIGF0dGFja0RlbGF5KSB7XG4gICAgICAgIHRoaXMuY2FuQXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0F0dGFja2luZykge1xuICAgICAgICB0aGlzLmNhbkF0dGFjayA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzQXR0YWNraW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGFzdEF0dGFjayA9IGV2ZW50LnRpbWVTdGFtcDtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2F0dGFjaycsIHsgZGFtYWdlRGVhbGVyOiB0aGlzLm9iamVjdC5pZCB9KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF0dGFja0xpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0F0dGFja0xpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBDb2xsaXNpb25MaXN0ZW5lcihhLCBiLCBldmVudFR5cGUpIHtcbiAgICB0aGlzLmEgPSBhO1xuICAgIHRoaXMuYiA9IGI7XG4gICAgdGhpcy5ldmVudFR5cGUgPSBldmVudFR5cGU7XG59XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuQ29sbGlzaW9uTGlzdGVuZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBkaXN0ID0gTWF0aC5zcXJ0KE1hdGgucG93KHRoaXMuYi5lbGVtZW50LnggLSB0aGlzLmEuZWxlbWVudC54LCAyKSArIE1hdGgucG93KHRoaXMuYi5lbGVtZW50LnkgLSB0aGlzLmEuZWxlbWVudC55LCAyKSk7XG4gICAgdmFyIGFkZGVkUmFkaXVzID0gdGhpcy5hLmdldFJhZGl1cygpICsgdGhpcy5iLmdldFJhZGl1cygpO1xuICAgIGlmIChkaXN0IDwgYWRkZWRSYWRpdXMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRUeXBlID09ICdoaXQnKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUhpdERldGVjdGlvbihldmVudCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5ldmVudFR5cGUgPT0gJ3BpY2t1cCcpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUGlja3VwRGV0ZWN0aW9uKGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5oYW5kbGVIaXREZXRlY3Rpb24gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBhdHRhY2sgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5hLmlzU2hvcnRBdHRhY2tpbmcoKSAmJiB0aGlzLmIuaWQgIT09ICdncm93bCcpIHtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQodGhpcy5ldmVudFR5cGUsIHtcbiAgICAgICAgICAgIHRpbWVTdGFtcDogZXZlbnQudGltZVN0YW1wLFxuICAgICAgICAgICAgaGl0VGFyZ2V0OiB0aGlzLmIuaWQsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiB0aGlzLmEuaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iLmlzU2hvcnRBdHRhY2tpbmcoKSAmJiB0aGlzLmEuaWQgIT09ICdncm93bCcpIHtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQodGhpcy5ldmVudFR5cGUsIHtcbiAgICAgICAgICAgIHRpbWVTdGFtcDogZXZlbnQudGltZVN0YW1wLFxuICAgICAgICAgICAgaGl0VGFyZ2V0OiB0aGlzLmEuaWQsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiB0aGlzLmIuaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgZGFtYWdlRGVhbGVyID0gdGhpcy5hLmlkID09ICdwbGF5ZXInID8gdGhpcy5iLmlkIDogdGhpcy5hLmlkO1xuICAgIGlmICghYXR0YWNrKSB7XG4gICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KHRoaXMuZXZlbnRUeXBlLCB7XG4gICAgICAgICAgICB0aW1lU3RhbXA6IGV2ZW50LnRpbWVTdGFtcCxcbiAgICAgICAgICAgIGhpdFRhcmdldDogJ3BsYXllcicsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiBkYW1hZ2VEZWFsZXJcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuYS5pZCA9PSAnZ3Jvd2wnKSB7XG4gICAgICAgICAgICB0aGlzLmEuaGl0KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5iLmlkID09ICdncm93bCcpIHtcbiAgICAgICAgICAgIHRoaXMuYi5oaXQoKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5oYW5kbGVQaWNrdXBEZXRlY3Rpb24gPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmEud2VhcG9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iLmVxdWlwcGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmEuZXF1aXAodGhpcy5iKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGlzaW9uTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvQ29sbGlzaW9uTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBjb21ib0ludGVydmFsID0gMTUwMDtcblxuZnVuY3Rpb24gQ29tYm9MaXN0ZW5lcigpIHtcbiAgICB0aGlzLmxldmVsID0gMDtcblx0dGhpcy5sYXN0SGl0ID0gMDtcbn1cblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUub25IaXQgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmIChldmVudC5oaXRUYXJnZXQgPT0gJ3BsYXllcicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuXHRpZiAoZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0SGl0ID4gY29tYm9JbnRlcnZhbCkge1xuXHRcdHRoaXMucmVzZXQoKTtcblx0fVxuXG5cdHRoaXMuaW5jcmVhc2VDb21ibyhldmVudC50aW1lU3RhbXApO1xuXHR0aGlzLmxhc3RIaXQgPSBldmVudC50aW1lU3RhbXA7XG5cblx0aWYgKHRoaXMubGV2ZWwgPiAxKSB7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ2NvbWJvJywge1xuXHRcdFx0bGV2ZWw6IHRoaXMubGV2ZWxcblx0XHR9KTtcblx0fVxufTtcblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbn07XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sZXZlbCA9IDA7XG59O1xuXG5Db21ib0xpc3RlbmVyLnByb3RvdHlwZS5pbmNyZWFzZUNvbWJvID0gZnVuY3Rpb24odGltZVN0YW1wKSB7XG4gICAgdGhpcy5sZXZlbCsrO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb21ib0xpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0NvbWJvTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIEdyb3dsTGlzdGVuZXIoZ3Jvd2xIYW5kbGVyKSB7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIgPSBncm93bEhhbmRsZXI7XG59XG5cbkdyb3dsTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2dyb3dsJywgdGhpcy5vbkdyb3dsLmJpbmQodGhpcykpO1xufTtcblxuR3Jvd2xMaXN0ZW5lci5wcm90b3R5cGUub25Hcm93bCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIuc3BhbihldmVudCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyb3dsTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvR3Jvd2xMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIG1heEl0ZW1zID0gNyxcbiAgICBjb29sZG93biA9IDEwMDAwO1xuXG5mdW5jdGlvbiBJdGVtTGlzdGVuZXIoaXRlbUhhbmRsZXIpIHtcbiAgICB0aGlzLmN1cnJlbnRJdGVtcyA9IDA7XG4gICAgdGhpcy5uZXh0SXRlbSA9IDA7XG5cbiAgICB0aGlzLml0ZW1IYW5kbGVyID0gaXRlbUhhbmRsZXI7XG59XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbiAgICB0aGlzLmVtaXR0ZXIub24oJ3VuZXF1aXAnLCB0aGlzLm9uVW5lcXVpcC5iaW5kKHRoaXMpKTtcbn07XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUub25VbmVxdWlwID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jdXJyZW50SXRlbXMtLTtcbn07XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGlmICh0aGlzLmN1cnJlbnRJdGVtcyA+PSBtYXhJdGVtcykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubmV4dEl0ZW0gPiBldmVudC50aW1lU3RhbXApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuaXRlbUhhbmRsZXIuc3Bhd24oKTtcbiAgICB0aGlzLm5leHRJdGVtID0gZXZlbnQudGltZVN0YW1wICsgY29vbGRvd247XG4gICAgdGhpcy5jdXJyZW50SXRlbXMrKztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSXRlbUxpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0l0ZW1MaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuXG52YXIgTGV2ZWxCdWlsZGVyID0gcmVxdWlyZSgnLi4vbGV2ZWwvTGV2ZWxCdWlsZGVyJyk7XG5cbnZhciBjdXJyZW50TGV2ZWxJZCA9IDA7XG5cbmZ1bmN0aW9uIExldmVsVXBMaXN0ZW5lcigpIHtcblx0dGhpcy5sZXZlbEJ1aWRsZXIgPSBuZXcgTGV2ZWxCdWlsZGVyKCk7XG59XG5cbkxldmVsVXBMaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG5cblx0Ly9lbWl0dGVyLm9uKCdtb25zdGVyLWRlYWQnLCB0aGlzLm9uTGV2ZWxVcC5iaW5kKHRoaXMpKTtcblx0ZW1pdHRlci5vbignc3RhcnQtbGV2ZWwnLCB0aGlzLm9uU3RhcnRMZXZlbC5iaW5kKHRoaXMpKTtcbn07XG5cbkxldmVsVXBMaXN0ZW5lci5wcm90b3R5cGUub25TdGFydExldmVsID0gZnVuY3Rpb24ocmVhY2hlZE5ld0xldmVsKSB7XG5cdGlmIChyZWFjaGVkTmV3TGV2ZWwpIHtcblx0XHRjdXJyZW50TGV2ZWxJZCsrO1xuXHR9XG5cblx0dmFyIG5ld0xldmVsID0gdGhpcy5sZXZlbEJ1aWRsZXIuZ2V0TGV2ZWwoY3VycmVudExldmVsSWQpO1xuXG5cdC8vY29uc29sZS5sb2coJ2xldmVsdXAnLCBuZXdMZXZlbCk7XG5cblx0dGhpcy5lbWl0dGVyLmVtaXQoJ2NoYW5nZS1sZXZlbCcsIG5ld0xldmVsKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxVcExpc3RlbmVyO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9MZXZlbFVwTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFJhaW5ib3dSb2FkTGlzdGVuZXIocmFpbmJvd1JvYWQpIHtcbiAgICB0aGlzLnJhaW5ib3dSb2FkID0gcmFpbmJvd1JvYWQ7XG59XG5cblJhaW5ib3dSb2FkTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2hhcy1mdW4nLCB0aGlzLm9uSGFzRnVuLmJpbmQodGhpcykpO1xufTtcblxuUmFpbmJvd1JvYWRMaXN0ZW5lci5wcm90b3R5cGUub25IYXNGdW4gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMucmFpbmJvd1JvYWQucGFpbnQoZXZlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSYWluYm93Um9hZExpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL1JhaW5ib3dSb2FkTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIFNvdW5kTGlzdGVuZXIoKSB7XG5cdHRoaXMuZnVuU291bmQgPSBjcmVhdGVqcy5Tb3VuZC5wbGF5KCdmdW4nKTtcblx0dGhpcy5mdW5Tb3VuZC5zdG9wKCk7XG59XG5cblNvdW5kTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnQgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG5cblx0ZW1pdHRlci5vbignaGl0JywgdGhpcy5vbkhpdC5iaW5kKHRoaXMpKTtcblx0ZW1pdHRlci5vbignZnVuJywgdGhpcy5vbkZ1bi5iaW5kKHRoaXMpKTtcbn07XG5cblNvdW5kTGlzdGVuZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0aWYgKGV2ZW50LmhpdFRhcmdldCA9PSAncGxheWVyJykge1xuXHRcdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2dpcmwtaHVydCcpO1xuXHR9IGVsc2UgaWYgKGV2ZW50LmhpdFRhcmdldCA9PSAnbW9uc3RlcicpIHtcblx0XHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdtb25zdGVyLWh1cnQnKTtcblx0fVxufTtcblxuU291bmRMaXN0ZW5lci5wcm90b3R5cGUub25GdW4gPSBmdW5jdGlvbihldmVudCkge1xuXHRpZiAoZXZlbnQuc3RhdHVzKSB7XG5cdFx0dGhpcy5mdW5Tb3VuZC5wbGF5KCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5mdW5Tb3VuZC5zdG9wKCk7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU291bmRMaXN0ZW5lcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvU291bmRMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuXG52YXIgTmlnaHRPdmVybGF5ID0gZnVuY3Rpb24ocGxheWVyKSB7XG5cdHRoaXMuYyA9IDA7XG5cblx0dGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG5cdHZhciBpbWcgPSBuZXcgY3JlYXRlanMuQml0bWFwKCcuL2ltZy9uaWdodG1vZGUucG5nJyk7XG5cdHRoaXMucGxheWVyID0gcGxheWVyO1xuXG5cdHRoaXMuZWxlbWVudC5hbHBoYSA9IDA7XG5cdGltZy5zY2FsZVggPSBpbWcuc2NhbGVZID0gMC42O1xuXHRpbWcueCA9IDEwMjQgLyAyO1xuXHRpbWcueSA9IDc2OC8yO1xuXG5cdGltZy5yZWdYID0gMTE1MDtcblx0aW1nLnJlZ1kgPSAxNDUwO1xuXG5cdHRoaXMuaW1nID0gaW1nO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoaW1nKTtcbn07XG5cbk5pZ2h0T3ZlcmxheS5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdHZhciBzcGVlZCA9IHRoaXMucGxheWVyLnZlbG9jaXR5Lmxlbmd0aCgpO1xuXG5cdHRoaXMuYyArPSBldmVudC5kZWx0YSAqIHNwZWVkICAvICg4MCAqIDEwMDApO1xuXHR0aGlzLmltZy5yb3RhdGlvbiA9IHRoaXMucGxheWVyLmVsZW1lbnQucm90YXRpb24gLSAzNSArIE1hdGguc2luKHRoaXMuYykgKiAxMDtcbn07XG5cbk5pZ2h0T3ZlcmxheS5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG5cdHRoaXMuZWxlbWVudC5hbHBoYSA9IGxldmVsLmRhcmtuZXNzO1xufTtcblxuTmlnaHRPdmVybGF5LnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOaWdodE92ZXJsYXk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbmlnaHRPdmVybGF5L05pZ2h0T3ZlcmxheS5qc1wiLFwiL25pZ2h0T3ZlcmxheVwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBHYW1lT3ZlclNjcmVlbiA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG59O1xuXG5HYW1lT3ZlclNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKG5ldyBjcmVhdGVqcy5CaXRtYXAoJy4vaW1nL2dhbWVvdmVyLnBuZycpKTtcblxuXHR0aGlzLmVsZW1lbnQuc2NhbGVYID0gMC41NDtcblx0dGhpcy5lbGVtZW50LnNjYWxlWSA9IDAuNzI7XG5cblx0Y3JlYXRlanMuU291bmQucGxheSgnZGVmZWF0Jyk7XG59O1xuXG5HYW1lT3ZlclNjcmVlbi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdhbWVPdmVyU2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvR2FtZU92ZXJTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFZpZXcgPSByZXF1aXJlKCcuLi92aWV3cy9WaWV3JyksXG4gICAgUGxheWVyID0gcmVxdWlyZSgnLi4vUGxheWVyJyksXG4gICAgTW9uc3RlciA9IHJlcXVpcmUoJy4uL01vbnN0ZXInKSxcbiAgICBGdW5CYXIgPSByZXF1aXJlKCcuLi9odWQvRnVuQmFyJyksXG4gICAgSGVhbHRoQmFyID0gcmVxdWlyZSgnLi4vaHVkL0hlYWx0aEJhcicpLFxuICAgIENvbWJvTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db21ib0xpc3RlbmVyJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpLFxuICAgIEF0dGFja0xpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvQXR0YWNrTGlzdGVuZXInKSxcbiAgICBTb3VuZExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvU291bmRMaXN0ZW5lcicpLFxuICAgIEdyb3dsTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Hcm93bExpc3RlbmVyJyksXG4gICAgTGV2ZWxVcExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvTGV2ZWxVcExpc3RlbmVyJyksXG4gICAgSXRlbUxpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvSXRlbUxpc3RlbmVyJyksXG4gICAgR3Jvd2xIYW5kbGVyID0gcmVxdWlyZSgnLi4vd2VhcG9ucy9Hcm93bEhhbmRsZXInKSxcbiAgICBJdGVtSGFuZGxlciA9IHJlcXVpcmUoJy4uL3dlYXBvbnMvSXRlbUhhbmRsZXInKSxcbiAgICBHcm91bmQgPSByZXF1aXJlKCcuLi9ncm91bmQvR3JvdW5kJyksXG4gICAgUmFpbmJvd1JvYWQgPSByZXF1aXJlKCcuLi9ncm91bmQvUmFpbmJvd1JvYWQnKSxcbiAgICBSYWluYm93Um9hZExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvUmFpbmJvd1JvYWRMaXN0ZW5lcicpLFxuICAgIE5pZ2h0T3ZlcmxheSA9IHJlcXVpcmUoJy4uL25pZ2h0T3ZlcmxheS9OaWdodE92ZXJsYXknKSxcbiAgICBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpO1xuXG5mdW5jdGlvbiBHYW1lU2NyZWVuKHN0YWdlKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuZ2FtZVZpZXcgPSBuZXcgVmlldygpO1xuICAgIHRoaXMuaHVkVmlldyA9IG5ldyBWaWV3KCk7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIgPSBuZXcgR3Jvd2xIYW5kbGVyKCk7XG4gICAgdGhpcy5pdGVtSGFuZGxlciA9IG5ldyBJdGVtSGFuZGxlcigpO1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblxuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG5cbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG5cdHRoaXMuYmFja2dyb3VuZE11c2ljID0gbnVsbDtcbn1cblxuR2FtZVNjcmVlbi5wcm90b3R5cGUucmVnaXN0ZXJFdmVudCA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuR2FtZVNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5nYW1lVmlldy5lbGVtZW50KTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5odWRWaWV3LmVsZW1lbnQpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQodGhpcy5ncm93bEhhbmRsZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQodGhpcy5pdGVtSGFuZGxlcik7XG5cbiAgICB2YXIgZnVuQmFyID0gbmV3IEZ1bkJhcigpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChmdW5CYXIpO1xuXG5cdHZhciByYWluYm93Um9hZCA9IG5ldyBSYWluYm93Um9hZCgpO1xuXHR0aGlzLmdhbWVWaWV3LmFkZENoaWxkKHJhaW5ib3dSb2FkKTtcblxuICAgIHRoaXMucGxheWVyID0gbmV3IFBsYXllcigyMDAsIDIwMCk7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIuc2V0VGFyZ2V0KHRoaXMucGxheWVyKTtcbiAgICB0aGlzLml0ZW1IYW5kbGVyLnNldFRhcmdldCh0aGlzLnBsYXllcik7XG4gICAgdGhpcy5nYW1lVmlldy5hZGRDaGlsZCh0aGlzLnBsYXllcik7XG4gICAgdGhpcy5nYW1lVmlldy5hdHRhY2godGhpcy5wbGF5ZXIpO1xuXG4gICAgdmFyIG1vbnN0ZXIgPSBuZXcgTW9uc3Rlcig3MDAsIDMwMCwgdGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQobW9uc3Rlcik7XG5cbiAgICB2YXIgaGVhbHRoQmFyMSA9IG5ldyBIZWFsdGhCYXIodHJ1ZSwgdGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChoZWFsdGhCYXIxKTtcblxuICAgIHZhciBoZWFsdGhCYXIyID0gbmV3IEhlYWx0aEJhcihmYWxzZSwgbW9uc3Rlcik7XG4gICAgdGhpcy5odWRWaWV3LmFkZENoaWxkKGhlYWx0aEJhcjIpO1xuXG4gICAgdmFyIGdyb3VuZCA9IG5ldyBHcm91bmQoKTtcbiAgICB0aGlzLmdhbWVWaWV3LmFkZENoaWxkQXQoZ3JvdW5kLCAwKTtcblxuICAgIGlmIChHYW1lQ29uc3RzLk5JR0hUX01PREUpIHtcbiAgICAgICAgdmFyIG5pZ2h0T3ZlcmxheSA9IG5ldyBOaWdodE92ZXJsYXkodGhpcy5wbGF5ZXIpO1xuICAgICAgICB0aGlzLmh1ZFZpZXcuYWRkQ2hpbGRBdChuaWdodE92ZXJsYXksIDApO1xuICAgIH1cblxuICAgIHZhciBjb21ib0xpc3RlbmVyID0gbmV3IENvbWJvTGlzdGVuZXIoKTtcbiAgICBjb21ib0xpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChjb21ib0xpc3RlbmVyKTtcbiAgICB2YXIgY29sbGlzaW9uTGlzdGVuZXIgPSBuZXcgQ29sbGlzaW9uTGlzdGVuZXIodGhpcy5wbGF5ZXIsIG1vbnN0ZXIsICdoaXQnKTtcbiAgICBjb2xsaXNpb25MaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2goY29sbGlzaW9uTGlzdGVuZXIpO1xuICAgIHZhciBhdHRhY2tMaXN0ZW5lciA9IG5ldyBBdHRhY2tMaXN0ZW5lcih0aGlzLnN0YWdlLCB0aGlzLnBsYXllcik7XG4gICAgYXR0YWNrTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGF0dGFja0xpc3RlbmVyKTtcblx0dmFyIHNvdW5kTGlzdGVuZXIgPSBuZXcgU291bmRMaXN0ZW5lcigpO1xuXHRzb3VuZExpc3RlbmVyLnJlZ2lzdGVyRXZlbnQodGhpcy5lbWl0dGVyKTtcblx0dGhpcy5saXN0ZW5lcnMucHVzaChzb3VuZExpc3RlbmVyKTtcbiAgICB2YXIgZ3Jvd2xMaXN0ZW5lciA9IG5ldyBHcm93bExpc3RlbmVyKHRoaXMuZ3Jvd2xIYW5kbGVyKTtcbiAgICBncm93bExpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChncm93bExpc3RlbmVyKTtcbiAgICB2YXIgbGV2ZWxVcExpc3RlbmVyID0gbmV3IExldmVsVXBMaXN0ZW5lcigpO1xuICAgIGxldmVsVXBMaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGV2ZWxVcExpc3RlbmVyKTtcbiAgICB2YXIgaXRlbUxpc3RlbmVyID0gbmV3IEl0ZW1MaXN0ZW5lcih0aGlzLml0ZW1IYW5kbGVyKTtcbiAgICBpdGVtTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGl0ZW1MaXN0ZW5lcik7XG4gICAgdmFyIHJhaW5ib3dSb2FkTGlzdGVuZXIgPSBuZXcgUmFpbmJvd1JvYWRMaXN0ZW5lcihyYWluYm93Um9hZCk7XG4gICAgcmFpbmJvd1JvYWRMaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2gocmFpbmJvd1JvYWRMaXN0ZW5lcik7XG5cbiAgICB0aGlzLmdhbWVWaWV3LnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5odWRWaWV3LnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG5cbiAgICBpZiAoIXRoaXMuYmFja2dyb3VuZE11c2ljKSB7XG5cdFx0dGhpcy5iYWNrZ3JvdW5kTXVzaWMgPSBjcmVhdGVqcy5Tb3VuZC5wbGF5KCdiYWNrZ3JvdW5kJywge2xvb3BzOiAtMSwgdm9sdW1lOiAwLjJ9KTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLmJhY2tncm91bmRNdXNpYy5yZXN1bWUoKTtcblx0fVxufTtcblxuR2FtZVNjcmVlbi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmh1ZFZpZXcucmVzZXQoKTtcbiAgICB0aGlzLmdhbWVWaWV3LnJlc2V0KCk7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIucmVzZXQoKTtcbiAgICB0aGlzLml0ZW1IYW5kbGVyLnJlc2V0KCk7XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcblx0dGhpcy5iYWNrZ3JvdW5kTXVzaWMucGF1c2UoKTtcbn07XG5cbkdhbWVTY3JlZW4ucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuZ2FtZVZpZXcudGljayhldmVudCk7XG4gICAgdGhpcy5odWRWaWV3LnRpY2soZXZlbnQpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxpc3RlbmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMubGlzdGVuZXJzW2ldWyd0aWNrJ10gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnNbaV0udGljayhldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdhbWVTY3JlZW47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc2NyZWVucy9HYW1lU2NyZWVuLmpzXCIsXCIvc2NyZWVuc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIEhvbWVTY3JlZW4oKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xufVxuXG5Ib21lU2NyZWVuLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0ZXh0Qm94ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHZhciBoZWFkbGluZSA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiV2VsY29tZSFcIiwgXCIxMDBweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKGhlYWRsaW5lKTtcblxuICAgIHZhciB0byA9IG5ldyBjcmVhdGVqcy5UZXh0KFwidG9cIiwgXCI1MHB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIHRvLnkgPSAxMjU7XG4gICAgdG8ueCA9IDE1MDtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKHRvKTtcblxuICAgIHZhciBnYW1lTmFtZSA9IG5ldyBjcmVhdGVqcy5UZXh0KFwie0dhbWVOYW1lfSFcIiwgXCIxMDBweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICBnYW1lTmFtZS55ID0gMjAwO1xuICAgIHRleHRCb3guYWRkQ2hpbGQoZ2FtZU5hbWUpO1xuXG4gICAgdGV4dEJveC55ID0gMTAwO1xuICAgIHRleHRCb3gueCA9IDE1MDtcblxuICAgIHRoaXMubG9hZGluZyA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiTG9hZGluZyAuLi5cIiwgXCI3NXB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIHRoaXMubG9hZGluZy55ID0gNTAwO1xuICAgIHRoaXMubG9hZGluZy54ID0gMTUwO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmxvYWRpbmcpO1xuXG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRleHRCb3gpO1xufTtcblxuSG9tZVNjcmVlbi5wcm90b3R5cGUuaXNSZWFkeSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLmxvYWRpbmcpO1xuXG4gICAgdGhpcy5sb2FkaW5nID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJDbGljayB0byBTdGFydCBHYW1lIVwiLCBcIjY2cHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgdGhpcy5sb2FkaW5nLnkgPSA1MDA7XG4gICAgdGhpcy5sb2FkaW5nLnggPSAxNTA7XG5cbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5sb2FkaW5nKTtcbn07XG5cbkhvbWVTY3JlZW4ucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhvbWVTY3JlZW47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc2NyZWVucy9Ib21lU2NyZWVuLmpzXCIsXCIvc2NyZWVuc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIE1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4oKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xufVxuXG5NYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0ZXh0Qm94ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHZhciBoZWFkbGluZSA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiVGhhbmsgWW91LCBsaXR0bGUgZ2lybCFcIiwgXCI1NnB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIHRleHRCb3guYWRkQ2hpbGQoaGVhZGxpbmUpO1xuXG4gICAgdmFyIGluZm8gPSBuZXcgY3JlYXRlanMuVGV4dChcIkJ1dCBNYXJpbyBpcyBpbiBhbm90aGVyIENhc3RsZSFcIiwgXCIzMnB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIGluZm8ueSA9IDEwMDtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKGluZm8pO1xuXG4gICAgdmFyIGFjdGlvbiA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiQ2xpY2sgdG8gdHJ5IHRoZSBuZXh0IENhc3RsZSFcIiwgXCIzMnB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIGFjdGlvbi55ID0gMzAwO1xuICAgIHRleHRCb3guYWRkQ2hpbGQoYWN0aW9uKTtcblxuICAgIHZhciBiID0gdGV4dEJveC5nZXRCb3VuZHMoKTtcbiAgICB0ZXh0Qm94LnggPSAxMDA7XG4gICAgdGV4dEJveC55ID0gMjAwO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0ZXh0Qm94KTtcblxuXHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCd2aWN0b3J5Jyk7XG59O1xuXG5NYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5qc1wiLFwiL3NjcmVlbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBQc2V1ZG9SYW5kID0gZnVuY3Rpb24oKSB7fTtcblxuLyoqXG4gKiBAcGFyYW0gc2VlZFxuICovXG5Qc2V1ZG9SYW5kLnByb3RvdHlwZS5zZXRTZWVkID0gZnVuY3Rpb24oc2VlZCkge1xuXHR0aGlzLl93ID0gTWF0aC5hYnMoc2VlZCAmIDB4ZmZmZik7XG5cdHRoaXMuX3ogPSBNYXRoLmFicyhzZWVkID4+IDE2KTtcblxuXHRpZiAodGhpcy5fdyA9PSAwKSB0aGlzLl93ID0gMTtcblx0aWYgKHRoaXMuX3ogPT0gMCkgdGhpcy5feiA9IDE7XG59O1xuXG4vKipcbiAqIEByZXR1cm5zIHtpbnR9XG4gKi9cblBzZXVkb1JhbmQucHJvdG90eXBlLmdldFJhbmRvbSA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLl96ID0gTWF0aC5hYnMoKDM2OTY5ICogKHRoaXMuX3ogJiA2NTUzNSkgKyAodGhpcy5feiA+PiAxNikpJjB4ZmZmZmZmZik7XG5cdHRoaXMuX3cgPSBNYXRoLmFicygoMTgwMDAgKiAodGhpcy5fdyAmIDY1NTM1KSArICh0aGlzLl93ID4+IDE2KSkmMHhmZmZmZmZmKTtcblx0cmV0dXJuIE1hdGguYWJzKCgodGhpcy5feiA8PCAxNikgKyB0aGlzLl93KSAmIDB4ZmZmZmZmZik7IC8vIGV4Y2x1ZGUgbGFzdCBiaXRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUHNldWRvUmFuZDtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi91dGlsL1BzZXVkb1JhbmQuanNcIixcIi91dGlsXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gKiBAcGFyYW0ge051bWJlcn0geVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBWZWN0b3IyRCA9IGZ1bmN0aW9uICh4LCB5KSB7XG5cdHRoaXMueCA9IHg7XG5cdHRoaXMueSA9IHk7XG59O1xuXG5WZWN0b3IyRC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIG5ldyBWZWN0b3IyRCh0aGlzLngsIHRoaXMueSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IGFub3RoZXJfdmVjdG9yXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xuVmVjdG9yMkQucHJvdG90eXBlLnBsdXMgPSBmdW5jdGlvbihhbm90aGVyX3ZlY3Rvcikge1xuXHR0aGlzLnggKz0gYW5vdGhlcl92ZWN0b3IueDtcblx0dGhpcy55ICs9IGFub3RoZXJfdmVjdG9yLnk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IGFub3RoZXJfdmVjdG9yXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xuVmVjdG9yMkQucHJvdG90eXBlLm1pbnVzID0gZnVuY3Rpb24oYW5vdGhlcl92ZWN0b3IpIHtcblx0cmV0dXJuIHRoaXMucGx1cyhhbm90aGVyX3ZlY3Rvci5jbG9uZSgpLnRpbWVzKC0xKSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7TnVtYmVyfSBmYWN0b3JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5WZWN0b3IyRC5wcm90b3R5cGUudGltZXMgPSBmdW5jdGlvbihmYWN0b3IpIHtcblx0dGhpcy54ICo9IGZhY3Rvcjtcblx0dGhpcy55ICo9IGZhY3RvcjtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQHJldHVybiB7TnVtYmVyfVxuICovXG5WZWN0b3IyRC5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSk7XG59O1xuXG4vKipcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5WZWN0b3IyRC5wcm90b3R5cGUubm9ybSA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoKCk7XG5cdGlmIChsZW5ndGggIT0gMCApIHtcblx0XHRyZXR1cm4gdGhpcy50aW1lcygxIC8gdGhpcy5sZW5ndGgoKSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjdG9yMkQ7XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2FcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9iXG4gKiBAcGFyYW0ge051bWJlcn0gdFxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cbm1vZHVsZS5leHBvcnRzLmxlcnAgPSBmdW5jdGlvbih2ZWN0b3JfYSwgdmVjdG9yX2IsIHQpIHtcblx0cmV0dXJuIHZlY3Rvcl9hLmNsb25lKCkudGltZXMoMS10KS5wbHVzKHZlY3Rvcl9iLmNsb25lKCkudGltZXModCkpO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYVxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2JcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5tb2R1bGUuZXhwb3J0cy5hZGQgPSBmdW5jdGlvbih2ZWN0b3JfYSwgdmVjdG9yX2IpIHtcblx0cmV0dXJuIHZlY3Rvcl9hLmNsb25lKCkucGx1cyh2ZWN0b3JfYilcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2FcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9iXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xubW9kdWxlLmV4cG9ydHMuc3VidHJhY3QgPSBmdW5jdGlvbih2ZWN0b3JfYSwgdmVjdG9yX2IpIHtcblx0cmV0dXJuIHZlY3Rvcl9hLmNsb25lKCkubWludXModmVjdG9yX2IpXG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9hXG4gKiBAcGFyYW0ge051bWJlcn0gZmFjdG9yXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xubW9kdWxlLmV4cG9ydHMubXVsdGlwbHkgPSBmdW5jdGlvbih2ZWN0b3JfYSwgZmFjdG9yKSB7XG5cdHJldHVybiB2ZWN0b3JfYS5jbG9uZSgpLnRpbWVzKGZhY3Rvcilcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKi9cbm1vZHVsZS5leHBvcnRzLmdldEFuZ2xlID0gZnVuY3Rpb24odmVjdG9yKSB7XG5cdHZhciBhbmdsZSA9IE1hdGguYXNpbih2ZWN0b3IueSAvIHZlY3Rvci5sZW5ndGgoKSkgKiAoMTgwIC8gTWF0aC5QSSkgKyA5MDtcblxuXHRyZXR1cm4gdmVjdG9yLnggPCAwID8gMzYwIC0gYW5nbGUgOiBhbmdsZTtcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdXRpbC9WZWN0b3IyZC5qc1wiLFwiL3V0aWxcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpO1xuXG52YXIgVmlldyA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cdHRoaXMuZWxlbWVudHMgPSBbXTtcbn07XG5cblZpZXcucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xuXHR0aGlzLmVsZW1lbnRzID0gW107XG59O1xuXG5WaWV3LnByb3RvdHlwZS5hZGRDaGlsZCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKGVsZW1lbnQuZWxlbWVudCk7XG5cdHRoaXMuZWxlbWVudHMucHVzaChlbGVtZW50KTtcbn07XG5cblZpZXcucHJvdG90eXBlLmFkZENoaWxkQXQgPSBmdW5jdGlvbihlbGVtZW50LCBpZHgpIHtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkQXQoZWxlbWVudC5lbGVtZW50LCBpZHgpO1xuXHR0aGlzLmVsZW1lbnRzLnB1c2goZWxlbWVudCk7XG59O1xuXG5WaWV3LnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmVsZW1lbnRzW2ldWydyZWdpc3RlckV2ZW50cyddID09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRoaXMuZWxlbWVudHNbaV0ucmVnaXN0ZXJFdmVudHMoZW1pdHRlcik7XG5cdFx0fVxuXHR9XG59O1xuXG5WaWV3LnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmVsZW1lbnRzW2ldWyd0aWNrJ10gPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhpcy5lbGVtZW50c1tpXS50aWNrKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRpZiAodGhpcy5hdHRhY2hlZFRvKSB7XG5cdFx0dGhpcy5lbGVtZW50LnNldFRyYW5zZm9ybShcblx0XHRcdC10aGlzLmF0dGFjaGVkVG8ueCArIEdhbWVDb25zdHMuR0FNRV9XSURUSCAvIDIsXG5cdFx0XHQtdGhpcy5hdHRhY2hlZFRvLnkgKyBHYW1lQ29uc3RzLkdBTUVfSEVJR0hUIC8gMlxuXHRcdCk7XG5cdH1cbn07XG5cblZpZXcucHJvdG90eXBlLmF0dGFjaCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0dGhpcy5hdHRhY2hlZFRvID0gZWxlbWVudC5lbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3ZpZXdzL1ZpZXcuanNcIixcIi92aWV3c1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBWZWMyZCA9IHJlcXVpcmUoJy4uL3V0aWwvVmVjdG9yMmQnKSxcbiAgICBHYW1lQ29uc3RzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpO1xuXG5mdW5jdGlvbiBHcm93bCh4LCB5LCB0YXJnZXQsIGxpZmV0aW1lLCByZWxhdGl2ZUxpZmV0aW1lKSB7XG4gICAgdGhpcy5pZCA9ICdncm93bCc7XG5cbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cblx0dmFyIGZpcmViYWxsID0gbmV3IGNyZWF0ZWpzLkJpdG1hcChcIi4vaW1nL2ZpcmViYWxsLnBuZ1wiKTtcblx0dGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjM7XG5cbiAgICBmaXJlYmFsbC5pbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmVsZW1lbnQucmVnWCA9IHRoaXMuZWxlbWVudC5nZXRCb3VuZHMoKS53aWR0aCAvIDI7XG5cdFx0dGhpcy5lbGVtZW50LnJlZ1kgPSB0aGlzLmVsZW1lbnQuZ2V0Qm91bmRzKCkuaGVpZ2h0IC8gMjtcblx0fS5iaW5kKHRoaXMpO1xuXG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChmaXJlYmFsbCk7XG5cblx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgdGhpcy5lbGVtZW50LnggPSB4O1xuICAgIHRoaXMuZWxlbWVudC55ID0geTtcbiAgICB0aGlzLmxpZmV0aW1lID0gbGlmZXRpbWU7XG4gICAgdGhpcy52ZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcblxuXHRjcmVhdGVqcy5Ud2Vlbi5nZXQodGhpcy5lbGVtZW50KVxuXHRcdC50byh7cm90YXRpb246IHJlbGF0aXZlTGlmZXRpbWV9LCByZWxhdGl2ZUxpZmV0aW1lKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKGZpcmViYWxsKTtcblx0XHR9LmJpbmQodGhpcykpO1xufVxuXG5Hcm93bC5wcm90b3R5cGUuaGl0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5saWZldGltZSA9IDA7XG59O1xuXG5Hcm93bC5wcm90b3R5cGUuaXNTaG9ydEF0dGFja2luZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuR3Jvd2wucHJvdG90eXBlLmdldFJhZGl1cyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAyMDtcbn07XG5cbkdyb3dsLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgY3VycmVudCA9IG5ldyBWZWMyZCh0aGlzLnRhcmdldC5lbGVtZW50LngsIHRoaXMudGFyZ2V0LmVsZW1lbnQueSk7XG4gICAgdmFyIHRhcmdldCAgPSBuZXcgVmVjMmQodGhpcy5lbGVtZW50LngsIHRoaXMuZWxlbWVudC55KTtcblxuICAgIHZhciB2ZWN0b3JfdG9fZGVzdGluYXRpb24gPSBWZWMyZC5zdWJ0cmFjdChjdXJyZW50LCB0YXJnZXQpO1xuICAgIHZhciBkaXN0YW5jZSA9IHZlY3Rvcl90b19kZXN0aW5hdGlvbi5sZW5ndGgoKTtcblxuICAgIC8vIGNhbGN1bGF0ZSBuZXcgdmVsb2NpdHkgYWNjb3JkaW5nIHRvIGN1cnJlbnQgdmVsb2NpdHkgYW5kIHBvc2l0aW9uIG9mIHRhcmdldFxuICAgIHZlY3Rvcl90b19kZXN0aW5hdGlvbi5ub3JtKCkudGltZXMoMC43KTtcbiAgICB0aGlzLnZlbG9jaXR5Lm5vcm0oKS50aW1lcygyMCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IHRoaXMudmVsb2NpdHkucGx1cyh2ZWN0b3JfdG9fZGVzdGluYXRpb24pO1xuXG4gICAgLy8gc2V0IHNwZWVkIG9mIG1vbnN0ZXIgYWNjb3JkaW5nIHRvIGRpc3RhbmNlIHRvIHRhcmdldFxuICAgIHRoaXMudmVsb2NpdHkudGltZXMoMTAwICsgZGlzdGFuY2UgLyAyLjUpO1xuXG4gICAgdmFyIGRlbHRhID0gVmVjMmQubXVsdGlwbHkodGhpcy52ZWxvY2l0eSwgZXZlbnQuZGVsdGEgLyA4MDAwKTtcblxuICAgIHRoaXMuZWxlbWVudC54ICs9IGRlbHRhLng7XG4gICAgdGhpcy5lbGVtZW50LnkgKz0gZGVsdGEueTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3Jvd2w7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9Hcm93bC5qc1wiLFwiL3dlYXBvbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgR3Jvd2wgPSByZXF1aXJlKCcuL0dyb3dsJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpO1xuXG52YXIgZ3Jvd2xMaWZlVGltZSA9IDYwMDA7XG5cbmZ1bmN0aW9uIEdyb3dsSGFuZGxlcigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5ncm93bHMgPSBbXTtcblxuICAgIHRoaXMuc2hvdWxkU3BhbiA9IGZhbHNlO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG59XG5cbkdyb3dsSGFuZGxlci5wcm90b3R5cGUuc2V0VGFyZ2V0ID0gZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5ncm93bHMgPSBbXTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxuR3Jvd2xIYW5kbGVyLnByb3RvdHlwZS5zcGFuID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLnNob3VsZFNwYW4gPSB0cnVlO1xuICAgIHRoaXMubmV4dFNwYW4gPSBldmVudDtcblx0Y3JlYXRlanMuU291bmQucGxheSgnbGF1bmNoLWZpcmViYWxsJyk7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLnNob3VsZFNwYW4pIHtcbiAgICAgICAgdmFyIGdyb3dsID0gbmV3IEdyb3dsKHRoaXMubmV4dFNwYW4ueCwgdGhpcy5uZXh0U3Bhbi55LCB0aGlzLm5leHRTcGFuLnRhcmdldCwgZXZlbnQudGltZVN0YW1wICsgZ3Jvd2xMaWZlVGltZSwgZ3Jvd2xMaWZlVGltZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChncm93bC5lbGVtZW50KTtcbiAgICAgICAgdGhpcy5zaG91bGRTcGFuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZ3Jvd2xzLnB1c2goZ3Jvd2wpO1xuICAgICAgICB2YXIgbGlzdGVuZXIgPSBuZXcgQ29sbGlzaW9uTGlzdGVuZXIodGhpcy50YXJnZXQsIGdyb3dsLCAnaGl0Jyk7XG4gICAgICAgIGxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSB0aGlzLmdyb3dscy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAodGhpcy5ncm93bHNbaV0ubGlmZXRpbWUgPCBldmVudC50aW1lU3RhbXApIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLmdyb3dsc1tpXS5lbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMuZ3Jvd2xzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmdyb3dsc1tpXVsndGljayddID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuZ3Jvd2xzW2ldLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzW2ldLnRpY2soZXZlbnQpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3Jvd2xIYW5kbGVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3dlYXBvbnMvR3Jvd2xIYW5kbGVyLmpzXCIsXCIvd2VhcG9uc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBTaG9ydFdlYXBvbiA9IHJlcXVpcmUoJy4vU2hvcnRXZWFwb24nKSxcbiAgICBQc2V1ZG9SYW5kID0gcmVxdWlyZSgnLi4vdXRpbC9Qc2V1ZG9SYW5kJyksXG4gICAgQ29sbGlzaW9uTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Db2xsaXNpb25MaXN0ZW5lcicpLFxuICAgIEdhbWVDb25zdGFudHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbnZhciB3ZWFwb25MaWZlVGltZSA9IDEwO1xuXG5mdW5jdGlvbiBJdGVtSGFuZGxlcigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5pdGVtcyA9IFtdO1xuXG4gICAgdGhpcy5zaG91bGRTcGF3biA9IGZhbHNlO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG5cbiAgICB0aGlzLnJhbmQgPSBuZXcgUHNldWRvUmFuZCgpO1xufVxuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUuc2V0VGFyZ2V0ID0gZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUuc3Bhd24gPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNob3VsZFNwYXduID0gdHJ1ZTtcbn07XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxuSXRlbUhhbmRsZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLnNob3VsZFNwYXduKSB7XG4gICAgICAgIHZhciBpdGVtID0gbmV3IFNob3J0V2VhcG9uKFxuICAgICAgICAgICAgdGhpcy5yYW5kLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0YW50cy5HQU1FX1dJRFRILFxuICAgICAgICAgICAgdGhpcy5yYW5kLmdldFJhbmRvbSgpICYgR2FtZUNvbnN0YW50cy5HQU1FX0hFSUdIVCxcbiAgICAgICAgICAgIHRoaXMucmFuZC5nZXRSYW5kb20oKSAlIDM2MCxcbiAgICAgICAgICAgIHdlYXBvbkxpZmVUaW1lXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChpdGVtLmVsZW1lbnQpO1xuICAgICAgICB0aGlzLnNob3VsZFNwYXduID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaXRlbXMucHVzaChpdGVtKTtcblxuICAgICAgICB2YXIgbGlzdGVuZXIgPSBuZXcgQ29sbGlzaW9uTGlzdGVuZXIodGhpcy50YXJnZXQsIGl0ZW0sICdwaWNrdXAnKTtcbiAgICAgICAgbGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMuaXRlbXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgaWYgKCF0aGlzLml0ZW1zW2ldLmVxdWlwcGVkICYmIHRoaXMuaXRlbXNbaV0ubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuaXRlbXNbaV0uZWxlbWVudCk7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLml0ZW1zW2ldWyd0aWNrJ10gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5pdGVtc1tpXS50aWNrKGV2ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5pdGVtc1tpXS5lcXVpcHBlZCAmJiB0aGlzLml0ZW1zW2ldLmxpZmV0aW1lID4gMCkge1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnNbaV0udGljayhldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxuSXRlbUhhbmRsZXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuICAgIHRoaXMucmFuZC5zZXRTZWVkKGxldmVsLml0ZW1TZWVkKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSXRlbUhhbmRsZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9JdGVtSGFuZGxlci5qc1wiLFwiL3dlYXBvbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgYXR0YWNrRHVyYXRpb24gPSA1MDA7XG5cbmZ1bmN0aW9uIFNob3J0V2VhcG9uKHgsIHksIHJvdGF0aW9uLCBsaWZldGltZSkge1xuICAgIHRoaXMucmFkaXVzID0gMjA7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuaWQgPSAnaXRlbSc7XG4gICAgdGhpcy5lbGVtZW50LnggPSB4O1xuICAgIHRoaXMuZWxlbWVudC55ID0geTtcbiAgICB0aGlzLmVsZW1lbnQucm90YXRpb24gPSByb3RhdGlvbjtcblxuICAgIHRoaXMuZXF1aXBwZWQgPSBmYWxzZTtcbiAgICB0aGlzLmxpZmV0aW1lID0gbGlmZXRpbWU7XG5cbiAgICB2YXIgaW1hZ2UgPSBuZXcgY3JlYXRlanMuQml0bWFwKCcuL2ltZy9zY2h3ZXJ0LnBuZycpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGltYWdlLmltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLmVsZW1lbnQucmVnWCA9IHNlbGYuZWxlbWVudC5nZXRCb3VuZHMoKS53aWR0aCAvIDI7XG4gICAgICAgIHNlbGYuZWxlbWVudC5yZWdZID0gc2VsZi5lbGVtZW50LmdldEJvdW5kcygpLmhlaWdodCAvIDI7XG4gICAgfTtcbiAgICB0aGlzLmltYWdlID0gaW1hZ2U7XG4gICAgdGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjE7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKGltYWdlKTtcbn1cblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2F0dGFjaycsIHRoaXMub25BdHRhY2suYmluZCh0aGlzKSk7XG59O1xuXG5TaG9ydFdlYXBvbi5wcm90b3R5cGUub25BdHRhY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuY2FuQWN0aXZlID0gdHJ1ZTtcbn07XG5cblNob3J0V2VhcG9uLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAodGhpcy5jYW5BY3RpdmUpIHtcbiAgICAgICAgdGhpcy5pc0FjdGl2ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuY2FuQWN0aXZlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29vbGRvd24gPSBldmVudC50aW1lU3RhbXAgKyBhdHRhY2tEdXJhdGlvbjtcbiAgICAgICAgdGhpcy5saWZldGltZS0tO1xuXG4gICAgICAgIGlmICh0aGlzLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXF1aXBwZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmlzQWN0aXZlICYmIHRoaXMuY29vbGRvd24gPCBldmVudC50aW1lU3RhbXApIHtcbiAgICAgICAgdGhpcy5jYW5BY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xuICAgIH1cbn07XG5cblNob3J0V2VhcG9uLnByb3RvdHlwZS5nZXRSYWRpdXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmFkaXVzO1xufTtcblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLmVxdWlwID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnggPSA5MDA7XG4gICAgdGhpcy5lbGVtZW50LnkgPSAwO1xuICAgIHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IDA7XG4gICAgdGhpcy5yYWRpdXMgPSA4MDtcbiAgICB0aGlzLmlkID0gJ3Nob3J0LXdlYXBvbic7XG4gICAgdGhpcy5lcXVpcHBlZCA9IHRydWU7XG4gICAgdGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAxO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaG9ydFdlYXBvbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi93ZWFwb25zL1Nob3J0V2VhcG9uLmpzXCIsXCIvd2VhcG9uc1wiKSJdfQ==
