/**
 * Copyright (C) 2017 Kinvey, Inc., 2020-2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');

var qmock = require('qmock');
var request = require('./');

// fromBuf adapted from qibl
var fromBuf = eval('parseInt(process.versions.node) >= 6 ? Buffer.from : Buffer');

var echoServer = http.createServer(function(req, res) {
    req.resume();
    req.on('end', function() {
        switch (req.url) {
        case '/utf8':
            res.write('utf8 ');
            res.end('response');
            break;
        case '/slowres':
            res.write('ok');
            setTimeout(function() { res.end() }, 200);
            break;
        default:
            res.statusCode = 404;
            res.end();
        }
    })
})

module.exports = {
    before: function(done) {
        echoServer.on('listening', done);
        echoServer.listen(1337);
    },

    after: function(done) {
        echoServer.close();
        done();
    },

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

    'microreq': {
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
                t.contains(spy.callArguments[0].headers.Authorization, 'Basic ' + fromBuf('usern:passw').toString('base64'));
                t.done();
            })
        },

        'options.auth': {
            'string': function(t) {
                var spy = t.spyOnce(http, 'request');
                request({ url: 'http://host/path', auth: 'user1:pass1' }, function() {
                    t.ok(spy.called);
                    t.equal(spy.args[0][0].auth, 'user1:pass1');
                    t.contains(spy.args[0][0].headers.Authorization, 'Basic ');
                    t.done();
                })
            },
            'object': function(t) {
                var spy = t.spyOnce(http, 'request');
                request({ url: 'http://host/path', auth: {username: 'user2', password: 'pass2'} }, function() {
                    t.ok(spy.called);
                    t.equal(spy.args[0][0].auth, 'user2:pass2');
                    t.contains(spy.args[0][0].headers.Authorization, 'Basic ');
                    t.done();
                })
            },
            'short-names object': function(t) {
                var spy = t.spyOnce(http, 'request');
                request({ url: 'http://host/path', auth: {user: 'user3', pass: 'pass3'} }, function() {
                    t.ok(spy.called);
                    t.equal(spy.args[0][0].auth, 'user3:pass3');
                    t.contains(spy.args[0][0].headers.Authorization, 'Basic ');
                    t.done();
                })
            },
            'url component': function(t) {
                var spy = t.spyOnce(http, 'request');
                request({ url: 'http://user4:pass4@host/path' }, function() {
                    t.ok(spy.called);
                    t.equal(spy.args[0][0].auth, 'user4:pass4');
                    t.contains(spy.args[0][0].headers.Authorization, 'Basic ');
                    t.done();
                })
            },
            'uri.auth overrides uri.url component': function(t) {
                var spy = t.spyOnce(http, 'request');
                request({ url: 'http://user4:pass4@host/path', auth: 'user5:pass5' }, function() {
                    t.ok(spy.called);
                    t.equal(spy.args[0][0].auth, 'user5:pass5');
                    t.contains(spy.args[0][0].headers.Authorization, 'Basic ');
                    t.done();
                })
            },
        },

        'options.maxRedirects': {
            'retries the request': function(t) {
                qmock.mockHttp()
                    .when('http://hostname:1/foo')
                        .send(301, 'Moved.', { location: 'https://hostname2:22/bar' })
                    .when('https://hostname2:22/bar')
                        .send(301, 'Moved.', { location: 'http://hostname3:333/bat' })
                    .when('http://hostname3:333/bat')
                        .send(200, 'OK')
                    ;
                request.defaults({ maxRedirects: 5 }).get('http://hostname:1/foo', function(err, res, body) {
                    t.ifError(err);
                    t.equal(body, 'OK');
                    t.done();
                })
            },
            'errors out if too many redirects': function(t) {
                qmock.mockHttp()
                    .when('http://hostname:80/foo')
                        .send(301, 'Moved.', { location: 'http://hostname:80/foo' });
                request.defaults({ maxRedirects: 10 }).get('http://hostname:80/foo', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.code, 'REDIRECT');
                    t.done();
                })
            },
            'can read from google.com': function(t) {
                t.skip();
                // google.com redirects to www.google.com
                request.defaults({ maxRedirects: 5, encoding: 'utf8' })
                    .request('http://google.com/search?q=nodejs', function(err, res, body) {
                        console.log("AR: got:", err, res && res.statusCode, '' + body);
                        t.ifError(err);
                        t.ok(body.length > 1000);
                        t.done();
                    });
            },
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
            var req = request('http://somehost', fromBuf('test req body'), function(err, res, body) {
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
                        res.emit('data', fromBuf('test '));
                        res.emit('data', fromBuf('resp'));
                        res.emit('data', fromBuf('onse'));
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

        'should return string response': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', 'test ');
                        res.emit('data', 'res');
                        res.emit('data', 'ponse');
                        res.emit('end');
                    })
            ;
            request('http://some/url', function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(body, 'test response');
                t.done();
            })
        },

        'should return decoded response': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', 'test ');
                        res.emit('data', 'resp');
                        res.emit('data', 'onse');
                        res.emit('end');
                    })
            ;
            request({ url: 'http://some/url', encoding: 'utf8' }, function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(body, 'test response');
                t.done();
            })
        },

        'should return decoded response via req': function(t) {
            // note: this test hits an actual http server to use an actual res.setEncoding
            qmock.unmockHttp();
            request({ url: 'http://localhost:1337/utf8', encoding: 'utf8' }, function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(body, 'utf8 response');
                t.done();
            })
        },

        'should merge baseUrl and url': function(t) {
            qmock.unmockHttp();
            request({ baseUrl: 'http://localhost:1337', url: '/utf8', encoding: 'utf8' }, function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(body, 'utf8 response');
                t.done();
            })
        },

        'should return decoded response even without res.setEncoding': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', fromBuf('test '));
                        res.emit('data', fromBuf('resp'));
                        res.emit('data', fromBuf('onse'));
                        res.emit('end');
                    })
            ;
            request({ url: 'http://some/url', encoding: 'utf8' }, function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(body, 'test response');
                t.done();
            })
        },

        'should return decoded json response as object': function(t) {
            var goodJson = '{"a":123}'
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', goodJson);
                        res.emit('end');
                    })
            ;
            request({ url: 'http://some/url', encoding: 'json' }, function(err, res, body) {
                t.ifError(err);
                t.deepEqual(body, JSON.parse(goodJson));
                t.done();
            })
        },

        'should return bad json response as utf8 string': function(t) {
            var badJson = '{"a"123}'
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', badJson);
                        res.emit('end');
                    })
            ;
            request({ url: 'http://some/url', encoding: 'json' }, function(err, res, body) {
                t.ifError(err);
                t.equal(typeof body, 'string');
                t.equal(String(body), badJson);
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

        'should return without ending call if noReqEnd': {
            before: function(done) {
                this.runTest = function(t, reqBody, expect) {
                    t.mockHttp()
                        .when('http://host/path')
                            .send(200, 'test response')
                    ;
                    var spy;
                    var req = request({
                        url: 'http://host/path',
                        body: reqBody,
                        noReqEnd: true,
                    }, function(err, res, body) {
                        t.deepEqual(req._mockWrites, expect);
                        t.equal(String(body), 'test response');
                        t.equal(spy.callCount, 1);
                        t.done();
                    })
                    spy = t.spy(req, 'end');
                    req.write('more test data', 'utf8');
                    req.end();
                }
                done();
            },

            'with body 2': function(t) {
                this.runTest(t, 'test data', [['test data', undefined], ['more test data', 'utf8'], null]);
            },

            'without body 2': function(t) {
                this.runTest(t, undefined, [['more test data', 'utf8'], null]);
            },
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

            'should time out on slow connect': function(t) {
                var t1 = Date.now();
                // hit an ip address that will not exist in the test environment
                var req = request({ url: 'http://10.0.0.0/', timeout: 20 }, function(err, res, body) {
                    t.ok(err);
                    t.equal(err.code, 'ETIMEDOUT'); // FIXME: sometimes EHOSTUNREACH
                    t.ok(Date.now() - t1 < 30);
                    t.done();
                })
            },

            'should time out on slow response': function(t) {
                qmock.mockHttp()
                    .when('http://somehost/slowres')
                        .write('')
                        .delay(100)
                        .end('ok')
                ;
                var t1 = Date.now();
                var req = request({ url: 'http://somehost/slowres', timeout: 30 }, function(err, res, body) {
                    t.ok(err);
                    t.equal(err.code, 'ESOCKETTIMEDOUT');
                    t.ok(Date.now() - t1 < 40);
                    t.done();
                })
            },

            'should time out on a slow connect if noResListen': function(t) {
                var t1 = Date.now();
                var req = request({ url: 'http://10.0.0.0/', timeout: 20, noResListen: true }, function(err, res) {
                    t.ok(err);
                    t.equal(err.code, 'ETIMEDOUT');
                    t.ok(Date.now() - t1 < 30);
                    t.done();
                })
            },

            'should time out on a slow response if noResListen': function(t) {
                var t1 = Date.now();
                var req = request({ url: 'http://localhost:1337/slowres', timeout: 30, noResListen: true }, function() {});
                req.on('error', function(err) {
                    t.equal(err.code, 'ESOCKETTIMEDOUT');
                    t.ok(Date.now() - t1 < 40);
                    t.done();
                })
            },
        },
    },

    'defaults': {
        'returns a request caller': function(t) {
            var caller = request.defaults();
            t.equal(typeof caller.request, 'function');
            t.equal(typeof caller.defaults, 'function');
            t.equal(typeof caller.get, 'function');
            t.equal(typeof caller.put, 'function');
            t.equal(typeof caller.post, 'function');
            t.equal(typeof caller.del, 'function');
            t.done();
        },
        'methods invoke request.request': function(t) {
            var caller = request.defaults();
            var methods = Object.keys(caller)
                .filter(function(m) { return typeof caller[m] === 'function' && m !== 'call' && m !== 'defaults' });
            var callCount = 0;
            var spy = t.stub(request, 'request').yields(null, {});
            for (var i = 0; i < methods.length; i++) {
                caller[methods[i]]('some.url', 'mock-body', function(err, res) {
                    if (++callCount === methods.length) {
                        spy.restore();
                        t.equal(callCount, methods.length);
                        t.done();
                    }
                })
            }
        },
        'caller merges inherited, default and user options': function(t) {
            var caller = request
                .defaults({ baseUrl: 'some-base-url//' })
                .defaults(0)
                .defaults({ headers: { Accept: 'foo/bar' } })
                .defaults({ someOption: 'TRUE-234' });
            var spy = t.stubOnce(request, 'request').yields(null, {});
            caller.call('FOO', { url: '/some-path', otherOption: '567' }, function(err, res, body) {
                t.ok(spy.called);
                t.contains(spy.args[0][0], {
                    method: 'FOO',              // retains method
                    someOption: 'TRUE-234',     // default option
                    otherOption: '567',         // user option
                    url: 'some-base-url/some-path',     // built url using inherited option
                    headers: { Accept: 'foo/bar' },     // merged headers
                });
                t.done();
            })
        },
        'caller uses default url': function(t) {
            var caller = request.defaults({ url: '/url' }).defaults({ baseUrl: '/some' });
            var spy = t.stubOnce(request, 'request').yields(null, {});
            caller.call('GET', '', 'mock body', function(err, res, body) {
                t.ok(spy.called);
                t.contains(spy.args[0][0], { url: '/some/url' });
                t.done();
            })
        },
        'caller invokes microreq.request': function(t) {
            var caller = request.defaults();
            var spy = t.stubOnce(request, 'request').yields(null, { body: 'mock response' });
            caller.call('GET', 'some.url', 'mock-body', function(err, res, body) {
                t.ok(spy.called);
                t.equal(res.body, 'mock response');
                t.done();
            })
        },
    },
};
