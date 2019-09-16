/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const fs = require('fs');
const path = require('path');

const app = require('connect')();

const bodyParser = require('body-parser');
const oas3Tools = require('oas3-tools');
const serveStatic = require('serve-static');
const pathToSwaggerUi = require('swagger-ui-dist').absolutePath();
const jsyaml = require('js-yaml');

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
const SWAGGERUI_PREFIX = '/TrustedDevicesUI';

// Initialize the Swagger middleware
oas3Tools.initializeMiddleware(swaggerDoc, function (middleware) {

  // Make generic req.body available for JSON submitted for TrustedDevices
  // This overcomes a bug in the old swagger-middleware used by OAS tools.
  app.use(`/TrustedDevices`, bodyParser.json());

  // Allow for CORS from browsers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    next();
  });

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
  app.use(`${SWAGGERUI_PREFIX}/api-docs`, serveStatic(path.join(__dirname, './api'), { 'index': ['swagger.json'] }));

  // Replace the static index.html form 'swagger-ui-dist' with our API index
  app.use(`${SWAGGERUI_PREFIX}/docs/index.html`, serveStatic(path.join(__dirname, './static/index.html')));
  app.use(`${SWAGGERUI_PREFIX}/static`, serveStatic(path.join(__dirname, './static')));

  // Serve up swagger-ui content
  app.use(`${SWAGGERUI_PREFIX}/docs`, serveStatic(pathToSwaggerUi, { 'index': ['index.html'] }));
  app.use(`${SWAGGERUI_PREFIX}/static`, serveStatic(path.join(__dirname, './static')));

  // Create a HTTP redirect from /docs to our patched index.html
  app.use(`${SWAGGERUI_PREFIX}/`, (req, res) => {
    res.setHeader('Location', `${SWAGGERUI_PREFIX}/docs/index.html`);
    res.writeHead(302, 'redirecting to swaggerui');
    res.end();
  });

  // Redirect Index to SwaggerUI index
  app.use(`/`, (req, res) => {
    res.setHeader('Location', `${SWAGGERUI_PREFIX}/docs/index.html`);
    res.writeHead(302, 'redirecting to swaggerui');
    res.end();
  });

});

module.exports = app;