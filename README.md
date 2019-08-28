# Trusted Devices Services - Swagger Edition

## Overview
This is a nodejs based application which expects to be co-resident with `restjavad` such that it can create device trusts and proxy trusted requests.

The application provides two URI namespaces:

- `/TustedDevices` - used to manage the device trusts between the local `restjavad` instance and remote TMOS devices.
- `/TustedProxy` - used to either retrieve query parameter based trust tokens or to proxy signed iControl REST requests to remote TMOS devices.

This application was written 'schema first'. The OpenAPI schema for this application can be found in the `./api/swagger.yaml` file and is served up as `/api-docs/swagger.json` through the `swagger-ui` interface. The application service uses OAS-tools, `swagger-middleware` to validate requests against the schema.

How is this different than the `f5-api-services-gateway` iControl LX based extension for `TrustedDevices` and `TrustedProxy`? It contains zero iControl LX code. It uses direct nodejs `http` and `https` module queries. It also does not mangle your HTTP requests headers 'automagically' the way the iControl LX framework does.

### Running the server
To run the server, run:

```
npm start
```

To view the Swagger UI interface:

```
open http://localhost:3000
```

This application utilized the OAS-tool kit as well as swagger-ui-dist.
