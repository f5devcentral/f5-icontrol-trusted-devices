#!/usr/bin/env node

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const {
    createServer,
    IncomingMessage,
    ServerResponse,
} = require('unit-http');
require('http').ServerResponse = ServerResponse;
require('http').IncomingMessage = IncomingMessage;

const logger = require('./utils/logger');
const app = require('./app');
const tasks = require('./tasks');

logger.info('registring listener with unit server');
createServer(app).listen();

tasks.run();