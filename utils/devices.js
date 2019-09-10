/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const logger = require('./logger');
const LOG_PRE = 'TrustedDevicesUtil';

const fs = require('fs');
const url = require('url');
const http = require('http');
const https = require('https');

const sshClient = require('ssh2').Client;

const certPath = '/mgmt/shared/device-certificates';
const deviceGroupsPath = '/mgmt/shared/resolver/device-groups';
const deviceInfoPath = '/mgmt/shared/identified-devices/config/device-info';
const usersPath = '/mgmt/shared/authz/users';
const pingPath = '/mgmt/shared/echo';

const TARGET_HOST_TIMEOUT = 300000;
let targetCache = {};

const tokenPath = '/shared/token';
const TOKEN_TIMEOUT = 300000;
let tokenCache = {};

const localHeaders = {
    'Authorization': 'Basic ' + new Buffer('admin:').toString('base64'),
    'Content-Type': 'application/json'
};
const localOptions = {
    'protocol': 'http:',
    'host': 'localhost',
    'port': 8100,
    'timout': 2000
};
const remoteHeaders = {
    'Content-Type': 'application/json'
};
const remoteOptions = {
    'protocol': 'https:',
    'rejectUnauthorized': false,
    'timeout': 10000,
};
const ACTIVE = 'ACTIVE';
const STARTED = 'STARTED';
const DEVICEGROUP_PREFIX = 'TrustDevices_';
const MAX_DEVICES_PER_GROUP = 20;

const INJECTED_USERNAME_PREFIX = 'f5trusteddevice';

// local globals cache
global.machineId = null;
global.serviceUsername = null;
global.servicePassword = null;
global.hostsToClean = [];
global.downDevices = {};

/** helper functions */


/**
 * retrieve trusted device definition by its targetUUID or targetHost
 *
 * Returns a promise which is resolved with the traget device or 
 * rejects if no target is found for the supplied target argument
 *  
 **/
const getTrustedDevice = (target) => {
    return new Promise((resolve, reject) => {
        getTrustedDevices()
            .then((devices) => {
                let found = false;
                devices.forEach((device) => {
                    if (target && device.targetUUID == target ||
                        target && device.targetHost == target) {
                        found = true;
                        targetCache[device.targetUUID] = {
                            targetHost: device.targetHost,
                            targetPort: device.targetPort,
                            teagetUUID: device.targetUUID
                        };
                        resolve(device);
                    }
                });
                if (!found) {
                    resolve(null);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
};

/**
 * Resolves TargetHost and TargetPort from TargetUUID with caching
 *
 * this is a common function in proxy calls to retrieve tokens
 **/
const resolveTargetFromUUID = (targetUUID) => {
    return new Promise((resolve, reject) => {
        if (targetUUID in targetCache) {
            logger.debug(`${LOG_PRE} - targetUUID: ${targetUUID} resolved from cache`);
            resolve(targetCache[targetUUID]);
        } else {
            getTrustedDevice(targetUUID)
                .then((device) => {
                    if (device) {
                        resolve(device);
                    } else {
                        const error = new Error('device not found');
                        device.statusCode = 404;
                        device.message = 'device not found';
                        reject(error);
                    }
                })
                .catch((error) => {
                    reject(error);
                });
        }
    });
};


/**
 * retrieve all defined trusted devices
 *
 * returns a promise which resolves with a list of target device
 * objects or rejects if they can't be resolved. If there are 
 * no trusted deviecs the promise resolves with an empty list.
 **/
const getTrustedDevices = () => {
    return new Promise((resolve, reject) => {
        const returnDevices = [];
        _queryDeviceGroups()
            .then((deviceGroups) => {
                const devicePromises = [];
                deviceGroups.forEach((deviceGroup) => {
                    devicePromises.push(
                        _getTrustedDevicesInGroup(deviceGroup)
                            .then((trustedDevices) => {
                                trustedDevices.forEach((device) => {
                                    returnDevices.push(device);
                                });
                            })
                    );
                });
                Promise.all(devicePromises)
                    .then(() => {
                        resolve(returnDevices);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Calls the iControl REST echo service and returns
 * boolean true if iControl REST is in the STARTED state.
 * Returns false if the host is not trusted or if iControl
 * REST is not STARTED.
 **/
const pingRemoteDevice = (targetUUID) => {
    return new Promise((resolve) => {
        let foundDevice = null;
        resolveTargetFromUUID(targetUUID)
            .then((device) => {
                foundDevice = device;
                return getToken(device.targetHost);
            })
            .then((token) => {
                const options = Object.assign({}, remoteOptions);
                options.headers = Object.assign({}, remoteHeaders);
                options.host = foundDevice.targetHost;
                options.port = foundDevice.targetPort;
                options.path = `${pingPath}?${token.queryParam}`;
                https.request(options, (res) => {
                    let body = '';
                    res.on('data', (seg) => {
                        body += seg;
                    });
                    res.on('end', () => {
                        try {
                            _handleErrors(res, body);
                            if (JSON.parse(body).stage == STARTED) {
                                resolve(true);
                            }
                        } catch (ex) {
                            resolve(false);
                        }
                    });
                    res.on('error', () => {
                        resolve(false);
                    });
                });
            })
            .catch((error) => {
                if (!foundDevice) {
                    logger.error(`${LOG_PRE} - proxy taget device ${targetUUID} not found`);
                } else {
                    logger.error(`${LOG_PRE} - ${error}`);
                }
                resolve(false);
            });
    });
};


/**
 * Signs the provided URL with the token query parameters provided
 * either the taretUUID or targetHost.
 *
 * returns a promise which resolves with the decorated URL ready
 * for making a request to a trusted host.
 **/
const signURL = (targetHost, iControlUrl) => {
    return new Promise((resolve, reject) => {
        getToken(targetHost)
            .then((token) => {
                const urlObj = url.parse(iControlUrl);
                if (urlObj.query) {
                    resolve(`${iControlUrl}&${token.queryParam}`);
                } else {
                    resolve(`${iControlUrl}?${token.queryParam}`);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Signs the provided URL with the token query parameters provided
 * either the taretUUID or targetHost.
 *
 * returns a promise which resolves with the decorated URL ready
 * for making a request to a trusted host.
 **/
const signPath = (targetHost, path) => {
    return new Promise((resolve, reject) => {
        getToken(targetHost)
            .then((token) => {
                const urlObj = url.parse(path);
                if (urlObj.query) {
                    resolve(`${path}&${token.queryParam}`);
                } else {
                    resolve(`${path}?${token.queryParam}`);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Retrieve trusted device token for the provided targetHost
 *
 * returns a promise which resolves with the token object or
 * rejects if not trusted device is found or an error occurs.
 **/
const getToken = (targetHost) => {
    return new Promise((resolve, reject) => {
        if (targetHost in Object.keys(global.downDevices)) {
            reject(new Error(`${targetHost} is currently unavailable`));
        } else if (targetHost in tokenCache) {
            const now = Date.now();
            const cachetimeleft = TOKEN_TIMEOUT - (now - tokenCache[targetHost].timestamp);
            if (cachetimeleft > 0) {
                tokenCache[targetHost].fromCache = true;
                tokenCache[targetHost].fromCacheTimestamp = now;
                logger.debug(`${LOG_PRE} - retrieved token from cache for ${targetHost} with ${cachetimeleft} ms in cache left`);
                resolve(Promise.resolve(tokenCache[targetHost]));
            } else {
                _fetchToken(targetHost)
                    .then((token) => {
                        resolve(token);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            }
        } else {
            _fetchToken(targetHost)
                .then((token) => {
                    resolve(token);
                })
                .catch((error) => {
                    reject(error);
                });
        }
    });
};


const _fetchToken = (targetHost) => {
    return new Promise((resolve, reject) => {
        const tokenBody = JSON.stringify({
            address: targetHost
        });
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = tokenPath;
        options.headers['Content-Length'] = tokenBody.length;
        options.method = 'POST';
        logger.debug(`${LOG_PRE} - retrieved token from ${options.path} for host ${targetHost}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    const jsonToken = JSON.parse(body);
                    tokenCache[targetHost] = jsonToken;
                    resolve(jsonToken);
                } catch (ex) {
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error retrieving token - ${error}`);
            reject(error);
        });
        request.write(tokenBody);
        request.end();
    });
};


const _userExists = (device, username) => {
    return new Promise((resolve, reject) => {
        _queryRemoteUsers(device)
            .then((users) => {
                let foundUser = false;
                users.forEach((user) => {
                    if (user == username) {
                        foundUser = true;
                    }
                });
                resolve(foundUser);
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _sshUserExists = (targetHost, targetPort, targetUsername, targetSshKey, userName) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(targetSshKey)) {
            reject(new Error(`SSH key ${targetSshKey} not found.`));
        } else {
            const privateKey = fs.readFileSync(targetSshKey);
            const queryUsersCmd = "curl -su 'admin:' http://localhost:8100/mgmt/shared/authz/users";
            const conn = sshClient();
            conn.on('ready', () => {
                conn.exec(queryUsersCmd, (error, stream) => {
                    if (error) {
                        reject(error);
                    }
                    let usersText = '';
                    stream.on('close', (code) => {
                        if (code == 0) {
                            const users = JSON.parse(usersText);
                            let foundUser = false;
                            users.items.forEach((user) => {
                                if (user.name == userName) {
                                    foundUser = true;
                                }
                            });
                            resolve(foundUser);
                        } else {
                            reject(new Error(`SSH query of users responded with code: ${code}`));
                        }
                    }).on('data', function (data) {
                        usersText += data;
                    });
                });
            }).on('error', (error) => {
                logger.error(`${LOG_PRE} - SSH query of users error: ${error}`);
                reject(error);
            }).connect({
                host: targetHost,
                port: targetPort,
                username: targetUsername,
                privateKey: privateKey
            });
        }
    });
};


const _deleteUser = (device) => {
    return new Promise((resolve, reject) => {
        let serviceUserName = null;
        _queryServiceUsername()
            .then((userName) => {
                serviceUserName = userName;
                return _userExists(device, userName);
            })
            .then((exists) => {
                if (exists) {
                    return _deleteRemoteUser(device, serviceUserName);
                } else {
                    return resolve();
                }
            })
            .then(() => {
                resolve();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _sshDeleteUser = (targetHost, targetPort, targetUsername, targetSshKey) => {
    return new Promise((resolve, reject) => {
        let serviceUserName = null;
        _queryServiceUsername()
            .then((userName) => {
                serviceUserName = userName;
                return _sshUserExists(targetHost, targetPort, targetUsername, targetSshKey, userName);
            })
            .then((userExists) => {
                if (userExists) {
                    const privateKey = fs.readFileSync(targetSshKey);
                    const deleteUserCmd = `tmsh delete auth user ${serviceUserName}`;
                    const conn = sshClient();
                    conn.on('ready', () => {
                        conn.exec(deleteUserCmd, (error, stream) => {
                            if (error) {
                                reject(error);
                            }
                            stream.on('close', (code) => {
                                if (code == 0) {
                                    resolve();
                                } else {
                                    reject(new Error(`SSH delete users responded with code: ${code}`));
                                }
                            });
                        });
                    }).on('error', (error) => {
                        logger.error(`${LOG_PRE} - SSH delete user error: ${error}`);
                        reject(error);
                    }).connect({
                        host: targetHost,
                        port: targetPort,
                        username: targetUsername,
                        privateKey: privateKey
                    });
                } else {
                    resolve();
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _sshCreateUser = (targetHost, targetPort, targetUsername, targetSshKey) => {
    return new Promise((resolve, reject) => {
        let serviceUserName = null;
        _sshDeleteUser(targetHost, targetPort, targetUsername, targetSshKey)
            .then(() => {
                return _queryServiceUsername();
            })
            .then((userName) => {
                serviceUserName = userName;
                return _queryServicePassword();
            })
            .then((password) => {
                const privateKey = fs.readFileSync(targetSshKey);
                const createUserCmd = `tmsh create auth user ${serviceUserName} shell none partition-access add { all-partitions { role admin } } password ${password}`;
                var conn = new sshClient();
                conn.on('ready', () => {
                    conn.exec(createUserCmd, (error, stream) => {
                        if (error) {
                            reject(error);
                        }
                        stream.on('close', (code) => {
                            conn.end();
                            if (code == 0) {
                                const getMgmtPortCmd = "curl -su 'admin:' http://localhost:8100/mgmt/shared/resolver/device-groups/tm-shared-all-big-ips/devices|python -c 'import sys, json; print json.load(sys.stdin)[\"items\"][0][\"httpsPort\"]'";
                                conn.exec(getMgmtPortCmd, (error, queryStream) => {
                                    if (error) {
                                        reject(error);
                                    }
                                    let httpsPort = 443;
                                    queryStream.on('close', (code) => {
                                        if (code == 0) {
                                            global.hostsToClean.append(targetHost);
                                            resolve(serviceUserName, password, httpsPort);
                                        } else {
                                            _sshDeleteUser(targetHost, targetPort, targetUsername, targetSshKey)
                                                .then(() => {
                                                    reject(`SSH command could not resolve httpsPort. Exited with code: ${code}`);
                                                })
                                                .catch((error) => {
                                                    reject(error);
                                                });
                                        }
                                    }).on('data', function (data) {
                                        httpsPort = parseInt(data);
                                    });
                                });
                            } else {
                                reject(new Error(`SSH command to create user exited with code: ${code}`));
                            }
                        });
                    });
                }).on('error', (error) => {
                    logger.error(`${LOG_PRE} - SSH create user error: ${error}`);
                    reject(error);
                }).connect({
                    host: targetHost,
                    port: targetPort,
                    username: targetUsername,
                    privateKey: privateKey
                });
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const cleanDevices = () => {
    const needCleaning = [];
    getTrustedDevices()
        .then((devices) => {
            const deviceCleanPromises = [];
            devices.forEach((device) => {
                if (device.available && (
                    device.targetHost in global.needCleaning ||
                    device.targetUUID in global.needCleaning
                    )) {
                    deviceCleanPromises.push(_deleteUser(device))
                        .catch((error) => {
                            logger.error(`${LOG_PRE} - error deleting service user on ${device.targetHost} - ${error}`);
                            needCleaning.push(device.targetHost);
                        });
                }
            });
            Promise.all(deviceCleanPromises)
                .then(() => {
                    global.needCleaning = needCleaning;
                });
        })
        .catch((error) => {
            logger.error(`${LOG_PRE} - error cleaning devices`);

        });
};


const monitorDevices = () => {
    getTrustedDevices()
        .then((devices) => {
            const monitorPromises = [];
            devices.forEach((device) => {
                monitorPromises.push(pingRemoteDevice(device.targetUUID))
                    .then((deviceUp) => {
                        if(deviceUp) {
                            if(device.targetHost in Object.keys(global.downDevices)) {
                                delete(global.downDevices[device.targetHost]);
                            }
                        } else {
                            global.downDevices[device.targetHost] = 1;
                        }
                    });
            });
            Promise.all(monitorPromises);
                logger.debug(`${LOG_PRE} - monitor run on ${monitorPromises.length} device(s) completed`);
        })
        .catch((error) => {
            logger.error(`${LOG_PRE} - error monitoring devices`);

        });
};

/**
 * Flushes trust tokens form the token cache
 **/
const flushTokenCache = (targetHost) => {
    return new Promise((resolve, reject) => {
        try {
            if (!targetHost) {
                // remove all token cache
                tokenCache = {};
                // remove all target cache
                targetCache = {};
                resolve();
            } else {
                // remove toke cache for this targetHost
                delete (tokenCache[targetHost]);
                // reverse interate through the targetUUID cache
                // and remove any device cache for the specified 
                // targetHost.
                const needToDelete = [];
                Object.keys(targetCache).forEach((targetUUID) => {
                    if (targetCache[targetUUID].targetHost == targetHost) {
                        needToDelete.push(targetUUID);
                    }
                });
                needToDelete.forEach((targetUUID) => {
                    delete (targetCache[targetUUID]);
                });
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    });
};


/**
 * Add device trusts for a list of supplied targets
 *
 * Returns a promise which resolves when devices are added.
 **/
const addDevices = (targets) => {
    return new Promise((resolve, reject) => {
        const addDevicePromises = [];
        targets.forEach((target) => {
            if (target.hasOwnProperty('targetSshKey')) {
                addDevicePromises.push(
                    _sshCreateUser(target.targetHost, target.targetPort, target.targetUsername, target.targetSshKey)
                        .then((targetUsername, targetPassphrase, targetPort) => {
                            addDevicePromises.push(
                                addDevice(target.targetHost, targetPort, targetUsername, targetPassphrase)
                            );
                        })
                );
            } else {
                addDevicePromises.push(
                    addDevice(target.targetHost, target.targetPort, target.targetUsername, target.targetPassphrase)
                );
            }
        });
        Promise.all(addDevicePromises)
            .then(() => {
                resolve();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Add a device trusts the supplied target
 *
 * Returns a promise which resolves when the device is added.
 **/
const addDevice = (targetHost, targetPort, targetUsername, targetPassphrase) => {
    return new Promise((resolve, reject) => {
        _getCandidateDeviceGroup()
            .then((deviceGroup) => {
                return _createDevice(deviceGroup, targetHost, targetPort, targetUsername, targetPassphrase);
            })
            .then((device) => {
                resolve(device);
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Deletes device trusts for a list of supplied devices
 *
 * Returns a promise which resolves when devices are deleted.
 **/
const deleteDevices = (devices) => {
    return new Promise((resolve, reject) => {
        const deleteDevicePromises = [];
        devices.forEach((device) => {
            deleteDevicePromises.push(
                deleteDevice(device)
            );
        });
        Promise.all(deleteDevicePromises)
            .then(() => {
                resolve();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Deletes device trust for a a supplied device
 *
 * Returns a promise which resolves when the device is deleted.
 **/
const deleteDevice = (device) => {
    return new Promise((resolve, reject) => {
        let foundDeviceGroup = '';
        logger.debug(`${LOG_PRE} - deleting targetUUID: ${device.targetUUID} from cache`);
        delete (targetCache[device.targetUUID]);
        _findDeviceGroupWithDevice(device)
            .then((deviceGroup) => {
                foundDeviceGroup = deviceGroup;
                return _deleteLocalCertificateOnRemote(device)
                    .then(() => {
                        return Promise.resolve();
                    })
                    .catch((error) => {
                        return Promise.resolve();
                    });
            })
            .then(() => {
                return _deleteCertificateByDevice(device)
                    .then(() => {
                        return Promise.resolve();
                    })
                    .catch((error) => {
                        return Promise.resolve();
                    });
            })
            .then(() => {
                return _deleteDevice(foundDeviceGroup, device.targetUUID);
            })
            .then((returnObj) => {
                resolve(returnObj);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

/**
 * Declarative interface to trusted devices
 *
 * When you declare your trusted devices, all non-declared trusted
 * deviecs will be remove, any missing devices will be added.
 * 
 * returns a promise which resolves with the currently populated
 * trusted devices, after the declaration alterations.
 **/
const declareDevices = (desiredDevices) => {
    return new Promise((resolve, reject) => {
        // create comparison collections
        const desiredDeviceDict = {};
        const existingDeviceDict = {};
        // populate desired ollection with targetHost:targetPort keys
        desiredDevices.forEach((device) => {
            if (!device.hasOwnProperty('targetPort')) {
                device.targetPort = 443;
            }
            desiredDeviceDict[`${device.targetHost}:${device.targetPort}`] = device;
        });
        // populate existing collection with targetHost:targetPort keys
        let existingDevices = [];
        getTrustedDevices()
            .then((discoveredDevices) => {
                existingDevices = discoveredDevices;
                discoveredDevices.forEach((device) => {
                    existingDeviceDict[`${device.targetHost}:${device.targetPort}`] = device;
                    for (let device in desiredDeviceDict) {
                        if (device in existingDeviceDict) {
                            if (existingDeviceDict[device].state === ACTIVE || _inProgress(existingDeviceDict[device].state)) {
                                // Device is desired, exists already, and is active or in progress. Don't remove it.
                                existingDevices = existingDevices.filter(t => `${device.targetHost}:${device.targetPort}` !== device); // jshint ignore:line
                                // Device is desired, exists already, and is active or in progress. Don't add it.
                                desiredDevices = desiredDevices.filter(t => `${device.targetHost}:${device.targetPort}` !== device); // jshint ignore:line
                            } else {
                                if (
                                    (
                                        !desiredDeviceDict[device].hasOwnProperty('targetUsername') &&
                                        !desiredDeviceDict[device].hasOwnProperty('targetPassphrase')
                                    ) ||
                                    (
                                        !desiredDeviceDict[device].hasOwnProperty('targetUsername') &&
                                        !desiredDeviceDict[device].hasOwnProperty('targetSshKey')
                                    )
                                ) {
                                    const err = new Error();
                                    err.statusCode = 400;
                                    err.message = 'declared device missing targetUsername, targetPassphrase, or targetSshKey';
                                    throw err;
                                }
                            }
                        } else {
                            if (
                                (
                                    !desiredDeviceDict[device].hasOwnProperty('targetUsername') &&
                                    !desiredDeviceDict[device].hasOwnProperty('targetPassphrase')
                                ) ||
                                (
                                    !desiredDeviceDict[device].hasOwnProperty('targetUsername') &&
                                    !desiredDeviceDict[device].hasOwnProperty('targetSshKey')
                                )
                            ) {
                                const err = new Error();
                                err.statusCode = 400;
                                err.message = 'declared device missing targetUsername, targetPassphrase, or targetSshKey';
                                throw err;
                            }
                        }
                    }
                });
                return deleteDevices(existingDevices);
            })
            .then(() => {
                return addDevices(desiredDevices);
            })
            .then(() => {
                return getTrustedDevices();
            })
            .then((currentDevices) => {
                resolve(currentDevices);
            })
            .catch((error) => {
                reject(error);
            });
    });
};


/**
 * Proxies a request to the specified targetUUID and path, 
 * signing the remote request.
 *
 * Takes a targetUUID, path, and then a http request an respon object.
 * The response is piped to the response object.
 **/
const proxyRequest = (targetUUID, path, client_req, client_res) => {
    let foundDevice = null;
    resolveTargetFromUUID(targetUUID)
        .then((device) => {
            foundDevice = device;
            return signPath(device.targetHost, path);
        })
        .then((signedPath) => {
            const options = Object.assign({}, remoteOptions);
            options.headers = Object.assign({}, remoteHeaders);
            options.host = foundDevice.targetHost;
            options.port = foundDevice.targetPort;
            options.path = signedPath;
            options.method = client_req.method;
            if (client_req.headers) {
                options.headers = client_req.headers;
            }
            const proxy = https.request(options, (res) => {
                client_res.writeHead(res.statusCode, res.headers);
                logger.debug(`${LOG_PRE} - proxy request taget device ${targetUUID} - ${res.statusCode} - ${path}`);
                res.on('data', (seg) => {
                    client_res.write(seg);
                });
                res.on('end', () => {
                    client_res.end();
                });
                /**
                 * unit-http IncomingMessage object won't let you pipe
                 * the streams together
                 * res.pipe(client_res, {
                 *    end: true
                 * });
                */
            });
            client_req.on('data', (seg) => {
                proxy.write(seg);
            });
            client_req.on('end', () => {
                proxy.end();
            });
            /**
             * unit-http IncomingMessage object won't let you pipe
             * the streams together
             * client_req.pipe(proxy, {
             *   end: true
             * });
            */
            /** There is no 'end' event firing for client_req without a body */
            if (!client_req.headers.hasOwnProperty('content-length')) {
                proxy.end();
            }
        })
        .catch((error) => {
            if (!foundDevice) {
                logger.error(`${LOG_PRE} - proxy taget device ${targetUUID} not found`);
                client_res.writeHead(404, `target device: ${targetUUID} not found.`);
                client_res.end();
            } else {
                client_res.writeHead(500, error);
                client_res.end();
            }
        });
};


const _wait = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});


const _getCandidateDeviceGroup = () => {
    return new Promise((resolve, reject) => {
        _queryDeviceGroups()
            .then((deviceGroups) => {
                if (deviceGroups.length) {
                    // device groups exists, find an 'not full' one
                    const devicePromises = [];
                    let resolvedDeviceGroup = '';
                    let devicGroupIndex = 0;
                    deviceGroups.forEach((deviceGroup) => {
                        // only do this if we haven't found a 'not full' one yet
                        if (resolvedDeviceGroup.length == 0) {
                            const thisDeviceGroupIndex = parseInt(
                                deviceGroup.slice(DEVICEGROUP_PREFIX.length)
                            );
                            // what my highest device group index?
                            if (thisDeviceGroupIndex > devicGroupIndex) {
                                devicGroupIndex = thisDeviceGroupIndex;
                            }
                            devicePromises.push(
                                _queryDevices(deviceGroup)
                                    .then((devices) => {
                                        if (devices.length < MAX_DEVICES_PER_GROUP) {
                                            resolvedDeviceGroup = deviceGroup;
                                        }
                                    })
                            );
                        }
                    });
                    Promise.all(devicePromises)
                        .then(() => {
                            // did we find a 'not full' one?
                            if (resolvedDeviceGroup.length) {
                                resolve(resolvedDeviceGroup);
                            } else {
                                // nope.. create a new one with the highest index
                                const deviceGroupName = DEVICEGROUP_PREFIX + devicGroupIndex;
                                _createDeviceGroup(deviceGroupName)
                                    .then(() => {
                                        resolve(deviceGroupName);
                                    });
                            }
                        })
                        .catch((error) => {
                            reject(error);
                        });
                } else {
                    // No device groups exist.. create the first one
                    const deviceGroupName = DEVICEGROUP_PREFIX + '0';
                    _createDeviceGroup(deviceGroupName)
                        .then(() => {
                            resolve(deviceGroupName);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _findDeviceGroupWithDevice = (device) => {
    return new Promise((resolve, reject) => {
        _queryDeviceGroups()
            .then((deviceGroups) => {
                const findDevicePromises = [];
                let found = false;
                deviceGroups.forEach((deviceGroup) => {
                    findDevicePromises.push(
                        _getTrustedDevicesInGroup(deviceGroup)
                            .then((devices) => {
                                devices.forEach((knownDevice) => {
                                    if (device.targetUUID == knownDevice.targetUUID) {
                                        found = true;
                                        resolve(deviceGroup);
                                    }
                                });
                            })
                    );
                });
                Promise.all(findDevicePromises)
                    .then(() => {
                        if (!found) {
                            reject(new Error('no device found'));
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _inProgress = (state) => {
    let inProgress = false;
    if ((state === "PENDING") ||
        (state === "FRAMEWORK_DEPLOYMENT_PENDING") ||
        (state === "CERTIFICATE_INSTALL") ||
        (state === "PENDING_DELETE") ||
        (state === "UNDISCOVERED")) {
        inProgress = true;
    }
    return inProgress;
};


const _inFailed = (state) => {
    let inFailed = false;
    if ((state === "FAILED") ||
        (state === "ERROR")) {
        inFailed = true;
    }
};


const _getTrustedDevicesInGroup = (deviceGroup) => {
    return new Promise((resolve, reject) => {
        let machineId = null;
        _queryMachineId()
            .then((id) => {
                machineId = id;
                return _queryDevices(deviceGroup);
            })
            .then((devices) => {
                const returnDevices = [];
                devices.forEach((device) => {
                    if (device.machineId != machineId) {
                        const targetDevice = {
                            targetUUID: device.machineId,
                            targetHost: device.address,
                            targetPort: device.httpsPort,
                            state: device.state,
                            targetHostname: device.hostname,
                            targetVersion: device.version,
                            targetRESTVersion: device.restFrameworkVersion,
                        };
                        if (_inProgress(device.state)) {
                            targetDevice.available = false;
                        } else if (_inFailed(device.state)) {
                            targetDevice.available = false;
                        } else if (device.address in Object.keys(global.downDevices)) {
                            targetDevice.available = false;
                        } else {
                            targetDevice.available = true;
                        }
                        returnDevices.push(targetDevice);
                    }
                });
                resolve(returnDevices);
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _queryDeviceGroups = () => {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = deviceGroupsPath;
        let body = '';
        logger.debug(`${LOG_PRE} - querying device groups ${options.path}`);
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    const respobj = JSON.parse(body);
                    const returnDeviceGroups = [];
                    if (respobj.hasOwnProperty('items')) {
                        respobj.items.forEach((dg) => {
                            if (dg.groupName.startsWith(DEVICEGROUP_PREFIX)) {
                                returnDeviceGroups.push(dg.groupName);
                            }
                        });
                    }
                    resolve(returnDeviceGroups);
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception querying device groups - ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error querying device groups - ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error querying device groups - ${error}`);
            reject(error);
        });
        request.end();

    });
};


const _createDeviceGroup = (deviceGroupName) => {
    return new Promise((resolve, reject) => {
        const deviceGroupBody = JSON.stringify({
            'groupName': deviceGroupName,
            'display': 'Trusted Device Group',
            'description': 'Device group to establish trust for control plane request authorization'
        });
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = deviceGroupsPath;
        options.headers['Content-Length'] = deviceGroupBody.length;
        options.method = 'POST';
        logger.debug(`${LOG_PRE} - creating device group ${options.path}/${deviceGroupName}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    resolve(JSON.parse(body));
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception creating device group ${ex}`);
                    resolve({});
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error creating device groups ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error creating device groups - ${error}`);
            reject(error);
        });
        request.write(deviceGroupBody);
        request.end();
    });
};


const _queryDevices = (deviceGroup) => {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = `${deviceGroupsPath}/${deviceGroup}/devices`;
        logger.debug(`${LOG_PRE} - querying devices ${options.path}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    const respobj = JSON.parse(body);
                    if (respobj.hasOwnProperty('items')) {
                        resolve(respobj.items);
                    } else {
                        resolve([]);
                    }
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception querying devices ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error querying devices ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error querying devices - ${error}`);
            reject(error);
        });
        request.end();
    });
};


const _createDevice = (deviceGroup, targetHost, targetPort,
    targetUsername, targetPassphrase) => {
    return new Promise((resolve, reject) => {
        const deviceBody = JSON.stringify({
            'userName': targetUsername,
            'password': targetPassphrase,
            'address': targetHost,
            'httpsPort': targetPort
        });
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = `${deviceGroupsPath}/${deviceGroup}/devices`;
        options.headers['Content-Length'] = deviceBody.length;
        options.method = 'POST';
        logger.debug(`${LOG_PRE} - creating device ${options.path} - ${targetHost}:${targetPort}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    resolve(JSON.parse(body));
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception creating device ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error creating device ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error creating device - ${error}`);
            reject(error);
        });
        request.write(deviceBody);
        request.end();
    });
};


const _deleteDevice = (deviceGroup, targetUUID) => {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = `${deviceGroupsPath}/${deviceGroup}/devices/${targetUUID}`;
        options.method = 'DELETE';
        logger.debug(`${LOG_PRE} - deleting device ${options.path}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    resolve({});
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception deleting device ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error deleting device ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error deleting device - ${error}`);
            reject(error);
        });
        request.end();
    });
};


const _deleteLocalCertificateOnRemote = (device) => {
    return new Promise((resolve, reject) => {
        _queryMachineId()
            .then((machineId) => {
                _queryRemoteCertificates(device)
                    .then((foundCerts) => {
                        let found = false;
                        foundCerts.forEach((cert) => {
                            if (cert.machineId == machineId) {
                                found = true;
                                _deleteRemoteCertificate(device, cert.certificateId)
                                    .then(() => {
                                        resolve();
                                    })
                                    .catch((error) => {
                                        reject(error);
                                    });
                            }
                        });
                        if (!found) {
                            reject(new Error(`local certificate not found on device: ${device.targetUUID}`));
                        }
                    });
            });
    });
};


const _deleteCertificateByDevice = (device) => {
    return new Promise((resolve, reject) => {
        _queryCertificates()
            .then((foundCerts) => {
                let found = false;
                foundCerts.forEach((cert) => {
                    if (cert.machineId == device.targetUUID) {
                        found = true;
                        _deleteCertificate(cert.certificateId)
                            .then(() => {
                                resolve();
                            })
                            .catch((error) => {
                                reject(error);
                            });
                    }
                });
                if (!found) {
                    reject(new Error(`can not delete local certificate for device: ${device.targetUUID}. No certificate found.`));
                }
            });
    });
};


const _queryCertificates = () => {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = certPath;
        logger.debug(`${LOG_PRE} - querying certificates ${options.path}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    const respobj = JSON.parse(body);
                    if (respobj.hasOwnProperty('items')) {
                        resolve(respobj.items);
                    } else {
                        resolve([]);
                    }
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception querying certificartes ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.error(`${LOG_PRE} - error querying certificates ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error querying certificates - ${error}`);
            reject(error);
        });
        request.end();
    });
};


const _deleteCertificate = (certificateId) => {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, localOptions);
        options.headers = Object.assign({}, localHeaders);
        options.path = `${certPath}/${certificateId}`;
        options.method = 'DELETE';
        logger.debug(`${LOG_PRE} - deleting certificate ${options.path}`);
        let body = '';
        const request = http.request(options, (res) => {
            res.on('data', (seg) => {
                body += seg;
            });
            res.on('end', () => {
                try {
                    _handleErrors(res, body);
                    resolve({});
                } catch (ex) {
                    logger.error(`${LOG_PRE} - exception deleting certificate ${ex}`);
                    reject(ex);
                }
            });
            res.on('error', (error) => {
                logger.debug(`${LOG_PRE} - error deleting certificates ${error}`);
                reject(error);
            });
        });
        request.on('error', (error) => {
            logger.error(`${LOG_PRE} - error deleting certificates - ${error}`);
            reject(error);
        });
        request.end();
    });
};


const _queryRemoteCertificates = (device) => {
    return new Promise((resolve, reject) => {
        getToken(device.targetHost)
            .then((token) => {
                const options = Object.assign({}, remoteOptions);
                options.headers = Object.assign({}, remoteHeaders);
                options.host = device.targetHost;
                options.port = device.targetPort;
                options.path = `${certPath}?${token.queryParam}`;
                logger.debug(`${LOG_PRE} - querying certificates ${options.host}:${options.port} - ${certPath}`);
                let body = '';
                const request = https.request(options, (res) => {
                    res.on('data', (seg) => {
                        body += seg;
                    });
                    res.on('end', () => {
                        try {
                            _handleErrors(res, body);
                            const respobj = JSON.parse(body);
                            if (respobj.hasOwnProperty('items')) {
                                resolve(respobj.items);
                            } else {
                                resolve([]);
                            }
                        } catch (ex) {
                            logger.error(`${LOG_PRE} - exception querying certificates ${options.host}:${options.port} - ${ex}`);
                            reject(ex);
                        }
                    });
                    res.on('error', (error) => {
                        logger.error(`${LOG_PRE} - error querying certificates ${options.host}:${options.port} - ${error}`);
                        reject(error);
                    });
                });
                request.on('error', (error) => {
                    logger.error(`${LOG_PRE} - error querying certificates - ${error}`);
                    reject(error);
                });
                request.end();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _deleteRemoteCertificate = (device, certificateId) => {
    return new Promise((resolve, reject) => {
        getToken(device.targetHost)
            .then((token) => {
                const options = Object.assign({}, remoteOptions);
                options.headers = Object.assign({}, remoteHeaders);
                options.host = device.targetHost;
                options.port = device.targetPort;
                options.path = `${certPath}/${certificateId}?${token.queryParam}`;
                options.method = 'DELETE';
                logger.debug(`${LOG_PRE} - deleting certificate ${options.host}:${options.port} - ${certPath}/${certificateId}`);
                let body = '';
                const request = https.request(options, (res) => {
                    res.on('data', (seg) => {
                        body += seg;
                    });
                    res.on('end', () => {
                        try {
                            _handleErrors(res, body);
                            resolve(JSON.parse(body));
                        } catch (ex) {
                            logger.error(`${LOG_PRE} - exception deleting certificate ${options.host}:${options.port} - ${certPath}/${certificateId} - ${ex}`);
                            resolve({});
                        }
                    });
                    res.on('error', (error) => {
                        logger.error(`${LOG_PRE} - error deleting certificate ${options.host}:${options.port} - ${certPath}/${certificateId} - ${error}`);
                        reject(error);
                    });
                });
                request.on('error', (error) => {
                    logger.error(`${LOG_PRE} - error deleting certificates - ${error}`);
                    reject(error);
                });
                request.end();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _queryServicePassword = () => {
    return new Promise((resolve, reject) => {
        if (global.servicePassword) {
            resolve(global.servicePassword);
        } else {
            global.servicePassword = Math.random().toString(36).slice(-8) + 'tD0' + Math.random().toString(36).slice(-8);
            resolve(global.serviceUsername);
        }
    });
};


const _queryServiceUsername = () => {
    return new Promise((resolve, reject) => {
        if (global.serviceUsername) {
            resolve(global.serviceUsername);
        } else {
            _queryMachineId()
                .then((machineId) => {
                    global.serviceUsername = INJECTED_USERNAME_PREFIX + machineId.slice(-12);
                    resolve(global.serviceUsername);
                })
                .catch((error) => {
                    reject(error);
                });
        }
    });
};


const _queryMachineId = () => {
    return new Promise((resolve, reject) => {
        if (global.machineId) {
            logger.debug(`${LOG_PRE} - retrieved machineId from cache`);
            resolve(global.machineId);
        } else if (fs.existsSync('/machineId')) {
            logger.debug(`${LOG_PRE} - retrieved machineId from file system`);
            global.machineId = String(fs.readFileSync('/machineId', 'utf8')).replace(/[^ -~]+/g, "");
            resolve(global.machineId);
        } else {
            const options = Object.assign({}, localOptions);
            options.headers = Object.assign({}, localHeaders);
            options.path = deviceInfoPath;
            logger.debug(`${LOG_PRE} - retrieved machineId from ${options.path}`);
            let body = '';
            const request = http.request(options, (res) => {
                res.on('data', (seg) => {
                    body += seg;
                });
                res.on('end', () => {
                    try {
                        _handleErrors(res, body);
                        const respobj = JSON.parse(body);
                        if (respobj.hasOwnProperty('machineId')) {
                            global.machineId = respobj.machineId;
                            resolve(global.machineId);
                        } else {
                            return [];
                        }
                    } catch (ex) {
                        logger.error(`${LOG_PRE} - exception retrieved machineId - ${ex}`);
                        reject(ex);
                    }
                });
                res.on('error', (error) => {
                    logger.error(`${LOG_PRE} - error retrieved machineId - ${error}`);
                    reject(error);
                });
            });
            request.on('error', (error) => {
                logger.error(`${LOG_PRE} - error retrieving machineId - ${error}`);
                reject(error);
            });
            request.end();
        }
    });
};


const _queryRemoteUsers = (device) => {
    return new Promise((resolve, reject) => {
        getToken(device.targetHost)
            .then((token) => {
                const options = Object.assign({}, remoteOptions);
                options.headers = Object.assign({}, remoteHeaders);
                options.host = device.targetHost;
                options.port = device.targetPort;
                options.path = `${usersPath}?${token.queryParam}`;
                let body = '';
                logger.debug(`${LOG_PRE} - querying users ${options.path}`);
                const request = http.request(options, (res) => {
                    res.on('data', (seg) => {
                        body += seg;
                    });
                    res.on('end', () => {
                        try {
                            _handleErrors(res, body);
                            const respobj = JSON.parse(body);
                            const returnUsers = [];
                            if (respobj.hasOwnProperty('items')) {
                                respobj.items.forEach((user) => {
                                    returnUsers.push(user.name);
                                });
                            }
                            resolve(returnUsers);
                        } catch (ex) {
                            logger.error(`${LOG_PRE} - exception querying users - ${ex}`);
                            reject(ex);
                        }
                    });
                    res.on('error', (error) => {
                        logger.error(`${LOG_PRE} - error querying users - ${error}`);
                        reject(error);
                    });
                });
                request.on('error', (error) => {
                    logger.error(`${LOG_PRE} - error querying users - ${error}`);
                    reject(error);
                });
                request.end();
            })
            .catch((error) => {
                reject(error);
            });
    });
};


const _deleteRemoteUser = (device, username) => {
    return new Promise((resolve, reject) => {
        getToken(device.targetHost)
            .then((token) => {
                const options = Object.assign({}, remoteOptions);
                options.headers = Object.assign({}, remoteHeaders);
                options.host = device.targetHost;
                options.port = device.targetPort;
                options.path = `${usersPath}/${username}?${token.queryParam}`;
                options.method = 'DELETE';
                let body = '';
                logger.debug(`${LOG_PRE} - delete user ${options.path}`);
                const request = http.request(options, (res) => {
                    res.on('data', (seg) => {
                        body += seg;
                    });
                    res.on('end', () => {
                        try {
                            if (res.statusCode == 404) {
                                resolve({});
                            } else {
                                _handleErrors(res, body);
                                const respobj = JSON.parse(body);
                                resolve(respobj);
                            }
                        } catch (ex) {
                            logger.error(`${LOG_PRE} - exception deleting user ${username} - ${ex}`);
                            reject(ex);
                        }
                    });
                    res.on('error', (error) => {
                        logger.error(`${LOG_PRE} - error deleting user ${username} - ${error}`);
                        reject(error);
                    });
                });
                request.on('error', (error) => {
                    logger.error(`${LOG_PRE} - error deleting user ${username} - ${error}`);
                    reject(error);
                });
                request.end();
            });
    });
};


const _handleErrors = (res, body) => {
    if (res.statusCode > 399) {
        const err = new Error(`request Error: status: ${res.statusCode} error: ${body}`);
        err.statusCode = res.statusCode;
        err.message = body;
        logger.error(`${LOG_PRE} - error ${res.statusCode} - ${body}`);
        throw err;
    }
};


exports.addDevice = addDevice;
exports.addDevices = addDevices;
exports.deleteDevice = deleteDevice;
exports.deleteDevices = deleteDevices;
exports.getTrustedDevice = getTrustedDevice;
exports.getTrustedDevices = getTrustedDevices;
exports.declareDevices = declareDevices;
exports.pingRemoteDevice = pingRemoteDevice;
exports.cleanDevices = cleanDevices;
exports.monitorDevices = monitorDevices;
exports.getToken = getToken;
exports.flushTokenCache = flushTokenCache;
exports.resolveTargetFromUUID = resolveTargetFromUUID;
exports.signPath = signPath;
exports.signURL = signURL;
exports.proxyRequest = proxyRequest;