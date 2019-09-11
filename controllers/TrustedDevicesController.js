/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('../utils/logger');
const LOG_PRE = 'TrustedDevicesController';

const utils = require('../utils/writer.js');
const TrustedDevicesServices = require('../service/TrustedDevicesServices');


module.exports.addTrusts = function addTrusts (req, res, next) {
  logger.debug(`${LOG_PRE} - addTrusts called`);
  TrustedDevicesServices.addTrusts(req.body)
    .then( (response) => {
      logger.debug(`${LOG_PRE} - addTrusts returned`);
      utils.writeJson(res, response, 202);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - addTrusts errored`);
      error.caller = `${LOG_PRE} - addTrusts`;
      utils.writeError(res, error);
    });
};

module.exports.declareTrusts = function declareTrusts (req, res, next) {
  logger.debug(`${LOG_PRE} - declareTrusts called`);
  TrustedDevicesServices.declareTrusts(req.body)
    .then( (response) => {
      logger.debug(`${LOG_PRE} - declareTrusts returned`);
      utils.writeJson(res, response, 202);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - declareTrusts errored`);
      error.caller = `${LOG_PRE} - declareTrusts`;
      utils.writeError(res, error);
    });
};

module.exports.deleteTrustByUUID = function deleteTrustByUUID (req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  logger.debug(`${LOG_PRE} - deleteTrustByUUID called - targetUUID:${targetUUID}`);
  TrustedDevicesServices.deleteTrustByUUID(targetUUID)
    .then((response) => {
      logger.debug(`${LOG_PRE} - deleteTrustByUUID returned`);
      utils.writeJson(res, response);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - deleteTrustByUUID errored`);
      error.caller = `${LOG_PRE} - deleteTrustByUUID`;
      utils.writeError(res, error);
    });
};

module.exports.deleteTrust = function deleteTrust (req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const targetHost = req.swagger.params.targetHost.value;
  const targetPort = req.swagger.params.targetPort.value;
  logger.debug(`${LOG_PRE} - deleteTrust called - targetUUID${targetUUID}, targetHost:${targetHost}, targetPort:${targetPort}`);
  TrustedDevicesServices.deleteTrust(targetUUID,targetHost,targetPort)
    .then( (response) => {
      logger.debug(`${LOG_PRE} - deleteTrust returned`);
      utils.writeJson(res, response);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - deleteTrust errored`);
      error.caller = `${LOG_PRE} - deleteTrust`;
      utils.writeError(res, error);
    });
};

module.exports.getTrust = function getTrust (req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  logger.debug(`${LOG_PRE} - getTrust called - targetUUID:${targetUUID}`);
  TrustedDevicesServices.getTrust(targetUUID)
    .then( (response) => {
      logger.debug(`${LOG_PRE} - getTrust returned`);
      utils.writeJson(res, response);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - getTrust errored`);
      error.caller = `${LOG_PRE} - getTrust`;
      utils.writeError(res, error);
    });
};

module.exports.getTrusts = function getTrusts (req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const targetHost = req.swagger.params.targetHost.value;
  logger.debug(`${LOG_PRE} - getTrusts called - targetUUID:${targetUUID}, targetHost:${targetHost}`);  
  TrustedDevicesServices.getTrusts(targetUUID,targetHost)
    .then( (response) => {
      logger.debug(`${LOG_PRE} - getTrusts returned`);
      utils.writeJson(res, response);
    })
    .catch( (error) => {
      logger.debug(`${LOG_PRE} - getTrusts errored`);
      error.caller = `${LOG_PRE} - getTrusts`;
      utils.writeError(res, error);
    });
};
