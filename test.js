'use strict';

var http = require('http');
var https = require('https');

var gm = {
    httpRequest: require('./')
};

module.exports = {
    'httpRequest': {
        'should invoke http.request': function(t) {
            var spy = mockHttpRequest(http, t, 0);
            gm.httpRequest('http://localhost', function(){});
            setImmediate(function() {
                t.equal(spy.callCount, 1);
                t.done();
            })
        },

        'should invoke https.request': function(t) {
            var spy = mockHttpRequest(https, t);
            gm.httpRequest('https://localhost', function(){});
            setImmediate(function() {
                t.equal(spy.callCount, 1);
                t.done();
            })
        },

        'should accept and parse string url': function(t) {
            var spy = mockHttpRequest(http, t);
            gm.httpRequest('http://usern:passw@localhost:1337/path/name?a=12&b=34#hash5', function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    auth: 'usern:passw',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                    query: 'a=12&b=34',
                    hash: '#hash5'
                });
                t.done();
            });
        },

        'should accept object url': function(t) {
            var spy = mockHttpRequest(http, t);
            var uri = { url: 'http://localhost:1337/path/name?a=12&b=34#hash5', auth: 'usern:passw', headers: { 'X-Unit-Test': '789A' } };
            gm.httpRequest(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    auth: 'usern:passw',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                    query: 'a=12&b=34',
                    hash: '#hash5',
                });
                t.contains(spy.callArguments[0].headers, { 'X-Unit-Test': '789A' });
                t.done();
            });
        },

        'should not set uri properties to undefined parsed properties': function(t) {
            var spy = mockHttpRequest(http, t);
            var uri = { url: "https://otherhost:1337" };
            gm.httpRequest(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'https:',
                    hostname: 'otherhost'
                });
                t.ok(! ('url' in spy.callArguments[0]));
                t.ok(! ('query' in spy.callArguments[0]));
                t.ok(! ('hash' in spy.callArguments[0]));
                t.done();
            });
        },

        'should not overwrite uri properties with parsed properties': function(t) {
            var spy = mockHttpRequest(http, t);
            var uri = { protocol: 'https:', hostname: 'otherhost', url: 'http://localhost:1337' };
            gm.httpRequest(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'https:',
                    hostname: 'otherhost'
                });
                t.ok(! ('url' in spy.callArguments[0]));
                t.done();
            });
        },

        'should accept string body': function(t) {
            var spy = mockHttpRequest(http, t);
            gm.httpRequest('http://localhost', 'test req body', function(err, res, body) {
                t.equal(spy._mockReq.written[0], 'test req body');
                t.done();
            })
        },

        'should accept buffer body': function(t) {
            var spy = mockHttpRequest(http, t);
            gm.httpRequest('http://localhost', new Buffer('test req body'), function(err, res, body) {
                t.ok(Buffer.isBuffer(spy._mockReq.written[0]));
                t.equal(spy._mockReq.written[0], 'test req body');
                t.done();
            })
        },

        'should accept object body': function(t) {
            var spy = mockHttpRequest(http, t);
            gm.httpRequest('http://localhost', { testBody: 'test req body' }, function(err, res, body) {
                t.equal(typeof spy._mockReq.written[0], 'string');
                t.equal(spy._mockReq.written[0], JSON.stringify({ testBody: 'test req body' }));
                t.done();
            })
        },

        'should make call to all-defaults uri': function(t) {
            // the url "" is a valid url, it uses all defaults -- http://localhost:80/
            // and returns the response if there is a localhost http server running.
            // Or errors out if not.  This test just runs all branch points of the code.
            gm.httpRequest({}, function(err, res, body) {
                t.done();
            })
        },

        'should return gathered response raw': function(t) {
            var spy = mockHttpRequest(http, t, 0);
            setImmediate(function() {
                spy._mockRes.emit('data', new Buffer('test '));
                spy._mockRes.emit('data', new Buffer('response'));
                spy._mockRes.emit('end');
            })
            gm.httpRequest('http://some/url', function(err, res, body) {
                t.ok(Buffer.isBuffer(body));
                t.equal(body.toString(), 'test response');
                t.done();
            })
        },

        'should return only once': function(t) {
            var spy = mockHttpRequest(http, t, 0);
            setImmediate(function() {
                spy._mockReq.emit('error', new Error('request error'));
                spy._mockRes.emit('error', new Error('response error'));
                spy._mockRes.emit('end');
            })
            var returnCount = 0;
            gm.httpRequest('http://some/url', function(err, res, body) {
                returnCount += 1;
                t.equal(returnCount, 1);
                t.ok(err);
                t.equal(err.message, 'request error');
                setTimeout(function(){ t.done() }, 10);
            })
        },

        'errors': {
            'should require callback': function(t) {
                try { gm.httpRequest("https://localhost") }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should require uri': function(t) {
                try { gm.httpRequest("", function(){}) }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should return req errors': function(t) {
                var spy = mockHttpRequest(http, t, 0);
                setTimeout(function() {
                    spy._mockReq.emit('error', new Error('test error'));
                }, 5)
                gm.httpRequest('http://some/url', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.message, 'test error');
                    t.done();
                })
            },
        },
    },
};


var events = require('events');
var util = require('util');

function MockReq( ) {
    events.EventEmitter.call(this);
    this.written = [];
    var self = this;
    this.write = function(chunk) { self.written.push(chunk) };
    this.end = function() {};
}
util.inherits(MockReq, events.EventEmitter);

function MockRes( ) {
    events.EventEmitter.call(this);
}
util.inherits(MockRes, events.EventEmitter);

// mock the next http.request to send a response ms milliseconds from now
function mockHttpRequest( http_https, t, ms ) {
    var mockReq = new MockReq();
    var mockRes = new MockRes();

    var spy = t.stubOnce(http_https, 'request', function(uri, cb) { cb(mockRes); return mockReq });

    if (ms === undefined) setImmediate(function(){ mockRes.emit('end') });
    else if (ms > 0) setTimeout(function(){ mockRes.emit('end') }, ms);

    spy._mockReq = mockReq;
    spy._mockRes = mockRes;
    return spy;
}
