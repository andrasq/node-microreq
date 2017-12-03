micro-request
=============

Very thin convenience wrapper around http `request` to make it usable more like
[`request`](https://npmjs.com/package/request) but without the size or speed overhead.


Api
---

### req = request( uri, [body,] callback(err, res, body) )

Make an http or https request to the given url.

`uri` can be a string url for a GET request, or an options object with settings for
`http[s].request`.  If a string, it must not be `""` empty.  Settings in the uri
object override url properties parsed from `uri.url`.

`body` is optional, if provided it will be sent in the request body.  Strings and Buffers
are sent as-is, all else is JSON encoded first.

`request` returns the `req` request object, and calls the callback on error, or with res
and the gathered body once the response has been received.


Options:

- url - web address string to call to.  If provided, it must not be blank.  To make a call
  to the all-defaults webpage `GET http://localhost:80/`, use the empty uri `{}`.
- body - body to send, if any.

The above options control the behavior of `micro-request`; All other options are send
on to `http`.


Todo
----

- option to not send the body, but let the caller write data to the returned `req`
- option to not wait for the response, but let the caller gather or pipe `res`


Related Work
------------

- `http`
- `khttp`
- `qhttp`
- `request`
