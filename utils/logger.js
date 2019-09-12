/* jshint esversion: 6 */
/* jshint node: true */
const colors = require('colors');
const _ = require('lodash');

const _makeLogFunction = (color, level) => {
    return function (msg) {
        console.log(('[' + level + ']')[color] + ' ' + new Date().toISOString().grey + ' ' + msg + ' ');
    };
};

let logger = {
    addLevels: (levels) => {
        logger = _.defaults(logger, _.mapValues(levels, _makeLogFunction));
    }
};

logger.addLevels({
    debug: 'grey',
    info: 'blue',
    warn: 'magenta',
    error: 'red',
    severe: 'yellow'
});

module.exports = logger;