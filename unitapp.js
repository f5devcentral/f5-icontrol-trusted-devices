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

const app = require('./app');

createServer(app).listen();