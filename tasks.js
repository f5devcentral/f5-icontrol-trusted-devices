/* jshint esversion: 6 */
/* jshint node: true */
const logger = require('./utils/logger');
const devices = require('./utils/devices');

const CLEAN_FREQ_SEC = 120;
const DEVICE_MONITOR_SEC = 120;

const cleaningTasks = () => {
    // Start device cleaning tasks
    logger.info(`device cleaning will run every ${CLEAN_FREQ_SEC} seconds`);
    setInterval(devices.cleanDevices, CLEAN_FREQ_SEC * 1000);
};

const monitoringTasks = () => {
    // Start device monitoring tasks
    logger.info(`device monitoring will run every ${CLEAN_FREQ_SEC} seconds`);
    setInterval(devices.monitorDevices, DEVICE_MONITOR_SEC * 1000);
};

const run = () => {
    cleaningTasks();
    monitoringTasks();
};

module.exports.run = run;