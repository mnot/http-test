var sys = require('sys');

var debug;
var debugLevel = parseInt(process.env.NODE_DEBUG, 16);
if (debugLevel & 0x4) {
  debug = function (x) { sys.error('HTTP: ' + x); };
} else {
  debug = function () { };
}

var net = require('net');
var events = require('events');
var Buffer = require('buffer').Buffer;

var FreeList = require('freelist').FreeList;
var HTTPParser = process.binding('http_parser').HTTPParser;

var parsers = new FreeList('parsers', 1000, function () {
  var parser = new HTTPParser('request');

  parser.onMessageBegin = function () {
    parser.incoming = new IncomingMessage(parser.socket);
    parser.field = null;
    parser.value = null;
  };

  // Only servers will get URL events.
  parser.onURL = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len);
    if (parser.incoming.url) {
      parser.incoming.url += slice;
    } else {
      // Almost always will branch here.
      parser.incoming.url = slice;
    }
  };

  parser.onHeaderField = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len).toLowerCase();
    if (parser.value != undefined) {
      parser.incoming._addHeaderLine(parser.field, parser.value);
      parser.field = null;
      parser.value = null;
    }
    if (parser.field) {
      parser.field += slice;
    } else {
      parser.field = slice;
    }
  };

  parser.onHeaderValue = function (b, start, len) {
    var slice = b.toString('ascii', start, start+len);
    if (parser.value) {
      parser.value += slice;
    } else {
      parser.value = slice;
    }
  };

  parser.onHeadersComplete = function (info) {
    if (parser.field && (parser.value != undefined)) {
      parser.incoming._addHeaderLine(parser.field, parser.value);
    }

    parser.incoming.httpVersionMajor = info.versionMajor;
    parser.incoming.httpVersionMinor = info.versionMinor;
    parser.incoming.httpVersion = info.versionMajor
                                + '.'
                                + info.versionMinor ;

    if (info.method) {
      // server only
      parser.incoming.method = info.method;
    } else {
      // client only
      parser.incoming.statusCode = info.statusCode;
    }

    parser.incoming.upgrade = info.upgrade;

    var isHeadResponse = false;

    if (!info.upgrade) {
      // For upgraded connections, we'll emit this after parser.execute
      // so that we can capture the first part of the new protocol
      isHeadResponse = parser.onIncoming(parser.incoming, info.shouldKeepAlive);
    }

    return isHeadResponse;
  };

  parser.onBody = function (b, start, len) {
    // TODO body encoding?
    var slice = b.slice(start, start+len);
    if (parser.incoming._decoder) {
      var string = parser.incoming._decoder.write(slice);
      if (string.length) parser.incoming.emit('data', string);
    } else {
      parser.incoming.emit('data', slice);
    }
  };

  parser.onMessageComplete = function () {
    if (!parser.incoming.upgrade) {
      // For upgraded connections, also emit this after parser.execute
      parser.incoming.emit("end");
    }
  };

  return parser;
});


var CRLF = "\r\n";
var STATUS_CODES = exports.STATUS_CODES = {
  100 : 'Continue',
  101 : 'Switching Protocols',
  102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
  200 : 'OK',
  201 : 'Created',
  202 : 'Accepted',
  203 : 'Non-Authoritative Information',
  204 : 'No Content',
  205 : 'Reset Content',
  206 : 'Partial Content',
  207 : 'Multi-Status',               // RFC 4918
  300 : 'Multiple Choices',
  301 : 'Moved Permanently',
  302 : 'Moved Temporarily',
  303 : 'See Other',
  304 : 'Not Modified',
  305 : 'Use Proxy',
  307 : 'Temporary Redirect',
  400 : 'Bad Request',
  401 : 'Unauthorized',
  402 : 'Payment Required',
  403 : 'Forbidden',
  404 : 'Not Found',
  405 : 'Method Not Allowed',
  406 : 'Not Acceptable',
  407 : 'Proxy Authentication Required',
  408 : 'Request Time-out',
  409 : 'Conflict',
  410 : 'Gone',
  411 : 'Length Required',
  412 : 'Precondition Failed',
  413 : 'Request Entity Too Large',
  414 : 'Request-URI Too Large',
  415 : 'Unsupported Media Type',
  416 : 'Requested Range Not Satisfiable',
  417 : 'Expectation Failed',
  418 : 'I\'m a teapot',              // RFC 2324
  422 : 'Unprocessable Entity',       // RFC 4918
  423 : 'Locked',                     // RFC 4918
  424 : 'Failed Dependency',          // RFC 4918
  425 : 'Unordered Collection',       // RFC 4918
  426 : 'Upgrade Required',           // RFC 2817
  500 : 'Internal Server Error',
  501 : 'Not Implemented',
  502 : 'Bad Gateway',
  503 : 'Service Unavailable',
  504 : 'Gateway Time-out',
  505 : 'HTTP Version not supported',
  506 : 'Variant Also Negotiates',    // RFC 2295
  507 : 'Insufficient Storage',       // RFC 4918
  509 : 'Bandwidth Limit Exceeded',
  510 : 'Not Extended'                // RFC 2774
};

var connectionExpression = /Connection/i;
var transferEncodingExpression = /Transfer-Encoding/i;
var closeExpression = /close/i;
var chunkExpression = /chunk/i;
var contentLengthExpression = /Content-Length/i;
var dateExpression = /Date/i;


/* Abstract base class for ServerRequest and ClientResponse. */
function IncomingMessage (socket) {
  events.EventEmitter.call(this);

  // TODO Remove one of these eventually.
  this.socket = socket;
  this.connection = socket;

  this.httpVersion = null;
  this.headers = {};

  // request (server) only
  this.url = "";

  this.method = null;

  // response (client) only
  this.statusCode = null;
  this.client = this.socket;
}
sys.inherits(IncomingMessage, events.EventEmitter);
exports.IncomingMessage = IncomingMessage;

IncomingMessage.prototype._parseQueryString = function () {
  throw new Error("_parseQueryString is deprecated. Use require(\"querystring\") to parse query strings.\n");
};


IncomingMessage.prototype.setEncoding = function (encoding) {
  var StringDecoder = require("string_decoder").StringDecoder; // lazy load
  this._decoder = new StringDecoder(encoding);
};

IncomingMessage.prototype.pause = function () {
  this.socket.pause();
};

IncomingMessage.prototype.resume = function () {
  this.socket.resume();
};

// Add the given (field, value) pair to the message
//
// Per RFC2616, section 4.2 it is acceptable to join multiple instances of the
// same header with a ', ' if the header in question supports specification of
// multiple values this way. If not, we declare the first instance the winner
// and drop the second. Extended header fields (those beginning with 'x-') are
// always joined.
IncomingMessage.prototype._addHeaderLine = function (field, value) {
  switch (field) {
    // Array headers:
    case 'set-cookie':
      if (field in this.headers) {
        this.headers[field].push(value);
      } else {
        this.headers[field] = [value];
      }
      break;

    // Comma separate. Maybe make these arrays?
    case 'accept':
    case 'accept-charset':
    case 'accept-encoding':
    case 'accept-language':
    case 'connection':
    case 'cookie':
      if (field in this.headers) {
        this.headers[field] += ', ' + value;
      } else {
        this.headers[field] = value;
      }
      break;


    default:
      if (field.slice(0,2) == 'x-') {
        // except for x-
        if (field in this.headers) {
          this.headers[field] += ', ' + value;
        } else {
          this.headers[field] = value;
        }
      } else {
        // drop duplicates
        if (!(field in this.headers)) this.headers[field] = value;
      }
      break;
  }
};

function OutgoingMessage (socket) {
  events.EventEmitter.call(this, socket);

  // TODO Remove one of these eventually.
  this.socket = socket;
  this.connection = socket;

  this.output = [];
  this.outputEncodings = [];

  this._last = false;
  this.chunkedEncoding = false;
  this.shouldKeepAlive = true;
  this.useChunkedEncodingByDefault = true;
  this.shouldSendDate = false;

  this._hasBody = true;
  this._trailer = '';

  this.finished = false;
}
sys.inherits(OutgoingMessage, events.EventEmitter);
exports.OutgoingMessage = OutgoingMessage;

// This abstract either writing directly to the socket or buffering it.
// Rename to _writeRaw() ?
OutgoingMessage.prototype._send = function (data, encoding) {
  // This is a shameful hack to get the headers and first body chunk onto
  // the same packet. Future versions of Node are going to take care of
  // this at a lower level and in a more general way.
  if (!this._headerSent) {
    if (typeof data === 'string') {
      data = this._header + data;
    } else {
      this.output.unshift(this._header);
      this.outputEncodings.unshift('ascii');
    }
    this._headerSent = true;
  }

  if (this.connection._outgoing[0] === this && this.connection.writable) {
    // There might be pending data in the this.output buffer.
    while (this.output.length) {
      if (!this.connection.writable) {
        this._buffer(data, encoding);
        return false;
      }
      var c = this.output.shift();
      var e = this.outputEncodings.shift();
      this.connection.write(c, e);
    }

    // Directly write to socket.
    return this.connection.write(data, encoding);
  } else {
    this._buffer(data, encoding);
    return false;
  }
};

OutgoingMessage.prototype._buffer = function (data, encoding) {
  // Buffer
  if (data.length === 0) return;

  var length = this.output.length;

  if (length === 0 || typeof data != 'string') {
    this.output.push(data);
    encoding = encoding || "ascii";
    this.outputEncodings.push(encoding);
    return false;
  }

  var lastEncoding = this.outputEncodings[length-1];
  var lastData = this.output[length-1];

  if ((lastEncoding === encoding) ||
      (!encoding && data.constructor === lastData.constructor)) {
    this.output[length-1] = lastData + data;
    return false;
  }

  this.output.push(data);
  encoding = encoding || "ascii";
  this.outputEncodings.push(encoding);

  return false;
};


OutgoingMessage.prototype._storeHeader = function (firstLine, headers) {
  var sentConnectionHeader = false;
  var sentContentLengthHeader = false;
  var sentTransferEncodingHeader = false;
  var sentDateHeader = false;

  // firstLine in the case of request is: "GET /index.html HTTP/1.1\r\n"
  // in the case of response it is: "HTTP/1.1 200 OK\r\n"
  var messageHeader = firstLine;
  var field, value;
  var self = this;

  function store(field, value) {
    messageHeader += field + ": " + value + CRLF;

    if (connectionExpression.test(field)) {
      sentConnectionHeader = true;
      if (closeExpression.test(value)) {
        self._last = true;
      } else {
        self.shouldKeepAlive = true;
      }

    } else if (transferEncodingExpression.test(field)) {
      sentTransferEncodingHeader = true;
      if (chunkExpression.test(value)) self.chunkedEncoding = true;

    } else if (contentLengthExpression.test(field)) {
      sentContentLengthHeader = true;

    } else if (dateExpression.test(field)) {
      sentDateHeader = true;
    }
  }

  if (headers) {
    var keys = Object.keys(headers);
    var isArray = (Array.isArray(headers));
    var i, l;

    for (i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      if (isArray) {
        field = headers[key][0];
        value = headers[key][1];
      } else {
        field = key;
        value = headers[key];
      }

      if (Array.isArray(value)) {
        for (i = 0, l = value.length; i < l; i++) {
          store(field, value[i]);
        }
      } else {
        store(field, value);
      }
    }
  }

  // Date header
  if (this.shouldSendDate == true && sentDateHeader == false) {
    messageHeader += "Date: " + utcDate() + CRLF;
  }

  // keep-alive logic
  if (sentConnectionHeader == false) {
    if (this.shouldKeepAlive &&
        (sentContentLengthHeader || this.useChunkedEncodingByDefault)) {
      messageHeader += "Connection: keep-alive\r\n";
    } else {
      this._last = true;
      messageHeader += "Connection: close\r\n";
    }
  }

  if (sentContentLengthHeader == false && sentTransferEncodingHeader == false) {
    if (this._hasBody) {
      if (this.useChunkedEncodingByDefault) {
        messageHeader += "Transfer-Encoding: chunked\r\n";
        this.chunkedEncoding = true;
      } else {
        this._last = true;
      }
    } else {
      // Make sure we don't end the 0\r\n\r\n at the end of the message.
      this.chunkedEncoding = false;
    }
  }

  this._header = messageHeader + CRLF;
  this._headerSent = false;
  // wait until the first body chunk, or close(), is sent to flush.
};


OutgoingMessage.prototype.sendBody = function () {
  throw new Error("sendBody() has been renamed to write(). ");
};


OutgoingMessage.prototype.write = function (chunk, encoding) {
  if (!this._header) {
    throw new Error("You have to call writeHead() before write()");
  }

  if (!this._hasBody) {
    console.error("This type of response MUST NOT have a body. Ignoring write() calls.");
    return true;
  }

  if (typeof chunk !== "string"
      && !Buffer.isBuffer(chunk)
      && !Array.isArray(chunk)) {
    throw new TypeError("first argument must be a string, Array, or Buffer");
  }

  if (chunk.length === 0) return false;

  var len, ret;
  if (this.chunkedEncoding) {
    if (typeof(chunk) === 'string') {
      len = Buffer.byteLength(chunk, encoding);
      var chunk = len.toString(16) + CRLF + chunk + CRLF;
      debug('string chunk = ' + sys.inspect(chunk));
      ret = this._send(chunk, encoding);
    } else {
      // buffer
      len = chunk.length;
      this._send(len.toString(16) + CRLF);
      this._send(chunk);
      ret = this._send(CRLF);
    }
  } else {
    ret = this._send(chunk, encoding);
  }

  debug('write ret = ' + ret);
  return ret;
};


OutgoingMessage.prototype.addTrailers = function (headers) {
  this._trailer = "";
  var keys = Object.keys(headers);
  var isArray = (Array.isArray(headers));
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    if (isArray) {
      field = headers[key][0];
      value = headers[key][1];
    } else {
      field = key;
      value = headers[key];
    }

    this._trailer += field + ": " + value + CRLF;
  }
};


OutgoingMessage.prototype.end = function (data, encoding) {
  var ret;

  var hot = this._headerSent === false
         && typeof(data) === "string"
         && data.length > 0
         && this.output.length === 0
         && this.connection.writable
         && this.connection._outgoing[0] === this
          ;

  if (hot) {
    // Hot path. They're doing
    //   res.writeHead();
    //   res.end(blah);
    // HACKY.
    if (this.chunkedEncoding) {
      var l = Buffer.byteLength(data, encoding).toString(16);
      ret = this.connection.write( this._header
                                 + l
                                 + CRLF
                                 + data
                                 + "\r\n0\r\n"
                                 + this._trailer
                                 + "\r\n"
                                 , encoding
                                 );
    } else {
      ret = this.connection.write(this._header + data, encoding);
    }
    this._headerSent = true;

  } else if (data) {
    // Normal body write.
    ret = this.write(data, encoding);
  }

  if (!hot) {
    if (this.chunkedEncoding) {
      ret = this._send('0\r\n' + this._trailer + '\r\n'); // Last chunk.
    } else if (!data) {
      // Force a flush, HACK.
      ret = this._send('');
    }
  }

  this.finished = true;

  // There is the first message on the outgoing queue, and we've sent
  // everything to the socket.
  if (this.output.length === 0 && this.connection._outgoing[0] === this) {
    debug('outgoing message end. shifting because was flushed');
    this.connection._onOutgoingSent();
  }

  return ret;
};


function ServerResponse (req) {
  OutgoingMessage.call(this, req.socket);

  if (req.method === 'HEAD') this._hasBody = false;

  this.shouldSendDate = true;

  if (req.httpVersionMajor < 1 || req.httpVersionMinor < 1) {
    this.useChunkedEncodingByDefault = false;
    this.shouldKeepAlive = false;
  }
}
sys.inherits(ServerResponse, OutgoingMessage);
exports.ServerResponse = ServerResponse;


ServerResponse.prototype.writeHead = function (statusCode) {
  var reasonPhrase, headers, headerIndex;

  if (typeof arguments[1] == 'string') {
    reasonPhrase = arguments[1];
    headerIndex = 2;
  } else {
    reasonPhrase = STATUS_CODES[statusCode] || "unknown";
    headerIndex = 1;
  }

  if (typeof arguments[headerIndex] == 'object') {
    headers = arguments[headerIndex];
  } else {
    headers = {};
  }

  var statusLine = "HTTP/1.1 " + statusCode.toString() + " "
                  + reasonPhrase + CRLF;

  if (statusCode === 204 || statusCode === 304) {
    // RFC 2616, 10.2.5:
    // The 204 response MUST NOT include a message-body, and thus is always
    // terminated by the first empty line after the header fields.
    // RFC 2616, 10.3.5:
    // The 304 response MUST NOT contain a message-body, and thus is always
    // terminated by the first empty line after the header fields.
    this._hasBody = false;
  }


  this._storeHeader(statusLine, headers);
};


ServerResponse.prototype.writeHeader = function () {
  this.writeHead.apply(this, arguments);
};

function ClientRequest (socket, method, url, headers) {
  OutgoingMessage.call(this, socket);

  this.method = method = method.toUpperCase();
  this.shouldKeepAlive = false;
  if (method === "GET" || method === "HEAD") {
    this.useChunkedEncodingByDefault = false;
  } else {
    this.useChunkedEncodingByDefault = true;
  }
  this._last = true;

  this._storeHeader(method + " " + url + " HTTP/1.1\r\n", headers);
}
sys.inherits(ClientRequest, OutgoingMessage);
exports.ClientRequest = ClientRequest;

ClientRequest.prototype.finish = function () {
  throw new Error( "finish() has been renamed to end() and no longer takes "
                 + "a response handler as an argument. Manually add a 'response' listener "
                 + "to the request object."
                 );
};


ClientRequest.prototype.end = function () {
  if (typeof arguments[0] == "function") {
    throw new Error( "ClientRequest.prototype.end does not take a callback. "
                   + "Add a 'response' listener manually to get the response."
                   );
  }
  OutgoingMessage.prototype.end.apply(this, arguments);
};


function outgoingFlush (socket) {
  // This logic is probably a bit confusing. Let me explain a bit:
  //
  // In both HTTP servers and clients it is possible to queue up several
  // outgoing messages. This is easiest to imagine in the case of a client.
  // Take the following situation:
  //
  //    req1 = client.request('GET', '/');
  //    req2 = client.request('POST', '/');
  //
  // The question is what happens when the user does
  //
  //   req2.write("hello world\n");
  //
  // It's possible that the first request has not been completely flushed to
  // the socket yet. Thus the outgoing messages need to be prepared to queue
  // up data internally before sending it on further to the socket's queue.
  //
  // This function, outgoingFlush(), is called by both the Server
  // implementation and the Client implementation to attempt to flush any
  // pending messages out to the socket.
  var message = socket._outgoing[0];

  if (!message) return;

  var ret;

  while (message.output.length) {
    if (!socket.writable) return; // XXX Necessary?

    var data = message.output.shift();
    var encoding = message.outputEncodings.shift();

    ret = socket.write(data, encoding);
  }

  if (message.finished) {
    socket._onOutgoingSent();
  } else if (ret) {
    message.emit('drain');
  }
}


function httpSocketSetup (socket) {
  // An array of outgoing messages for the socket. In pipelined connections
  // we need to keep track of the order they were sent.
  socket._outgoing = [];
  socket.__destroyOnDrain = false;

  // NOTE: be sure not to use ondrain elsewhere in this file!
  socket.ondrain = function () {
    var message = socket._outgoing[0];
    if (message) message.emit('drain');
    if (socket.__destroyOnDrain) socket.destroy();
  };
}



function Server (requestListener) {
  if (!(this instanceof Server)) return new Server(requestListener);
  net.Server.call(this);

  if(requestListener){
    this.addListener("request", requestListener);
  }

  this.addListener("connection", connectionListener);
}
sys.inherits(Server, net.Server);

Server.prototype.setSecure = function (credentials) {
  this.secure = true;
  this.credentials = credentials;
}

exports.Server = Server;

exports.createServer = function (requestListener) {
  return new Server(requestListener);
};

function connectionListener (socket) {
  var self = this;

  debug("new http connection");

  httpSocketSetup(socket);

  socket.setTimeout(2*60*1000); // 2 minute timeout
  socket.addListener('timeout', function () {
    socket.destroy();
  });

  var parser = parsers.alloc();
  parser.reinitialize('request');
  parser.socket = socket;

  if (self.secure) {
    socket.setSecure(self.credentials);
  }

  socket.addListener('error', function (e) {
    self.emit('clientError', e);
  });

  socket.ondata = function (d, start, end) {
    var ret = parser.execute(d, start, end - start);
    if (ret instanceof Error) {
      socket.destroy(ret);
    } else if (parser.incoming && parser.incoming.upgrade) {
      var bytesParsed = ret;
      socket.ondata = null;
      socket.onend = null;

      var req = parser.incoming;

      // This is start + byteParsed + 1 due to the error of getting \n
      // in the upgradeHead from the closing lines of the headers
      var upgradeHead = d.slice(start + bytesParsed + 1, end);

      if (self.listeners("upgrade").length) {
        self.emit('upgrade', req, req.socket, upgradeHead);
      } else {
        // Got upgrade header, but have no handler.
        socket.destroy();
      }
    }
  };

  socket.onend = function () {
    parser.finish();

    if (socket._outgoing.length) {
      socket._outgoing[socket._outgoing.length-1]._last = true;
      outgoingFlush(socket);
    } else {
      socket.end();
    }
  };

  socket.addListener('close', function () {
    // unref the parser for easy gc
    parsers.free(parser);
  });

  // At the end of each response message, after it has been flushed to the
  // socket.  Here we insert logic about what to do next.
  socket._onOutgoingSent = function (message) {
    var message = socket._outgoing.shift();
    if (message._last) {
      // No more messages to be pushed out.

      // HACK: need way to do this with socket interface
      if (socket._writeQueue.length) {
        socket.__destroyOnDrain = true; //socket.end();
      } else {
        socket.destroy();
      }

    } else if (socket._outgoing.length) {
      // Push out the next message.
      outgoingFlush(socket);
    }
  };

  // The following callback is issued after the headers have been read on a
  // new message. In this callback we setup the response object and pass it
  // to the user.
  parser.onIncoming = function (req, shouldKeepAlive) {
    var res = new ServerResponse(req);
    debug('server response shouldKeepAlive: ' + shouldKeepAlive);
    res.shouldKeepAlive = shouldKeepAlive;
    socket._outgoing.push(res);

    self.emit('request', req, res);
    return false; // Not a HEAD response. (Not even a response!)
  };
}


function Client ( ) {
  if (!(this instanceof Client)) return new Client();
  net.Stream.call(this);
  var self = this;

  httpSocketSetup(self);

  var parser;

  function initParser () {
    if (!parser) parser = parsers.alloc();
    parser.reinitialize('response');
    parser.socket = self;
    parser.onIncoming = function (res) {
      debug("incoming response!");

      var req = self._outgoing[0];

      // Responses to HEAD requests are AWFUL. Ask Ryan.
      // A major oversight in HTTP. Hence this nastiness.
      var isHeadResponse = req.method == "HEAD";
      debug('isHeadResponse ' + isHeadResponse);
      
      if (req.shouldKeepAlive && res.headers.connection === 'close') {
        req.shouldKeepAlive = false;
      }

      res.addListener('end', function ( ) {
        debug("request complete disconnecting. readyState = " + self.readyState);
        // For the moment we reconnect for every request. FIXME!
        // All that should be required for keep-alive is to not reconnect,
        // but outgoingFlush instead.
        if (req.shouldKeepAlive) {
          outgoingFlush(self)
          self._outgoing.shift()
          outgoingFlush(self)
        } else {
          self.end();
        }
      });

      req.emit("response", res);

      return isHeadResponse;
    };
  };

  function onData(d, start, end) {
    if (!parser) {
      throw new Error("parser not initialized prior to Client.ondata call");
    }
    var ret = parser.execute(d, start, end - start);
    if (ret instanceof Error) {
      self.destroy(ret);
    } else if (parser.incoming && parser.incoming.upgrade) {
      var bytesParsed = ret;
      self.ondata = null;
      self.onend = null

      var req = parser.incoming;

      var upgradeHead = d.slice(start + bytesParsed + 1, end);

      if (self.listeners('upgrade').length) {
        self.emit('upgrade', req, self, upgradeHead);
      } else {
        self.destroy();
      }
    }
  };

  self.addListener("connect", function () {
    debug('client connected');

    self.ondata = onData;
    self.onend = onEnd;

    if (this.https) {
      this.setSecure(this.credentials);
    } else {
      initParser();
      debug('requests: ' + sys.inspect(self._outgoing));
      outgoingFlush(self);
    }
  });

  self.addListener("secure", function () {
    initParser();
    debug('requests: ' + sys.inspect(self._outgoing));
    outgoingFlush(self);
  });

  function onEnd() {
    if (parser) parser.finish();
    debug("self got end closing. readyState = " + self.readyState);
    self.end();
  };

  self.addListener("close", function (e) {
    if (e) return;

    debug("HTTP CLIENT onClose. readyState = " + self.readyState);

    // finally done with the request
    self._outgoing.shift();

    // If there are more requests to handle, reconnect.
    if (self._outgoing.length) {
      self._reconnect();
    } else if (parser) {
      parsers.free(parser);
      parser = null;
    }
  });
};
sys.inherits(Client, net.Stream);

exports.Client = Client;

exports.createClient = function (port, host, https, credentials) {
  var c = new Client();
  c.port = port;
  c.host = host;
  c.https = https;
  c.credentials = credentials;
  return c;
};


// This is called each time a request has been pushed completely to the
// socket. The message that was sent is still sitting at client._outgoing[0]
// it is our responsibility to shift it off.
//
// We have to be careful when it we shift it because once we do any writes
// to other requests will be flushed directly to the socket.
//
// At the moment we're implement a client which connects and disconnects on
// each request/response cycle so we cannot shift off the request from
// client._outgoing until we're completely disconnected after the response
// comes back.
Client.prototype._onOutgoingSent = function (message) {
  // We've just finished a message. We don't end/shutdown the connection here
  // because HTTP servers typically cannot handle half-closed connections
  // (Node servers can).
  //
  // Instead, we just check if the connection is closed, and if so
  // reconnect if we have pending messages.
  if (this._outgoing.length && this.readyState == "closed") {
    debug("HTTP client request flush. reconnect.  readyState = " + this.readyState);
    this._reconnect();
  }
};


Client.prototype._reconnect = function () {
  if (this.readyState === "closed") {
    debug("HTTP CLIENT: reconnecting readyState = " + this.readyState);
    this.connect(this.port, this.host);
  }
};


Client.prototype.get = function () {
  throw new Error("client.get(...) is now client.request('GET', ...)");
};

Client.prototype.head = function () {
  throw new Error("client.head(...) is now client.request('HEAD', ...)");
};

Client.prototype.post = function () {
  throw new Error("client.post(...) is now client.request('POST', ...)");
};

Client.prototype.del = function () {
  throw new Error("client.del(...) is now client.request('DELETE', ...)");
};

Client.prototype.put = function () {
  throw new Error("client.put(...) is now client.request('PUT', ...)");
};

Client.prototype.request = function (method, url, headers) {
  if (typeof(url) != "string") {
    // assume method was omitted, shift arguments
    headers = url;
    url = method;
    method = "GET";
  }
  var req = new ClientRequest(this, method, url, headers);
  this._outgoing.push(req);
  if (this.readyState === 'closed') this._reconnect();
  return req;
};


exports.cat = function (url, encoding_, headers_) {
  var encoding = 'utf8',
      headers = {},
      callback = null;

  // parse the arguments for the various options... very ugly
  if (typeof(arguments[1]) == 'string') {
    encoding = arguments[1];
    if (typeof(arguments[2]) == 'object') {
      headers = arguments[2];
      if (typeof(arguments[3]) == 'function') callback = arguments[3];
    } else {
      if (typeof(arguments[2]) == 'function') callback = arguments[2];
    }
  } else {
    // didn't specify encoding
    if (typeof(arguments[1]) == 'object') {
      headers = arguments[1];
      callback = arguments[2];
    } else {
      callback = arguments[1];
    }
  }

  var url = require("url").parse(url);

  var hasHost = false;
  if (Array.isArray(headers)) {
    for (var i = 0, l = headers.length; i < l; i++) {
      if (headers[i][0].toLowerCase() === 'host') {
        hasHost = true;
        break;
      }
    }
  } else if (typeof headers === "Object") {
    var keys = Object.keys(headers);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      if (key.toLowerCase() == 'host') {
        hasHost = true;
        break;
      }
    }
  }
  if (!hasHost) headers["Host"] = url.hostname;

  var content = "";

  var client = exports.createClient(url.port || 80, url.hostname);
  var req = client.request((url.pathname || "/")+(url.search || "")+(url.hash || ""), headers);

  if (url.protocol=="https:") {
      client.https = true;
  }

  var callbackSent = false;

  req.addListener('response', function (res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (callback && !callbackSent) {
        callback(res.statusCode);
        callbackSent = true;
      }
      client.end();
      return;
    }
    res.setEncoding(encoding);
    res.addListener('data', function (chunk) { content += chunk; });
    res.addListener('end', function () {
      if (callback && !callbackSent) {
        callback(null, content);
        callbackSent = true;
      }
    });
  });

  client.addListener("error", function (err) {
    if (callback && !callbackSent) {
      callback(err);
      callbackSent = true;
    }
  });

  client.addListener("close", function () {
    if (callback && !callbackSent) {
      callback(new Error('Connection closed unexpectedly'));
      callbackSent = true;
    }
  });
  req.end();
};

var date_cache;
utcDate = function () {
  if (! date_cache) {
    var d = new Date();
    date_cache = d.toUTCString();
    setTimeout(function () {
      date_cache = undefined;
    }, 1000 - d.getMilliseconds());
  }
  return date_cache;
}
