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
    } catch(error) {
        return false;
    }
};


/**
 *
 *  retrieve ssh keys objects from files on the gateway
 *  
 **/
const getSshKeys = (sshKeyName) => {
    
};


