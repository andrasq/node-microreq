/**
 * Copyright (C) 2017 Kinvey, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');
var Url = require('url');

module.exports = request;

function request( uri, body, callback ) {
    return request.request(uri, body, callback);
};
request.request = httpRequest;

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
    body = (body != undefined) ? body : (uri.body != undefined) ? uri.body : undefined;
    if (!uri || !callback) throw new Error("uri and callback required");

    var requestOptions = { headers: {} };
    if (typeof uri === 'object') {
        for (var k in uri) if (k !== 'url' && k !== 'body' && k !== 'headers' && k !== 'noReqEnd' && k !== 'noResListen') requestOptions[k] = uri[k];
        for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];
    }

    var urlParts, url = (typeof uri === 'string') ? uri : uri.url;
    // TODO: copy pathmame too for older qnit mockHttp(); nodejs ignores it
    if (url != undefined) for (var k in (urlParts = Url.parse(url), { protocol:1, hostname:1, port:1, path:1, pathname:1 })) {
        if (urlParts[k] != null) requestOptions[k] = urlParts[k];
    }

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    if (uri.noReqEnd) requestOptions.headers['Transfer-Encoding'] = 'chunked';
    else requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body ? body.length : 0;

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    var returned = 0, callbackOnce = function( err, res, body ) { if (!returned++) callback(err, res, body) };
    var req = httpCaller.request(requestOptions, function(res) {
        if (uri.noResListen) return callbackOnce(null, res);
        var chunks = [];
        res.on('data', function(chunk) {
            chunks.push(chunk);
        })
        res.on('end', function() {
            callbackOnce(null, res, Buffer.concat(chunks));
        })
        res.on('error', function(err) {
            callbackOnce(err, res);
        })
    })
    req.on('error', function(err) {
        callbackOnce(err);
    })

    if (body !== undefined) req.write(body);
    if (!uri.noReqEnd) req.end();

    return req;
}
