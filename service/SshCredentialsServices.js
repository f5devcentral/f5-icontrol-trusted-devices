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
        if ('key' in body && 'name' in body.key && 'privateKey' in body.key) {
            sshutils.createKeyFile(body.key.name, body.key.privateKey)
                .then(() => {
                    resolve();
                })
                .catch((error) => {
                    reject(error);
                });
        } else {
          // report missing request body
          const error = new Error('SSH key definition requires name and private key');
          error.statusCode = 405;
          error.message = 'SSH key definition requires name and private key';
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
