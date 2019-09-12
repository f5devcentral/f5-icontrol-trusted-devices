#!/usr/bin/env node

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const http = require('http');
const logger = require('./utils/logger');
const devices = require('./utils/devices');
const port = process.env.PORT || '3000';
const app = require('./app');
const tasks = require('./tasks');

// Start the server
logger.info('registring listener socket listener');
http.createServer(app).listen(port, function () {
    logger.info(`your server is listening on port ${port} (http://localhost:${port})`);
});

tasks.run();
