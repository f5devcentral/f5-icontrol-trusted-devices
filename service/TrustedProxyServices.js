/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const devices = require('../utils/devices.js');

/**
 * retrieve trust token for trusted TMOS devices
 *
 * targetUUID uuid Filter output to the matching targetUUID
 * returns List
 **/
const getTrustTokenByUUID = function (targetUUID) {
  return new Promise(function (resolve, reject) {
    let targetDevice = {};
    devices.resolveTargetFromUUID(targetUUID)
      .then((device) => {
        if (device) {
          targetDevice = device;
          return devices.getToken(device.targetHost);
        } else {
          const error = new Error('device not found');
          error.statusCode = 404;
          error.message = 'device not found';
          reject(error);
        }
      })
      .then((token) => {
        token.targetUUID = targetDevice.targetUUID;
        token.targetHost = targetDevice.targetHost;
        token.targetPort = targetDevice.targetPort;
        resolve(token);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
exports.getTrustTokenByUUID = getTrustTokenByUUID;

/**
 * retrieve trust token for trusted TMOS devices
 *
 * targetUUID uuid Filter output to the matching targetUUID (optional)
 * targetHost String Filter output to the matching targetHost (optional)
 * returns List
 **/
exports.getTrustToken = function (targetUUID, targetHost) {
  if (targetUUID) {
    return getTrustTokenByUUID(targetUUID);
  }
  return new Promise(function (resolve, reject) {
    let targetDevice = {};
    devices.getTrustedDevice(targetHost)
      .then((device) => {
        if (device) {
          targetDevice = device;
          return devices.getToken(device.targetHost);
        } else {
          const error = new Error('device not found');
          error.statusCode = 404;
          error.message = 'device not found';
          reject(error);
        }
      })
      .then((token) => {
        token.targetUUID = targetDevice.targetUUID;
        token.targetHost = targetDevice.targetHost;
        token.targetPort = targetDevice.targetPort;
        resolve(token);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

exports.flushTokenCache = function flushTokenCache() {
  return new Promise((resolve, reject) => {
    devices.flushTokenCache()
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};

exports.flushTokenCacheByUUID = function flushTokenCacheByUUID(targetUUID) {
  return new Promise((resolve, reject) => {
    devices.getTrustedDevice(targetUUID)
      .then((device) => {
        if (device) {
          return devices.flushTokenCache(device.targetHost);
        } else {
          const error = new Error('device not found');
          error.statusCode = 404;
          error.message = 'device not found';
          reject(error);
        }
      })
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};



/**
 * proxy a GET iControl REST API request to a trusted Host
 *
 * targetUUID uuid Filter output to the matching targetUUID
 * iControlRESTPath String The iControl REST API path on the remote trusted device
 * no response value expected for this operation
 **/
exports.getiControlRESTProxy = function (targetUUID, iControlRESTPath, req, res) {
  devices.proxyRequest(targetUUID, iControlRESTPath, req, res);
};


/**
 * proxy an iControl REST API request to a trusted Host
 *
 * targetUUID uuid Filter output to the matching targetUUID
 * iControlRESTPath String The iControl REST API path on the remote trusted device
 * no response value expected for this operation
 **/
exports.deleteiControlRESTProxy = function (targetUUID, iControlRESTPath, req, res) {
  devices.proxyRequest(targetUUID, iControlRESTPath, req, res);
};


/**
 * proxy a PATCH iControl REST API request to a trusted Host
 *
 * body Map the iControl REST request body
 * targetUUID uuid Filter output to the matching targetUUID
 * iControlRESTPath String The iControl REST API path on the remote trusted device
 * no response value expected for this operation
 **/
exports.patchiControlRESTProxy = function (targetUUID, iControlRESTPath, req, res) {
  devices.proxyRequest(targetUUID, iControlRESTPath, req, res);
};


/**
 * proxy an iControl REST API request to a trusted Host
 *
 * body Map the iControl REST request body
 * targetUUID uuid Filter output to the matching targetUUID
 * iControlRESTPath String The iControl REST API path on the remote trusted device
 * no response value expected for this operation
 **/
exports.postiControlRESTProxy = function (targetUUID, iControlRESTPath, req, res) {
  devices.proxyRequest(targetUUID, iControlRESTPath, req, res);
};


/**
 * proxy an iControl REST API request to a trusted Host
 *
 * body Map the iControl REST request body
 * targetUUID uuid Filter output to the matching targetUUID
 * iControlRESTPath String The iControl REST API path on the remote trusted device
 * no response value expected for this operation
 **/
exports.putiControlRESTProxy = function (targetUUID, iControlRESTPath, req, res) {
  devices.proxyRequest(targetUUID, iControlRESTPath, req, res);
};

