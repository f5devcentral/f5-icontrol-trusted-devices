/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const sshutils = require('../utils/ssh.js');

/**
 * get SSH keys on the gateway
 *
 * sskKeyName is a string to filter the returned files
 **/
exports.getSshKeys = function (sshKeyName) {
    return new Promise(function (resolve, reject) {
        sshutils.getSshKeys(sshKeyName)
          .then((keys) => {
              if(keys) {
                  resolve(keys);
              } else {
                  const error = new Error('SSH keys not found');
                  error.statusCode = 404;
                  reject(error);
              }
          })
          .catch((error) => {
              if(! ('statusCode' in error)) {
                  error.statusCode = 500;
              }
              // report errors getting SSH key files
              reject(error);
          });
    });
  };


/**
 * create SSH Key
 *
 * sskKeyFile is a string to filter the returned files
 **/
exports.createSshIdentityFile = function (body) {
    return new Promise(function (resolve, reject) {
        if ('key' in body && 'name' in body.key) {
            const privateKeyPromises = []
            if (! ('privateKey' in body.key.privateKey) ) {
                privateKeyPromises.push(
                    sshutils.createPrivateKey()
                        .then( (privateKey) => {
                            body.key.privateKey = privateKey;
                        })
                        .catch( (error) => {
                            reject(error);
                        })
                );
            }
            Promise.all(privateKeyPromises)
                .then(() => {
                    sshutils.createKeyFile(body.key.name, body.key.privateKey)
                        .then(() => {
                            resolve();
                        });
                })
                .catch((error) => {
                    reject(error);
                });
        } else {
          // report missing request body
          const error = new Error('SSH key definition requires name');
          error.statusCode = 405;
          error.message = 'SSH key definition requires name';
          reject(error);
        }
    });
};


/**
 * delete SSH key on the gateway
 *
 * sskKeyName is the name of the key to delete
 **/
exports.deleteSshKey = function (sshKeyName) {
    return new Promise(function (resolve, reject) {
        if(sshKeyName) {
            sshutils.deleteSshKey(sshKeyName)
                .then( () => {
                    resolve();
                })
                .catch( (error) => {
                    reject(error);
                });
        } else {
            const error = new Error('invalid sshKeyName');
            error.statusCode = 405;
            error.message = 'invalid sshKeyName';
            reject(error);
        }
    });
};


/**
 * authroize SSH key on a remote device
 *
 * body - request body
 **/
exports.authorizeSshKey = function (body) {
    return new Promise(function (resolve, reject) {
        if ('key' in body &&
            'sshKeyName' in body.key &&
            'targetHost' in body.key &&
            'targetUsername' in body.key &&
            'targetPassphrase' in body.key) {
            if(! ('targetPort' in body.key)) {
                body.key.targetPort = 22;
            }
            sshutils.authorizeSshKey(
              body.key.sshKeyName, body.key.targetHost,
              body.key.targetPort, body.key.targetUsername,
              body.key.targetPassphrase)
                .then(() => {
                    resolve();
                })
                .catch((error) => {
                    // report errors authorizing SSH key
                    reject(error);
                });
        } else {
          // report missing request body
          const error = new Error('SSH key definition requires sshKeyName, targetHost, targetUsername, and targetPassphrase');
          error.statusCode = 405;
          error.message = 'SSH key definition requires name';
          reject(error);
        }
    });
};


/**
 * deauthroize SSH key on a remote device
 *
 * sshKeyName - the SSH key name on the gateway
 * targetHost - the target host to deauthorize the SSH key
 * targetPort - the target SSH port to deauthorize the SSH key
 *
 **/
exports.deauthorizeSshKey = function (sshKeyName, targetHost, targetPort) {
    return new Promise(function (resolve, reject) {
        sshutils.deauthorizeSshKey(sshKeyName, targetHost, targetPort)
            .then(() => {
                resolve();
            })
            .catch((error) => {
                // report errors deauthorizing SSH key
                reject(error);
            });
    });
};