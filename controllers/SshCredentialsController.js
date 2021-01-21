/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('../utils/logger');
const LOG_PRE = 'SshCredentialsController';

const utils = require('../utils/writer.js');
const SshCredentialsServices = require('../service/SshCredentialsServices');

module.exports.getSshKeys = function getSshKeys (req, res, next) {
    logger.debug(`${LOG_PRE} - getSshKeys called`);
    const sshKeyName = req.swagger.params.sshKeyName.value;
    SshCredentialsServices.getSshKeys(sshKeyName)
      .then( (response) => {
        logger.debug(`${LOG_PRE} - getSshKeys returned`);
        utils.writeJson(res, response, 200);
      })
      .catch( (error) => {
        logger.debug(`${LOG_PRE} - getSshKeys errored`);
        error.caller = `${LOG_PRE} - getSshKeys`;
        utils.writeError(res, error);
      });
};

module.exports.createSshIdentityFile = function createSshIdentityFile (req, res, next) {
    logger.debug(`${LOG_PRE} - createSshIdentityFile called`);
    SshCredentialsServices.createSshIdentityFile(req.body)
      .then( (response) => {
        logger.debug(`${LOG_PRE} - createSshIdentityFile returned`);
        utils.writeJson(res, response, 202);
      })
      .catch( (error) => {
        logger.debug(`${LOG_PRE} - createSshIdentityFile errored`);
        error.caller = `${LOG_PRE} - createSshIdentityFile`;
        utils.writeError(res, error);
      });
};

module.exports.deleteSshKey = function deleteSshKey (req, res, next) {
    logger.debug(`${LOG_PRE} - deleteSshKey called`);
    const sshKeyName = req.swagger.params.sshKeyName.value;
    SshCredentialsServices.deleteSshKey(sshKeyName)
      .then( (response) => {
        logger.debug(`${LOG_PRE} - deleteSshKey returned`);
        utils.writeJson(res, response, 200);
      })
      .catch( (error) => {
        logger.debug(`${LOG_PRE} - deleteSshKey errored`);
        error.caller = `${LOG_PRE} - deleteSshKey`;
        utils.writeError(res, error);
      });
};

module.exports.authorizeSshKey = function authorizeSshKey (req, res, next) {
    logger.debug(`${LOG_PRE} - authorizeSshKey called`);
    SshCredentialsServices.authorizeSshKey(req.body)
      .then( (response) => {
        logger.debug(`${LOG_PRE} - authorizeSshKey returned`);
        utils.writeJson(res, response, 202);
      })
      .catch( (error) => {
        logger.debug(`${LOG_PRE} - authorizeSshKey errored`);
        error.caller = `${LOG_PRE} - authorizeSshKey`;
        utils.writeError(res, error);
      });
};

module.exports.deauthorizeSshKey = function deauthorizeSshKey (req, res, next) {
    logger.debug(`${LOG_PRE} - deauthorizeSshKey called`);
    const sshKeyName = req.swagger.params.sshKeyName.value;
    const targetHost = req.swagger.params.targetHost.value;
    let targetPort = req.swagger.params.targetPort.value;
    if (! targetPort ) {
        targetPort = 22;
    }
    SshCredentialsServices.deauthorizeSshKey(sshKeyName, targetHost, targetPort)
      .then( (response) => {
        logger.debug(`${LOG_PRE} - deauthorizeSshKey returned`);
        utils.writeJson(res, response, 200);
      })
      .catch( (error) => {
        logger.debug(`${LOG_PRE} - deauthorizeSshKey errored`);
        error.caller = `${LOG_PRE} - deauthorizeSshKey`;
        utils.writeError(res, error);
      });
};
