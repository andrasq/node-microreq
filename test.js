/**
 * Copyright (C) 2017 Kinvey, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');

var qmock = require('qnit').qmock;
var request = require('./');

module.exports = {
    afterEach: function(done) {
        qmock.unmockHttp();
        done();
    },

    'package': {
        'should export a function taking 3 parameters': function(t) {
            t.equal(typeof request, 'function');
            t.equal(request.length, 3);
            t.done();
        },
    },

    'request should invoke request.request': function(t) {
        t.mockHttp().when(/^/).send(200);
        var spy = t.stubOnce(request, 'request');
        var url = "http://host/path", cb;
        request(url, cb = function(err, res, body){
            t.equal(spy.callCount, 1);
            t.done();
        })
        spy.restore();
        t.equal(spy.callCount, 1);
        t.strictEqual(spy.callArguments[0], 'http://host/path');
        t.strictEqual(spy.callArguments[1], cb);
        t.strictEqual(spy.callArguments[2], undefined);
        t.done();
    },

    'httpRequest': {
        'should invoke http.request': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            request('http://localhost1', function(){
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    hostname: 'localhost1',
                })
                t.done();
            })
            setImmediate(function() {
            })
        },

        'should invoke https.request': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(https, 'request');
            request('https://localhost2', function(){
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments, {
                    hostname: 'localhost2',
                })
                t.done();
            })
        },

        'should accept and parse string url': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            request('http://usern:passw@localhost:1337/path/name?a=12&b=34#hash5', function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                })
                t.done();
            })
        },

        'should accept object url': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            var uri = { url: 'http://localhost:1337/path/name?a=12&b=34#hash5', auth: 'usern:passw', headers: { 'X-Unit-Test': '789A' } };
            request(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                })
                t.contains(spy.callArguments[0].headers, { 'X-Unit-Test': '789A' });
                t.done();
            })
        },

        'should not set uri properties to undefined parsed properties': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(https, 'request');
            var uri = { url: "https://otherhost:1337" };
            request(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'https:',
                    hostname: 'otherhost'
                })
                t.ok(! ('url' in spy.callArguments[0]));
                t.ok(! ('query' in spy.callArguments[0]));
                t.ok(! ('hash' in spy.callArguments[0]));
                t.done();
            })
        },

        'should call with the parsed url properties': function(t) {
            var reqOptions;
            t.mockHttp()
                .when(/^/)
                    .compute(function(req, res, next) {
                        reqOptions = req._options;
                        next();
                    })
            ;
            var uri = { method: 'POST', protocol: 'http:', hostname: 'somehost', query: 'b=2', hash: 'somehash', other: 'other' };
            uri.url = 'https://otherhost:1337/path/name?a=1#otherhash';
            request(uri, function(err, res, body) {
                t.contains(reqOptions, {
                    method: 'POST',
                    other: 'other',
                    protocol: 'https:',
                    hostname: 'otherhost',
                    port: 1337,
                    path: '/path/name?a=1',
                })
                t.done();
            })
        },

        'should accept string body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = request('http://localhost', 'test req body', function(err, res, body) {
                t.equal(typeof req._mockWrites[0][0], 'string');
                t.equal(req._mockWrites[0][0], 'test req body');
                t.done();
            })
        },

        'should accept buffer body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = request('http://somehost', new Buffer('test req body'), function(err, res, body) {
                t.ok(Buffer.isBuffer(req._mockWrites[0][0]));
                t.equal(String(req._mockWrites[0][0]), 'test req body');
                t.done();
            })
        },

        'should accept object body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = request('http://somehost', { testBody: 'test req body' }, function(err, res, body) {
                t.equal(typeof req._mockWrites[0][0], 'string');
                t.equal(req._mockWrites[0][0], JSON.stringify({ testBody: 'test req body'}));
                t.done();
            })
        },

        'should make call to all-defaults uri': function(t) {
            // the url "" is a valid url, it uses all defaults -- http://localhost:80/
            // and returns the response if there is a localhost http server running.
            // Or errors out if not.  This test just runs all branch points of the code.
            request({}, function(err, res, body) {
                t.done();
            })
        },

        'should return gathered response raw': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', new Buffer('test '));
                        res.emit('data', new Buffer('response'));
                        res.emit('end');
                    })
            ;
            request('http://some/url', function(err, res, body) {
                t.ifError(err);
                t.ok(Buffer.isBuffer(body));
                t.equal(body.toString(), 'test response');
                t.done();
            })
        },

        'should return only once': function(t) {
            t.mockHttp()
                .when('http://host/path')
                    .send(200, 'test response')
            ;
            var returnCount = 0;
            var req = request('http://host/path', function(err, res, body) {
                returnCount += 1;
                t.ok(!err);
                t.equal(returnCount, 1);
                if (res) res.emit('error', new Error('not sure if res emits error'));
                if (res) res.emit('end');
                setTimeout(function(){ t.done() }, 10);
            })
            setTimeout(function(){ req.emit('error', new Error('test error')) }, 2);
            setTimeout(function(){ req.emit('error', new Error('test error')) }, 3);
        },

        'should return without response if noResListen': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .send(200, 'test response')
            ;
            t.expect(2);
            var req = request({
                url: 'http://some/url',
                noResListen: true,
            }, function(err, res, body) {
                t.strictEqual(body, undefined);
                res.on('data', function(chunk) {
                    t.equal(String(chunk), 'test response');
                })
                res.on('end', function() {
                    t.done();
                })
            })
        },

        'alt should return without ending call if noReqEnd': function(t) {
            t.mockHttp()
                .when('http://host/path')
                    .send(200, 'test response')
            ;
            var spy;
            var req = request({
                url: 'http://host/path',
                body: 'test data',
                noReqEnd: true,
            }, function(err, res, body) {
                t.deepEqual(req._mockWrites, [['test data', undefined], ['more test data', 'utf8'], null]);
                t.equal(String(body), 'test response');
                t.equal(spy.callCount, 1);
                t.done();
            })
            spy = t.spy(req, 'end');
            req.write('more test data', 'utf8');
            req.end();
        },

        'errors': {
            'should require callback': function(t) {
                try { request("https://localhost") }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should require uri': function(t) {
                try { request("", function(){}) }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should return req errors': function(t) {
                t.mockHttp()
                    .when('http://host/path')
                        .send(200, 'test response')
                ;
                var req = request('http://host/path', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.message, 'req error');
                    t.done();
                })
                req.emit('error', new Error('req error'));
            },

            'should return res errors': function(t) {
                t.mockHttp()
                    .when('http://host/path')
                    .emit('error', new Error('res error'))
                ;
                request('http://host/path', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.message, 'res error');
                    t.done();
                })
            },
        },
    },
};
