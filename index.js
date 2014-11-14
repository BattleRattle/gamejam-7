'use strict';

var http = require('http'),
	beefy = require('beefy'),
	config = require('./config');

var server = http.createServer(
	beefy({
		index: './index.html',
		entries: {
			// list of all static js files where it should be possible to use node functionality like require()
			'/index.js': './static/js/index.js'
		},
		cwd: __dirname + '/static/',
		quiet: false,
		live: true,
		bundlerFlags: ['-t'],
		watchify: false
	})
).listen(config.server.port);

console.log('Server started on http://' + config.server.host + ':' + config.server.port + '/');
