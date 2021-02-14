/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('./logger');
const LOG_PRE = 'SSHKeysUtil';

const forge = require('node-forge')
const fs = require('fs')
const path = require('path')
const sshClient = require('ssh2').Client;

const KEY_PATH = '/sshkeys';
const DEFAULT_SSH_PORT = 22;

/** helper functions */

const _is_private_key = (keytext) => {
    try {
        forge.pki.privateKeyFromPem(keytext);
        return true;
    } catch (error) {
        return false;
    }
};


/**
 *
 *  retrieve ssh keys objects from files on the gateway
 *  
 **/
const getSshKeys = (sshKeyName) => {
    return new Promise(function (resolve, reject) {
        let keyfiles = [];
        let files = fs.readdirSync(KEY_PATH);
        files.forEach(file => {
            if (!sshKeyName) {
                keyfiles.push(path.basename(file));
            } else {
                if (file == sshKeyName) {
                    keyfiles.push(file);
                }
            }

        });
        if (keyfiles.length == 0) {
            const error = new Error('key not found');
            error.statusCode = 404;
            error.message = 'key not found';
            reject(error);
        } else {
            resolve({ 'keys': keyfiles });
        }
    });
};


const createKeyFile = (name, key) => {
    return new Promise(function (resolve, reject) {
        if(!_is_private_key(key)) {
            const error = new Error('key is not a valid PEM private key');
            error.statusCode = 400;
            error.message = 'key is not a valide PEM private key';
            reject(error);
        }
        let files = fs.readdirSync(KEY_PATH);
        files.forEach(file => {
            if (file == name) {
                const error = new Error('key file exists');
                error.statusCode = 409;
                error.message = 'key file exists';
                reject(error);
            }
        });
        try {
            fs.writeFileSync(KEY_PATH + '/' + name, key);
        } catch (ex) {
            ex.statusCode = 500;
            reject(ex);
        }
    });
};


const deleteSshKey = (sshKeyName) => {
    return new Promise(function (resolve, reject) {
        if (!sshKeyName) {
            const error = new Error('key not found');
            error.statusCode = 404;
            error.message = 'key not found';
            reject(error);
        }
        let files = fs.readdirSync(KEY_PATH);
        files.forEach(file => {
            if (file == sshKeyName) {
                fs.rm(KEY_PATH + '/' + file);
                resolve();
            }
        });
        const error = new Error('key not found');
        error.statusCode = 404;
        error.message = 'key not found';
        reject(error);
    });
};
