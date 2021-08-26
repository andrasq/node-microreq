/**
 * Copyright (C) 2017-2019 Kinvey, Inc., 2020-2021 Andras Radics
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
module.exports.defaults = defaults;

var microreqOptions = { url:1, body:1, headers:1, noReqEnd:1, noResListen:1, encoding:1, timeout:1, auth:1, baseUrl:1, };
var urlBlankFields = { protocol: null, hostname: null, port: null, path: null, pathname: null };
function tryJsonParse(str) { try { return JSON.parse(str) } catch (e) { return str.toString('utf8') } }
var fromBuf = eval('parseInt(process.versions.node) >= 7 ? Buffer.from : Buffer');

/*
 * make an http request, return the response
 * Very simple wrapper around http.request to make it more conveient to use.
 * Uri can be a url string or the options to pass to http.request, with a few extra
 * recognized settings eg 'url', 'body', 'encoding' (that are not passed).
 * makeError and readBody adapted from qibl 1.5.0-pre
 */
function microreq( uri, body, callback ) {
    if (!callback) { callback = body; body = undefined }
    body = (body != undefined) ? body : (uri.body != undefined) ? uri.body : undefined;
    if (!uri || !callback) throw new Error("uri and callback required");
    if (typeof uri !== 'object') uri = { url: String(uri) };

    var requestOptions = { headers: {} }, noReqEnd = uri.noReqEnd, noResListen = uri.noResListen, encoding = uri.encoding;
    for (var k in uri) if (!(microreqOptions[k])) requestOptions[k] = uri[k];
    for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];
    if (uri.auth) requestOptions.auth = (typeof uri.auth === 'string') ? uri.auth
        : (uri.auth.username || uri.auth.user) + ':' + (uri.auth.password || uri.auth.pass);

    if (uri.url != undefined) {
        // copy pathmame too for older qnit mockHttp(); nodejs ignores it
        var urlParts = Url.parse(buildUrl(uri.baseUrl, uri.url));
        for (var k in urlBlankFields) if (urlParts[k] != null) requestOptions[k] = urlParts[k];
        if (requestOptions.auth === undefined) requestOptions.auth = urlParts.auth; // uri.auth overrides the url
    }
    if (requestOptions.auth) requestOptions.headers['Authorization'] = 'Basic ' + fromBuf(requestOptions.auth).toString('base64');

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    if (noReqEnd) requestOptions.headers['Transfer-Encoding'] = 'chunked';
    else requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body ? body.length : 0;

    var req, doneCount = 0, maxRedirects = 10, body, connected = false, onError = function onError(err) {
        if (!err) { !connected ? req.abort() : req.socket.destroy() }
        if (!err) var timeoutErr =  !connected ? makeError('ETIMEDOUT', 'connect timeout') : makeError('ESOCKETTIMEDOUT', 'data timeout');
        if (!err && noResListen) req.emit('error', timeoutErr); // if callback already called emit the error on req
        else doCallback(timeoutErr || makeError(err.code || 'ERES', err));
    }
    var timer = uri.timeout >= 0 && setTimeout(onError, uri.timeout);
    function doCallback(err, res, body) { timer && clearTimeout(timer); if (!doneCount++) callback(err, res, body) }

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    req = httpCaller.request(requestOptions, function onConnect(res) {
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
            var resBody = !chunk1 ? data : !chunks ? chunk1 : Buffer.concat(chunks);
            if (encoding) resBody = (encoding === 'json') ? tryJsonParse(resBody) : (typeof resBody !== 'string') ? resBody.toString(encoding) : resBody;
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                clearTimeout(timer);  // NOTE: redirect location must include the query and hash
                if (uri.maxRedirects <= 0) return doCallback(makeError('REDIRECT', 'too many redirects'));
                var caller = defaults(mergeOpts(uri, res.headers.location[0] === '/'
                    ? { baseUrl: buildBaseUrl(urlParts || uri) } : mergeOpts({ baseUrl: null }, urlBlankFields),
                    { body: body, maxRedirects: +uri.maxRedirects - 1, url: res.headers.location })
                );;
                caller.request({}, callback);
            } else doCallback(null, res, resBody);
        })
        res.on('error', onError);
    })
    req.on('error', onError);

    if (body !== undefined) noReqEnd ? req.write(body) : req.end(body)  // faster to just end than to write + end
    else if (!noReqEnd) req.end();

    return req;
}

function defaults( options ) {
    if (!options || typeof options === 'string') options = { url: options || '' };
    var caller = {
        _opts: mergeOpts({}, options),
        call: function(method, uri, body, cb) {
            if (typeof uri !== 'object') uri = (typeof uri === 'string' && uri) ? { url: uri } : {};
            return module.exports.request(mergeOpts({}, caller._opts, uri, { method: method }), body, cb);
        },
        request: function request(uri, body, cb) { return caller.call(uri.method, uri, body, cb) },
        defaults: function(options) { return defaults(mergeOpts(caller._opts, options)) },
        get: function get(url, body, cb) { return caller.call('GET', url, body, cb) },
        head: function del(url, body, cb) { return caller.call('HEAD', url, body, cb) },
        post: function post(url, body, cb) { return caller.call('POST', url, body, cb) },
        put: function put(url, body, cb) { return caller.call('PUT', url, body, cb) },
        patch: function patch(url, body, cb) { return caller.call('PATCH', url, body, cb) },
        del: function del(url, body, cb) { return caller.call('DELETE', url, body, cb) },
    }
    caller.delete = caller.del;
    return caller;
}
function rtrim(str, ch) { while (str && str.slice(-1) === ch) str = str.slice(0, -1); return str }
function buildUrl( baseUrl, pathUrl ) { return baseUrl && (!pathUrl || pathUrl[0] === '/') ? rtrim(baseUrl, '/') + pathUrl : pathUrl }
function buildBaseUrl( uri ) { return (uri.protocol || 'http:') + '//' + (uri.hostname || 'localhost') + (uri.port ? ':' + uri.port : '') }
function mergeOpts( dst, src1 /* ...VARARGS */ ) {
    for (var si = 1; si < arguments.length; si++) {
        var src = arguments[si], keys = Object.keys(src || {});
        for (var i = 0; i < keys.length; i++) dst[keys[i]] =
            (keys[i] !== 'headers') ? src[keys[i]] : mergeOpts(dst[keys[i]] || {}, src[keys[i]]);
    }
    return dst;
}

function makeError( code, message, baseFunc ) {
    var err = typeof message === 'object' ? message : (err = new Error(message), Error.captureStackTrace(err, baseFunc), err);
    return (err.code = code, err);
}
