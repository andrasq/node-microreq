microreq
========
[![Build Status](https://api.travis-ci.org/andrasq/node-microreq.svg?branch=master)](https://travis-ci.org/andrasq/node-microreq?branch=master)
[![Coverage Status](https://codecov.io/github/andrasq/node-microreq/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-microreq?branch=master)


Extremely thin convenience wrapper around `http.request` to make it usable more like
[`request`](https://npmjs.com/package/request) but without the size, speed or cpu
overhead.  No frills, just convenience.

    var request = require('microreq');

    var req = request("https://github.com/andrasq", function(err, res, body) {
        // err is any socket error
        // res is the http response object
        // body is a buffer
    })


Api
---

### req = request( uri, [body,] callback(err, res, body) )

Make an http or https request to the given url.

`uri` can be a url string for a GET request, or an options object with settings for
`http/https.request`.  If a string, it must not be `''` empty.  If an object, it can
have a property `url` with the url string to call.  Properties read from the url string
(`protocol`, `host`, `path`, and possibly `port`) override properties in `uri`.
To specify the all-defaults webpage "GET http://localhost:80/", use the empty uri `{}`.

`body` is optional, if provided it will be sent in the request as the payload.  If not
provided, `req.write()` will not be called.  Strings and Buffers are sent as-is, all
else is JSON encoded first.

`request` returns the `req` request object, and calls the callback.  `callback` will
receive any emitted error, the response object, and the gathered response body in a
Buffer.  The exact behavior can be tuned with the `noResListen` and `noReqEnd` options.

Options that control the behavior of `microreq` (all other options are passed to `http`):

- `url` - web address string to call to.  If provided, it must not be the empty string `''`.
- `body` - body to send, if any.  A body passed as a function argument takes precedence.
- `encoding` - if set, convert the response to a string of this encoding.  The default is
     to return the raw data in buffers.  Only the final `body` is decoded, not the
     `on data` callbacks.
- `noReqEnd` - do not call `req.end()` after writing the body, let the caller append
     more data.  This also sends a `Transfer-Encoding: chunked` request header.
     The caller is reponsible for calling `req.end` to launch the call.
- `noResListen` - return as soon as the response header arrives, let the caller listen
    for the `res` `'data'` and `'end'` events


Change Log
----------

- 0.10.0 - `encoding` option
- 0.9.0 - first release

Todo
----


Related Work
------------

- [`http`](https://nodejs.org/dist/latest/docs/api/http.html) - nodejs http
- [`khttp`](https://github.com/andrasq/node-k-http) - fast mini request
- [`qhttp`](https://npmjs.com/package/qhttp) - fast http convenience utils
- [`request`](https://npmjs.com/package/request) - old featureful request
