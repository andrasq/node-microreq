'use strict';

var http = require('http');
var https = require('https');
var Url = require('url');


module.exports = httpRequest;


// url properties to send along from the uri to http
// we need at least { protocol:1, auth:1, hostname:1, port:1, query:1, path:1, hash:1, href:1 }
var urlProperties = Url.parse("");

/*
 * make an http request, return the response
 * Very simple wrapper around http.request to make it more conveient to use.
 * Uri can be a url string or the options to pass to http.request, with two more
 * recognized fields 'url' and 'body' (that are not passed).
 */
function httpRequest( uri, body, callback ) {
    if (!callback) {
        callback = body;
        body = undefined;
    }
    body = (body != undefined) ? body : uri.body || '';
    if (!uri || !callback) throw new Error("uri and callback required");

    var requestOptions = { headers: {} };
    for (var k in typeof uri === 'object' && uri) if (k !== 'url' && k !== 'body' && k !== 'headers') requestOptions[k] = uri[k];
    for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];

    var urlParts = Url.parse((typeof uri === 'string') ? uri : (uri.url || ""));
    for (var k in { protocol:1, auth:1, hostname:1, port:1, query:1, path:1, hash:1, href:1 }) {
        if (urlParts[k] != null) requestOptions[k] = urlParts[k];
    }

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body.length;

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    var req = httpCaller.request(requestOptions, function(res) {
        var chunks = [];
        res.on('data', function(chunk) {
            chunks.push(chunk);
        })
        res.on('end', function() {
            callback(null, res, Buffer.concat(chunks));
        })
    })
    req.on('error', function(err) {
        callback(err);
    })

    req.write(body);
    req.end();

    return req;
}
