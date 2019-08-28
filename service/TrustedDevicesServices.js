/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

var devices = require('../utils/devices.js');

/**
 * add devices to trust
 *
 * body CreateDevices Add declared devices to existing trusts
 * no response value expected for this operation
 **/
exports.addTrusts = function (body) {
  return new Promise(function (resolve, reject) {
    if ('devices' in body && Array.isArray(body.devices)) {
      devices.getTrustedDevices()
        .then((discoveredDevices) => {
            body.devices.forEach((device) => {
              discoveredDevices.push(device);
            });
            return devices.declareDevices(discoveredDevices);
        })
        .then((declareDevices) => {
          resolve({ devices: declareDevices });
        })
        .catch((error) => {
          // report errors declaring devices
          reject(error);
        });
    } else {
      // report missing request body
      const error = new Error('missing declaration');
      error.statusCode = 400;
      error.message = 'missing declaration';
      reject(error);
    }
  });
};


/**
 * declare device trusts
 *
 * body CreateDevices Declare all trusts
 * no response value expected for this operation
 **/
exports.declareTrusts = function (body) {
  return new Promise(function (resolve, reject) {
    if ('devices' in body && Array.isArray(body.devices)) {
      devices.declareDevices(body.devices)
        .then((declareDevices) => {
          resolve({ devices: declareDevices });
        })
        .catch((error) => {
          // report errors declaring devices
          reject(error);
        });
    } else {
      // report missing request body
      const error = new Error('missing declaration');
      error.statusCode = 400;
      error.message = 'missing declaration';
      reject(error);
    }
  });
};


/**
 * delete device from existing trusts matching the targetUUID
 *
 * targetUUID uuid Delete trust matching targetUUID
 * no response value expected for this operation
 **/
const deleteTrustByUUID = function (targetUUID) {
  return new Promise(function (resolve, reject) {
    devices.getTrustedDevice(targetUUID)
      .then((device) => {
        if (device) {
          return devices.deleteDevice(device);
        } else {
          const error = new Error('device not found');
          error.statusCode = 404;
          error.message = 'device not found';
          reject(error);
        }
      })
      .then((device) => {
        resolve(device);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
exports.deleteTrustByUUID = deleteTrustByUUID;

/**
 * delete device from existing trusts matching filters
 *
 * targetUUID uuid Delete trust matching targetUUID (optional)
 * targetHost String Delete trust(S) matching targetHost (optional)
 * targetPort tcpPort Delete trust matchin targetHost and targetPort (optional)
 * no response value expected for this operation
 **/
exports.deleteTrust = function (targetUUID, targetHost, targetPort) {
  if (targetUUID) {
    return deleteTrustByUUID(targetUUID);
  }
  if (targetHost && targetPort) {
    return new Promise(function (resolve, reject) {
      devices.getTrustedDevices()
        .then((discoveredDevices) => {
          let found = false;
          discoveredDevices.forEach((device) => {
            if (device.targetHost == targetHost && device.targetPort == targetPort) {
              found = true;
              return devices.deleteDevice(device);
            }
          });
          if (!found) {
            const error = new Error('device not found');
            error.statusCode = 404;
            error.message = 'device not found';
            reject(error);
          }
        })
        .then((device) => {
          resolve(device);
        })
        .catch((error) => {
          reject(error);
        });
    });
  } else {
    return Promise.reject(400, 'missing device targetHost and targetPort');
  }
};


/**
 * retrieve defined device trusts matching the targetUUID
 *
 * targetUUID uuid Filter output to the matching targetUUID
 * returns List
 **/
exports.getTrust = function (targetUUID) {
  return new Promise(function (resolve, reject) {
    devices.getTrustedDevice(targetUUID)
      .then((device) => {
        if (!device) {
          const error = new Error('device not found');
          error.statusCode = 404;
          error.message = 'device not found';
          reject(error);
        } else {
          resolve({ devices: [device] });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};


/**
 * retrieve defined device trusts optionally matching filters
 *
 * targetUUID uuid Filter output to the matching targetUUID (optional)
 * targetHost String Filter output to the matching targetHost (optional)
 * returns List
 **/
exports.getTrusts = function (targetUUID, targetHost) {
  return new Promise(function (resolve, reject) {
    devices.getTrustedDevices()
      .then((discoveredDevices) => {
        let found = false;
        let foundDevice = {};
        if (targetUUID) {
          discoveredDevices.forEach(device => {
            if (device.targetUUID == targetUUID) {
              foundDevice = device;
            }
          });
        }
        if (targetHost) {
          discoveredDevices.forEach(device => {
            if (device.targetHost == targetHost) {
              foundDevice = device;
            }
          });
        }
        if (targetUUID || targetHost) {
          if (found) {
            resolve({ devices: [foundDevice] });
          } else {
            const error = new Error('device not found');
            error.called = 'getTrust';
            error.statusCode = 404;
            error.message = 'device not found';
            reject(error);
          }
        } else {
          resolve({ devices: discoveredDevices });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};

