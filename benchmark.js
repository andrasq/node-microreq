var cluster = require('cluster');
var http = require('http');
var Url = require('url');

var microreq = require('./').defaults();
var qhttp = require('qhttp');
var khttp = require('../k-http');
var qtimeit = require('qtimeit');
var request = require('request');
var axios = require('axios');

// NOTE: node-v0.10.42 axios crashes with bluebird, hangs with promise, q-then
global.Promise = global.promise || require('q-then').Promise;

if (cluster.isMaster) {
    cluster.fork();
    var server = http.createServer(function(req, res) {
        req.on('data', function() {});
        req.on('end', function() {
            if (req.url === '/close') server.close();
            // res.setHeader('Date', '-'); // faster without turning off Date
            res.end('OK');
        })
    }).listen(1337);
}
else {
    var url = 'http://localhost:1337';
    var agent = new http.Agent({ keepAlive: true, maxConnections: 10 });
    var caller = microreq.defaults({ agent: agent }).defaults(Url.parse(url));
    qtimeit.bench.timeGoal = 0.4;
console.log("\nAR: parallel:");
qtimeit.bench.opsPerTest = 100;
    qtimeit.bench({
/**
        'cb x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) cb() },
        'cb x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) cb() },
        'cb x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) cb() },
        // cb: 1e9 calls / sec

        'promise x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) Promise.resolve().then(cb) },
        'promise x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) Promise.resolve().then(cb) },
        'promise x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) Promise.resolve().then(cb) },
        // promise: 50m / sec
**/

        'axios then x100 1': function(next) { var cb = gatherPromiseThen(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(cb) },
        'axios then x100 2': function(next) { var cb = gatherPromiseThen(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(cb) },
        'axios then x100 3': function(next) { var cb = gatherPromiseThen(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(cb) },
        // axios: 27k/s

        'axios cb x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(function() { cb() }) },
        'axios cb x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(function() { cb() }) },
        'axios cb x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) axios.get(url, { httpAgent: agent }).then(function() { cb() }) },
        // axios: 27k/s

        'request x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) request.get({ url: url, agent: agent }, cb) },
        'request x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) request.get({ url: url, agent: agent }, cb) },
        'request x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) request.get({ url: url, agent: agent }, cb) },
        // request: 28k/s

        'microreq x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) microreq.request({ url: url, agent: agent }, cb) },
        'microreq x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) microreq.request({ url: url, agent: agent }, cb) },
        'microreq x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) microreq.request({ url: url, agent: agent }, cb) },
        // microreq: 65k/s

        'caller x100 1': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) caller.get({}, cb) },
        'caller x100 2': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) caller.get({}, cb) },
        'caller x100 3': function(next) { var cb = gatherCallbacks(100, next);
            for (var i=0; i<100; i++) caller.get({}, cb) },
        // microreq.defaults: 65.5k/s

    }, function(err) {
if (err) throw err;
console.log("\nAR: series:");
qtimeit.bench.opsPerTest = 1;
qtimeit.bench({
        'request 1': function(next) { request.get({ url: url, agent: agent }, next) },
        'request 2': function(next) { request.get({ url: url, agent: agent }, next) },
        'request 3': function(next) { request.get({ url, agent: agent }, next) },
        'axios 1': function(next) { axios.get(url, { httpAgent: agent }).then(function() { next() }) },
        'axios 2': function(next) { axios.get(url, { httpAgent: agent }).then(function() { next() }) },
        'axios 3': function(next) { axios.get(url, { httpAgent: agent }).then(function() { next() }) },
        'microreq 1': function(next) { microreq.request({ url: url, agent: agent }, next) },
        'microreq 2': function(next) { microreq.request({ url: url, agent: agent }, next) },
        'microreq 3': function(next) { microreq.request({ url: url, agent: agent }, next) },
        'microreq 4': function(next) { microreq.request({ url: url, agent: agent }, next) },
        'caller 1': function(next) { caller.get({}, next) },
        'caller 2': function(next) { caller.get({}, next) },
        'caller 3': function(next) { caller.get({}, next) },
        'caller 4': function(next) { caller.get({}, next) },
        'qhttp 1': function(next) { qhttp.get({ url: url, agent: agent }, next) },
        'qhttp 2': function(next) { qhttp.get({ url: url, agent: agent }, next) },
        'qhttp 3': function(next) { qhttp.get({ url: url, agent: agent }, next) },
        'khttp 1': function(next) { khttp.get({ url: url, agent: agent }, next) },
        'khttp 2': function(next) { khttp.get({ url: url, agent: agent }, next) },
        'khttp 3': function(next) { khttp.get({ url: url, agent: agent }, next) },
    }, function(err) {
        microreq.defaults({}).get('http://localhost:1337/close', function(){
            agent.destroy();
            process.disconnect();
        });
    })
    });
}

function gatherCallbacks(count, cb) {
    return function(err) {
        err ? cb(err) : (--count <= 0) ? cb() : null;
    }
}

function gatherPromiseThen(count, cb) {
    return function(x) {
        (--count <= 0) ? cb() : null;
    }
}


/*** 2021-03-16

% node-v10.15.0 benchmark.js

AR: parallel:
unable to measure cpu mhz: /usr/bin/perf error
qtimeit=0.22.2 node=10.15.0 v8=6.8.275.32-node.45 platform=linux kernel=5.10.0-3-amd64 up_threshold=11
arch=ia32 mhz=4565[os] cpuCount=12 cpu="AMD Ryzen 5 5600X 6-Core Processor"
name                  speed           rate
axios then x100 1    26,052 ops/sec   1000 >>>>>
axios then x100 2    26,934 ops/sec   1034 >>>>>
axios then x100 3    26,548 ops/sec   1019 >>>>>
axios cb x100 1      26,918 ops/sec   1033 >>>>>
axios cb x100 2      26,815 ops/sec   1029 >>>>>
axios cb x100 3      26,840 ops/sec   1030 >>>>>
request x100 1       27,463 ops/sec   1054 >>>>>
request x100 2       28,181 ops/sec   1082 >>>>>
request x100 3       28,152 ops/sec   1081 >>>>>
microreq x100 1      62,675 ops/sec   2406 >>>>>>>>>>>>
microreq x100 2      63,298 ops/sec   2430 >>>>>>>>>>>>
microreq x100 3      63,145 ops/sec   2424 >>>>>>>>>>>>
caller x100 1        62,442 ops/sec   2397 >>>>>>>>>>>>
caller x100 2        59,553 ops/sec   2286 >>>>>>>>>>>
caller x100 3        62,780 ops/sec   2410 >>>>>>>>>>>>

AR: series:
unable to measure cpu mhz: /usr/bin/perf error
qtimeit=0.22.2 node=10.15.0 v8=6.8.275.32-node.45 platform=linux kernel=5.10.0-3-amd64 up_threshold=11
arch=ia32 mhz=4501[os] cpuCount=12 cpu="AMD Ryzen 5 5600X 6-Core Processor"
name           speed           rate
request 1     11,604 ops/sec   1000 >>>>>
request 2     11,750 ops/sec   1013 >>>>>
request 3     11,911 ops/sec   1026 >>>>>
axios 1       10,026 ops/sec    864 >>>>
axios 2       10,106 ops/sec    871 >>>>
axios 3       10,126 ops/sec    873 >>>>
microreq 1    20,550 ops/sec   1771 >>>>>>>>>
microreq 2    20,564 ops/sec   1772 >>>>>>>>>
microreq 3    20,559 ops/sec   1772 >>>>>>>>>
microreq 4    20,775 ops/sec   1790 >>>>>>>>>
caller 1      21,674 ops/sec   1868 >>>>>>>>>
caller 2      21,430 ops/sec   1847 >>>>>>>>>
caller 3      21,365 ops/sec   1841 >>>>>>>>>
caller 4      20,388 ops/sec   1757 >>>>>>>>>
qhttp 1       21,741 ops/sec   1874 >>>>>>>>>
qhttp 2       21,756 ops/sec   1875 >>>>>>>>>
qhttp 3       21,933 ops/sec   1890 >>>>>>>>>
khttp 1       20,755 ops/sec   1788 >>>>>>>>>
khttp 2       20,856 ops/sec   1797 >>>>>>>>>
khttp 3       20,793 ops/sec   1792 >>>>>>>>>
262.119u 65.045s 3:48.40 143.2% 0+0k 0+0io 0pf+0w

***/
