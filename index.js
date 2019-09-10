#!/usr/bin/env node

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const http = require('http');
const logger = require('./utils/logger');
const port = process.env.PORT || '3000';
const app = require('./app');

// Start the server
http.createServer(app).listen(port, function () {
    logger.info(`Your server is listening on port ${port} (http://localhost:${port})`);
});
