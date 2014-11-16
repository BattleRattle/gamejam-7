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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_2eb0246d.js","/")
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ldmVudGVtaXR0ZXIyL2xpYi9ldmVudGVtaXR0ZXIyLmpzIiwiL3d3dy9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL3d3dy9nYW1lamFtLTcvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi93d3cvZ2FtZWphbS03L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9HYW1lQ29uc3RzLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL01vbnN0ZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvUGxheWVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL1ByZWxvYWRlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9hc3NldHMuanNvbiIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9mYWtlXzJlYjAyNDZkLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2dhbWUuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvZ3JvdW5kL0Zsb3dlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9ncm91bmQvR3JvdW5kLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2dyb3VuZC9SYWluYm93Um9hZC5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9ncm91bmQvVHJlZS5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9odWQvQ2hlYXRlckJhci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9odWQvRnVuQmFyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2h1ZC9IZWFsdGhCYXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvaHVkL0xldmVsQmFyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2h1ZC9XZWFwb25CYXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGV2ZWwvTGV2ZWwuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGV2ZWwvTGV2ZWxCdWlsZGVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xldmVsL2xldmVscy5qc29uIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0F0dGFja0xpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0NoZWF0TGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvQ29sbGlzaW9uTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvQ29tYm9MaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Hcm93bExpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL0l0ZW1MaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9MZXZlbFVwTGlzdGVuZXIuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvbGlzdGVuZXIvUmFpbmJvd1JvYWRMaXN0ZW5lci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9saXN0ZW5lci9Tb3VuZExpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL2xpc3RlbmVyL1dlYXBvbkJhckxpc3RlbmVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL25pZ2h0T3ZlcmxheS9OaWdodE92ZXJsYXkuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvc2NyZWVucy9HYW1lT3ZlclNjcmVlbi5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9zY3JlZW5zL0dhbWVTY3JlZW4uanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvc2NyZWVucy9Ib21lU2NyZWVuLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3NjcmVlbnMvTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy9zY3JlZW5zL1N0b3J5U2NyZWVuLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3V0aWwvUHNldWRvUmFuZC5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy91dGlsL1ZlY3RvcjJkLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3ZpZXdzL1ZpZXcuanMiLCIvd3d3L2dhbWVqYW0tNy9zdGF0aWMvanMvd2VhcG9ucy9Hcm93bC5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy93ZWFwb25zL0dyb3dsSGFuZGxlci5qcyIsIi93d3cvZ2FtZWphbS03L3N0YXRpYy9qcy93ZWFwb25zL0l0ZW1IYW5kbGVyLmpzIiwiL3d3dy9nYW1lamFtLTcvc3RhdGljL2pzL3dlYXBvbnMvU2hvcnRXZWFwb24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIVxuICogRXZlbnRFbWl0dGVyMlxuICogaHR0cHM6Ly9naXRodWIuY29tL2hpajFueC9FdmVudEVtaXR0ZXIyXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIGhpajFueFxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG47IWZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSA/IEFycmF5LmlzQXJyYXkgOiBmdW5jdGlvbiBfaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbiAgfTtcbiAgdmFyIGRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGlmICh0aGlzLl9jb25mKSB7XG4gICAgICBjb25maWd1cmUuY2FsbCh0aGlzLCB0aGlzLl9jb25mKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb25maWd1cmUoY29uZikge1xuICAgIGlmIChjb25mKSB7XG5cbiAgICAgIHRoaXMuX2NvbmYgPSBjb25mO1xuXG4gICAgICBjb25mLmRlbGltaXRlciAmJiAodGhpcy5kZWxpbWl0ZXIgPSBjb25mLmRlbGltaXRlcik7XG4gICAgICBjb25mLm1heExpc3RlbmVycyAmJiAodGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IGNvbmYubWF4TGlzdGVuZXJzKTtcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcbiAgICAgIGNvbmYubmV3TGlzdGVuZXIgJiYgKHRoaXMubmV3TGlzdGVuZXIgPSBjb25mLm5ld0xpc3RlbmVyKTtcblxuICAgICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lclRyZWUgPSB7fTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBFdmVudEVtaXR0ZXIoY29uZikge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMubmV3TGlzdGVuZXIgPSBmYWxzZTtcbiAgICBjb25maWd1cmUuY2FsbCh0aGlzLCBjb25mKTtcbiAgfVxuXG4gIC8vXG4gIC8vIEF0dGVudGlvbiwgZnVuY3Rpb24gcmV0dXJuIHR5cGUgbm93IGlzIGFycmF5LCBhbHdheXMgIVxuICAvLyBJdCBoYXMgemVybyBlbGVtZW50cyBpZiBubyBhbnkgbWF0Y2hlcyBmb3VuZCBhbmQgb25lIG9yIG1vcmVcbiAgLy8gZWxlbWVudHMgKGxlYWZzKSBpZiB0aGVyZSBhcmUgbWF0Y2hlc1xuICAvL1xuICBmdW5jdGlvbiBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIGkpIHtcbiAgICBpZiAoIXRyZWUpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdmFyIGxpc3RlbmVycz1bXSwgbGVhZiwgbGVuLCBicmFuY2gsIHhUcmVlLCB4eFRyZWUsIGlzb2xhdGVkQnJhbmNoLCBlbmRSZWFjaGVkLFxuICAgICAgICB0eXBlTGVuZ3RoID0gdHlwZS5sZW5ndGgsIGN1cnJlbnRUeXBlID0gdHlwZVtpXSwgbmV4dFR5cGUgPSB0eXBlW2krMV07XG4gICAgaWYgKGkgPT09IHR5cGVMZW5ndGggJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgYXQgdGhlIGVuZCBvZiB0aGUgZXZlbnQocykgbGlzdCBhbmQgdGhlIHRyZWUgaGFzIGxpc3RlbmVyc1xuICAgICAgLy8gaW52b2tlIHRob3NlIGxpc3RlbmVycy5cbiAgICAgIC8vXG4gICAgICBpZiAodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxlYWYgPSAwLCBsZW4gPSB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoOyBsZWFmIDwgbGVuOyBsZWFmKyspIHtcbiAgICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVyc1tsZWFmXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGN1cnJlbnRUeXBlID09PSAnKicgfHwgY3VycmVudFR5cGUgPT09ICcqKicpIHx8IHRyZWVbY3VycmVudFR5cGVdKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGV2ZW50IGVtaXR0ZWQgaXMgJyonIGF0IHRoaXMgcGFydFxuICAgICAgLy8gb3IgdGhlcmUgaXMgYSBjb25jcmV0ZSBtYXRjaCBhdCB0aGlzIHBhdGNoXG4gICAgICAvL1xuICAgICAgaWYgKGN1cnJlbnRUeXBlID09PSAnKicpIHtcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfSBlbHNlIGlmKGN1cnJlbnRUeXBlID09PSAnKionKSB7XG4gICAgICAgIGVuZFJlYWNoZWQgPSAoaSsxID09PSB0eXBlTGVuZ3RoIHx8IChpKzIgPT09IHR5cGVMZW5ndGggJiYgbmV4dFR5cGUgPT09ICcqJykpO1xuICAgICAgICBpZihlbmRSZWFjaGVkICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIFRoZSBuZXh0IGVsZW1lbnQgaGFzIGEgX2xpc3RlbmVycywgYWRkIGl0IHRvIHRoZSBoYW5kbGVycy5cbiAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gJyonIHx8IGJyYW5jaCA9PT0gJyoqJykge1xuICAgICAgICAgICAgICBpZih0cmVlW2JyYW5jaF0uX2xpc3RlbmVycyAmJiAhZW5kUmVhY2hlZCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzIpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIE5vIG1hdGNoIG9uIHRoaXMgb25lLCBzaGlmdCBpbnRvIHRoZSB0cmVlIGJ1dCBub3QgaW4gdGhlIHR5cGUgYXJyYXkuXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH1cblxuICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbY3VycmVudFR5cGVdLCBpKzEpKTtcbiAgICB9XG5cbiAgICB4VHJlZSA9IHRyZWVbJyonXTtcbiAgICBpZiAoeFRyZWUpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgbGlzdGVuZXIgdHJlZSB3aWxsIGFsbG93IGFueSBtYXRjaCBmb3IgdGhpcyBwYXJ0LFxuICAgICAgLy8gdGhlbiByZWN1cnNpdmVseSBleHBsb3JlIGFsbCBicmFuY2hlcyBvZiB0aGUgdHJlZVxuICAgICAgLy9cbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeFRyZWUsIGkrMSk7XG4gICAgfVxuXG4gICAgeHhUcmVlID0gdHJlZVsnKionXTtcbiAgICBpZih4eFRyZWUpIHtcbiAgICAgIGlmKGkgPCB0eXBlTGVuZ3RoKSB7XG4gICAgICAgIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGxpc3RlbmVyIG9uIGEgJyoqJywgaXQgd2lsbCBjYXRjaCBhbGwsIHNvIGFkZCBpdHMgaGFuZGxlci5cbiAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCdWlsZCBhcnJheXMgb2YgbWF0Y2hpbmcgbmV4dCBicmFuY2hlcyBhbmQgb3RoZXJzLlxuICAgICAgICBmb3IoYnJhbmNoIGluIHh4VHJlZSkge1xuICAgICAgICAgIGlmKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHh4VHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIFdlIGtub3cgdGhlIG5leHQgZWxlbWVudCB3aWxsIG1hdGNoLCBzbyBqdW1wIHR3aWNlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gY3VycmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gQ3VycmVudCBub2RlIG1hdGNoZXMsIG1vdmUgaW50byB0aGUgdHJlZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsxKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoID0ge307XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoW2JyYW5jaF0gPSB4eFRyZWVbYnJhbmNoXTtcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB7ICcqKic6IGlzb2xhdGVkQnJhbmNoIH0sIGkrMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSByZWFjaGVkIHRoZSBlbmQgYW5kIHN0aWxsIG9uIGEgJyoqJ1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlWycqJ10gJiYgeHhUcmVlWycqJ10uX2xpc3RlbmVycykge1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVsnKiddLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlzdGVuZXJzO1xuICB9XG5cbiAgZnVuY3Rpb24gZ3Jvd0xpc3RlbmVyVHJlZSh0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgdHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuXG4gICAgLy9cbiAgICAvLyBMb29rcyBmb3IgdHdvIGNvbnNlY3V0aXZlICcqKicsIGlmIHNvLCBkb24ndCBhZGQgdGhlIGV2ZW50IGF0IGFsbC5cbiAgICAvL1xuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHR5cGUubGVuZ3RoOyBpKzEgPCBsZW47IGkrKykge1xuICAgICAgaWYodHlwZVtpXSA9PT0gJyoqJyAmJiB0eXBlW2krMV0gPT09ICcqKicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB0cmVlID0gdGhpcy5saXN0ZW5lclRyZWU7XG4gICAgdmFyIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG5cbiAgICB3aGlsZSAobmFtZSkge1xuXG4gICAgICBpZiAoIXRyZWVbbmFtZV0pIHtcbiAgICAgICAgdHJlZVtuYW1lXSA9IHt9O1xuICAgICAgfVxuXG4gICAgICB0cmVlID0gdHJlZVtuYW1lXTtcblxuICAgICAgaWYgKHR5cGUubGVuZ3RoID09PSAwKSB7XG5cbiAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBsaXN0ZW5lcjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBbdHJlZS5fbGlzdGVuZXJzLCBsaXN0ZW5lcl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXNBcnJheSh0cmVlLl9saXN0ZW5lcnMpKSB7XG5cbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycy53YXJuZWQpIHtcblxuICAgICAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobSA+IDAgJiYgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBuYW1lID0gdHlwZS5zaGlmdCgpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cbiAgLy8gMTAgbGlzdGVuZXJzIGFyZSBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoXG4gIC8vIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuICAvL1xuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcbiAgLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5kZWxpbWl0ZXIgPSAnLic7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gbjtcbiAgICBpZiAoIXRoaXMuX2NvbmYpIHRoaXMuX2NvbmYgPSB7fTtcbiAgICB0aGlzLl9jb25mLm1heExpc3RlbmVycyA9IG47XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudCA9ICcnO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbikge1xuICAgIHRoaXMubWFueShldmVudCwgMSwgZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubWFueSA9IGZ1bmN0aW9uKGV2ZW50LCB0dGwsIGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaXN0ZW5lcigpIHtcbiAgICAgIGlmICgtLXR0bCA9PT0gMCkge1xuICAgICAgICBzZWxmLm9mZihldmVudCwgbGlzdGVuZXIpO1xuICAgICAgfVxuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lci5fb3JpZ2luID0gZm47XG5cbiAgICB0aGlzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICB2YXIgdHlwZSA9IGFyZ3VtZW50c1swXTtcblxuICAgIGlmICh0eXBlID09PSAnbmV3TGlzdGVuZXInICYmICF0aGlzLm5ld0xpc3RlbmVyKSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcikgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggdGhlICpfYWxsKiBmdW5jdGlvbnMgYW5kIGludm9rZSB0aGVtLlxuICAgIGlmICh0aGlzLl9hbGwpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLl9hbGwubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICB0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICAgIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG5cbiAgICAgIGlmICghdGhpcy5fYWxsICYmXG4gICAgICAgICF0aGlzLl9ldmVudHMuZXJyb3IgJiZcbiAgICAgICAgISh0aGlzLndpbGRjYXJkICYmIHRoaXMubGlzdGVuZXJUcmVlLmVycm9yKSkge1xuXG4gICAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgJ2Vycm9yJyBldmVudC5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBoYW5kbGVyO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgaGFuZGxlciA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVyLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBzbG93ZXJcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKGhhbmRsZXIpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgICAgdmFyIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkgfHwgISF0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuICEhdGhpcy5fYWxsO1xuICAgIH1cblxuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLm9uQW55KHR5cGUpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbiBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09IFwibmV3TGlzdGVuZXJzXCIhIEJlZm9yZVxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGdyb3dMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCB0eXBlLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkge1xuICAgICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgICB9XG4gICAgZWxzZSBpZih0eXBlb2YgdGhpcy5fZXZlbnRzW3R5cGVdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcblxuICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uQW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBpZighdGhpcy5fYWxsKSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGZ1bmN0aW9uIHRvIHRoZSBldmVudCBsaXN0ZW5lciBjb2xsZWN0aW9uLlxuICAgIHRoaXMuX2FsbC5wdXNoKGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVMaXN0ZW5lciBvbmx5IHRha2VzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyxsZWFmcz1bXTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGRvZXMgbm90IHVzZSBsaXN0ZW5lcnMoKSwgc28gbm8gc2lkZSBlZmZlY3Qgb2YgY3JlYXRpbmcgX2V2ZW50c1t0eXBlXVxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgaGFuZGxlcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICBsZWFmcy5wdXNoKHtfbGlzdGVuZXJzOmhhbmRsZXJzfSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgIGhhbmRsZXJzID0gbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgaWYgKGlzQXJyYXkoaGFuZGxlcnMpKSB7XG5cbiAgICAgICAgdmFyIHBvc2l0aW9uID0gLTE7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGhhbmRsZXJzW2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLmxpc3RlbmVyICYmIGhhbmRsZXJzW2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGxlYWYuX2xpc3RlbmVycy5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbmRsZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgKGhhbmRsZXJzLmxpc3RlbmVyICYmIGhhbmRsZXJzLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgKGhhbmRsZXJzLl9vcmlnaW4gJiYgaGFuZGxlcnMuX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZkFueSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgdmFyIGkgPSAwLCBsID0gMCwgZm5zO1xuICAgIGlmIChmbiAmJiB0aGlzLl9hbGwgJiYgdGhpcy5fYWxsLmxlbmd0aCA+IDApIHtcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcbiAgICAgIGZvcihpID0gMCwgbCA9IGZucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgaWYoZm4gPT09IGZuc1tpXSkge1xuICAgICAgICAgIGZucy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgIXRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHZhciBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG5cbiAgICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgICAgbGVhZi5fbGlzdGVuZXJzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgaGFuZGxlcnMgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlcnMsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgICByZXR1cm4gaGFuZGxlcnM7XG4gICAgfVxuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBbXTtcbiAgICBpZiAoIWlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV07XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcblxuICAgIGlmKHRoaXMuX2FsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gIH07XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEV2ZW50RW1pdHRlcjtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBDb21tb25KU1xuICAgIGV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICB3aW5kb3cuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxufSgpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ldmVudGVtaXR0ZXIyL2xpYi9ldmVudGVtaXR0ZXIyLmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MlxuXG4vKipcbiAqIElmIGBCdWZmZXIuX3VzZVR5cGVkQXJyYXlzYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKGNvbXBhdGlibGUgZG93biB0byBJRTYpXG4gKi9cbkJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgPSAoZnVuY3Rpb24gKCkge1xuICAvLyBEZXRlY3QgaWYgYnJvd3NlciBzdXBwb3J0cyBUeXBlZCBBcnJheXMuIFN1cHBvcnRlZCBicm93c2VycyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLFxuICAvLyBDaHJvbWUgNyssIFNhZmFyaSA1LjErLCBPcGVyYSAxMS42KywgaU9TIDQuMisuIElmIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgYWRkaW5nXG4gIC8vIHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcywgdGhlbiB0aGF0J3MgdGhlIHNhbWUgYXMgbm8gYFVpbnQ4QXJyYXlgIHN1cHBvcnRcbiAgLy8gYmVjYXVzZSB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gYWRkIGFsbCB0aGUgbm9kZSBCdWZmZXIgQVBJIG1ldGhvZHMuIFRoaXMgaXMgYW4gaXNzdWVcbiAgLy8gaW4gRmlyZWZveCA0LTI5LiBOb3cgZml4ZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOFxuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiZcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAvLyBDaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgLy8gV29ya2Fyb3VuZDogbm9kZSdzIGJhc2U2NCBpbXBsZW1lbnRhdGlvbiBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgc3RyaW5nc1xuICAvLyB3aGlsZSBiYXNlNjQtanMgZG9lcyBub3QuXG4gIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcgJiYgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBzdWJqZWN0ID0gc3RyaW5ndHJpbShzdWJqZWN0KVxuICAgIHdoaWxlIChzdWJqZWN0Lmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0ICsgJz0nXG4gICAgfVxuICB9XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0KVxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJylcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QubGVuZ3RoKSAvLyBhc3N1bWUgdGhhdCBvYmplY3QgaXMgYXJyYXktbGlrZVxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCBuZWVkcyB0byBiZSBhIG51bWJlciwgYXJyYXkgb3Igc3RyaW5nLicpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgICBlbHNlXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3RbaV1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuLy8gU1RBVElDIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPT0gbnVsbCAmJiBiICE9PSB1bmRlZmluZWQgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIgKyAnJ1xuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoIC8gMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGFzc2VydChpc0FycmF5KGxpc3QpLCAnVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdCwgW3RvdGFsTGVuZ3RoXSlcXG4nICtcbiAgICAgICdsaXN0IHNob3VsZCBiZSBhbiBBcnJheS4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB0b3RhbExlbmd0aCAhPT0gJ251bWJlcicpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBCVUZGRVIgSU5TVEFOQ0UgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gX2hleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgYXNzZXJ0KHN0ckxlbiAlIDIgPT09IDAsICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBhc3NlcnQoIWlzTmFOKGJ5dGUpLCAnSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPSBpICogMlxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBfdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2FzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2JpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIF9hc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcbiAgc3RhcnQgPSBOdW1iZXIoc3RhcnQpIHx8IDBcbiAgZW5kID0gKGVuZCAhPT0gdW5kZWZpbmVkKVxuICAgID8gTnVtYmVyKGVuZClcbiAgICA6IGVuZCA9IHNlbGYubGVuZ3RoXG5cbiAgLy8gRmFzdHBhdGggZW1wdHkgc3RyaW5nc1xuICBpZiAoZW5kID09PSBzdGFydClcbiAgICByZXR1cm4gJydcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGFzc2VydCh0YXJnZXRfc3RhcnQgPj0gMCAmJiB0YXJnZXRfc3RhcnQgPCB0YXJnZXQubGVuZ3RoLFxuICAgICAgJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSBzb3VyY2UubGVuZ3RoLCAnc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAgfHwgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiBfdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKylcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gX2JpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIF9hc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gX2hleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSsxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSBjbGFtcChzdGFydCwgbGVuLCAwKVxuICBlbmQgPSBjbGFtcChlbmQsIGxlbiwgbGVuKVxuXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgdmFsID0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICB9IGVsc2Uge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV1cbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDJdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgICB2YWwgfD0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0ICsgM10gPDwgMjQgPj4+IDApXG4gIH0gZWxzZSB7XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMV0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMl0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAzXVxuICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0XSA8PCAyNCA+Pj4gMClcbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsXG4gICAgICAgICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICB2YXIgbmVnID0gdGhpc1tvZmZzZXRdICYgMHg4MFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQxNihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MzIoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMDAwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZmZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRmxvYXQgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWREb3VibGUgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuXG5cbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAgICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZmZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2YsIC0weDgwKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB0aGlzLndyaXRlVUludDgodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB0aGlzLndyaXRlVUludDgoMHhmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmLCAtMHg4MDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQxNihidWYsIDB4ZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQzMihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MzIoYnVmLCAweGZmZmZmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCxcbiAgICAgICAgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5jaGFyQ29kZUF0KDApXG4gIH1cblxuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiAhaXNOYU4odmFsdWUpLCAndmFsdWUgaXMgbm90IGEgbnVtYmVyJylcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgdGhpcy5sZW5ndGgsICdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSB0aGlzLmxlbmd0aCwgJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHRoaXNbaV0gPSB2YWx1ZVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG91dCA9IFtdXG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgb3V0W2ldID0gdG9IZXgodGhpc1tpXSlcbiAgICBpZiAoaSA9PT0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUykge1xuICAgICAgb3V0W2kgKyAxXSA9ICcuLi4nXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIG91dC5qb2luKCcgJykgKyAnPidcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpXG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgZ2V0L3NldCBtZXRob2RzIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX2dldCA9IGFyci5nZXRcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxuLy8gc2xpY2Uoc3RhcnQsIGVuZClcbmZ1bmN0aW9uIGNsYW1wIChpbmRleCwgbGVuLCBkZWZhdWx0VmFsdWUpIHtcbiAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgaW5kZXggPSB+fmluZGV4OyAgLy8gQ29lcmNlIHRvIGludGVnZXIuXG4gIGlmIChpbmRleCA+PSBsZW4pIHJldHVybiBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICBpbmRleCArPSBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICByZXR1cm4gMFxufVxuXG5mdW5jdGlvbiBjb2VyY2UgKGxlbmd0aCkge1xuICAvLyBDb2VyY2UgbGVuZ3RoIHRvIGEgbnVtYmVyIChwb3NzaWJseSBOYU4pLCByb3VuZCB1cFxuICAvLyBpbiBjYXNlIGl0J3MgZnJhY3Rpb25hbCAoZS5nLiAxMjMuNDU2KSB0aGVuIGRvIGFcbiAgLy8gZG91YmxlIG5lZ2F0ZSB0byBjb2VyY2UgYSBOYU4gdG8gMC4gRWFzeSwgcmlnaHQ/XG4gIGxlbmd0aCA9IH5+TWF0aC5jZWlsKCtsZW5ndGgpXG4gIHJldHVybiBsZW5ndGggPCAwID8gMCA6IGxlbmd0aFxufVxuXG5mdW5jdGlvbiBpc0FycmF5IChzdWJqZWN0KSB7XG4gIHJldHVybiAoQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoc3ViamVjdCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3ViamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSdcbiAgfSkoc3ViamVjdClcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3RilcbiAgICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpKVxuICAgIGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKylcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgcG9zXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuXG4vKlxuICogV2UgaGF2ZSB0byBtYWtlIHN1cmUgdGhhdCB0aGUgdmFsdWUgaXMgYSB2YWxpZCBpbnRlZ2VyLiBUaGlzIG1lYW5zIHRoYXQgaXRcbiAqIGlzIG5vbi1uZWdhdGl2ZS4gSXQgaGFzIG5vIGZyYWN0aW9uYWwgY29tcG9uZW50IGFuZCB0aGF0IGl0IGRvZXMgbm90XG4gKiBleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gdmVyaWZ1aW50ICh2YWx1ZSwgbWF4KSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA+PSAwLCAnc3BlY2lmaWVkIGEgbmVnYXRpdmUgdmFsdWUgZm9yIHdyaXRpbmcgYW4gdW5zaWduZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgaXMgbGFyZ2VyIHRoYW4gbWF4aW11bSB2YWx1ZSBmb3IgdHlwZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmc2ludCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmSUVFRTc1NCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG59XG5cbmZ1bmN0aW9uIGFzc2VydCAodGVzdCwgbWVzc2FnZSkge1xuICBpZiAoIXRlc3QpIHRocm93IG5ldyBFcnJvcihtZXNzYWdlIHx8ICdGYWlsZWQgYXNzZXJ0aW9uJylcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSClcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIG5CaXRzID0gLTcsXG4gICAgICBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDAsXG4gICAgICBkID0gaXNMRSA/IC0xIDogMSxcbiAgICAgIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV07XG5cbiAgaSArPSBkO1xuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBzID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIGUgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBtTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXM7XG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59O1xuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGMsXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApLFxuICAgICAgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpLFxuICAgICAgZCA9IGlzTEUgPyAxIDogLTEsXG4gICAgICBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KTtcblxuICBlID0gKGUgPDwgbUxlbikgfCBtO1xuICBlTGVuICs9IG1MZW47XG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCk7XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEdhbWVDb25zdHMgPSB7fTtcblxuLy8gd2luZG93IHNpemUgaW4gcHhcbkdhbWVDb25zdHMuR0FNRV9XSURUSCBcdD0gMTAyNDtcbkdhbWVDb25zdHMuR0FNRV9IRUlHSFQgXHQ9IDc2ODtcblxuLy8gdG90YWwgZmllbGQgc2l6ZVxuR2FtZUNvbnN0cy5TSVpFID0gMzAwMDtcblxuR2FtZUNvbnN0cy5OSUdIVF9NT0RFID0gdHJ1ZTtcbkdhbWVDb25zdHMuRFJBV19GTE9XRVJTID0gZmFsc2U7XG5cbkdhbWVDb25zdHMuTU9OU1RFUl9TUEVFRCA9IDAuMDI1O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdhbWVDb25zdHM7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvR2FtZUNvbnN0cy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBncm93bFNvdW5kcyA9IDM7IC8vIGluIHNlY29uZHNcblxudmFyIFZlYzJkID0gcmVxdWlyZSgnLi91dGlsL1ZlY3RvcjJkJyksXG5cdEdhbWVDb25zdHMgPSByZXF1aXJlKCcuL0dhbWVDb25zdHMnKTtcblxudmFyIE1vbnN0ZXIgPSBmdW5jdGlvbih4LCB5LCB0YXJnZXQpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR0aGlzLnRhcmdldCA9IHRhcmdldDtcblxuXHR0aGlzLnJhZGl1cyA9IDkwO1xuXHR0aGlzLm1heEhlYWx0aCA9IHRoaXMuaGVhbHRoID0gMzAwO1xuXHR0aGlzLmlkID0gJ21vbnN0ZXInO1xuXHR0aGlzLmxhc3RHcm93bEF0ID0gMDtcblx0dGhpcy5ncm93bFNvdW5kSW5kZXggPSAwO1xuXHR0aGlzLmJvdW5jZVZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuXHR0aGlzLnNwZWVkID0gMTtcblx0dGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXHR0aGlzLnZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuXHR0aGlzLmdyb3dsQ29vbGRvd24gPSAwO1xuXG5cdHZhciBpbWFnZSA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoJy4vaW1nL21vbnN0ZXIucG5nJyk7XG5cdHRoaXMuZWxlbWVudC5zY2FsZVggPSB0aGlzLmVsZW1lbnQuc2NhbGVZID0gMC4zO1xuXG5cdGltYWdlLmltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHNlbGYuZWxlbWVudC5yZWdYID0gc2VsZi5lbGVtZW50LmdldEJvdW5kcygpLndpZHRoIC8gMjtcblx0XHRzZWxmLmVsZW1lbnQucmVnWSA9IHNlbGYuZWxlbWVudC5nZXRCb3VuZHMoKS5oZWlnaHQgLyAyO1xuXHR9O1xuXG5cdHRoaXMuZWxlbWVudC54ID0geDtcblx0dGhpcy5lbGVtZW50LnkgPSB5O1xuXG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChpbWFnZSk7XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuTW9uc3Rlci5wcm90b3R5cGUub25IaXQgPSBmdW5jdGlvbihldmVudCkge1xuXHRpZiAoZXZlbnQuaGl0VGFyZ2V0ICE9PSB0aGlzLmlkKSB7XG5cdFx0aWYgKGV2ZW50LmRhbWFnZURlYWxlciA9PSB0aGlzLmlkKSB7XG5cdFx0XHR2YXIgcG9zaXRpb24gPSBuZXcgVmVjMmQodGhpcy5lbGVtZW50LngsIHRoaXMuZWxlbWVudC55KTtcblx0XHRcdHZhciB0YXJnZXRfcG9zaXRpb24gPSBuZXcgVmVjMmQodGhpcy50YXJnZXQuZWxlbWVudC54LCB0aGlzLnRhcmdldC5lbGVtZW50LnkpO1xuXHRcdFx0dGhpcy50YXJnZXQuYm91bmNlVmVsb2NpdHkgPSAgVmVjMmQuc3VidHJhY3QodGFyZ2V0X3Bvc2l0aW9uLCBwb3NpdGlvbikubm9ybSgpLnRpbWVzKDE4MCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0dGhpcy5ib3VuY2VWZWxvY2l0eSA9IHRoaXMudmVsb2NpdHkuY2xvbmUoKS5ub3JtKCkudGltZXMoLTE4MCk7XG5cblx0dGhpcy5oZWFsdGggLT0gZXZlbnQuZGFtYWdlO1xuXHR0aGlzLmhlYWx0aCA9IE1hdGgubWF4KDAsIHRoaXMuaGVhbHRoKTtcblxuXHRpZiAodGhpcy5oZWFsdGggPT0gMCkge1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdtb25zdGVyLWRlYWQnKTtcblx0fVxufTtcblxuLyoqXG4gKiBAcGFyYW0gZXZlbnRcbiAqL1xuTW9uc3Rlci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdHZhciBjdXJyZW50ID0gbmV3IFZlYzJkKHRoaXMudGFyZ2V0LmVsZW1lbnQueCwgdGhpcy50YXJnZXQuZWxlbWVudC55KTtcblx0dmFyIHRhcmdldCA9IG5ldyBWZWMyZCh0aGlzLmVsZW1lbnQueCwgdGhpcy5lbGVtZW50LnkpO1xuXG5cdHZhciB2ZWN0b3JfdG9fZGVzdGluYXRpb24gPSBWZWMyZC5zdWJ0cmFjdChjdXJyZW50LCB0YXJnZXQpO1xuXHR2YXIgZGlzdGFuY2UgPSB2ZWN0b3JfdG9fZGVzdGluYXRpb24ubGVuZ3RoKCk7XG5cblx0Ly8gY2FsY3VsYXRlIG5ldyB2ZWxvY2l0eSBhY2NvcmRpbmcgdG8gY3VycmVudCB2ZWxvY2l0eSBhbmQgcG9zaXRpb24gb2YgdGFyZ2V0XG5cdHZlY3Rvcl90b19kZXN0aW5hdGlvbi5ub3JtKCkudGltZXMoMC41KTtcblx0dGhpcy52ZWxvY2l0eS5ub3JtKCkudGltZXMoMjApO1xuXHR0aGlzLnZlbG9jaXR5ID0gdGhpcy52ZWxvY2l0eS5wbHVzKHZlY3Rvcl90b19kZXN0aW5hdGlvbik7XG5cblx0Ly8gc2V0IHNwZWVkIG9mIG1vbnN0ZXIgYWNjb3JkaW5nIHRvIGRpc3RhbmNlIHRvIHRhcmdldFxuXHR0aGlzLnZlbG9jaXR5LnRpbWVzKGRpc3RhbmNlKTtcblxuXHR2YXIgZGVsdGEgPSBWZWMyZC5tdWx0aXBseSh0aGlzLnZlbG9jaXR5LCBldmVudC5kZWx0YSAvIDEwMDAgKiBHYW1lQ29uc3RzLk1PTlNURVJfU1BFRUQgKiB0aGlzLnNwZWVkKTtcblx0dmFyIGFuZ2xlID0gVmVjMmQuZ2V0QW5nbGUoZGVsdGEpO1xuXG5cdGlmICh0aGlzLmJvdW5jZVZlbG9jaXR5Lmxlbmd0aCgpICE9IDApIHtcblx0XHR2YXIgcHVzaF9kZWx0YSA9IFZlYzJkLm11bHRpcGx5KHRoaXMuYm91bmNlVmVsb2NpdHkuY2xvbmUoKSwgZXZlbnQuZGVsdGEgLyA4MCk7XG5cdFx0dGhpcy5ib3VuY2VWZWxvY2l0eSA9IHRoaXMuYm91bmNlVmVsb2NpdHkubWludXMocHVzaF9kZWx0YSk7XG5cblx0XHRkZWx0YS5wbHVzKHB1c2hfZGVsdGEpO1xuXG5cdFx0aWYgKHB1c2hfZGVsdGEubGVuZ3RoKCkgPCAxKSB7XG5cdFx0XHR0aGlzLmJvdW5jZVZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuXHRcdH1cblx0fVxuXG5cdHRoaXMuZWxlbWVudC54ICs9IGRlbHRhLng7XG5cdHRoaXMuZWxlbWVudC55ICs9IGRlbHRhLnk7XG5cblx0dGhpcy5lbGVtZW50LnggPSBNYXRoLm1pbihHYW1lQ29uc3RzLlNJWkUsIE1hdGgubWF4KC1HYW1lQ29uc3RzLlNJWkUsIHRoaXMuZWxlbWVudC54KSk7XG5cdHRoaXMuZWxlbWVudC55ID0gTWF0aC5taW4oR2FtZUNvbnN0cy5TSVpFLCBNYXRoLm1heCgtR2FtZUNvbnN0cy5TSVpFLCB0aGlzLmVsZW1lbnQueSkpO1xuXG5cdHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IGFuZ2xlO1xuXG5cdGlmICh0aGlzLmdyb3dsQ29vbGRvd24gJiYgZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0R3Jvd2xBdCA+IHRoaXMuZ3Jvd2xDb29sZG93biAqIDEwMDApIHtcblx0XHR0aGlzLmdyb3dsKCk7XG5cdH1cbn07XG5cbk1vbnN0ZXIucHJvdG90eXBlLmdyb3dsID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMubGFzdEdyb3dsQXQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0Y3JlYXRlanMuU291bmQucGxheSgnZ3Jvd2wnICsgdGhpcy5ncm93bFNvdW5kSW5kZXgsIHt2b2x1bWU6IDAuOH0pO1xuXHR0aGlzLmdyb3dsU291bmRJbmRleCA9ICh0aGlzLmdyb3dsU291bmRJbmRleCArIDEpICUgZ3Jvd2xTb3VuZHM7XG5cblx0dGhpcy5lbWl0dGVyLmVtaXQoJ2dyb3dsJywge1xuXHRcdHg6IHRoaXMuZWxlbWVudC54LFxuXHRcdHk6IHRoaXMuZWxlbWVudC55LFxuXHRcdHRhcmdldDogdGhpcy50YXJnZXRcblx0fSk7XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5nZXRSYWRpdXMgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMucmFkaXVzO1xufTtcblxuTW9uc3Rlci5wcm90b3R5cGUuaXNTaG9ydEF0dGFja2luZyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG5Nb25zdGVyLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy5tYXhIZWFsdGggPSBsZXZlbC5tb25zdGVySGVhbHRoO1xuXHR0aGlzLmhlYWx0aCA9IGxldmVsLm1vbnN0ZXJIZWFsdGg7XG5cdHRoaXMuc3BlZWQgPSBsZXZlbC5tb25zdGVyU3BlZWQ7XG5cdHRoaXMuZ3Jvd2xDb29sZG93biA9IGxldmVsLmdyb3dsQ29vbGRvd247XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vbnN0ZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvTW9uc3Rlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFZlYzJkID0gcmVxdWlyZSgnLi91dGlsL1ZlY3RvcjJkJyksXG4gICAgR2FtZUNvbnN0cyA9IHJlcXVpcmUoJy4vR2FtZUNvbnN0cycpO1xuXG52YXIgZnVuRmFjdG9yID0gMztcblxuLyoqXG4gKiBAcGFyYW0ge051bWJlcn0geFxuICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUGxheWVyID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzLnJhZGl1cyA9IDMwO1xuICAgIHRoaXMubWF4SGVhbHRoID0gdGhpcy5oZWFsdGggPSAxMDA7XG4gICAgdGhpcy5pZCA9ICdwbGF5ZXInO1xuICAgIHRoaXMuYW5nbGUgPSAwO1xuXHR0aGlzLmZvb3RzdGVwc1BsYXllZCA9IDA7XG5cdHRoaXMuZm9vdHN0ZXBOdW1iZXIgPSAxO1xuXG5cdHRoaXMuYXR0YWNrU3RhcnRlZCA9IDA7XG4gICAgdGhpcy52ZWxvY2l0eSA9IG5ldyBWZWMyZCgwLCAwKTtcbiAgICB0aGlzLmJvdW5jZVZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuXG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG5cdHZhciBzcyA9IG5ldyBjcmVhdGVqcy5TcHJpdGVTaGVldCh7XG5cdFx0XCJhbmltYXRpb25zXCI6XG5cdFx0e1xuXHRcdFx0XCJ3YWxrXCI6IHtcblx0XHRcdFx0ZnJhbWVzOiBbMSwgMl0sXG5cdFx0XHRcdG5leHQ6XCJ3YWxrXCIsXG5cdFx0XHRcdHNwZWVkOiAwLjJcblx0XHRcdH0sXG5cdFx0XHRcIndhaXRcIjoge1xuXHRcdFx0XHRmcmFtZXM6IFswXSxcblx0XHRcdFx0bmV4dDpcIndhaXRcIixcblx0XHRcdFx0c3BlZWQ6IDAuMlxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0XCJpbWFnZXNcIjogW1wiLi9pbWcvcGxheWVyX3Nwcml0ZS5wbmdcIl0sXG5cdFx0XCJmcmFtZXNcIjpcblx0XHR7XG5cdFx0XHRcImhlaWdodFwiOiAxMDI0LFxuXHRcdFx0XCJ3aWR0aFwiOjEwMjQsXG5cdFx0XHRcInJlZ1hcIjogMCxcblx0XHRcdFwicmVnWVwiOiAwLFxuXHRcdFx0XCJjb3VudFwiOiAzXG5cdFx0fVxuXHR9KTtcblxuXHR0aGlzLnNwcml0ZSA9IG5ldyBjcmVhdGVqcy5TcHJpdGUoc3MsIFwid2FpdFwiKTtcblxuICAgIHRoaXMuZWxlbWVudC5zY2FsZVggPSB0aGlzLmVsZW1lbnQuc2NhbGVZID0gMC4xO1xuXHRzZWxmLmVsZW1lbnQucmVnWCA9IHNlbGYuZWxlbWVudC5yZWdZID0gNTEyO1xuXG5cdHRoaXMuZWxlbWVudC54ID0geDtcblx0dGhpcy5lbGVtZW50LnkgPSB5O1xuXG4gICAgdGhpcy5oYXNGdW4gPSBmYWxzZTtcblxuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLnNwcml0ZSk7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2hpdCcsIHRoaXMub25IaXQuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignYXR0YWNrJywgdGhpcy5vbkF0dGFjay5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdzdGFnZW1vdXNlbW92ZScsIHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignZnVuJywgdGhpcy5vbkZ1bi5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignaGVhbC1tZScsIHRoaXMub25IZWFsTWUuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbigncGxheWVyLXdlYXBvbi1saWZldGltZScsIHRoaXMub25QbGF5ZXJXZWFwb25MaWZldGltZS5iaW5kKHRoaXMpKTtcblxuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5vbkhpdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmhpdFRhcmdldCAhPT0gdGhpcy5pZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaGFzRnVuKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmhlYWx0aCAtPSBldmVudC5kYW1hZ2U7XG4gICAgdGhpcy5oZWFsdGggPSBNYXRoLm1heCgwLCB0aGlzLmhlYWx0aCk7XG5cblx0aWYgKHRoaXMuaGVhbHRoID09IDApIHtcblx0XHR0aGlzLmVtaXR0ZXIuZW1pdCgncGxheWVyLWRlYWQnKTtcblx0fVxufTtcblxuUGxheWVyLnByb3RvdHlwZS5vbkF0dGFjayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdHRoaXMuYXR0YWNrU3RhcnRlZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xufTtcblxuXG5QbGF5ZXIucHJvdG90eXBlLm9uTW91c2VNb3ZlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgY3VycmVudF9zcGVlZCA9IHRoaXMudmVsb2NpdHkubGVuZ3RoKCk7XG5cbiAgICB2YXIgbW91c2VfZGVsdGEgPSBuZXcgVmVjMmQoXG4gICAgICAgIGV2ZW50LnN0YWdlWCAtIEdhbWVDb25zdHMuR0FNRV9XSURUSCAvIDIsXG4gICAgICAgIGV2ZW50LnN0YWdlWSAtIEdhbWVDb25zdHMuR0FNRV9IRUlHSFQgLyAyXG4gICAgKTtcblxuICAgIHRoaXMuYW5nbGUgPSBWZWMyZC5nZXRBbmdsZShtb3VzZV9kZWx0YSk7XG5cbiAgICBpZiAodGhpcy5oYXNGdW4pIHtcbiAgICAgICAgbW91c2VfZGVsdGEudGltZXMoZnVuRmFjdG9yKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2hhcy1mdW4nLCB7eDogdGhpcy5lbGVtZW50LngsIHk6IHRoaXMuZWxlbWVudC55fSk7XG4gICAgfVxuXG4gICAgaWYgKG1vdXNlX2RlbHRhLmxlbmd0aCgpIDwgNjApIHtcbiAgICAgICAgdGhpcy52ZWxvY2l0eS54ID0gMDtcbiAgICAgICAgdGhpcy52ZWxvY2l0eS55ID0gMDtcblxuICAgICAgICBpZiAoY3VycmVudF9zcGVlZCkge1xuICAgICAgICAgICAgdGhpcy5zcHJpdGUuZ290b0FuZFBsYXkoJ3dhaXQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYoY3VycmVudF9zcGVlZCA9PSAwKSB7XG4gICAgICAgIHRoaXMuc3ByaXRlLmdvdG9BbmRQbGF5KCd3YWxrJyk7XG4gICAgfVxuXG4gICAgdGhpcy52ZWxvY2l0eSA9IG1vdXNlX2RlbHRhO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5vbkZ1biA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5oYXNGdW4gPSBldmVudC5zdGF0dXM7XG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLm9uSGVhbE1lID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmhlYWx0aCA9IHRoaXMubWF4SGVhbHRoO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5vblBsYXllcldlYXBvbkxpZmV0aW1lID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMud2VhcG9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLndlYXBvbi5saWZldGltZSA9IDEwMDAwMDA7XG4gICAgdGhpcy53ZWFwb24udHJpZ2dlclVwZGF0ZSgpO1xufTtcblxuLyoqXG4gKiBAcGFyYW0gZXZlbnRcbiAqL1xuUGxheWVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB2YXIgZGVsdGEgPSBWZWMyZC5tdWx0aXBseSh0aGlzLnZlbG9jaXR5LCBldmVudC5kZWx0YSAvIDEwMDApO1xuXG4gICAgaWYgKHRoaXMuYm91bmNlVmVsb2NpdHkubGVuZ3RoKCkgIT0gMCkge1xuICAgICAgICB2YXIgcHVzaF9kZWx0YSA9IFZlYzJkLm11bHRpcGx5KHRoaXMuYm91bmNlVmVsb2NpdHkuY2xvbmUoKSwgZXZlbnQuZGVsdGEgLyA4MCk7XG4gICAgICAgIHRoaXMuYm91bmNlVmVsb2NpdHkgPSB0aGlzLmJvdW5jZVZlbG9jaXR5Lm1pbnVzKHB1c2hfZGVsdGEpO1xuXG4gICAgICAgIGRlbHRhLnBsdXMocHVzaF9kZWx0YSk7XG5cbiAgICAgICAgaWYgKHB1c2hfZGVsdGEubGVuZ3RoKCkgPCAxKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5jZVZlbG9jaXR5ID0gbmV3IFZlYzJkKDAsIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbGVtZW50LnggKz0gZGVsdGEueDtcbiAgICB0aGlzLmVsZW1lbnQueSArPSBkZWx0YS55O1xuXG4gICAgdGhpcy5lbGVtZW50LnggPSBNYXRoLm1pbihHYW1lQ29uc3RzLlNJWkUsIE1hdGgubWF4KC1HYW1lQ29uc3RzLlNJWkUsIHRoaXMuZWxlbWVudC54KSk7XG4gICAgdGhpcy5lbGVtZW50LnkgPSBNYXRoLm1pbihHYW1lQ29uc3RzLlNJWkUsIE1hdGgubWF4KC1HYW1lQ29uc3RzLlNJWkUsIHRoaXMuZWxlbWVudC55KSk7XG5cbiAgICB0aGlzLmVsZW1lbnQucm90YXRpb24gPSB0aGlzLmFuZ2xlO1xuXG5cdC8vIGNoYW5nZSBzcGVlZCBvZiBhbmltYXRpb25cbiAgICB0aGlzLnNwcml0ZS5mcmFtZXJhdGUgPSBkZWx0YS5sZW5ndGgoKSAqIDY7XG5cbiAgICBpZiAodGhpcy53ZWFwb24pIHtcbiAgICAgICAgaWYgKCF0aGlzLndlYXBvbi5lcXVpcHBlZCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMud2VhcG9uLmVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy53ZWFwb24gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ3VuZXF1aXAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBhdHRhY2tTdGFydGVkRGlmZiA9IGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMuYXR0YWNrU3RhcnRlZDtcbiAgICAgICAgICAgIGlmIChhdHRhY2tTdGFydGVkRGlmZiA8IDUwMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IE1hdGgucm91bmQodGhpcy5lbGVtZW50LnJvdGF0aW9uICsgMTA4MCAvIDUwMCAqIGF0dGFja1N0YXJ0ZWREaWZmKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy53ZWFwb24udGljayhldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cblx0aWYgKHRoaXMudmVsb2NpdHkubGVuZ3RoKCkgPiAwICYmIChldmVudC50aW1lU3RhbXAgLSB0aGlzLmZvb3RzdGVwc1BsYXllZCkgPiA0NTAwMCAvIHRoaXMudmVsb2NpdHkubGVuZ3RoKCkpIHtcblx0XHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdmb290c3RlcCcgKyB0aGlzLmZvb3RzdGVwTnVtYmVyLCB7dm9sdW1lOiAwLjZ9KTtcblx0XHR0aGlzLmZvb3RzdGVwc1BsYXllZCA9IGV2ZW50LnRpbWVTdGFtcDtcblx0XHR0aGlzLmZvb3RzdGVwTnVtYmVyID0gKHRoaXMuZm9vdHN0ZXBOdW1iZXIgKyAxKSAlIDI7XG5cdH1cbn07XG5cblBsYXllci5wcm90b3R5cGUuZXF1aXAgPSBmdW5jdGlvbih3ZWFwb24pIHtcbiAgICB3ZWFwb24uZXF1aXAoKTtcbiAgICB0aGlzLndlYXBvbiA9IHdlYXBvbjtcbiAgICB0aGlzLndlYXBvbi5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh3ZWFwb24uZWxlbWVudCk7XG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2VxdWlwJywge1xuICAgICAgICBpZDogdGhpcy53ZWFwb24uaWQsXG4gICAgICAgIGxpZmV0aW1lOiB0aGlzLndlYXBvbi5saWZldGltZVxuICAgIH0pXG59O1xuXG5QbGF5ZXIucHJvdG90eXBlLmdldFJhZGl1cyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5pc1Nob3J0QXR0YWNraW5nKCkpIHtcbiAgICAgICAgaWYgKHRoaXMud2VhcG9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ucmFkaXVzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmFkaXVzO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnJhZGl1cztcbn07XG5cblBsYXllci5wcm90b3R5cGUuaXNTaG9ydEF0dGFja2luZyA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmhhc0Z1bikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy53ZWFwb24gJiYgdGhpcy53ZWFwb24uaWQgPT0gJ3Nob3J0LXdlYXBvbicgJiYgdGhpcy53ZWFwb24uaXNBY3RpdmUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuUGxheWVyLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcbiAgICB0aGlzLm1heEhlYWx0aCA9IGxldmVsLnBsYXllckhlYWx0aDtcbiAgICB0aGlzLmhlYWx0aCA9IGxldmVsLnBsYXllckhlYWx0aDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL1BsYXllci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcblxuZnVuY3Rpb24gUHJlbG9hZGVyKCkge1xuXHR0aGlzLnF1ZXVlID0gbmV3IGNyZWF0ZWpzLkxvYWRRdWV1ZSgpO1xuXHR0aGlzLnF1ZXVlLmluc3RhbGxQbHVnaW4oY3JlYXRlanMuU291bmQpO1xufVxuXG5QcmVsb2FkZXIucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihmaWxlcykge1xuXHR0aGlzLnF1ZXVlLmxvYWRNYW5pZmVzdChmaWxlcyk7XG59O1xuXG5QcmVsb2FkZXIucHJvdG90eXBlLm9uQ29tcGxldGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHR0aGlzLnF1ZXVlLm9uKCdjb21wbGV0ZScsIGNhbGxiYWNrKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUHJlbG9hZGVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL1ByZWxvYWRlci5qc1wiLFwiL1wiKSIsIm1vZHVsZS5leHBvcnRzPVtcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJmaXJlYmFsbFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL2ZpcmViYWxsLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJnYW1lb3ZlclwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL2dhbWVvdmVyLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJncmFzc1wiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL2dyYXNzLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtb25zdGVyXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvbW9uc3Rlci5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibmlnaHRtb2RlXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvbmlnaHRtb2RlLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJwbGF5ZXJcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9wbGF5ZXIucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInBsYXllcl9zcHJpdGVcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy9wbGF5ZXJfc3ByaXRlLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJwb29mXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9pbWcvcG9vZi5wbmdcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwic2Nod2VydFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vaW1nL3NjaHdlcnQucG5nXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInRyZWVcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL2ltZy90cmVlLnBuZ1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJiYWNrZ3JvdW5kXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvYmFja2dyb3VuZC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZGVmZWF0XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZGVmZWF0Lm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJmb290c3RlcDBcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9mb290c3RlcDAubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImZvb3RzdGVwMVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2Zvb3RzdGVwMS5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZnVuXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZnVuLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJnaXJsLWh1cnRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9naXJsLWh1cnQubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImdyb3dsMFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2dyb3dsMC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwiZ3Jvd2wxXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvZ3Jvd2wxLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJncm93bDJcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9ncm93bDIubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcImxhdW5jaC1maXJlYmFsbFwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL2xhdW5jaC1maXJlYmFsbC5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWMwXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWMwLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzFcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzEubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljMlwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljMi5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibWFnaWMzXCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbWFnaWMzLm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJtYWdpYzRcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9tYWdpYzQubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcIm1hZ2ljNVwiLFxuICAgICAgICBcInNyY1wiOiBcIi4vc291bmRzL21hZ2ljNS5tcDNcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IFwibW9uc3Rlci1odXJ0XCIsXG4gICAgICAgIFwic3JjXCI6IFwiLi9zb3VuZHMvbW9uc3Rlci1odXJ0Lm1wM1wiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogXCJzd2luZzFcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy9zd2luZzEubXAzXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiBcInZpY3RvcnlcIixcbiAgICAgICAgXCJzcmNcIjogXCIuL3NvdW5kcy92aWN0b3J5Lm1wM1wiXG4gICAgfVxuXSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEdhbWUgPSByZXF1aXJlKCcuL2dhbWUnKSxcblx0UHJlbG9hZGVyID0gcmVxdWlyZSgnLi9QcmVsb2FkZXInKSxcblx0YXNzZXRzID0gcmVxdWlyZSgnLi9hc3NldHMnKTtcblxudmFyIHByZWxvYWRlciA9IG5ldyBQcmVsb2FkZXIoKTtcbnZhciBnYW1lID0gbmV3IEdhbWUoJ2dhbWVfY2FudmFzJyk7XG5nYW1lLmluaXQoKTtcblxucHJlbG9hZGVyLm9uQ29tcGxldGUoZnVuY3Rpb24oKSB7XG5cdGdhbWUuYXNzZXRzUmVhZHkoKTtcbn0pO1xuXG5wcmVsb2FkZXIubG9hZChhc3NldHMpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2Zha2VfMmViMDI0NmQuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRlbWl0dGVyMicpLkV2ZW50RW1pdHRlcjIsXG4gICAgR2FtZVNjcmVlbiA9IHJlcXVpcmUoJy4vc2NyZWVucy9HYW1lU2NyZWVuJyksXG4gICAgTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbiA9IHJlcXVpcmUoJy4vc2NyZWVucy9NYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuJyksXG4gICAgSG9tZVNjcmVlbiA9IHJlcXVpcmUoJy4vc2NyZWVucy9Ib21lU2NyZWVuJyksXG4gICAgU3RvcnlTY3JlZW4gPSByZXF1aXJlKCcuL3NjcmVlbnMvU3RvcnlTY3JlZW4nKSxcbiAgICBHYW1lT3ZlclNjcmVlbiA9IHJlcXVpcmUoJy4vc2NyZWVucy9HYW1lT3ZlclNjcmVlbicpO1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBHYW1lID0gZnVuY3Rpb24oZ2FtZUNhbnZhc0lkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5lbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIHRoaXMuc3RhZ2UgPSBuZXcgY3JlYXRlanMuU3RhZ2UoZ2FtZUNhbnZhc0lkKTtcblxuICAgIHRoaXMuc3RhZ2UubW91c2VDaGlsZHJlbiA9IGZhbHNlO1xuICAgIHRoaXMuc3RhZ2UubW91c2VFbmFibGVkID0gZmFsc2U7XG5cbiAgICB0aGlzLmdhbWVTY3JlZW4gPSBuZXcgR2FtZVNjcmVlbih0aGlzLnN0YWdlKTtcbiAgICB0aGlzLmdhbWVPdmVyU2NyZWVuID0gbmV3IEdhbWVPdmVyU2NyZWVuKCk7XG4gICAgdGhpcy5tYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuID0gbmV3IE1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4oKTtcbiAgICB0aGlzLmhvbWVTY3JlZW4gPSBuZXcgSG9tZVNjcmVlbigpO1xuICAgIHRoaXMuc3RvcnlTY3JlZW4gPSBuZXcgU3RvcnlTY3JlZW4oKTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuZ2FtZVNjcmVlbi5lbGVtZW50KTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuZ2FtZU92ZXJTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLm1hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLmhvbWVTY3JlZW4uZWxlbWVudCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLnN0b3J5U2NyZWVuLmVsZW1lbnQpO1xuXG4gICAgdGhpcy5nYW1lU2NyZWVuLnJlZ2lzdGVyRXZlbnQodGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG5cbiAgICBjcmVhdGVqcy5UaWNrZXIuc2V0RlBTKDYwKTtcbiAgICBjcmVhdGVqcy5UaWNrZXIuc2V0UGF1c2VkKHRydWUpO1xuICAgIGNyZWF0ZWpzLlRpY2tlci5hZGRFdmVudExpc3RlbmVyKCd0aWNrJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgc2VsZi50aWNrKGV2ZW50KTtcbiAgICB9KTtcbn07XG5cbkdhbWUucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ3BsYXllci1kZWFkJywgdGhpcy5vbkdhbWVPdmVyLmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ21vbnN0ZXItZGVhZCcsIHRoaXMub25OZXh0Q2FzdGxlU2NyZWVuLmJpbmQodGhpcykpO1xuXG4gICAgdGhpcy5zdGFnZS5vbignc3RhZ2Vtb3VzZW1vdmUnLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBlbWl0dGVyLmVtaXQoJ3N0YWdlbW91c2Vtb3ZlJywgZXZlbnQpO1xuICAgIH0pO1xufTtcblxuR2FtZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaG9tZVNjcmVlbi5zdGFydCgpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuYXNzZXRzUmVhZHkgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmhvbWVTY3JlZW4uaXNSZWFkeSgpO1xuICAgIHRoaXMuc3RhZ2Uub24oJ3N0YWdlbW91c2V1cCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmhvbWVTY3JlZW4ucmVzZXQoKTtcbiAgICAgICAgdGhpcy5zdGFydE5ld2dhbWUoKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuc3RhcnROZXdnYW1lID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5kb1N0YXJ0KHRydWUpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuZG9TdGFydCA9IGZ1bmN0aW9uKG5ld0dhbWUpIHtcbiAgICB0aGlzLnN0b3J5U2NyZWVuLnN0YXJ0KCd0ZXN0JywgJ21lJyk7XG4gICAgdGhpcy5zdGFnZS5vbignc3RhZ2Vtb3VzZXVwJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc3RvcnlTY3JlZW4ucmVzZXQoKTtcbiAgICAgICAgdGhpcy5zdGFydChuZXdHYW1lKTtcblxuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnc3RhcnQtbGV2ZWwnLCB0cnVlKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNoYW5nZVNjcmVlbigpO1xuXG4gICAgdGhpcy5nYW1lU2NyZWVuLnN0YXJ0KCk7XG5cbiAgICBjcmVhdGVqcy5UaWNrZXIuc2V0UGF1c2VkKGZhbHNlKTtcbn07XG5cbkdhbWUucHJvdG90eXBlLm9uTmV4dENhc3RsZVNjcmVlbiA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgY3JlYXRlanMuVGlja2VyLnNldFBhdXNlZCh0cnVlKTtcbiAgICB0aGlzLmdhbWVTY3JlZW4ucmVzZXQoKTtcbiAgICB0aGlzLmNoYW5nZVNjcmVlbigpO1xuXG4gICAgdGhpcy5tYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuLnN0YXJ0KCk7XG4gICAgdGhpcy5zdGFnZS5vbignc3RhZ2Vtb3VzZXVwJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5yZXNldCgpO1xuICAgICAgICB0aGlzLmRvU3RhcnQoZmFsc2UpO1xuICAgIH0uYmluZCh0aGlzKSk7XG59O1xuXG5HYW1lLnByb3RvdHlwZS5vbkdhbWVPdmVyID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjcmVhdGVqcy5UaWNrZXIuc2V0UGF1c2VkKHRydWUpO1xuICAgIHRoaXMuZ2FtZVNjcmVlbi5yZXNldCgpO1xuICAgIHRoaXMuY2hhbmdlU2NyZWVuKCk7XG5cbiAgICB0aGlzLmdhbWVPdmVyU2NyZWVuLnN0YXJ0KCk7XG4gICAgdGhpcy5zdGFnZS5vbignc3RhZ2Vtb3VzZXVwJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZ2FtZU92ZXJTY3JlZW4ucmVzZXQoKTtcbiAgICAgICAgdGhpcy5zdGFydCgpO1xuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnZ2FtZS1vdmVyJyk7XG5cbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuR2FtZS5wcm90b3R5cGUuY2hhbmdlU2NyZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbWl0dGVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIHRoaXMuc3RhZ2UucmVtb3ZlQWxsRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG59O1xuXG5HYW1lLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLnN0YWdlLnVwZGF0ZShldmVudCk7XG5cblx0aWYgKGV2ZW50LnBhdXNlZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG4gICAgdGhpcy5nYW1lU2NyZWVuLnRpY2soZXZlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHYW1lO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2dhbWUuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBudW1QZXRhbHMgPSAxMjtcblxudmFyIEZsb3dlciA9IGZ1bmN0aW9uKHgsIHksIGNvbG9yKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXHR0aGlzLmVsZW1lbnQueCA9IHg7XG5cdHRoaXMuZWxlbWVudC55ID0geTtcblx0dGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAwLjE7XG5cblx0Zm9yKHZhciBuID0gMDsgbiA8IG51bVBldGFsczsgbisrKSB7XG5cdFx0dmFyIHBldGFsID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG5cblx0XHRwZXRhbC5ncmFwaGljc1xuXHRcdFx0LmJlZ2luRmlsbCgnI2ZmMCcpXG5cdFx0XHQuZHJhd0NpcmNsZSgwLCAwLCAyMClcblx0XHRcdC8vLmJlZ2luU3Ryb2tlKCcjZmZmJylcblx0XHRcdC5zZXRTdHJva2VTdHlsZSgzKVxuXHRcdFx0LmJlZ2luRmlsbChjb2xvcilcblx0XHRcdC5tb3ZlVG8oLTUsIC0yMClcblx0XHRcdC5iZXppZXJDdXJ2ZVRvKC00MCwgLTkwLCA0MCwgLTkwLCA1LCAtMjApXG5cdFx0XHQuY2xvc2VQYXRoKCk7XG5cdFx0cGV0YWwucm90YXRpb24gPSAzNjAgKiBuIC8gbnVtUGV0YWxzO1xuXG5cdFx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHBldGFsKTtcblx0fVxuXG5cdC8vdGhpcy5lbGVtZW50LmNhY2hlKC0xMDAsIC0xMDAsIDIwMCwgMjAwKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmxvd2VyO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ncm91bmQvRmxvd2VyLmpzXCIsXCIvZ3JvdW5kXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgR2FtZUNvbnN0cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKSxcblx0UHNldWRvUmFuZCA9IHJlcXVpcmUoJy4uL3V0aWwvUHNldWRvUmFuZCcpLFxuXHRUcmVlID0gcmVxdWlyZSgnLi9UcmVlJyksXG5cdEZsb3dlciA9IHJlcXVpcmUoJy4vRmxvd2VyJyk7XG5cbnZhciBHcm91bmQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5wc2V1ZG9SYW5kb20gPSBuZXcgUHNldWRvUmFuZCgpO1xuXG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5lbGVtZW50Lm1vdXNlQ2hpbGRyZW4gPSBmYWxzZTtcblx0dGhpcy5lbGVtZW50Lm1vdXNlRW5hYmxlZCA9IGZhbHNlO1xuXHR0aGlzLnNoYXBlID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG5cblx0dGhpcy5kZWNvcmF0aW9ucyA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblxuXHR0aGlzLnRyZWVDb3VudCA9IDA7XG5cdHRoaXMuZmxvd2VyQ291bnQgPSAwO1xuXG5cdHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblx0aW1nLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuc2hhcGUuZ3JhcGhpY3Ncblx0XHRcdC5iZWdpbkJpdG1hcEZpbGwoaW1nLCAncmVwZWF0Jylcblx0XHRcdC5kcmF3UmVjdCgwLCAwLCBHYW1lQ29uc3RzLlNJWkUgKiAyLCBHYW1lQ29uc3RzLlNJWkUgKiAyKTtcblx0fS5iaW5kKHRoaXMpO1xuXHRpbWcuc3JjID0gJy4vaW1nL2dyYXNzLnBuZyc7XG5cblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuc2hhcGUpO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5kZWNvcmF0aW9ucyk7XG5cdHRoaXMuZWxlbWVudC54ID0gLUdhbWVDb25zdHMuU0laRTtcblx0dGhpcy5lbGVtZW50LnkgPSAtR2FtZUNvbnN0cy5TSVpFO1xufTtcblxuR3JvdW5kLnByb3RvdHlwZS5zcGF3bkZsb3dlcnMgPSBmdW5jdGlvbigpIHtcblx0dmFyIHgsIHksIGNvbG9yLCBpO1xuXG5cdHZhciBjb2xvcnMgPSBbJyNmMzMnLCAnIzg4ZicsICcjZjcwJywgJyNmMGYnLCAnI2RkZiddO1xuXG5cdGZvciAoaSA9IDA7IGkgPD0gdGhpcy5mbG93ZXJDb3VudDsgaSsrKSB7XG5cdFx0eCA9IHRoaXMucHNldWRvUmFuZG9tLmdldFJhbmRvbSgpICUgR2FtZUNvbnN0cy5TSVpFICogMjtcblx0XHR5ID0gdGhpcy5wc2V1ZG9SYW5kb20uZ2V0UmFuZG9tKCkgJSBHYW1lQ29uc3RzLlNJWkUgKiAyO1xuXHRcdGNvbG9yID0gY29sb3JzWyhNYXRoLnJhbmRvbSgpICogY29sb3JzLmxlbmd0aCB8IDApXTtcblxuXHRcdHRoaXMuZGVjb3JhdGlvbnMuYWRkQ2hpbGQobmV3IEZsb3dlcih4LCB5LCBjb2xvcikuZWxlbWVudCk7XG5cdH1cbn07XG5cbkdyb3VuZC5wcm90b3R5cGUuc3Bhd25UcmVlcyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgeCwgeSwgciwgaTtcblxuXHRmb3IgKGkgPSAwOyBpIDw9IHRoaXMudHJlZUNvdW50OyBpKyspIHtcblx0XHR4ID0gdGhpcy5wc2V1ZG9SYW5kb20uZ2V0UmFuZG9tKCkgJSBHYW1lQ29uc3RzLlNJWkUgKiAyO1xuXHRcdHkgPSB0aGlzLnBzZXVkb1JhbmRvbS5nZXRSYW5kb20oKSAlIEdhbWVDb25zdHMuU0laRSAqIDI7XG5cdFx0ciA9IDcwICsgdGhpcy5wc2V1ZG9SYW5kb20uZ2V0UmFuZG9tKCkgJSAxMDA7XG5cblx0XHR0aGlzLmRlY29yYXRpb25zLmFkZENoaWxkKG5ldyBUcmVlKHgsIHksIHIpLmVsZW1lbnQpO1xuXHR9XG59O1xuXG5Hcm91bmQucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHRlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG59O1xuXG5Hcm91bmQucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR0aGlzLnBzZXVkb1JhbmRvbS5zZXRTZWVkKGxldmVsLml0ZW1TZWVkKTtcblx0dGhpcy50cmVlQ291bnQgPSBsZXZlbC50cmVlcztcblx0dGhpcy5mbG93ZXJDb3VudCA9IGxldmVsLnRyZWVzICogMjA7XG5cblx0aWYgKEdhbWVDb25zdHMuRFJBV19GTE9XRVJTKSB7XG5cdFx0dGhpcy5zcGF3bkZsb3dlcnMoKTtcblx0XHR0aGlzLnNwYXduVHJlZXMoKTtcblxuXHRcdHRoaXMuZGVjb3JhdGlvbnMuY2FjaGUoMCwgMCwgR2FtZUNvbnN0cy5TSVpFICogMiwgR2FtZUNvbnN0cy5TSVpFICogMik7XG5cdFx0dGhpcy5kZWNvcmF0aW9ucy5yZW1vdmVBbGxDaGlsZHJlbigpO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuc3Bhd25UcmVlcygpO1xuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyb3VuZDtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ncm91bmQvR3JvdW5kLmpzXCIsXCIvZ3JvdW5kXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gUmFpbmJvd1JvYWQoKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXHR0aGlzLmhhc0ZhbiA9IDA7XG59XG5cblJhaW5ib3dSb2FkLnByb3RvdHlwZS5wYWludCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgNjsgaSsrKSB7XG5cdFx0dGhpcy5zcGF3bkp1aWN5U3RhcihldmVudC54LCBldmVudC55KTtcblx0fVxufTtcblxuUmFpbmJvd1JvYWQucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIC8vIHJlbW92ZSBvbGQgcGFpbnRpbmdzXG59O1xuXG5SYWluYm93Um9hZC5wcm90b3R5cGUuc3Bhd25KdWljeVN0YXIgPSBmdW5jdGlvbih4LCB5KSB7XG5cdHZhciBzaXplID0gOCArIDcgKiBNYXRoLnJhbmRvbSgpO1xuXG5cdHZhciBzdGFyID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG5cdHN0YXIueCA9IHggLSAxNSArIDMwICogTWF0aC5yYW5kb20oKTtcblx0c3Rhci55ID0geSAtIDE1ICsgMzAgKiBNYXRoLnJhbmRvbSgpO1xuXHRzdGFyLnJvdGF0aW9uID0gcGFyc2VJbnQoTWF0aC5yYW5kb20oKSAqIDM2MCk7XG5cdHN0YXIuZ3JhcGhpY3MuYmVnaW5TdHJva2UoXCIjZjBmXCIpLmJlZ2luRmlsbCgnI2ZmMCcpLnNldFN0cm9rZVN0eWxlKDEpLmRyYXdQb2x5U3RhcigwLCAwLCBzaXplIC8gMiwgNSwgMC42KS5jbG9zZVBhdGgoKTtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHN0YXIpO1xuXG5cdGNyZWF0ZWpzLlR3ZWVuLmdldChzdGFyKVxuXHRcdC50byh7YWxwaGE6IDAsIHJvdGF0aW9uOiBzdGFyLnJvdGF0aW9uICsgMTgwfSwgNTAwICsgNTAwICogTWF0aC5yYW5kb20oKSwgY3JlYXRlanMuRWFzZS5saW5lYXIpXG5cdFx0LmNhbGwoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQoc3Rhcik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmFpbmJvd1JvYWQ7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZ3JvdW5kL1JhaW5ib3dSb2FkLmpzXCIsXCIvZ3JvdW5kXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVHJlZSA9IGZ1bmN0aW9uKHgsIHksIHIpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cbiAgICB2YXIgYml0bWFwID0gbmV3IGNyZWF0ZWpzLkJpdG1hcChcIi4vaW1nL3RyZWUucG5nXCIpO1xuICAgIGJpdG1hcC54ID0geDtcbiAgICBiaXRtYXAueSA9IHk7XG4gICAgYml0bWFwLnNjYWxlWCA9IGJpdG1hcC5zY2FsZVkgPSByIC8gMTAwO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChiaXRtYXApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUcmVlO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9ncm91bmQvVHJlZS5qc1wiLFwiL2dyb3VuZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBtZXNzYWdlcyA9IFtcbiAgICAnVHJ5aW5nIHRvIGZpZ2h0IHRoZSBpbXBvc3NpYmxlPycsXG4gICAgJyNjaGVhdGVyZ2F0ZScsXG4gICAgJ1kgVSBuMDBiPycsXG4gICAgJ1RoaXMgd29udCBoZWxwIHlvdSEnLFxuICAgICdFdmVyIGhlYXJkIG9mICNmYWlycGxheT8nLFxuICAgICdBcmUgd2UgdHJ5aW5nIHRvIGJlIGdvZD8nXG5dO1xuXG52YXIgUmFuZCA9IHJlcXVpcmUoJy4uL3V0aWwvUHNldWRvUmFuZCcpLFxuICAgIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gQ2hlYXRlckJhcigpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5lbGVtZW50LnggPSBjb25zdGFudHMuR0FNRV9XSURUSCAvIDIgLSA5NTtcbiAgICB0aGlzLmVsZW1lbnQueSA9IDIwMDtcblxuICAgIHRoaXMucmFuZCA9IG5ldyBSYW5kKCk7XG4gICAgdGhpcy5yYW5kLnNldFNlZWQobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xufVxuXG5DaGVhdGVyQmFyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdjaGVhdGVyJywgdGhpcy5vbkNoZWF0ZXIuYmluZCh0aGlzKSk7XG59O1xuXG5DaGVhdGVyQmFyLnByb3RvdHlwZS5vbkNoZWF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dCA9IG1lc3NhZ2VzW3RoaXMucmFuZC5nZXRSYW5kb20oKSAlIG1lc3NhZ2VzLmxlbmd0aF07XG4gICAgdmFyIG1lc3NhZ2UgPSBuZXcgY3JlYXRlanMuVGV4dCh0ZXh0LCAnMzBweCBLb21pa2EnLCBcIiNmZmZcIik7XG4gICAgbWVzc2FnZS54ID0gOTUgLSBtZXNzYWdlLmdldE1lYXN1cmVkV2lkdGgoKSAvIDI7XG4gICAgbWVzc2FnZS55ID0gMTUwO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZChtZXNzYWdlKTtcblxuY3JlYXRlanMuVHdlZW4uZ2V0KG1lc3NhZ2UpXG4gICAgICAgIC50byh7eTogMCwgYWxwaGE6IDB9LCAyNTAwLCBjcmVhdGVqcy5FYXNlLmxpbmVhcilcbiAgICAgICAgLmNhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZChtZXNzYWdlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hlYXRlckJhcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9odWQvQ2hlYXRlckJhci5qc1wiLFwiL2h1ZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBhdXRvRGVjcmVhc2VQZXJTZWNvbmQgPSAwLjU7XG52YXIgbWF4V2lkdGggPSAyNDA7XG52YXIganVpY3lTdGFyQ291bnQgPSAxNTtcbnZhciBtYXhNYWdpY0xldmVsID0gNTtcblxudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gRnVuQmFyKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB0aGlzLmVsZW1lbnQueCA9IGNvbnN0YW50cy5HQU1FX1dJRFRIIC8gMiAtIDk1O1xuXHR0aGlzLmVsZW1lbnQueSA9IDEwO1xuICAgIHRoaXMuY3VycmVudCA9IDA7XG5cdHRoaXMubGFzdEluY3JlYXNlID0gMDtcbiAgICB0aGlzLmJvcmRlciA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuYm9yZGVyLmdyYXBoaWNzLmJlZ2luRmlsbChcIiMzMzNcIikuZHJhd1JlY3QoMCwgMCwgMjUwLCA1MCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuYm9yZGVyKTtcblxuXHR0aGlzLm1heEZ1blZhbHVlID0gMDtcblx0dGhpcy5mdW5UaW1lID0gMDtcblxuICAgIHRoaXMuZmlsbCA9IG5ldyBjcmVhdGVqcy5TaGFwZSgpO1xuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5maWxsKTtcblxuXHR0aGlzLmlzRnVuVGltZSA9IGZhbHNlO1xuXHR0aGlzLmlzRnVuVGltZVJlc2V0ID0gdHJ1ZTtcblxuXHR0aGlzLmZ1blRleHQgPSBuZXcgY3JlYXRlanMuVGV4dChcIkZ1blwiLCBcIjI0cHggS29taWthXCIsIFwiI2ZmZlwiKTtcblx0dGhpcy5mdW5UZXh0LnggPSAtNjA7XG5cdHRoaXMuZnVuVGV4dC55ID0gMztcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZnVuVGV4dCk7XG5cblx0dGhpcy5mdW5CYXJUZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQoXCIwLjBcIiwgXCIyNXB4IEtvbWlrYVwiLCAnI2ZmZicpO1xuXHR0aGlzLmZ1bkJhclRleHQueCA9IDkwO1xuXHR0aGlzLmZ1bkJhclRleHQueSA9IDE7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmZ1bkJhclRleHQpO1xufVxuXG5GdW5CYXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2hpdCcsIHRoaXMub25IaXQuYmluZCh0aGlzKSk7XG4gICAgZW1pdHRlci5vbignY29tYm8nLCB0aGlzLm9uQ29tYm8uYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ2ZvcmNlLWZ1bicsIHRoaXMub25Gb3JjZUZ1bi5iaW5kKHRoaXMpKTtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xuXG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ID09ICdwbGF5ZXInKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cblx0dGhpcy5pbmNyZWFzZSgxKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUub25Db21ibyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5pbmNyZWFzZShldmVudC5sZXZlbCk7XG5cdHRoaXMuc3Bhd25Db21ib01lc3NhZ2UoZXZlbnQubGV2ZWwpO1xufTtcblxuRnVuQmFyLnByb3RvdHlwZS5pbmNyZWFzZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHRoaXMuY3VycmVudCArPSB2YWx1ZTtcblx0aWYgKHRoaXMuY3VycmVudCA+PSB0aGlzLm1heEZ1blZhbHVlICYmIHRoaXMuaXNGdW5UaW1lID09IGZhbHNlKSB7XG5cdFx0dGhpcy5jYW5GdW5UaW1lID0gdHJ1ZTtcblx0XHR0aGlzLmVtaXR0ZXIuZW1pdCgnZnVuJywge3N0YXR1czogMX0pO1xuXHR9XG5cblx0dGhpcy5jdXJyZW50ID0gTWF0aC5taW4odGhpcy5jdXJyZW50LCB0aGlzLm1heEZ1blZhbHVlKTtcblxuXHR0aGlzLmxhc3RJbmNyZWFzZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXG5cdGZvciAodmFyIGkgPSAwOyBpIDwganVpY3lTdGFyQ291bnQgKyAxOyBpKyspIHtcblx0XHR0aGlzLnNwYXduSnVpY3lTdGFyKDUgKyB0aGlzLmdldE1heE9mZnNldE9uQmFyKCkgLyBqdWljeVN0YXJDb3VudCAqIGkgLSAyMCArIDQwICogTWF0aC5yYW5kb20oKSwgNTAgKiBNYXRoLnJhbmRvbSgpLCA0MCk7XG5cdH1cblxuXHR2YXIgbWFnaWNMZXZlbCA9IE1hdGgubWluKG1heE1hZ2ljTGV2ZWwsIHZhbHVlKTtcblx0Y3JlYXRlanMuU291bmQucGxheSgnbWFnaWMnICsgbWFnaWNMZXZlbCk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLm9uRm9yY2VGdW4gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pbmNyZWFzZSh0aGlzLm1heEZ1blZhbHVlKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY3VycmVudCA+IDApIHtcblx0XHRpZiAodGhpcy5pc0Z1blRpbWUgJiYgZXZlbnQudGltZVN0YW1wIDwgdGhpcy5mdW5UaW1lRW5kKSB7XG5cdFx0XHR0aGlzLnNwYXduSnVpY3lTdGFyKDUgKyB0aGlzLmdldE1heE9mZnNldE9uQmFyKCkgKiBNYXRoLnJhbmRvbSgpIC0gMjAgKyA0MCAqIE1hdGgucmFuZG9tKCksIDUwICogTWF0aC5yYW5kb20oKSwgNDApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmlzRnVuVGltZSA9IGZhbHNlO1xuXG5cdFx0XHRpZiAoIXRoaXMuaXNGdW5UaW1lUmVzZXQpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50ID0gMDtcblx0XHRcdFx0dGhpcy5pc0Z1blRpbWVSZXNldCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuZW1pdHRlci5lbWl0KCdmdW4nLCB7c3RhdHVzOiAwfSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY3VycmVudCAtPSAoZXZlbnQuZGVsdGEgLyAxMDAwKSAqIGF1dG9EZWNyZWFzZVBlclNlY29uZDtcblx0XHRcdHRoaXMuY3VycmVudCA9IE1hdGgubWF4KHRoaXMuY3VycmVudCwgMCk7XG5cblx0XHRcdHZhciBsYXN0SW5jcmVhc2VEaWZmID0gZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0SW5jcmVhc2U7XG5cdFx0XHRpZiAobGFzdEluY3JlYXNlRGlmZiA8IDEwMDApIHtcblx0XHRcdFx0Ly8gZmFkZSBmcm9tIHJnYigyNTUsIDAsIDI1NSkgdG8gcmdiKDI1NSwgMjU1LCAwKVxuXHRcdFx0XHR0aGlzLmRyYXdGaWxsKCdyZ2IoMjU1LCAnICsgTWF0aC5yb3VuZCgyNTUgLyAxMDAwICogbGFzdEluY3JlYXNlRGlmZikgKyAnLCAnICsgTWF0aC5yb3VuZCgyNTUgLSAyNTUgLyAxMDAwICogbGFzdEluY3JlYXNlRGlmZikgKyAnKScpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kcmF3RmlsbCgpO1xuXHRcdFx0fVxuXHRcdH1cbiAgICB9XG5cblx0dGhpcy5mdW5CYXJUZXh0LnRleHQgPSAoTWF0aC5yb3VuZCh0aGlzLmN1cnJlbnQgKiAxMCkgLyAxMCkudG9GaXhlZCgxKSArICcvJyArIHRoaXMubWF4RnVuVmFsdWU7XG5cblx0aWYgKHRoaXMuY2FuRnVuVGltZSkge1xuXHRcdHRoaXMuaXNGdW5UaW1lID0gdHJ1ZTtcblx0XHR0aGlzLmNhbkZ1blRpbWUgPSBmYWxzZTtcblx0XHR0aGlzLmlzRnVuVGltZVJlc2V0ID0gZmFsc2U7XG5cdFx0dGhpcy5mdW5UaW1lRW5kID0gZXZlbnQudGltZVN0YW1wICsgdGhpcy5mdW5UaW1lO1xuXHR9XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLmdldE1heE9mZnNldE9uQmFyID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiAodGhpcy5jdXJyZW50IC8gdGhpcy5tYXhGdW5WYWx1ZSkgKiBtYXhXaWR0aDtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUuZHJhd0ZpbGwgPSBmdW5jdGlvbihjb2xvcikge1xuXHRjb2xvciA9IChjb2xvciA9PT0gdW5kZWZpbmVkKSA/ICcjZmYwJyA6IGNvbG9yO1xuICAgIHRoaXMuZmlsbC5ncmFwaGljcy5jbGVhcigpLmJlZ2luRmlsbChjb2xvcikuZHJhd1JlY3QoNSwgNSwgKHRoaXMuY3VycmVudCAvIHRoaXMubWF4RnVuVmFsdWUpICogbWF4V2lkdGgsIDQwKTtcbn07XG5cbkZ1bkJhci5wcm90b3R5cGUuc3Bhd25KdWljeVN0YXIgPSBmdW5jdGlvbih4LCB5LCBzaXplKSB7XG5cdHNpemUgKj0gKDAuOCArIDAuNCAqIE1hdGgucmFuZG9tKCkpO1xuXG5cdHZhciBzdGFyID0gbmV3IGNyZWF0ZWpzLlNoYXBlKCk7XG5cdHN0YXIueCA9IHg7XG5cdHN0YXIueSA9IHk7XG5cdHN0YXIucm90YXRpb24gPSBwYXJzZUludChNYXRoLnJhbmRvbSgpICogMzYwKTtcblx0c3Rhci5ncmFwaGljcy5iZWdpblN0cm9rZShcIiNmMGZcIikuYmVnaW5GaWxsKCcjZmYwJykuc2V0U3Ryb2tlU3R5bGUoMikuZHJhd1BvbHlTdGFyKDAsIDAsIHNpemUgLyAyIC0gMTUsIDUsIDAuNikuY2xvc2VQYXRoKCk7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChzdGFyKTtcblxuXHRjcmVhdGVqcy5Ud2Vlbi5nZXQoc3Rhcilcblx0XHQudG8oe3k6IHkgKyAyMDAsIGFscGhhOiAwLCByb3RhdGlvbjogc3Rhci5yb3RhdGlvbiArIDE4MH0sIDUwMCArIDUwMCAqIE1hdGgucmFuZG9tKCksIGNyZWF0ZWpzLkVhc2UubGluZWFyKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHN0YXIpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLnNwYXduQ29tYm9NZXNzYWdlID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dmFyIG1lc3NhZ2UgPSBuZXcgY3JlYXRlanMuVGV4dChsZXZlbCArICd4IENvbWJvJywgJzMwcHggS29taWthJywgXCIjZmZmXCIpO1xuXHRtZXNzYWdlLnggPSA5NSAtIG1lc3NhZ2UuZ2V0TWVhc3VyZWRXaWR0aCgpIC8gMjtcblx0bWVzc2FnZS55ID0gMTUwO1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQobWVzc2FnZSk7XG5cblx0Y3JlYXRlanMuVHdlZW4uZ2V0KG1lc3NhZ2UpXG5cdFx0LnRvKHt5OiAwLCBhbHBoYTogMH0sIDE1MDAsIGNyZWF0ZWpzLkVhc2UubGluZWFyKVxuXHRcdC5jYWxsKGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKG1lc3NhZ2UpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG59O1xuXG5GdW5CYXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR0aGlzLm1heEZ1blZhbHVlID0gbGV2ZWwubWF4RnVuVmFsdWU7XG5cdHRoaXMuZnVuVGltZSA9IGxldmVsLmZ1blRpbWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZ1bkJhcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9odWQvRnVuQmFyLmpzXCIsXCIvaHVkXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIG1heFdpZHRoID0gMjQwO1xuXG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgnLi4vR2FtZUNvbnN0cycpO1xuXG5mdW5jdGlvbiBIZWFsdGhCYXIobGVmdCwgb2JqZWN0KSB7XG4gICAgdGhpcy5vYmplY3QgPSBvYmplY3Q7XG5cbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5lbGVtZW50LnggPSBsZWZ0ID8gNDUgOiBjb25zdGFudHMuR0FNRV9XSURUSCAtIDI2MDtcblx0dGhpcy5lbGVtZW50LnkgPSAxMDtcbiAgICB0aGlzLmN1cnJlbnQgPSAwO1xuXG4gICAgdGhpcy5ib3JkZXIgPSBuZXcgY3JlYXRlanMuU2hhcGUoKTtcbiAgICB0aGlzLmJvcmRlci5ncmFwaGljcy5iZWdpbkZpbGwoXCIjNDQ0XCIpLmRyYXdSZWN0KDAsIDAsIDI1MCwgNTApO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmJvcmRlcik7XG5cbiAgICB0aGlzLmZpbGwgPSBuZXcgY3JlYXRlanMuU2hhcGUoKTtcbiAgICB0aGlzLmRyYXdGaWxsKCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZmlsbCk7XG5cblx0dGhpcy5mdW5UZXh0ID0gbmV3IGNyZWF0ZWpzLlRleHQobGVmdCA/IFwi4pmlXCIgOiBcIuKYoFwiLCBcIjMwcHggS29taWthXCIsIGxlZnQgPyAnI2Y4ZicgOiAnI2QwMCcpO1xuXHR0aGlzLmZ1blRleHQueCA9IC0zNTtcblx0dGhpcy5mdW5UZXh0LnkgPSAtNDtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZnVuVGV4dCk7XG5cblx0dGhpcy5yZW1haW5pbmdIaXRzVGV4dCA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiXCIsIFwiMjVweCBLb21pa2FcIiwgJyNmZmYnKTtcblx0dGhpcy5yZW1haW5pbmdIaXRzVGV4dC54ID0gNzA7XG5cdHRoaXMucmVtYWluaW5nSGl0c1RleHQueSA9IDE7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLnJlbWFpbmluZ0hpdHNUZXh0KTtcbn1cblxuSGVhbHRoQmFyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICBlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuICAgIGVtaXR0ZXIub24oJ2hlYWwtbWUnLCB0aGlzLm9uSGVhbE1lLmJpbmQodGhpcykpO1xufTtcblxuSGVhbHRoQmFyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLnJlbWFpbmluZ0hpdHNUZXh0LnRleHQgPSB0aGlzLm9iamVjdC5oZWFsdGggKyAnLycgKyB0aGlzLm9iamVjdC5tYXhIZWFsdGg7XG59O1xuXG5IZWFsdGhCYXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ICE9PSB0aGlzLm9iamVjdC5pZCApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbn07XG5cbkhlYWx0aEJhci5wcm90b3R5cGUub25IZWFsTWUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuZHJhd0ZpbGwoKTtcbn07XG5cbkhlYWx0aEJhci5wcm90b3R5cGUuZHJhd0ZpbGwgPSBmdW5jdGlvbigpIHtcblx0dmFyIGNvbG9yID0gKHRoaXMub2JqZWN0LmlkID09PSAncGxheWVyJykgPyAnI2Y4ZicgOiAnI2QwMCc7XG4gICAgdGhpcy5maWxsLmdyYXBoaWNzLmNsZWFyKCkuYmVnaW5GaWxsKGNvbG9yKS5kcmF3UmVjdCg1LCA1LCAodGhpcy5vYmplY3QuaGVhbHRoIC8gdGhpcy5vYmplY3QubWF4SGVhbHRoKSAqIG1heFdpZHRoLCA0MCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWx0aEJhcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9odWQvSGVhbHRoQmFyLmpzXCIsXCIvaHVkXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gTGV2ZWxCYXIoKSB7XG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dGhpcy5lbGVtZW50LnggPSBjb25zdGFudHMuR0FNRV9XSURUSCAtIDEzMDtcblx0dGhpcy5lbGVtZW50LnkgPSBjb25zdGFudHMuR0FNRV9IRUlHSFQgLSA2MDtcblxuXHR0aGlzLnRleHQgPSBuZXcgY3JlYXRlanMuVGV4dChcIiBcIiwgXCIyNXB4IEtvbWlrYVwiLCAnI2ZmZicpO1xuXHR0aGlzLnRleHQueCA9IDA7XG5cdHRoaXMudGV4dC55ID0gMDtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMudGV4dCk7XG59XG5cbkxldmVsQmFyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0ZW1pdHRlci5vbignY2hhbmdlLWxldmVsJywgdGhpcy5vbkNoYW5nZUxldmVsLmJpbmQodGhpcykpO1xufTtcblxuTGV2ZWxCYXIucHJvdG90eXBlLm9uQ2hhbmdlTGV2ZWwgPSBmdW5jdGlvbihsZXZlbCkge1xuXHR0aGlzLnRleHQudGV4dCA9IFwiTGV2ZWwgXCIgKyBsZXZlbC5sZXZlbElkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMZXZlbEJhcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaHVkL0xldmVsQmFyLmpzXCIsXCIvaHVkXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKSxcblx0aWNvbkhhbmQgPSAn4piDJyxcblx0aWNvblN3b3JkID0gJ+KalCc7XG5cbmZ1bmN0aW9uIFdlYXBvbkJhcigpIHtcblx0dGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXHR0aGlzLmVsZW1lbnQueCA9IDEwO1xuXHR0aGlzLmVsZW1lbnQueSA9IGNvbnN0YW50cy5HQU1FX0hFSUdIVCAtIDYwO1xuXG5cdHRoaXMuaWNvbiA9IGljb25IYW5kO1xuXG5cdHRoaXMucmVtYWluaW5nSGl0c1RleHQgPSBuZXcgY3JlYXRlanMuVGV4dChpY29uSGFuZCArIFwiIDBcIiwgXCIyNXB4IEtvbWlrYVwiLCAnI2ZmZicpO1xuXHR0aGlzLnJlbWFpbmluZ0hpdHNUZXh0LnggPSA1MDtcblx0dGhpcy5yZW1haW5pbmdIaXRzVGV4dC55ID0gMDtcblx0dGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMucmVtYWluaW5nSGl0c1RleHQpO1xufVxuXG5XZWFwb25CYXIucHJvdG90eXBlLnVwZGF0ZVdlYXBvbiA9IGZ1bmN0aW9uKHdlYXBvbiwgcmVtYWluaW5nKSB7XG5cdHN3aXRjaCAod2VhcG9uKSB7XG5cdFx0Y2FzZSAnc2hvcnQtd2VhcG9uJzpcblx0XHRcdHRoaXMuaWNvbiA9IGljb25Td29yZDtcblx0XHRcdGJyZWFrO1xuXG5cdFx0ZGVmYXVsdDpcblx0XHRcdHRoaXMuaWNvbiA9IGljb25IYW5kO1xuXHRcdFx0YnJlYWs7XG5cdH1cblxuXHR0aGlzLnVwZGF0ZVJlbWFpbmluZ0hpdHMocmVtYWluaW5nKTtcbn07XG5cbldlYXBvbkJhci5wcm90b3R5cGUudXBkYXRlUmVtYWluaW5nSGl0cyA9IGZ1bmN0aW9uKHJlbWFpbmluZykge1xuXHR0aGlzLnJlbWFpbmluZ0hpdHNUZXh0LnRleHQgPSB0aGlzLmljb24gKyAnICcgKyBwYXJzZUludChyZW1haW5pbmcgfHwgMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYXBvbkJhcjtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvaHVkL1dlYXBvbkJhci5qc1wiLFwiL2h1ZFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIExldmVsID0gZnVuY3Rpb24obGV2ZWxJZCwgZGFya25lc3MsIG1vbnN0ZXJTcGVlZCwgaXRlbVNlZWQsIHRlcnJhaW5TZWVkLCBwbGF5ZXJIZWFsdGgsIG1vbnN0ZXJIZWFsdGgsIHRyZWVzLCBncm93bENvb2xkb3duLCBpdGVtQ29vbGRvd24sIGl0ZW1Td29yZEFtb3VudCwgaXRlbVN3b3JkTGlmZXRpbWUsIGNvbWJvSW50ZXJ2YWwsIG1heEZ1blZhbHVlLCBmdW5UaW1lKSB7XG4gICAgdGhpcy5sZXZlbElkID0gbGV2ZWxJZDtcbiAgICB0aGlzLmRhcmtuZXNzID0gZGFya25lc3M7XG4gICAgdGhpcy5tb25zdGVyU3BlZWQgPSBtb25zdGVyU3BlZWQ7XG4gICAgdGhpcy5kYXJrbmVzcyA9IGRhcmtuZXNzO1xuICAgIHRoaXMuaXRlbVNlZWQgPSBpdGVtU2VlZDtcbiAgICB0aGlzLnRlcnJhaW5TZWVkID0gdGVycmFpblNlZWQ7XG4gICAgdGhpcy5wbGF5ZXJIZWFsdGggPSBwbGF5ZXJIZWFsdGg7XG4gICAgdGhpcy5tb25zdGVySGVhbHRoID0gbW9uc3RlckhlYWx0aDtcbiAgICB0aGlzLnRyZWVzID0gdHJlZXM7XG4gICAgdGhpcy5ncm93bENvb2xkb3duID0gZ3Jvd2xDb29sZG93bjtcbiAgICB0aGlzLml0ZW1Db29sZG93biA9IGl0ZW1Db29sZG93bjtcbiAgICB0aGlzLml0ZW1Td29yZEFtb3VudCA9IGl0ZW1Td29yZEFtb3VudDtcbiAgICB0aGlzLml0ZW1Td29yZExpZmV0aW1lID0gaXRlbVN3b3JkTGlmZXRpbWU7XG4gICAgdGhpcy5jb21ib0ludGVydmFsID0gY29tYm9JbnRlcnZhbDtcbiAgICB0aGlzLm1heEZ1blZhbHVlID0gbWF4RnVuVmFsdWU7XG4gICAgdGhpcy5mdW5UaW1lID0gZnVuVGltZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWw7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xldmVsL0xldmVsLmpzXCIsXCIvbGV2ZWxcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBsZXZlbERhdGEgPSByZXF1aXJlKCcuL2xldmVscycpLFxuICAgIExldmVsID0gcmVxdWlyZSgnLi9MZXZlbCcpO1xuXG52YXIgTGV2ZWxCdWlsZGVyID0gZnVuY3Rpb24oKSB7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7TnVtYmVyfSBsZXZlbElkXG4gKiBAcmV0dXJucyB7TGV2ZWx9XG4gKi9cbkxldmVsQnVpbGRlci5wcm90b3R5cGUuZ2V0TGV2ZWwgPSBmdW5jdGlvbihsZXZlbElkKSB7XG4gICAgdmFyIHJhd19sZXZlbCA9IGxldmVsRGF0YVtsZXZlbElkIC0gMV07XG4gICAgdmFyIGxldmVsID0gbmV3IExldmVsKFxuICAgICAgICByYXdfbGV2ZWwubGV2ZWwsXG4gICAgICAgIHJhd19sZXZlbC5kYXJrbmVzcyxcbiAgICAgICAgcmF3X2xldmVsLm1vbnN0ZXJTcGVlZCxcbiAgICAgICAgcmF3X2xldmVsLml0ZW1TZWVkLFxuICAgICAgICByYXdfbGV2ZWwudGVycmFpblNlZWQsXG4gICAgICAgIHJhd19sZXZlbC5wbGF5ZXJIZWFsdGgsXG4gICAgICAgIHJhd19sZXZlbC5tb25zdGVySGVhbHRoLFxuICAgICAgICByYXdfbGV2ZWwudHJlZXMsXG4gICAgICAgIHJhd19sZXZlbC5ncm93bENvb2xkb3duLFxuICAgICAgICByYXdfbGV2ZWwuaXRlbUNvb2xkb3duLFxuICAgICAgICByYXdfbGV2ZWwuaXRlbVN3b3JkQW1vdW50LFxuICAgICAgICByYXdfbGV2ZWwuaXRlbVN3b3JkTGlmZXRpbWUsXG4gICAgICAgIHJhd19sZXZlbC5jb21ib0ludGVydmFsLFxuICAgICAgICByYXdfbGV2ZWwubWF4RnVuVmFsdWUsXG4gICAgICAgIHJhd19sZXZlbC5mdW5UaW1lXG4gICAgKTtcblxuICAgIHJldHVybiBsZXZlbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxCdWlsZGVyO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9sZXZlbC9MZXZlbEJ1aWxkZXIuanNcIixcIi9sZXZlbFwiKSIsIm1vZHVsZS5leHBvcnRzPVtcbiAge1xuICAgIFwibGV2ZWxcIjogMSxcbiAgICBcImRhcmtuZXNzXCI6IDAsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMC43LFxuICAgIFwiaXRlbVNlZWRcIjogMixcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwMSxcbiAgICBcInRyZWVzXCI6IDIwMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAyNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDE1MCxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiAyMCxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDIwLFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogNyxcbiAgICBcImZ1blRpbWVcIjogNjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAyLFxuICAgIFwiZGFya25lc3NcIjogMC41LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDAuOSxcbiAgICBcIml0ZW1TZWVkXCI6IDMsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDIsXG4gICAgXCJ0cmVlc1wiOiA1MDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAxNTAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogMTUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxMCxcbiAgICBcImZ1blRpbWVcIjogNTAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAzLFxuICAgIFwiZGFya25lc3NcIjogMC43LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEsXG4gICAgXCJpdGVtU2VlZFwiOiA0LFxuICAgIFwidGVycmFpblNlZWRcIjogMTAzLFxuICAgIFwidHJlZXNcIjogNTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTAwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAyMDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDgsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogNixcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDEwLFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogNSxcbiAgICBcImZ1blRpbWVcIjogMTUwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiA0LFxuICAgIFwiZGFya25lc3NcIjogMC43NSxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjEsXG4gICAgXCJpdGVtU2VlZFwiOiA1LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA0LFxuICAgIFwidHJlZXNcIjogMzc1LFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEwMCxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMjUwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiA1LFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDUsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiAxMCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDE1LFxuICAgIFwiZnVuVGltZVwiOiA0MDAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDUsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjc4LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuMixcbiAgICBcIml0ZW1TZWVkXCI6IDYsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDUsXG4gICAgXCJ0cmVlc1wiOiAxMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTAwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiAzMDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDUsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogNSxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDEwLFxuICAgIFwiY29tYm9JbnRlcnZhbFwiOiAxNTAwLFxuICAgIFwibWF4RnVuVmFsdWVcIjogMTUsXG4gICAgXCJmdW5UaW1lXCI6IDM1MDBcbiAgfSxcbiAge1xuICAgIFwibGV2ZWxcIjogNixcbiAgICBcImRhcmtuZXNzXCI6IDAuODEsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS4zLFxuICAgIFwiaXRlbVNlZWRcIjogNyxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDEwNixcbiAgICBcInRyZWVzXCI6IDEwMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxMjUsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDMyNSxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogNSxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiA0LFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogMTAsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxNSxcbiAgICBcImZ1blRpbWVcIjogMzAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiA3LFxuICAgIFwiZGFya25lc3NcIjogMC44NCxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjQsXG4gICAgXCJpdGVtU2VlZFwiOiA4LFxuICAgIFwidGVycmFpblNlZWRcIjogMTA3LFxuICAgIFwidHJlZXNcIjogNzUwLFxuICAgIFwicGxheWVySGVhbHRoXCI6IDEyNSxcbiAgICBcIm1vbnN0ZXJIZWFsdGhcIjogMzUwLFxuICAgIFwiZ3Jvd2xDb29sZG93blwiOiA0LFxuICAgIFwiaXRlbUNvb2xkb3duXCI6IDEwLFxuICAgIFwiaXRlbVN3b3JkQW1vdW50XCI6IDQsXG4gICAgXCJpdGVtU3dvcmRMaWZldGltZVwiOiAxMCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDE1LFxuICAgIFwiZnVuVGltZVwiOiAyNTAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDgsXG4gICAgXCJkYXJrbmVzc1wiOiAwLjg4LFxuICAgIFwibW9uc3RlclNwZWVkXCI6IDEuNSxcbiAgICBcIml0ZW1TZWVkXCI6IDksXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDgsXG4gICAgXCJ0cmVlc1wiOiAxMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDM3NSxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogNCxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiA0LFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogNSxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDE1LFxuICAgIFwiZnVuVGltZVwiOiAyMDAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDksXG4gICAgXCJkYXJrbmVzc1wiOiAwLjksXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS42LFxuICAgIFwiaXRlbVNlZWRcIjogMTAsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMDksXG4gICAgXCJ0cmVlc1wiOiA1MDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA0MDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDQsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAxNSxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxMCxcbiAgICBcImRhcmtuZXNzXCI6IDAuOTIsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS43LFxuICAgIFwiaXRlbVNlZWRcIjogMTEsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTAsXG4gICAgXCJ0cmVlc1wiOiAxNTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA0MjUsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDMsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDUsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyMCxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxMSxcbiAgICBcImRhcmtuZXNzXCI6IDAuOTQsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMS44LFxuICAgIFwiaXRlbVNlZWRcIjogMTIsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTEsXG4gICAgXCJ0cmVlc1wiOiAyMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDQ1MCxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogMyxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiAzLFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogNSxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDIwLFxuICAgIFwiZnVuVGltZVwiOiAyMDAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDEyLFxuICAgIFwiZGFya25lc3NcIjogMC45NixcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAxLjksXG4gICAgXCJpdGVtU2VlZFwiOiAxMyxcbiAgICBcInRlcnJhaW5TZWVkXCI6IDExMixcbiAgICBcInRyZWVzXCI6IDU3MCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDUwMCxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogMyxcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiAzLFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogNSxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDIwLFxuICAgIFwiZnVuVGltZVwiOiAyMDAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDEzLFxuICAgIFwiZGFya25lc3NcIjogMC45NyxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAyLFxuICAgIFwiaXRlbVNlZWRcIjogMTQsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTMsXG4gICAgXCJ0cmVlc1wiOiAyMTAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA1MjUsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDMsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDQsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyMCxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxNCxcbiAgICBcImRhcmtuZXNzXCI6IDAuOTgsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMi4xLFxuICAgIFwiaXRlbVNlZWRcIjogMTUsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTQsXG4gICAgXCJ0cmVlc1wiOiAxMCxcbiAgICBcInBsYXllckhlYWx0aFwiOiAxNTAsXG4gICAgXCJtb25zdGVySGVhbHRoXCI6IDU1MCxcbiAgICBcImdyb3dsQ29vbGRvd25cIjogMixcbiAgICBcIml0ZW1Db29sZG93blwiOiAxMCxcbiAgICBcIml0ZW1Td29yZEFtb3VudFwiOiAzLFxuICAgIFwiaXRlbVN3b3JkTGlmZXRpbWVcIjogNCxcbiAgICBcImNvbWJvSW50ZXJ2YWxcIjogMTUwMCxcbiAgICBcIm1heEZ1blZhbHVlXCI6IDI1LFxuICAgIFwiZnVuVGltZVwiOiAyMDAwXG4gIH0sXG4gIHtcbiAgICBcImxldmVsXCI6IDE1LFxuICAgIFwiZGFya25lc3NcIjogMC45OSxcbiAgICBcIm1vbnN0ZXJTcGVlZFwiOiAyLjIsXG4gICAgXCJpdGVtU2VlZFwiOiAxNixcbiAgICBcInRlcnJhaW5TZWVkXCI6IDExNSxcbiAgICBcInRyZWVzXCI6IDgsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA2MDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDIsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDQsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyNixcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxNixcbiAgICBcImRhcmtuZXNzXCI6IDEsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMi4zLFxuICAgIFwiaXRlbVNlZWRcIjogMTcsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTYsXG4gICAgXCJ0cmVlc1wiOiAxMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA3NTAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDIsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDQsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyNyxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9LFxuICB7XG4gICAgXCJsZXZlbFwiOiAxNyxcbiAgICBcImRhcmtuZXNzXCI6IDEsXG4gICAgXCJtb25zdGVyU3BlZWRcIjogMi40LFxuICAgIFwiaXRlbVNlZWRcIjogMTgsXG4gICAgXCJ0ZXJyYWluU2VlZFwiOiAxMTcsXG4gICAgXCJ0cmVlc1wiOiAxMDAsXG4gICAgXCJwbGF5ZXJIZWFsdGhcIjogMTUwLFxuICAgIFwibW9uc3RlckhlYWx0aFwiOiA4MDAsXG4gICAgXCJncm93bENvb2xkb3duXCI6IDIsXG4gICAgXCJpdGVtQ29vbGRvd25cIjogMTAsXG4gICAgXCJpdGVtU3dvcmRBbW91bnRcIjogMyxcbiAgICBcIml0ZW1Td29yZExpZmV0aW1lXCI6IDQsXG4gICAgXCJjb21ib0ludGVydmFsXCI6IDE1MDAsXG4gICAgXCJtYXhGdW5WYWx1ZVwiOiAyOCxcbiAgICBcImZ1blRpbWVcIjogMjAwMFxuICB9XG5dIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIGF0dGFja0RlbGF5ID0gMTAwMDtcblxuZnVuY3Rpb24gQXR0YWNrTGlzdGVuZXIoc3RhZ2UsIG9iamVjdCkge1xuICAgIHRoaXMuc3RhZ2UgPSBzdGFnZTtcbiAgICB0aGlzLm9iamVjdCA9IG9iamVjdDtcblxuICAgIHRoaXMubGFzdEF0dGFjayA9IDA7XG4gICAgdGhpcy5jYW5BdHRhY2sgPSB0cnVlO1xuICAgIHRoaXMuaXNBdHRhY2tpbmcgPSBmYWxzZTtcbn1cblxuQXR0YWNrTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd2luZG93LmRvY3VtZW50Lm9uY2xpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoc2VsZi5jYW5BdHRhY2spIHtcbiAgICAgICAgICAgIHNlbGYuaXNBdHRhY2tpbmcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbkF0dGFja0xpc3RlbmVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMuY2FuQXR0YWNrICYmIGV2ZW50LnRpbWVTdGFtcCA+IHRoaXMubGFzdEF0dGFjayArIGF0dGFja0RlbGF5KSB7XG4gICAgICAgIHRoaXMuY2FuQXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0F0dGFja2luZykge1xuICAgICAgICB0aGlzLmNhbkF0dGFjayA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzQXR0YWNraW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGFzdEF0dGFjayA9IGV2ZW50LnRpbWVTdGFtcDtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2F0dGFjaycsIHsgZGFtYWdlRGVhbGVyOiB0aGlzLm9iamVjdC5pZCB9KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF0dGFja0xpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0F0dGFja0xpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgY2hlYXRzID0gW1xuICAgIHtcbiAgICAgICAga2V5czogWzEwMiwgMTE3LCAxMTBdLCAvL2Z1blxuICAgICAgICBldmVudDogXCJmb3JjZS1mdW5cIlxuICAgIH0sXG4gICAge1xuICAgICAgICBrZXlzOiBbIDExOSwgMTA1LCAxMTBdLCAvLyB3aW5cbiAgICAgICAgZXZlbnQ6ICdtb25zdGVyLWRlYWQnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleXM6IFsgMTA0LCAxMDgsIDExMl0sIC8vIGhscFxuICAgICAgICBldmVudDogJ2hlYWwtbWUnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGtleXM6IFsgMTEyLCAxMDgsIDEyMl0sIC8vIHBselxuICAgICAgICBldmVudDogJ3BsYXllci13ZWFwb24tbGlmZXRpbWUnXG4gICAgfVxuXTtcblxuZnVuY3Rpb24gQ2hlYXRMaXN0ZW5lcigpIHtcbiAgICB0aGlzLmxhc3RLZXlzID0gWzAsIDAsIDBdO1xufVxuXG5DaGVhdExpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xuICAgIGRvY3VtZW50Lm9ua2V5cHJlc3MgPSB0aGlzLm9uS2V5VXAuYmluZCh0aGlzKTtcblxufTtcblxuQ2hlYXRMaXN0ZW5lci5wcm90b3R5cGUub25LZXlVcCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5sYXN0S2V5cy5zaGlmdCgpO1xuICAgIHRoaXMubGFzdEtleXMucHVzaChldmVudC5jaGFyQ29kZSk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoZWF0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoY2hlYXRzW2ldLmtleXMuam9pbignLCcpID09IHRoaXMubGFzdEtleXMuam9pbignLCcpKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnY2hlYXRlcicpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoY2hlYXRzW2ldLmV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hlYXRMaXN0ZW5lcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9DaGVhdExpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBDb2xsaXNpb25MaXN0ZW5lcihhLCBiLCBldmVudFR5cGUpIHtcbiAgICB0aGlzLmEgPSBhO1xuICAgIHRoaXMuYiA9IGI7XG4gICAgdGhpcy5ldmVudFR5cGUgPSBldmVudFR5cGU7XG59XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50cyA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuQ29sbGlzaW9uTGlzdGVuZXIucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBkaXN0ID0gTWF0aC5zcXJ0KE1hdGgucG93KHRoaXMuYi5lbGVtZW50LnggLSB0aGlzLmEuZWxlbWVudC54LCAyKSArIE1hdGgucG93KHRoaXMuYi5lbGVtZW50LnkgLSB0aGlzLmEuZWxlbWVudC55LCAyKSk7XG4gICAgdmFyIGFkZGVkUmFkaXVzID0gdGhpcy5hLmdldFJhZGl1cygpICsgdGhpcy5iLmdldFJhZGl1cygpO1xuICAgIGlmIChkaXN0IDwgYWRkZWRSYWRpdXMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRUeXBlID09ICdoaXQnKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUhpdERldGVjdGlvbihldmVudCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5ldmVudFR5cGUgPT0gJ3BpY2t1cCcpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUGlja3VwRGV0ZWN0aW9uKGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5oYW5kbGVIaXREZXRlY3Rpb24gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBhdHRhY2sgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5hLmlzU2hvcnRBdHRhY2tpbmcoKSAmJiB0aGlzLmIuaWQgIT09ICdncm93bCcpIHtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQodGhpcy5ldmVudFR5cGUsIHtcbiAgICAgICAgICAgIHRpbWVTdGFtcDogZXZlbnQudGltZVN0YW1wLFxuICAgICAgICAgICAgaGl0VGFyZ2V0OiB0aGlzLmIuaWQsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiB0aGlzLmEuaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iLmlzU2hvcnRBdHRhY2tpbmcoKSAmJiB0aGlzLmEuaWQgIT09ICdncm93bCcpIHtcbiAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQodGhpcy5ldmVudFR5cGUsIHtcbiAgICAgICAgICAgIHRpbWVTdGFtcDogZXZlbnQudGltZVN0YW1wLFxuICAgICAgICAgICAgaGl0VGFyZ2V0OiB0aGlzLmEuaWQsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiB0aGlzLmIuaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXR0YWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgZGFtYWdlRGVhbGVyID0gdGhpcy5hLmlkID09ICdwbGF5ZXInID8gdGhpcy5iLmlkIDogdGhpcy5hLmlkO1xuICAgIGlmICghYXR0YWNrKSB7XG4gICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KHRoaXMuZXZlbnRUeXBlLCB7XG4gICAgICAgICAgICB0aW1lU3RhbXA6IGV2ZW50LnRpbWVTdGFtcCxcbiAgICAgICAgICAgIGhpdFRhcmdldDogJ3BsYXllcicsXG4gICAgICAgICAgICBkYW1hZ2U6IDEwLFxuICAgICAgICAgICAgZGFtYWdlRGVhbGVyOiBkYW1hZ2VEZWFsZXJcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuYS5pZCA9PSAnZ3Jvd2wnKSB7XG4gICAgICAgICAgICB0aGlzLmEuaGl0KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5iLmlkID09ICdncm93bCcpIHtcbiAgICAgICAgICAgIHRoaXMuYi5oaXQoKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkNvbGxpc2lvbkxpc3RlbmVyLnByb3RvdHlwZS5oYW5kbGVQaWNrdXBEZXRlY3Rpb24gPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmEud2VhcG9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iLmVxdWlwcGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmEuZXF1aXAodGhpcy5iKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGlzaW9uTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvQ29sbGlzaW9uTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbmZ1bmN0aW9uIENvbWJvTGlzdGVuZXIoKSB7XG4gICAgdGhpcy5sZXZlbCA9IDA7XG5cdHRoaXMubGFzdEhpdCA9IDA7XG5cdHRoaXMuY29tYm9JbnRlcnZhbCA9IDA7XG59XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xuICAgIGVtaXR0ZXIub24oJ2hpdCcsIHRoaXMub25IaXQuYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcbn07XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLm9uSGl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuaGl0VGFyZ2V0ID09ICdwbGF5ZXInKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cblx0aWYgKGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMubGFzdEhpdCA+IHRoaXMuY29tYm9JbnRlcnZhbCkge1xuXHRcdHRoaXMucmVzZXQoKTtcblx0fVxuXG5cdHRoaXMuaW5jcmVhc2VDb21ibyhldmVudC50aW1lU3RhbXApO1xuXHR0aGlzLmxhc3RIaXQgPSBldmVudC50aW1lU3RhbXA7XG5cblx0aWYgKHRoaXMubGV2ZWwgPiAxKSB7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ2NvbWJvJywge1xuXHRcdFx0bGV2ZWw6IHRoaXMubGV2ZWxcblx0XHR9KTtcblx0fVxufTtcblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbn07XG5cbkNvbWJvTGlzdGVuZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sZXZlbCA9IDA7XG59O1xuXG5Db21ib0xpc3RlbmVyLnByb3RvdHlwZS5pbmNyZWFzZUNvbWJvID0gZnVuY3Rpb24odGltZVN0YW1wKSB7XG4gICAgdGhpcy5sZXZlbCsrO1xufTtcblxuQ29tYm9MaXN0ZW5lci5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG5cdHRoaXMuY29tYm9JbnRlcnZhbCA9IGxldmVsLmNvbWJvSW50ZXJ2YWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbWJvTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvQ29tYm9MaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gR3Jvd2xMaXN0ZW5lcihncm93bEhhbmRsZXIpIHtcbiAgICB0aGlzLmdyb3dsSGFuZGxlciA9IGdyb3dsSGFuZGxlcjtcbn1cblxuR3Jvd2xMaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignZ3Jvd2wnLCB0aGlzLm9uR3Jvd2wuYmluZCh0aGlzKSk7XG59O1xuXG5Hcm93bExpc3RlbmVyLnByb3RvdHlwZS5vbkdyb3dsID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmdyb3dsSGFuZGxlci5zcGFuKGV2ZW50KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3Jvd2xMaXN0ZW5lcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9Hcm93bExpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5cbmZ1bmN0aW9uIEl0ZW1MaXN0ZW5lcihpdGVtSGFuZGxlcikge1xuICAgIHRoaXMuY3VycmVudEl0ZW1zID0gMDtcbiAgICB0aGlzLm5leHRJdGVtID0gMDtcbiAgICB0aGlzLm1heEl0ZW1zID0gMDtcbiAgICB0aGlzLmNvb2xkb3duID0gMDtcbiAgICB0aGlzLml0ZW1IYW5kbGVyID0gaXRlbUhhbmRsZXI7XG59XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbiAgICB0aGlzLmVtaXR0ZXIub24oJ3VuZXF1aXAnLCB0aGlzLm9uVW5lcXVpcC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcbn07XG5cbkl0ZW1MaXN0ZW5lci5wcm90b3R5cGUub25DaGFuZ2VMZXZlbCA9IGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgdGhpcy5tYXhJdGVtcyA9IGxldmVsLml0ZW1Td29yZEFtb3VudDtcbiAgICB0aGlzLmNvb2xkb3duID0gbGV2ZWwuaXRlbUNvb2xkb3duO1xufTtcblxuSXRlbUxpc3RlbmVyLnByb3RvdHlwZS5vblVuZXF1aXAgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmN1cnJlbnRJdGVtcy0tO1xufTtcblxuSXRlbUxpc3RlbmVyLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY3VycmVudEl0ZW1zID49IHRoaXMubWF4SXRlbXMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm5leHRJdGVtID4gZXZlbnQudGltZVN0YW1wKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLml0ZW1IYW5kbGVyLnNwYXduKCk7XG4gICAgdGhpcy5uZXh0SXRlbSA9IGV2ZW50LnRpbWVTdGFtcCArIHRoaXMuY29vbGRvd24gKiAxMDAwO1xuICAgIHRoaXMuY3VycmVudEl0ZW1zKys7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEl0ZW1MaXN0ZW5lcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9JdGVtTGlzdGVuZXIuanNcIixcIi9saXN0ZW5lclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcblxudmFyIExldmVsQnVpbGRlciA9IHJlcXVpcmUoJy4uL2xldmVsL0xldmVsQnVpbGRlcicpO1xuXG52YXIgY3VycmVudExldmVsSWQgPSAwO1xuXG5mdW5jdGlvbiBMZXZlbFVwTGlzdGVuZXIoKSB7XG5cdHRoaXMubGV2ZWxCdWlkbGVyID0gbmV3IExldmVsQnVpbGRlcigpO1xufVxuXG5MZXZlbFVwTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHR0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xuXG5cdC8vZW1pdHRlci5vbignbW9uc3Rlci1kZWFkJywgdGhpcy5vbkxldmVsVXAuYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ3N0YXJ0LWxldmVsJywgdGhpcy5vblN0YXJ0TGV2ZWwuYmluZCh0aGlzKSk7XG5cdGVtaXR0ZXIub24oJ2dhbWUtb3ZlcicsIHRoaXMub25HYW1lT3Zlci5iaW5kKHRoaXMpKTtcbn07XG5cbkxldmVsVXBMaXN0ZW5lci5wcm90b3R5cGUub25TdGFydExldmVsID0gZnVuY3Rpb24oKSB7XG5cdGN1cnJlbnRMZXZlbElkKys7XG5cblx0dmFyIG5ld0xldmVsID0gdGhpcy5sZXZlbEJ1aWRsZXIuZ2V0TGV2ZWwoY3VycmVudExldmVsSWQpO1xuXG5cdHRoaXMuZW1pdHRlci5lbWl0KCdjaGFuZ2UtbGV2ZWwnLCBuZXdMZXZlbCk7XG59O1xuXG5MZXZlbFVwTGlzdGVuZXIucHJvdG90eXBlLm9uR2FtZU92ZXIgPSBmdW5jdGlvbigpIHtcblx0Y3VycmVudExldmVsSWQgPSAxO1xuXG5cdHZhciBuZXdMZXZlbCA9IHRoaXMubGV2ZWxCdWlkbGVyLmdldExldmVsKGN1cnJlbnRMZXZlbElkKTtcblxuXHR0aGlzLmVtaXR0ZXIuZW1pdCgnY2hhbmdlLWxldmVsJywgbmV3TGV2ZWwpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMZXZlbFVwTGlzdGVuZXI7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL0xldmVsVXBMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gUmFpbmJvd1JvYWRMaXN0ZW5lcihyYWluYm93Um9hZCkge1xuICAgIHRoaXMucmFpbmJvd1JvYWQgPSByYWluYm93Um9hZDtcbn1cblxuUmFpbmJvd1JvYWRMaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignaGFzLWZ1bicsIHRoaXMub25IYXNGdW4uYmluZCh0aGlzKSk7XG59O1xuXG5SYWluYm93Um9hZExpc3RlbmVyLnByb3RvdHlwZS5vbkhhc0Z1biA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5yYWluYm93Um9hZC5wYWludChldmVudCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJhaW5ib3dSb2FkTGlzdGVuZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbGlzdGVuZXIvUmFpbmJvd1JvYWRMaXN0ZW5lci5qc1wiLFwiL2xpc3RlbmVyXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gU291bmRMaXN0ZW5lcigpIHtcblx0dGhpcy5mdW5Tb3VuZCA9IGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ2Z1bicpO1xuXHR0aGlzLmZ1blNvdW5kLnN0b3AoKTtcbn1cblxuU291bmRMaXN0ZW5lci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudCA9IGZ1bmN0aW9uKGVtaXR0ZXIpIHtcblx0dGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcblxuXHRlbWl0dGVyLm9uKCdoaXQnLCB0aGlzLm9uSGl0LmJpbmQodGhpcykpO1xuXHRlbWl0dGVyLm9uKCdmdW4nLCB0aGlzLm9uRnVuLmJpbmQodGhpcykpO1xufTtcblxuU291bmRMaXN0ZW5lci5wcm90b3R5cGUub25IaXQgPSBmdW5jdGlvbihldmVudCkge1xuXHRpZiAoZXZlbnQuaGl0VGFyZ2V0ID09ICdwbGF5ZXInKSB7XG5cdFx0Y3JlYXRlanMuU291bmQucGxheSgnZ2lybC1odXJ0Jyk7XG5cdH0gZWxzZSBpZiAoZXZlbnQuaGl0VGFyZ2V0ID09ICdtb25zdGVyJykge1xuXHRcdGNyZWF0ZWpzLlNvdW5kLnBsYXkoJ21vbnN0ZXItaHVydCcpO1xuXHR9XG59O1xuXG5Tb3VuZExpc3RlbmVyLnByb3RvdHlwZS5vbkZ1biA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdGlmIChldmVudC5zdGF0dXMpIHtcblx0XHR0aGlzLmZ1blNvdW5kLnBsYXkoKTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLmZ1blNvdW5kLnN0b3AoKTtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTb3VuZExpc3RlbmVyO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9saXN0ZW5lci9Tb3VuZExpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBXZWFwb25CYXJMaXN0ZW5lcih3ZWFwb25CYXIpIHtcbiAgICB0aGlzLndlYXBvbkJhciA9IHdlYXBvbkJhcjtcbn1cblxuV2VhcG9uQmFyTGlzdGVuZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ3VuZXF1aXAnLCB0aGlzLm9uVW5lcXVpcC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCdlcXVpcCcsIHRoaXMub25FcXVpcC5iaW5kKHRoaXMpKTtcbiAgICBlbWl0dGVyLm9uKCd3ZWFwb24tdXBkYXRlJywgdGhpcy5vbldlYXBvblVwZGF0ZS5iaW5kKHRoaXMpKTtcbn07XG5cbldlYXBvbkJhckxpc3RlbmVyLnByb3RvdHlwZS5vblVuZXF1aXAgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLndlYXBvbkJhci51cGRhdGVXZWFwb24oJ2hhbmRzJyk7XG59O1xuXG5XZWFwb25CYXJMaXN0ZW5lci5wcm90b3R5cGUub25FcXVpcCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy53ZWFwb25CYXIudXBkYXRlV2VhcG9uKGV2ZW50LmlkLCBldmVudC5saWZldGltZSk7XG59O1xuXG5XZWFwb25CYXJMaXN0ZW5lci5wcm90b3R5cGUub25XZWFwb25VcGRhdGUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMud2VhcG9uQmFyLnVwZGF0ZVJlbWFpbmluZ0hpdHMoZXZlbnQubGlmZXRpbWUpO1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYXBvbkJhckxpc3RlbmVyO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2xpc3RlbmVyL1dlYXBvbkJhckxpc3RlbmVyLmpzXCIsXCIvbGlzdGVuZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5cbnZhciBOaWdodE92ZXJsYXkgPSBmdW5jdGlvbihwbGF5ZXIpIHtcblx0dGhpcy5jID0gMDtcblxuXHR0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG5cblx0dmFyIGltZyA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoJy4vaW1nL25pZ2h0bW9kZS5wbmcnKTtcblx0dGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG5cblx0dGhpcy5lbGVtZW50LmFscGhhID0gMDtcblx0aW1nLnNjYWxlWCA9IGltZy5zY2FsZVkgPSAwLjY7XG5cdGltZy54ID0gMTAyNCAvIDI7XG5cdGltZy55ID0gNzY4LzI7XG5cblx0aW1nLnJlZ1ggPSAxMTUwO1xuXHRpbWcucmVnWSA9IDE0NTA7XG5cblx0dGhpcy5pbWcgPSBpbWc7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChpbWcpO1xufTtcblxuTmlnaHRPdmVybGF5LnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0dmFyIHNwZWVkID0gdGhpcy5wbGF5ZXIudmVsb2NpdHkubGVuZ3RoKCk7XG5cblx0dGhpcy5jICs9IGV2ZW50LmRlbHRhICogc3BlZWQgIC8gKDgwICogMTAwMCk7XG5cdHRoaXMuaW1nLnJvdGF0aW9uID0gdGhpcy5wbGF5ZXIuZWxlbWVudC5yb3RhdGlvbiAtIDM1ICsgTWF0aC5zaW4odGhpcy5jKSAqIDEwO1xufTtcblxuTmlnaHRPdmVybGF5LnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcblx0dGhpcy5lbGVtZW50LmFscGhhID0gbGV2ZWwuZGFya25lc3M7XG59O1xuXG5OaWdodE92ZXJsYXkucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuXHRlbWl0dGVyLm9uKCdjaGFuZ2UtbGV2ZWwnLCB0aGlzLm9uQ2hhbmdlTGV2ZWwuYmluZCh0aGlzKSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5pZ2h0T3ZlcmxheTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9uaWdodE92ZXJsYXkvTmlnaHRPdmVybGF5LmpzXCIsXCIvbmlnaHRPdmVybGF5XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIEdhbWVPdmVyU2NyZWVuID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbn07XG5cbkdhbWVPdmVyU2NyZWVuLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQuYWRkQ2hpbGQobmV3IGNyZWF0ZWpzLkJpdG1hcCgnLi9pbWcvZ2FtZW92ZXIucG5nJykpO1xuXG5cdHRoaXMuZWxlbWVudC5zY2FsZVggPSAwLjU0O1xuXHR0aGlzLmVsZW1lbnQuc2NhbGVZID0gMC43MjtcblxuXHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdkZWZlYXQnKTtcbn07XG5cbkdhbWVPdmVyU2NyZWVuLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR2FtZU92ZXJTY3JlZW47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc2NyZWVucy9HYW1lT3ZlclNjcmVlbi5qc1wiLFwiL3NjcmVlbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgVmlldyA9IHJlcXVpcmUoJy4uL3ZpZXdzL1ZpZXcnKSxcbiAgICBQbGF5ZXIgPSByZXF1aXJlKCcuLi9QbGF5ZXInKSxcbiAgICBNb25zdGVyID0gcmVxdWlyZSgnLi4vTW9uc3RlcicpLFxuICAgIEZ1bkJhciA9IHJlcXVpcmUoJy4uL2h1ZC9GdW5CYXInKSxcbiAgICBIZWFsdGhCYXIgPSByZXF1aXJlKCcuLi9odWQvSGVhbHRoQmFyJyksXG4gICAgTGV2ZWxCYXIgPSByZXF1aXJlKCcuLi9odWQvTGV2ZWxCYXInKSxcbiAgICBXZWFwb25CYXIgPSByZXF1aXJlKCcuLi9odWQvV2VhcG9uQmFyJyksXG4gICAgQ2hlYXRlckJhciA9IHJlcXVpcmUoJy4uL2h1ZC9DaGVhdGVyQmFyJyksXG4gICAgQ29tYm9MaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0NvbWJvTGlzdGVuZXInKSxcbiAgICBDb2xsaXNpb25MaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0NvbGxpc2lvbkxpc3RlbmVyJyksXG4gICAgQXR0YWNrTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9BdHRhY2tMaXN0ZW5lcicpLFxuICAgIFNvdW5kTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9Tb3VuZExpc3RlbmVyJyksXG4gICAgR3Jvd2xMaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0dyb3dsTGlzdGVuZXInKSxcbiAgICBMZXZlbFVwTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9MZXZlbFVwTGlzdGVuZXInKSxcbiAgICBJdGVtTGlzdGVuZXIgPSByZXF1aXJlKCcuLi9saXN0ZW5lci9JdGVtTGlzdGVuZXInKSxcbiAgICBDaGVhdExpc3RlbmVyID0gcmVxdWlyZSgnLi4vbGlzdGVuZXIvQ2hlYXRMaXN0ZW5lcicpLFxuICAgIEdyb3dsSGFuZGxlciA9IHJlcXVpcmUoJy4uL3dlYXBvbnMvR3Jvd2xIYW5kbGVyJyksXG4gICAgSXRlbUhhbmRsZXIgPSByZXF1aXJlKCcuLi93ZWFwb25zL0l0ZW1IYW5kbGVyJyksXG4gICAgR3JvdW5kID0gcmVxdWlyZSgnLi4vZ3JvdW5kL0dyb3VuZCcpLFxuICAgIFJhaW5ib3dSb2FkID0gcmVxdWlyZSgnLi4vZ3JvdW5kL1JhaW5ib3dSb2FkJyksXG4gICAgUmFpbmJvd1JvYWRMaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL1JhaW5ib3dSb2FkTGlzdGVuZXInKSxcbiAgICBXZWFwb25CYXJMaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL1dlYXBvbkJhckxpc3RlbmVyJyksXG4gICAgTmlnaHRPdmVybGF5ID0gcmVxdWlyZSgnLi4vbmlnaHRPdmVybGF5L05pZ2h0T3ZlcmxheScpLFxuICAgIEdhbWVDb25zdHMgPSByZXF1aXJlKCcuLi9HYW1lQ29uc3RzJyk7XG5cbmZ1bmN0aW9uIEdhbWVTY3JlZW4oc3RhZ2UpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5nYW1lVmlldyA9IG5ldyBWaWV3KCk7XG4gICAgdGhpcy5odWRWaWV3ID0gbmV3IFZpZXcoKTtcbiAgICB0aGlzLmdyb3dsSGFuZGxlciA9IG5ldyBHcm93bEhhbmRsZXIoKTtcbiAgICB0aGlzLml0ZW1IYW5kbGVyID0gbmV3IEl0ZW1IYW5kbGVyKCk7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcblxuICAgIHRoaXMuc3RhZ2UgPSBzdGFnZTtcblx0dGhpcy5iYWNrZ3JvdW5kTXVzaWMgPSBudWxsO1xufVxuXG5HYW1lU2NyZWVuLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50ID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG59O1xuXG5HYW1lU2NyZWVuLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmdhbWVWaWV3LmVsZW1lbnQpO1xuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0aGlzLmh1ZFZpZXcuZWxlbWVudCk7XG4gICAgdGhpcy5nYW1lVmlldy5hZGRDaGlsZCh0aGlzLmdyb3dsSGFuZGxlcik7XG4gICAgdGhpcy5nYW1lVmlldy5hZGRDaGlsZCh0aGlzLml0ZW1IYW5kbGVyKTtcblxuICAgIHZhciBmdW5CYXIgPSBuZXcgRnVuQmFyKCk7XG4gICAgdGhpcy5odWRWaWV3LmFkZENoaWxkKGZ1bkJhcik7XG4gICAgdGhpcy5odWRWaWV3LmFkZENoaWxkKG5ldyBDaGVhdGVyQmFyKCkpO1xuXG5cdHZhciByYWluYm93Um9hZCA9IG5ldyBSYWluYm93Um9hZCgpO1xuXHR0aGlzLmdhbWVWaWV3LmFkZENoaWxkKHJhaW5ib3dSb2FkKTtcblxuICAgIHRoaXMucGxheWVyID0gbmV3IFBsYXllcigyMDAsIDIwMCk7XG4gICAgdGhpcy5ncm93bEhhbmRsZXIuc2V0VGFyZ2V0KHRoaXMucGxheWVyKTtcbiAgICB0aGlzLml0ZW1IYW5kbGVyLnNldFRhcmdldCh0aGlzLnBsYXllcik7XG4gICAgdGhpcy5nYW1lVmlldy5hZGRDaGlsZCh0aGlzLnBsYXllcik7XG4gICAgdGhpcy5nYW1lVmlldy5hdHRhY2godGhpcy5wbGF5ZXIpO1xuXG4gICAgdmFyIG1vbnN0ZXIgPSBuZXcgTW9uc3Rlcig3MDAsIDMwMCwgdGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuZ2FtZVZpZXcuYWRkQ2hpbGQobW9uc3Rlcik7XG5cbiAgICB2YXIgaGVhbHRoQmFyMSA9IG5ldyBIZWFsdGhCYXIodHJ1ZSwgdGhpcy5wbGF5ZXIpO1xuICAgIHRoaXMuaHVkVmlldy5hZGRDaGlsZChoZWFsdGhCYXIxKTtcblxuICAgIHZhciBoZWFsdGhCYXIyID0gbmV3IEhlYWx0aEJhcihmYWxzZSwgbW9uc3Rlcik7XG4gICAgdGhpcy5odWRWaWV3LmFkZENoaWxkKGhlYWx0aEJhcjIpO1xuXG5cdHZhciB3ZWFwb25CYXIgPSBuZXcgV2VhcG9uQmFyKCk7XG5cdHRoaXMuaHVkVmlldy5hZGRDaGlsZCh3ZWFwb25CYXIpO1xuXG4gICAgdmFyIGxldmVsQmFyID0gbmV3IExldmVsQmFyKCk7XG4gICAgdGhpcy5odWRWaWV3LmFkZENoaWxkKGxldmVsQmFyKTtcblxuICAgIHZhciBncm91bmQgPSBuZXcgR3JvdW5kKCk7XG4gICAgdGhpcy5nYW1lVmlldy5hZGRDaGlsZEF0KGdyb3VuZCwgMCk7XG5cbiAgICBpZiAoR2FtZUNvbnN0cy5OSUdIVF9NT0RFKSB7XG4gICAgICAgIHZhciBuaWdodE92ZXJsYXkgPSBuZXcgTmlnaHRPdmVybGF5KHRoaXMucGxheWVyKTtcbiAgICAgICAgdGhpcy5odWRWaWV3LmFkZENoaWxkQXQobmlnaHRPdmVybGF5LCAwKTtcbiAgICB9XG5cbiAgICB2YXIgY29tYm9MaXN0ZW5lciA9IG5ldyBDb21ib0xpc3RlbmVyKCk7XG4gICAgY29tYm9MaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2goY29tYm9MaXN0ZW5lcik7XG4gICAgdmFyIGNvbGxpc2lvbkxpc3RlbmVyID0gbmV3IENvbGxpc2lvbkxpc3RlbmVyKHRoaXMucGxheWVyLCBtb25zdGVyLCAnaGl0Jyk7XG4gICAgY29sbGlzaW9uTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGNvbGxpc2lvbkxpc3RlbmVyKTtcbiAgICB2YXIgYXR0YWNrTGlzdGVuZXIgPSBuZXcgQXR0YWNrTGlzdGVuZXIodGhpcy5zdGFnZSwgdGhpcy5wbGF5ZXIpO1xuICAgIGF0dGFja0xpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChhdHRhY2tMaXN0ZW5lcik7XG5cdHZhciBzb3VuZExpc3RlbmVyID0gbmV3IFNvdW5kTGlzdGVuZXIoKTtcblx0c291bmRMaXN0ZW5lci5yZWdpc3RlckV2ZW50KHRoaXMuZW1pdHRlcik7XG5cdHRoaXMubGlzdGVuZXJzLnB1c2goc291bmRMaXN0ZW5lcik7XG4gICAgdmFyIGdyb3dsTGlzdGVuZXIgPSBuZXcgR3Jvd2xMaXN0ZW5lcih0aGlzLmdyb3dsSGFuZGxlcik7XG4gICAgZ3Jvd2xMaXN0ZW5lci5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzLnB1c2goZ3Jvd2xMaXN0ZW5lcik7XG4gICAgdmFyIGxldmVsVXBMaXN0ZW5lciA9IG5ldyBMZXZlbFVwTGlzdGVuZXIoKTtcbiAgICBsZXZlbFVwTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGxldmVsVXBMaXN0ZW5lcik7XG4gICAgdmFyIGl0ZW1MaXN0ZW5lciA9IG5ldyBJdGVtTGlzdGVuZXIodGhpcy5pdGVtSGFuZGxlcik7XG4gICAgaXRlbUxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChpdGVtTGlzdGVuZXIpO1xuICAgIHZhciByYWluYm93Um9hZExpc3RlbmVyID0gbmV3IFJhaW5ib3dSb2FkTGlzdGVuZXIocmFpbmJvd1JvYWQpO1xuICAgIHJhaW5ib3dSb2FkTGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKHJhaW5ib3dSb2FkTGlzdGVuZXIpO1xuICAgIHZhciB3ZWFwb25CYXJMaXN0ZW5lciA9IG5ldyBXZWFwb25CYXJMaXN0ZW5lcih3ZWFwb25CYXIpO1xuICAgIHdlYXBvbkJhckxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaCh3ZWFwb25CYXJMaXN0ZW5lcik7XG4gICAgdmFyIGNoZWF0TGlzdGVuZXIgPSBuZXcgQ2hlYXRMaXN0ZW5lcigpO1xuICAgIGNoZWF0TGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGNoZWF0TGlzdGVuZXIpO1xuXG4gICAgdGhpcy5nYW1lVmlldy5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuICAgIHRoaXMuaHVkVmlldy5yZWdpc3RlckV2ZW50cyh0aGlzLmVtaXR0ZXIpO1xuXG4gICAgaWYgKCF0aGlzLmJhY2tncm91bmRNdXNpYykge1xuXHRcdHRoaXMuYmFja2dyb3VuZE11c2ljID0gY3JlYXRlanMuU291bmQucGxheSgnYmFja2dyb3VuZCcsIHtsb29wczogLTEsIHZvbHVtZTogMC4yfSk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5iYWNrZ3JvdW5kTXVzaWMucmVzdW1lKCk7XG5cdH1cbn07XG5cbkdhbWVTY3JlZW4ucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5odWRWaWV3LnJlc2V0KCk7XG4gICAgdGhpcy5nYW1lVmlldy5yZXNldCgpO1xuICAgIHRoaXMuZ3Jvd2xIYW5kbGVyLnJlc2V0KCk7XG4gICAgdGhpcy5pdGVtSGFuZGxlci5yZXNldCgpO1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG5cdHRoaXMuYmFja2dyb3VuZE11c2ljLnBhdXNlKCk7XG59O1xuXG5HYW1lU2NyZWVuLnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmdhbWVWaWV3LnRpY2soZXZlbnQpO1xuICAgIHRoaXMuaHVkVmlldy50aWNrKGV2ZW50KTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmxpc3RlbmVyc1tpXVsndGljayddID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzW2ldLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHYW1lU2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvR2FtZVNjcmVlbi5qc1wiLFwiL3NjcmVlbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBIb21lU2NyZWVuKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbn1cblxuSG9tZVNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dEJveCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB2YXIgaGVhZGxpbmUgPSBuZXcgY3JlYXRlanMuVGV4dChcIldlbGNvbWUhXCIsIFwiMTAwcHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgdGV4dEJveC5hZGRDaGlsZChoZWFkbGluZSk7XG5cbiAgICB2YXIgdG8gPSBuZXcgY3JlYXRlanMuVGV4dChcInRvXCIsIFwiNTBweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICB0by55ID0gMTI1O1xuICAgIHRvLnggPSAxNTA7XG4gICAgdGV4dEJveC5hZGRDaGlsZCh0byk7XG5cbiAgICB2YXIgZ2FtZU5hbWUgPSBuZXcgY3JlYXRlanMuVGV4dChcIntHYW1lTmFtZX0hXCIsIFwiMTAwcHggU2lsa3NjcmVlblwiLCBcIiNmZjc3MDBcIik7XG4gICAgZ2FtZU5hbWUueSA9IDIwMDtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKGdhbWVOYW1lKTtcblxuICAgIHRleHRCb3gueSA9IDEwMDtcbiAgICB0ZXh0Qm94LnggPSAxNTA7XG5cbiAgICB0aGlzLmxvYWRpbmcgPSBuZXcgY3JlYXRlanMuVGV4dChcIkxvYWRpbmcgLi4uXCIsIFwiNzVweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICB0aGlzLmxvYWRpbmcueSA9IDUwMDtcbiAgICB0aGlzLmxvYWRpbmcueCA9IDE1MDtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGhpcy5sb2FkaW5nKTtcblxuICAgIHRoaXMuZWxlbWVudC5hZGRDaGlsZCh0ZXh0Qm94KTtcbn07XG5cbkhvbWVTY3JlZW4ucHJvdG90eXBlLmlzUmVhZHkgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5sb2FkaW5nKTtcblxuICAgIHRoaXMubG9hZGluZyA9IG5ldyBjcmVhdGVqcy5UZXh0KFwiQ2xpY2sgdG8gU3RhcnQgR2FtZSFcIiwgXCI2NnB4IFNpbGtzY3JlZW5cIiwgXCIjZmY3NzAwXCIpO1xuICAgIHRoaXMubG9hZGluZy55ID0gNTAwO1xuICAgIHRoaXMubG9hZGluZy54ID0gMTUwO1xuXG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMubG9hZGluZyk7XG59O1xuXG5Ib21lU2NyZWVuLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBbGxDaGlsZHJlbigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIb21lU2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvSG9tZVNjcmVlbi5qc1wiLFwiL3NjcmVlbnNcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5mdW5jdGlvbiBNYXJpb0lzSW5Bbm90aGVyQ2FzdGxlU2NyZWVuKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbn1cblxuTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dEJveCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB2YXIgaGVhZGxpbmUgPSBuZXcgY3JlYXRlanMuVGV4dChcIlRoYW5rIFlvdSwgbGl0dGxlIGdpcmwhXCIsIFwiNTZweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKGhlYWRsaW5lKTtcblxuICAgIHZhciBpbmZvID0gbmV3IGNyZWF0ZWpzLlRleHQoXCJCdXQgTWFyaW8gaXMgaW4gYW5vdGhlciBDYXN0bGUhXCIsIFwiMzJweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICBpbmZvLnkgPSAxMDA7XG4gICAgdGV4dEJveC5hZGRDaGlsZChpbmZvKTtcblxuICAgIHZhciBhY3Rpb24gPSBuZXcgY3JlYXRlanMuVGV4dChcIkNsaWNrIHRvIHRyeSB0aGUgbmV4dCBDYXN0bGUhXCIsIFwiMzJweCBTaWxrc2NyZWVuXCIsIFwiI2ZmNzcwMFwiKTtcbiAgICBhY3Rpb24ueSA9IDMwMDtcbiAgICB0ZXh0Qm94LmFkZENoaWxkKGFjdGlvbik7XG5cbiAgICB2YXIgYiA9IHRleHRCb3guZ2V0Qm91bmRzKCk7XG4gICAgdGV4dEJveC54ID0gMTAwO1xuICAgIHRleHRCb3gueSA9IDIwMDtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQodGV4dEJveCk7XG5cblx0Y3JlYXRlanMuU291bmQucGxheSgndmljdG9yeScpO1xufTtcblxuTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWFyaW9Jc0luQW5vdGhlckNhc3RsZVNjcmVlbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zY3JlZW5zL01hcmlvSXNJbkFub3RoZXJDYXN0bGVTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZnVuY3Rpb24gU3RvcnlTY3JlZW4oKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xufVxuXG5TdG9yeVNjcmVlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcblxufTtcblxuU3RvcnlTY3JlZW4ucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0b3J5U2NyZWVuO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3NjcmVlbnMvU3RvcnlTY3JlZW4uanNcIixcIi9zY3JlZW5zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUHNldWRvUmFuZCA9IGZ1bmN0aW9uKCkge307XG5cbi8qKlxuICogQHBhcmFtIHNlZWRcbiAqL1xuUHNldWRvUmFuZC5wcm90b3R5cGUuc2V0U2VlZCA9IGZ1bmN0aW9uKHNlZWQpIHtcblx0dGhpcy5fdyA9IE1hdGguYWJzKHNlZWQgJiAweGZmZmYpO1xuXHR0aGlzLl96ID0gTWF0aC5hYnMoc2VlZCA+PiAxNik7XG5cblx0aWYgKHRoaXMuX3cgPT0gMCkgdGhpcy5fdyA9IDE7XG5cdGlmICh0aGlzLl96ID09IDApIHRoaXMuX3ogPSAxO1xufTtcblxuLyoqXG4gKiBAcmV0dXJucyB7aW50fVxuICovXG5Qc2V1ZG9SYW5kLnByb3RvdHlwZS5nZXRSYW5kb20gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5feiA9IE1hdGguYWJzKCgzNjk2OSAqICh0aGlzLl96ICYgNjU1MzUpICsgKHRoaXMuX3ogPj4gMTYpKSYweGZmZmZmZmYpO1xuXHR0aGlzLl93ID0gTWF0aC5hYnMoKDE4MDAwICogKHRoaXMuX3cgJiA2NTUzNSkgKyAodGhpcy5fdyA+PiAxNikpJjB4ZmZmZmZmZik7XG5cdHJldHVybiBNYXRoLmFicygoKHRoaXMuX3ogPDwgMTYpICsgdGhpcy5fdykgJiAweGZmZmZmZmYpOyAvLyBleGNsdWRlIGxhc3QgYml0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBzZXVkb1JhbmQ7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdXRpbC9Qc2V1ZG9SYW5kLmpzXCIsXCIvdXRpbFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAcGFyYW0ge051bWJlcn0geFxuICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgVmVjdG9yMkQgPSBmdW5jdGlvbiAoeCwgeSkge1xuXHR0aGlzLnggPSB4O1xuXHR0aGlzLnkgPSB5O1xufTtcblxuVmVjdG9yMkQucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBuZXcgVmVjdG9yMkQodGhpcy54LCB0aGlzLnkpO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSBhbm90aGVyX3ZlY3RvclxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cblZlY3RvcjJELnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24oYW5vdGhlcl92ZWN0b3IpIHtcblx0dGhpcy54ICs9IGFub3RoZXJfdmVjdG9yLng7XG5cdHRoaXMueSArPSBhbm90aGVyX3ZlY3Rvci55O1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSBhbm90aGVyX3ZlY3RvclxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cblZlY3RvcjJELnByb3RvdHlwZS5taW51cyA9IGZ1bmN0aW9uKGFub3RoZXJfdmVjdG9yKSB7XG5cdHJldHVybiB0aGlzLnBsdXMoYW5vdGhlcl92ZWN0b3IuY2xvbmUoKS50aW1lcygtMSkpO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge051bWJlcn0gZmFjdG9yXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xuVmVjdG9yMkQucHJvdG90eXBlLnRpbWVzID0gZnVuY3Rpb24oZmFjdG9yKSB7XG5cdHRoaXMueCAqPSBmYWN0b3I7XG5cdHRoaXMueSAqPSBmYWN0b3I7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqL1xuVmVjdG9yMkQucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xufTtcblxuLyoqXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xuVmVjdG9yMkQucHJvdG90eXBlLm5vcm0gPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCgpO1xuXHRpZiAobGVuZ3RoICE9IDAgKSB7XG5cdFx0cmV0dXJuIHRoaXMudGltZXMoMSAvIHRoaXMubGVuZ3RoKCkpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvcjJEO1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9hXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYlxuICogQHBhcmFtIHtOdW1iZXJ9IHRcbiAqIEByZXR1cm4ge1ZlY3RvcjJEfVxuICovXG5tb2R1bGUuZXhwb3J0cy5sZXJwID0gZnVuY3Rpb24odmVjdG9yX2EsIHZlY3Rvcl9iLCB0KSB7XG5cdHJldHVybiB2ZWN0b3JfYS5jbG9uZSgpLnRpbWVzKDEtdCkucGx1cyh2ZWN0b3JfYi5jbG9uZSgpLnRpbWVzKHQpKTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtWZWN0b3IyRH0gdmVjdG9yX2FcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9iXG4gKiBAcmV0dXJuIHtWZWN0b3IyRH1cbiAqL1xubW9kdWxlLmV4cG9ydHMuYWRkID0gZnVuY3Rpb24odmVjdG9yX2EsIHZlY3Rvcl9iKSB7XG5cdHJldHVybiB2ZWN0b3JfYS5jbG9uZSgpLnBsdXModmVjdG9yX2IpXG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3Rvcl9hXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYlxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cbm1vZHVsZS5leHBvcnRzLnN1YnRyYWN0ID0gZnVuY3Rpb24odmVjdG9yX2EsIHZlY3Rvcl9iKSB7XG5cdHJldHVybiB2ZWN0b3JfYS5jbG9uZSgpLm1pbnVzKHZlY3Rvcl9iKVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1ZlY3RvcjJEfSB2ZWN0b3JfYVxuICogQHBhcmFtIHtOdW1iZXJ9IGZhY3RvclxuICogQHJldHVybiB7VmVjdG9yMkR9XG4gKi9cbm1vZHVsZS5leHBvcnRzLm11bHRpcGx5ID0gZnVuY3Rpb24odmVjdG9yX2EsIGZhY3Rvcikge1xuXHRyZXR1cm4gdmVjdG9yX2EuY2xvbmUoKS50aW1lcyhmYWN0b3IpXG59O1xuXG4vKipcbiAqIEBwYXJhbSB7VmVjdG9yMkR9IHZlY3RvclxuICogQHJldHVybiB7TnVtYmVyfVxuICovXG5tb2R1bGUuZXhwb3J0cy5nZXRBbmdsZSA9IGZ1bmN0aW9uKHZlY3Rvcikge1xuXHR2YXIgYW5nbGUgPSBNYXRoLmFzaW4odmVjdG9yLnkgLyB2ZWN0b3IubGVuZ3RoKCkpICogKDE4MCAvIE1hdGguUEkpICsgOTA7XG5cblx0cmV0dXJuIHZlY3Rvci54IDwgMCA/IDM2MCAtIGFuZ2xlIDogYW5nbGU7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL3V0aWwvVmVjdG9yMmQuanNcIixcIi91dGlsXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgR2FtZUNvbnN0cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxudmFyIFZpZXcgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXHR0aGlzLmVsZW1lbnRzID0gW107XG59O1xuXG5WaWV3LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmVsZW1lbnQucmVtb3ZlQWxsQ2hpbGRyZW4oKTtcblx0dGhpcy5lbGVtZW50cyA9IFtdO1xufTtcblxuVmlldy5wcm90b3R5cGUuYWRkQ2hpbGQgPSBmdW5jdGlvbihlbGVtZW50KSB7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZChlbGVtZW50LmVsZW1lbnQpO1xuXHR0aGlzLmVsZW1lbnRzLnB1c2goZWxlbWVudCk7XG59O1xuXG5WaWV3LnByb3RvdHlwZS5hZGRDaGlsZEF0ID0gZnVuY3Rpb24oZWxlbWVudCwgaWR4KSB7XG5cdHRoaXMuZWxlbWVudC5hZGRDaGlsZEF0KGVsZW1lbnQuZWxlbWVudCwgaWR4KTtcblx0dGhpcy5lbGVtZW50cy5wdXNoKGVsZW1lbnQpO1xufTtcblxuVmlldy5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5lbGVtZW50c1tpXVsncmVnaXN0ZXJFdmVudHMnXSA9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRzW2ldLnJlZ2lzdGVyRXZlbnRzKGVtaXR0ZXIpO1xuXHRcdH1cblx0fVxufTtcblxuVmlldy5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5lbGVtZW50c1tpXVsndGljayddID09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRoaXMuZWxlbWVudHNbaV0udGljayhldmVudCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHRoaXMuYXR0YWNoZWRUbykge1xuXHRcdHRoaXMuZWxlbWVudC5zZXRUcmFuc2Zvcm0oXG5cdFx0XHQtdGhpcy5hdHRhY2hlZFRvLnggKyBHYW1lQ29uc3RzLkdBTUVfV0lEVEggLyAyLFxuXHRcdFx0LXRoaXMuYXR0YWNoZWRUby55ICsgR2FtZUNvbnN0cy5HQU1FX0hFSUdIVCAvIDJcblx0XHQpO1xuXHR9XG59O1xuXG5WaWV3LnByb3RvdHlwZS5hdHRhY2ggPSBmdW5jdGlvbihlbGVtZW50KSB7XG5cdHRoaXMuYXR0YWNoZWRUbyA9IGVsZW1lbnQuZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmlldztcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi92aWV3cy9WaWV3LmpzXCIsXCIvdmlld3NcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgVmVjMmQgPSByZXF1aXJlKCcuLi91dGlsL1ZlY3RvcjJkJyksXG4gICAgR2FtZUNvbnN0cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gR3Jvd2woeCwgeSwgdGFyZ2V0LCBsaWZldGltZSwgcmVsYXRpdmVMaWZldGltZSkge1xuICAgIHRoaXMuaWQgPSAnZ3Jvd2wnO1xuXG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuXG4gICAgdGhpcy5maXJlYmFsbCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcblx0dmFyIGZpcmViYWxsID0gbmV3IGNyZWF0ZWpzLkJpdG1hcChcIi4vaW1nL2ZpcmViYWxsLnBuZ1wiKTtcblxuXHR0aGlzLmZpcmViYWxsLnNjYWxlWCA9IHRoaXMuZmlyZWJhbGwuc2NhbGVZID0gMC4zO1xuXG4gICAgZmlyZWJhbGwuaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5maXJlYmFsbC5yZWdYID0gdGhpcy5maXJlYmFsbC5nZXRCb3VuZHMoKS53aWR0aCAvIDI7XG5cdFx0dGhpcy5maXJlYmFsbC5yZWdZID0gdGhpcy5maXJlYmFsbC5nZXRCb3VuZHMoKS5oZWlnaHQgLyAyO1xuXHR9LmJpbmQodGhpcyk7XG5cblx0dGhpcy5maXJlYmFsbC5hZGRDaGlsZChmaXJlYmFsbCk7XG4gICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKHRoaXMuZmlyZWJhbGwpO1xuXG5cdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuICAgIHRoaXMuZWxlbWVudC54ID0geDtcbiAgICB0aGlzLmVsZW1lbnQueSA9IHk7XG4gICAgdGhpcy5saWZldGltZSA9IGxpZmV0aW1lO1xuICAgIHRoaXMudmVsb2NpdHkgPSBuZXcgVmVjMmQoMCwgMCk7XG5cblx0Y3JlYXRlanMuVHdlZW4uZ2V0KHRoaXMuZmlyZWJhbGwpXG5cdFx0LnRvKHtyb3RhdGlvbjogcmVsYXRpdmVMaWZldGltZX0sIHJlbGF0aXZlTGlmZXRpbWUgLSA1MDApXG5cdFx0LmNhbGwoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5maXJlYmFsbCk7XG5cdFx0fS5iaW5kKHRoaXMpKTtcblxuICAgIHZhciBkYXRhID0gbmV3IGNyZWF0ZWpzLlNwcml0ZVNoZWV0KHtcbiAgICAgICAgXCJpbWFnZXNcIjogWycuL2ltZy9wb29mLnBuZyddLFxuICAgICAgICBcImZyYW1lc1wiOiB7XG4gICAgICAgICAgICBcInJlZ1hcIjogMCxcbiAgICAgICAgICAgIFwiaGVpZ2h0XCI6IDEyOCxcbiAgICAgICAgICAgIFwiY291bnRcIjogNjQsXG4gICAgICAgICAgICBcInJlZ1lcIjogMCxcbiAgICAgICAgICAgIFwid2lkdGhcIjogMTI4XG4gICAgICAgIH0sXG4gICAgICAgIFwiYW5pbWF0aW9uc1wiOiB7XCJlbXB0eVwiOiBbMF0sIFwiZGVmYXVsdFwiOiBbMSwgNjQsIFwiZW1wdHlcIl19XG4gICAgfSk7XG5cbiAgICBjcmVhdGVqcy5Ud2Vlbi5nZXQodGhpcy5lbGVtZW50KVxuICAgICAgICAud2FpdChyZWxhdGl2ZUxpZmV0aW1lIC0gMTAwMClcbiAgICAgICAgLmNhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgYW5pbWF0aW9uID0gbmV3IGNyZWF0ZWpzLlNwcml0ZShkYXRhLCBcImRlZmF1bHRcIik7XG4gICAgICAgICAgICBhbmltYXRpb24ueCA9IC02NDtcbiAgICAgICAgICAgIGFuaW1hdGlvbi55ID0gLTY0O1xuICAgICAgICAgICAgYW5pbWF0aW9uLmZyYW1lcmF0ZSA9IDYwO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKGFuaW1hdGlvbik7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG59XG5cbkdyb3dsLnByb3RvdHlwZS5oaXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmxpZmV0aW1lID0gMDtcbn07XG5cbkdyb3dsLnByb3RvdHlwZS5pc1Nob3J0QXR0YWNraW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5Hcm93bC5wcm90b3R5cGUuZ2V0UmFkaXVzID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIDIwO1xufTtcblxuR3Jvd2wucHJvdG90eXBlLnRpY2sgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBjdXJyZW50ID0gbmV3IFZlYzJkKHRoaXMudGFyZ2V0LmVsZW1lbnQueCwgdGhpcy50YXJnZXQuZWxlbWVudC55KTtcbiAgICB2YXIgdGFyZ2V0ICA9IG5ldyBWZWMyZCh0aGlzLmVsZW1lbnQueCwgdGhpcy5lbGVtZW50LnkpO1xuXG4gICAgdmFyIHZlY3Rvcl90b19kZXN0aW5hdGlvbiA9IFZlYzJkLnN1YnRyYWN0KGN1cnJlbnQsIHRhcmdldCk7XG4gICAgdmFyIGRpc3RhbmNlID0gdmVjdG9yX3RvX2Rlc3RpbmF0aW9uLmxlbmd0aCgpO1xuXG4gICAgLy8gY2FsY3VsYXRlIG5ldyB2ZWxvY2l0eSBhY2NvcmRpbmcgdG8gY3VycmVudCB2ZWxvY2l0eSBhbmQgcG9zaXRpb24gb2YgdGFyZ2V0XG4gICAgdmVjdG9yX3RvX2Rlc3RpbmF0aW9uLm5vcm0oKS50aW1lcygwLjcpO1xuICAgIHRoaXMudmVsb2NpdHkubm9ybSgpLnRpbWVzKDIwKTtcbiAgICB0aGlzLnZlbG9jaXR5ID0gdGhpcy52ZWxvY2l0eS5wbHVzKHZlY3Rvcl90b19kZXN0aW5hdGlvbik7XG5cbiAgICAvLyBzZXQgc3BlZWQgb2YgbW9uc3RlciBhY2NvcmRpbmcgdG8gZGlzdGFuY2UgdG8gdGFyZ2V0XG4gICAgdGhpcy52ZWxvY2l0eS50aW1lcygxMDAgKyBkaXN0YW5jZSAvIDIuNSk7XG5cbiAgICB2YXIgZGVsdGEgPSBWZWMyZC5tdWx0aXBseSh0aGlzLnZlbG9jaXR5LCBldmVudC5kZWx0YSAvIDgwMDApO1xuXG4gICAgdGhpcy5lbGVtZW50LnggKz0gZGVsdGEueDtcbiAgICB0aGlzLmVsZW1lbnQueSArPSBkZWx0YS55O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcm93bDtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi93ZWFwb25zL0dyb3dsLmpzXCIsXCIvd2VhcG9uc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBHcm93bCA9IHJlcXVpcmUoJy4vR3Jvd2wnKSxcbiAgICBDb2xsaXNpb25MaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0NvbGxpc2lvbkxpc3RlbmVyJyk7XG5cbnZhciBncm93bExpZmVUaW1lID0gNjAwMDtcblxuZnVuY3Rpb24gR3Jvd2xIYW5kbGVyKCkge1xuICAgIHRoaXMuZWxlbWVudCA9IG5ldyBjcmVhdGVqcy5Db250YWluZXIoKTtcbiAgICB0aGlzLmdyb3dscyA9IFtdO1xuXG4gICAgdGhpcy5zaG91bGRTcGFuID0gZmFsc2U7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcbn1cblxuR3Jvd2xIYW5kbGVyLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbn07XG5cbkdyb3dsSGFuZGxlci5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyID0gZW1pdHRlcjtcbn07XG5cbkdyb3dsSGFuZGxlci5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmdyb3dscyA9IFtdO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5Hcm93bEhhbmRsZXIucHJvdG90eXBlLnNwYW4gPSBmdW5jdGlvbihldmVudCkge1xuICAgIHRoaXMuc2hvdWxkU3BhbiA9IHRydWU7XG4gICAgdGhpcy5uZXh0U3BhbiA9IGV2ZW50O1xuXHRjcmVhdGVqcy5Tb3VuZC5wbGF5KCdsYXVuY2gtZmlyZWJhbGwnKTtcbn07XG5cbkdyb3dsSGFuZGxlci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuc2hvdWxkU3Bhbikge1xuICAgICAgICB2YXIgZ3Jvd2wgPSBuZXcgR3Jvd2wodGhpcy5uZXh0U3Bhbi54LCB0aGlzLm5leHRTcGFuLnksIHRoaXMubmV4dFNwYW4udGFyZ2V0LCBldmVudC50aW1lU3RhbXAgKyBncm93bExpZmVUaW1lLCBncm93bExpZmVUaW1lKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmFkZENoaWxkKGdyb3dsLmVsZW1lbnQpO1xuICAgICAgICB0aGlzLnNob3VsZFNwYW4gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5ncm93bHMucHVzaChncm93bCk7XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IG5ldyBDb2xsaXNpb25MaXN0ZW5lcih0aGlzLnRhcmdldCwgZ3Jvd2wsICdoaXQnKTtcbiAgICAgICAgbGlzdGVuZXIucmVnaXN0ZXJFdmVudHModGhpcy5lbWl0dGVyKTtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMuZ3Jvd2xzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmICh0aGlzLmdyb3dsc1tpXS5saWZldGltZSA8IGV2ZW50LnRpbWVTdGFtcCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuZ3Jvd2xzW2ldLmVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy5ncm93bHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuZ3Jvd2xzW2ldWyd0aWNrJ10gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5ncm93bHNbaV0udGljayhldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5saXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbaV0udGljayhldmVudCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcm93bEhhbmRsZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvd2VhcG9ucy9Hcm93bEhhbmRsZXIuanNcIixcIi93ZWFwb25zXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xudmFyIFNob3J0V2VhcG9uID0gcmVxdWlyZSgnLi9TaG9ydFdlYXBvbicpLFxuICAgIFBzZXVkb1JhbmQgPSByZXF1aXJlKCcuLi91dGlsL1BzZXVkb1JhbmQnKSxcbiAgICBDb2xsaXNpb25MaXN0ZW5lciA9IHJlcXVpcmUoJy4uL2xpc3RlbmVyL0NvbGxpc2lvbkxpc3RlbmVyJyksXG4gICAgR2FtZUNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL0dhbWVDb25zdHMnKTtcblxuZnVuY3Rpb24gSXRlbUhhbmRsZXIoKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gbmV3IGNyZWF0ZWpzLkNvbnRhaW5lcigpO1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcblxuICAgIHRoaXMuc2hvdWxkU3Bhd24gPSBmYWxzZTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIHRoaXMuaXRlbVN3b3JkTGlmZXRpbWUgPSAxMDtcblxuICAgIHRoaXMucmFuZCA9IG5ldyBQc2V1ZG9SYW5kKCk7XG59XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbn07XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5zcGF3biA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc2hvdWxkU3Bhd24gPSB0cnVlO1xufTtcblxuSXRlbUhhbmRsZXIucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5pdGVtcyA9IFtdO1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG4gICAgdGhpcy5lbGVtZW50LnJlbW92ZUFsbENoaWxkcmVuKCk7XG59O1xuXG5JdGVtSGFuZGxlci5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuc2hvdWxkU3Bhd24pIHtcbiAgICAgICAgdmFyIGl0ZW0gPSBuZXcgU2hvcnRXZWFwb24oXG4gICAgICAgICAgICB0aGlzLnJhbmQuZ2V0UmFuZG9tKCkgJSBHYW1lQ29uc3RhbnRzLkdBTUVfV0lEVEgsXG4gICAgICAgICAgICB0aGlzLnJhbmQuZ2V0UmFuZG9tKCkgJiBHYW1lQ29uc3RhbnRzLkdBTUVfSEVJR0hULFxuICAgICAgICAgICAgdGhpcy5yYW5kLmdldFJhbmRvbSgpICUgMzYwLFxuICAgICAgICAgICAgdGhpcy5pdGVtU3dvcmRMaWZldGltZVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoaXRlbS5lbGVtZW50KTtcbiAgICAgICAgdGhpcy5zaG91bGRTcGF3biA9IGZhbHNlO1xuICAgICAgICB0aGlzLml0ZW1zLnB1c2goaXRlbSk7XG5cbiAgICAgICAgdmFyIGxpc3RlbmVyID0gbmV3IENvbGxpc2lvbkxpc3RlbmVyKHRoaXMudGFyZ2V0LCBpdGVtLCAncGlja3VwJyk7XG4gICAgICAgIGxpc3RlbmVyLnJlZ2lzdGVyRXZlbnRzKHRoaXMuZW1pdHRlcik7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSB0aGlzLml0ZW1zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmICghdGhpcy5pdGVtc1tpXS5lcXVpcHBlZCAmJiB0aGlzLml0ZW1zW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLml0ZW1zW2ldLmVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5pdGVtc1tpXVsndGljayddID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXNbaV0udGljayhldmVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuaXRlbXNbaV0uZXF1aXBwZWQgJiYgdGhpcy5pdGVtc1tpXS5saWZldGltZSA+IDApIHtcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzW2ldLnRpY2soZXZlbnQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuSXRlbUhhbmRsZXIucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRzID0gZnVuY3Rpb24oZW1pdHRlcikge1xuICAgIGVtaXR0ZXIub24oJ2NoYW5nZS1sZXZlbCcsIHRoaXMub25DaGFuZ2VMZXZlbC5iaW5kKHRoaXMpKTtcbn07XG5cbkl0ZW1IYW5kbGVyLnByb3RvdHlwZS5vbkNoYW5nZUxldmVsID0gZnVuY3Rpb24obGV2ZWwpIHtcbiAgICB0aGlzLnJhbmQuc2V0U2VlZChsZXZlbC5pdGVtU2VlZCk7XG4gICAgdGhpcy5pdGVtU3dvcmRMaWZldGltZSA9IGxldmVsLml0ZW1Td29yZExpZmV0aW1lO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJdGVtSGFuZGxlcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi93ZWFwb25zL0l0ZW1IYW5kbGVyLmpzXCIsXCIvd2VhcG9uc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBhdHRhY2tEdXJhdGlvbiA9IDUwMDtcblxuZnVuY3Rpb24gU2hvcnRXZWFwb24oeCwgeSwgcm90YXRpb24sIGxpZmV0aW1lKSB7XG4gICAgdGhpcy5yYWRpdXMgPSAyMDtcbiAgICB0aGlzLmVsZW1lbnQgPSBuZXcgY3JlYXRlanMuQ29udGFpbmVyKCk7XG4gICAgdGhpcy5pZCA9ICdpdGVtJztcbiAgICB0aGlzLmVsZW1lbnQueCA9IHg7XG4gICAgdGhpcy5lbGVtZW50LnkgPSB5O1xuICAgIHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IHJvdGF0aW9uO1xuXG4gICAgdGhpcy5lcXVpcHBlZCA9IGZhbHNlO1xuICAgIHRoaXMubGlmZXRpbWUgPSBsaWZldGltZTtcblxuICAgIHZhciBpbWFnZSA9IG5ldyBjcmVhdGVqcy5CaXRtYXAoJy4vaW1nL3NjaHdlcnQucG5nJyk7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaW1hZ2UuaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYuZWxlbWVudC5yZWdYID0gc2VsZi5lbGVtZW50LmdldEJvdW5kcygpLndpZHRoIC8gMjtcbiAgICAgICAgc2VsZi5lbGVtZW50LnJlZ1kgPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRzKCkuaGVpZ2h0IC8gMjtcbiAgICB9O1xuICAgIHRoaXMuaW1hZ2UgPSBpbWFnZTtcbiAgICB0aGlzLmVsZW1lbnQuc2NhbGVYID0gdGhpcy5lbGVtZW50LnNjYWxlWSA9IDAuMTtcbiAgICB0aGlzLmVsZW1lbnQuYWRkQ2hpbGQoaW1hZ2UpO1xufVxuXG5TaG9ydFdlYXBvbi5wcm90b3R5cGUucmVnaXN0ZXJFdmVudHMgPSBmdW5jdGlvbihlbWl0dGVyKSB7XG4gICAgZW1pdHRlci5vbignYXR0YWNrJywgdGhpcy5vbkF0dGFjay5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmVtaXR0ZXIgPSBlbWl0dGVyO1xufTtcblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLm9uQXR0YWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAodGhpcy5saWZldGltZSA8PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmNhbkFjdGl2ZSA9IHRydWU7XG59O1xuXG5TaG9ydFdlYXBvbi5wcm90b3R5cGUudGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY2FuQWN0aXZlKSB7XG4gICAgICAgIHRoaXMuaXNBY3RpdmUgPSB0cnVlO1xuICAgICAgICB0aGlzLmNhbkFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmNvb2xkb3duID0gZXZlbnQudGltZVN0YW1wICsgYXR0YWNrRHVyYXRpb247XG4gICAgICAgIHRoaXMubGlmZXRpbWUtLTtcblxuICAgICAgICB0aGlzLnRyaWdnZXJVcGRhdGUoKTtcblxuICAgICAgICBpZiAodGhpcy5saWZldGltZSA8PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmVxdWlwcGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0FjdGl2ZSAmJiB0aGlzLmNvb2xkb3duIDwgZXZlbnQudGltZVN0YW1wKSB7XG4gICAgICAgIHRoaXMuY2FuQWN0aXZlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaXNBY3RpdmUgPSBmYWxzZTtcbiAgICB9XG59O1xuXG5TaG9ydFdlYXBvbi5wcm90b3R5cGUudHJpZ2dlclVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZW1pdHRlci5lbWl0KCd3ZWFwb24tdXBkYXRlJywge1xuICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgbGlmZXRpbWU6IHRoaXMubGlmZXRpbWVcbiAgICB9KTtcbn07XG5cblNob3J0V2VhcG9uLnByb3RvdHlwZS5nZXRSYWRpdXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmFkaXVzO1xufTtcblxuU2hvcnRXZWFwb24ucHJvdG90eXBlLmVxdWlwID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbGVtZW50LnggPSA5MDA7XG4gICAgdGhpcy5lbGVtZW50LnkgPSAwO1xuICAgIHRoaXMuZWxlbWVudC5yb3RhdGlvbiA9IDA7XG4gICAgdGhpcy5yYWRpdXMgPSA4MDtcbiAgICB0aGlzLmlkID0gJ3Nob3J0LXdlYXBvbic7XG4gICAgdGhpcy5lcXVpcHBlZCA9IHRydWU7XG4gICAgdGhpcy5lbGVtZW50LnNjYWxlWCA9IHRoaXMuZWxlbWVudC5zY2FsZVkgPSAxO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaG9ydFdlYXBvbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi93ZWFwb25zL1Nob3J0V2VhcG9uLmpzXCIsXCIvd2VhcG9uc1wiKSJdfQ==
