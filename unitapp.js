#!/usr/bin/env node

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const {
  createServer,
  IncomingMessage,
  ServerResponse,
} = require('unit-http');

require('http').ServerResponse = ServerResponse;
require('http').IncomingMessage = IncomingMessage;

const logger = require('./utils/logger');

const fs = require('fs');
const path = require('path');
const http = require('http');

const app = require('connect')();
const bodyParser = require('body-parser');
const oas3Tools = require('oas3-tools');
const serveStatic = require('serve-static');
const pathToSwaggerUi = require('swagger-ui-dist').absolutePath();
const jsyaml = require('js-yaml');
const serverPort = process.env.PORT || 3000;

// swaggerRouter configuration
var options = {
  controllers: path.join(__dirname, './controllers'),
  useStubs: process.env.NODE_ENV === 'development' // Conditionally turn on stubs (mock mode)
};

// The Swagger document for validation and static serving (in JSON for the UI)
var spec = fs.readFileSync(path.join(__dirname, 'api/swagger.yaml'), 'utf8');
var swaggerDoc = jsyaml.safeLoad(spec);
var jsonspecfile = path.join(__dirname, './api') + '/swagger.json';
fs.writeFileSync(jsonspecfile, JSON.stringify(swaggerDoc, null, 4), { encoding: 'utf8', flag: 'w' });

// swagger-UI URI prefix
const APP_URI_PREFIX = '/TrustedDevicesUI';

// Initialize the Swagger middleware
oas3Tools.initializeMiddleware(swaggerDoc, function (middleware) {

  // Make generic req.body available for JSON submitted for TrustedDevices
  // This overcomes a bug in the old swagger-middleware used by OAS tools.
  app.use(`/TrustedDevices`, bodyParser.json());

  // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
  app.use(middleware.swaggerMetadata());

  // Validate Swagger requests
  app.use(middleware.swaggerValidator());

  // Return JSON for Validation Errors
  app.use((err, req, res, next) => {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(405, 'validation error');
    res.write(JSON.stringify({ msg: err.stack.split('\n')[0], error: err }));
    res.end();
  });

  // Route validated requests to appropriate controller
  app.use(middleware.swaggerRouter(options));

  // Serve the Swagger documents and Swagger UI
  // Replace the ancient OAS Swagger-UI with a updated swagger-ui-dist

  // Serve up our Schema in JSON format for swagger-ui
  app.use(`${APP_URI_PREFIX}/api-docs`, serveStatic(path.join(__dirname, './api'), { 'index': ['swagger.json'] }));

  // Replace the static index.html form 'swagger-ui-dist' with patched content 
  // pointing to our relative URI for our schema JSON file
  app.use(`${APP_URI_PREFIX}/docs/index.html`, (req, res) => {
    res.write(swaggerUIIndex(`${APP_URI_PREFIX}/api-docs/swagger.json`));
    res.end();
  });
  // Serve up swagger-ui content
  app.use(`${APP_URI_PREFIX}/docs`, serveStatic(pathToSwaggerUi, { 'index': ['index.html'] }));

  // Create a HTTP redirect from /docs to our patched index.html
  app.use(`${APP_URI_PREFIX}/docs/`, (req, res) => {
    res.setHeader('Location', `${APP_URI_PREFIX}/docs/index.html`);
    res.writeHead(302, 'redirecting to swaggerui');
    res.end();
  });

  // Start the server
  createServer(app).listen();

});

/** 
 * 
 * Hot patch the index.html from swagger-ui-dist to our shcema index
 *  
*/
const swaggerUIIndex = (indexUri) => {
  const indexContent = fs.readFileSync(`${pathToSwaggerUi}/index.html`)
    .toString()
    .replace(/url:(.*)?/, 'url: "' + indexUri + '",');
  return indexContent;
};