/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('../utils/logger');
const LOG_PRE = 'TrustedProxyController';

var utils = require('../utils/writer.js');
var TrustedProxyServices = require('../service/TrustedProxyServices');

module.exports.getTrustTokenByUUID = function getTrustToken(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  logger.debug(`${LOG_PRE} - getTrustToken called - targetUUID: ${targetUUID}`);
  TrustedProxyServices.getTrustTokenByUUID(targetUUID)
    .then(function (response) {
      logger.debug(`${LOG_PRE} - getTrustToken returned`);
      utils.writeJson(res, response);
    })
    .catch((error) => {
      logger.debug(`${LOG_PRE} - getTrustToken errored`);
      error.caller = `${LOG_PRE} - getTrustToken`;
      utils.writeError(res, error);
    });
};

module.exports.getTrustToken = function getTrustTokens(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const targetHost = req.swagger.params.targetHost.value;
  logger.debug(`${LOG_PRE} - getTrustTokens called - targetUUID: ${targetUUID}, targetHost: ${targetHost}`);  
  TrustedProxyServices.getTrustToken(targetUUID, targetHost)
    .then(function (response) {
      logger.debug(`${LOG_PRE} - getTrustTokens returned`);
      utils.writeJson(res, response);
    })
    .catch((error) => {
      logger.debug(`${LOG_PRE} - getTrustTokens errored`);
      error.caller = `${LOG_PRE} - getTrustTokens`;
      utils.writeError(res, error);
    });
};

module.exports.flushTokenCache = function flushTokenCache(req, res, next) {
  logger.debug(`${LOG_PRE} - flushTokenCache called`);
  TrustedProxyServices.flushTokenCache()
    .then(function (response) {
      logger.debug(`${LOG_PRE} - flushTokenCache returned`);
      utils.writeJson(res, response);
    })
    .catch((error) => {
      logger.debug(`${LOG_PRE} - flushTokenCache errored`);
      error.caller = `${LOG_PRE} - flushTokenCache`;
      utils.writeError(res, error);
    });
};

module.exports.flushTokenCacheByUUID = function flushTokenCache(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  logger.debug(`${LOG_PRE} - flushTokenCacheByUUID called - targetUUID: ${targetUUID}`);
  TrustedProxyServices.flushTokenCacheByUUID(targetUUID)
    .then(function (response) {
      logger.debug(`${LOG_PRE} - flushTokenCacheByUUID returned`);
      utils.writeJson(res, response);
    })
    .catch((error) => {
      logger.debug(`${LOG_PRE} - flushTokenCacheByUUID errored`);
      error.caller = `${LOG_PRE} - flushTokenCacheByUUID`;
      utils.writeError(res, error);
    });
};

module.exports.getiControlRESTProxy = function getiControlRESTProxy(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const iControlRESTPath = req.swagger.params.iControlRESTPath.value;
  logger.debug(`${LOG_PRE} - getiControlRESTProxy - targetUUID: ${targetUUID} - iControlRESTPath: ${iControlRESTPath}`);  
  TrustedProxyServices.getiControlRESTProxy(targetUUID, iControlRESTPath, req, res);
};

module.exports.deleteiControlRESTProxy = function deleteiControlRESTProxy(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const iControlRESTPath = req.swagger.params.iControlRESTPath.value;
  logger.debug(`${LOG_PRE} - deleteiControlRESTProxy - targetUUID: ${targetUUID} - iControlRESTPath: ${iControlRESTPath}`);  
  TrustedProxyServices.deleteiControlRESTProxy(targetUUID, iControlRESTPath, req, res);
};

module.exports.patchiControlRESTProxy = function patchiControlRESTProxy(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const iControlRESTPath = req.swagger.params.iControlRESTPath.value;
  logger.debug(`${LOG_PRE} - patchiControlRESTProxy - targetUUID: ${targetUUID} - iControlRESTPath: ${iControlRESTPath}`);  
  TrustedProxyServices.patchiControlRESTProxy(targetUUID, iControlRESTPath.req.res);
};

module.exports.postiControlRESTProxy = function postiControlRESTProxy(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const iControlRESTPath = req.swagger.params.iControlRESTPath.value;
  logger.debug(`${LOG_PRE} - postiControlRESTProxy - targetUUID: ${targetUUID} - iControlRESTPath: ${iControlRESTPath}`);  
  TrustedProxyServices.postiControlRESTProxy(targetUUID, iControlRESTPath.req.res);
};

module.exports.putiControlRESTProxy = function putiControlRESTProxy(req, res, next) {
  const targetUUID = req.swagger.params.targetUUID.value;
  const iControlRESTPath = req.swagger.params.iControlRESTPath.value;
  logger.debug(`${LOG_PRE} - putiControlRESTProxy - targetUUID: ${targetUUID} - iControlRESTPath: ${iControlRESTPath}`);  
  TrustedProxyServices.putiControlRESTProxy(targetUUID, iControlRESTPath.req, res);
};
