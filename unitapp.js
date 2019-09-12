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
const devices = require('./utils/devices');
const app = require('./app');

logger.info('registring listener with unit server');
createServer(app).listen();

const CLEAN_FREQ_SEC = 120;
// Start device cleaning tasks
logger.info(`device cleaning will run every ${CLEAN_FREQ_SEC} seconds`);
setInterval(devices.cleanDevices, CLEAN_FREQ_SEC*1000);

const DEVICE_MONITOR_SEC = 120;
// Start device monitoring tasks
logger.info(`device monitoring will run every ${CLEAN_FREQ_SEC} seconds`);
setInterval(devices.monitorDevices, DEVICE_MONITOR_SEC*1000);