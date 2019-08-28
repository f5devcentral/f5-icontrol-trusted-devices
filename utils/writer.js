/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('./logger');

const ResponsePayload = function(code, payload) {
  this.code = code;
  this.payload = payload;
};

exports.respondWithCode = (code, payload) => {
  return new ResponsePayload(code, payload);
};

var writeJson = exports.writeJson = (response, arg1, arg2) => {
  var code;
  var payload;

  if(arg1 && arg1 instanceof ResponsePayload) {
    writeJson(response, arg1.payload, arg1.code);
    return;
  }

  if(arg2 && Number.isInteger(arg2)) {
    code = arg2;
  }
  else {
    if(arg1 && Number.isInteger(arg1)) {
      code = arg1;
    }
  }
  if(code && arg1) {
    payload = arg1;
  }
  else if(arg1) {
    payload = arg1;
  }

  if(!code) {
    // if no response code given, we default to 200
    code = 200;
  }
  if(typeof payload === 'object') {
    payload = JSON.stringify(payload, null, 2);
  }
  response.writeHead(code, {'Content-Type': 'application/json'});
  response.end(payload);
};

const writeError = exports.writeError = (response, error) => {
  var code = 500;
  var payload = 'system error';
  if(error.hasOwnProperty('statusCode')) {
    code = error.statusCode;
  }
  if(error.hasOwnProperty('message')) {
    payload = error.message;
  }
  logger.error(`${error.caller} - ${code} - ${payload}`);
  response.writeHead(code, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(payload));
};
