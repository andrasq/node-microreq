/**
 * Copyright (C) 2017-2019 Kinvey, Inc., 2020 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');
var Url = require('url');

module.exports = function request(uri, body, cb) { return request.request(uri, body, cb) };
module.exports.request = microreq;

var microreqOptions = {url:1, body:1, headers:1, noReqEnd:1, noResListen:1, encoding:1, timeout:1};
function tryJsonParse(str) { try { return JSON.parse(str) } catch (e) { return str.toString('utf8') } }

/*
 * make an http request, return the response
 * Very simple wrapper around http.request to make it more conveient to use.
 * Uri can be a url string or the options to pass to http.request, with a few extra
 * recognized settings eg 'url', 'body', 'encoding' (that are not passed).
 * makeError and readBody adapted from qibl 1.5.0-pre
 */
function microreq( uri, body, callback ) {
    if (!callback) {
        callback = body;
        body = undefined;
    }
    body = (body != undefined) ? body : (uri.body != undefined) ? uri.body : undefined;
    if (!uri || !callback) throw new Error("uri and callback required");

    var requestOptions = { headers: {} }, noReqEnd = uri.noReqEnd, noResListen = uri.noResListen, encoding = uri.encoding;
    if (typeof uri === 'object') {
        for (var k in uri) if (!(microreqOptions[k])) requestOptions[k] = uri[k];
        for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];
    }

    var urlParts, url = (typeof uri === 'string') ? uri : uri.url;
    // copy pathmame too for older qnit mockHttp(); nodejs ignores it
    if (url != undefined) for (var k in (urlParts = Url.parse(url), { protocol:1, hostname:1, port:1, path:1, pathname:1 })) {
        if (urlParts[k] != null) requestOptions[k] = urlParts[k];
    }

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    if (noReqEnd) requestOptions.headers['Transfer-Encoding'] = 'chunked';
    else requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body ? body.length : 0;

    var req, doneCount = 0, body, connected = false, onError = function onError(err) {
        if (!err) { !connected ? req.abort() : req.socket.destroy() }
        if (!err) var timeoutErr =  !connected ? makeError('ETIMEDOUT', 'connect timeout') : makeError('ESOCKETTIMEDOUT', 'data timeout');
        if (!err && noResListen) req.emit('error', timeoutErr); // if callback already called emit the error on req
        else doCallback(timeoutErr || makeError(err.code || 'ERES', err));
    }
    var timer = uri.timeout >= 0 && setTimeout(onError, uri.timeout);
    function doCallback(err, res, body) { timer && clearTimeout(timer); if (!doneCount++) callback(err, res, body) }

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    req = httpCaller.request(requestOptions, function(res) {
        connected = true;
        if (encoding && encoding !== 'json' && res.setEncoding) res.setEncoding(encoding);
        if (noResListen) return (!doneCount++ && callback(null, res));  // direct callback to not cancel timeouts
        var chunk1, chunks, data = '', body;
        res.on('data', function(chunk) {
            if (typeof chunk === 'string') data += chunk;
            else if (!chunk1) chunk1 = chunk;
            else if (!chunks) chunks = new Array(chunk1, chunk);
            else chunks.push(chunk);
        })
        res.on('end', function() {
            var body = !chunk1 ? data : !chunks ? chunk1 : Buffer.concat(chunks);
            if (encoding) body = (encoding === 'json') ? tryJsonParse(body) : (typeof body !== 'string') ? body.toString(encoding) : body;
            doCallback(null, res, body);
        })
        res.on('error', onError);
    })
    req.on('error', onError);

    if (body !== undefined) noReqEnd ? req.write(body) : req.end(body)  // faster to just end than to write + end
    else if (!noReqEnd) req.end();

    return req;
}

function makeError( code, message, baseFunc ) {
    var err = typeof message === 'object' ? message : (err = new Error(message), Error.captureStackTrace(err, baseFunc), err);
    return (err.code = code, err);
}
