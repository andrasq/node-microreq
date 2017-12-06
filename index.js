/**
 * Copyright (C) 2017 Kinvey, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');
var Url = require('url');

function request( uri, body, callback ) {
    return request.request(uri, body, callback);
};
request.request = httpRequest;

module.exports = request;

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

    var requestOptions = { headers: {} }, options = {};
    if (typeof uri === 'object') {
        for (var k in uri) {
            if (k !== 'url' && k !== 'body' && k !== 'headers' && k !== 'noReqEnd' && k !== 'noResListen' && k !== 'encoding') requestOptions[k] = uri[k];
            else options[k] = uri[k];
        }
        for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];
    }

    var urlParts, url = (typeof uri === 'string') ? uri : uri.url;
    // TODO: copy pathmame too for older qnit mockHttp(); nodejs ignores it
    if (url != undefined) for (var k in (urlParts = Url.parse(url), { protocol:1, hostname:1, port:1, path:1, pathname:1 })) {
        if (urlParts[k] != null) requestOptions[k] = urlParts[k];
    }

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    if (options.noReqEnd) requestOptions.headers['Transfer-Encoding'] = 'chunked';
    else requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body ? body.length : 0;

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    var returned = 0, callbackOnce = function( err, res, body ) { if (!returned++) callback(err, res, body) };
    var req = httpCaller.request(requestOptions, function(res) {
        if (options.noResListen) return callbackOnce(null, res);
        var chunks = [];
        res.on('data', function(chunk) {
            chunks.push(chunk);
        })
        res.on('end', function() {
            var body = decodeBody(chunks, options.encoding);
            callbackOnce(body instanceof Error ? body : null, res, body instanceof Error ? chunks : body);
        })
        res.on('error', function(err) {
            callbackOnce(err, res);
        })
    })
    req.on('error', function(err) {
        callbackOnce(err);
    })

    if (body !== undefined) req.write(body);
    if (!options.noReqEnd) req.end();

    return req;
}

function decodeBody( chunks, encoding ) {
    if (!encoding) return Buffer.concat(chunks);
    try { return Buffer.concat(chunks).toString(encoding) }
    catch (err) { return err }
}
