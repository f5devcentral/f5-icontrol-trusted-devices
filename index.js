#!/usr/bin/env node

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const http = require('http');
const logger = require('./utils/logger');
const devices = require('./utils/devices');
const port = process.env.PORT || '3000';
const app = require('./app');

// Start the server
logger.info('registring listener socket listener');
http.createServer(app).listen(port, function () {
    logger.info(`your server is listening on port ${port} (http://localhost:${port})`);
});


const CLEAN_FREQ_SEC = 120;
// Start device cleaning tasks
logger.info(`device cleaning will run every ${CLEAN_FREQ_SEC} seconds`);
setInterval(devices.cleanDevices, CLEAN_FREQ_SEC*1000);

const DEVICE_MONITOR_SEC = 120;
// Start device monitoring tasks
logger.info(`device monitoring will run every ${CLEAN_FREQ_SEC} seconds`);
setInterval(devices.monitorDevices, DEVICE_MONITOR_SEC*1000);