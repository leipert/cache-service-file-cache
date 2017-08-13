const crypto = require('crypto');
const path = require('path');
const CircularJSON = require('circular-json');

const fs = require('fs-extra');
const Promise = require('bluebird');

function FileCache(config) {
    const self = this;
    config = config || {};
    self.type = 'file-cache';
    self.verbose = config.verbose || false;
    self.defaultExpiration = config.defaultExpiration || 900;
    self.maxRetries = config.maxRetries || 4;
    self.retryDelay = config.retryDelay || 250;

    if (config.tmpDir) {
        self.tmpDir = config.tmpDir;
    } else {
        if (!config.key) {
            throw new Error(`Please either supply 'tmpDir' or 'key' option`);
        }
        self.tmpDir = path.join(require('os').tmpDir(), config.key);
    }

    function _log(message) {
        if (self.verbose) {
            console.error(message);
        }
    }

    function _getCacheFilePath(key) {
        return path.join(
            self.tmpDir,
            crypto.createHash('md5').update(key).digest('hex') + '.cjson'
        );
    }

    let askedForFile = {};

    function _getFile(key) {
        const file = _getCacheFilePath(key);

        return fs
            .pathExists(file)
            .then(exists => {
                if (exists) {
                    _log(`_getFile: Trying to load key ${key}: ${file}`);
                    return fs.readFile(file);
                }
                _log(`_getFile: No cache for key ${key} found`);
                return null;
            })
            .then(string => {
                if (string) {
                    try {
                        return CircularJSON.parse(string);
                    } catch (e) {
                        _log(`_getFile: Cache for ${key} could not be parsed`);
                        _log(e);
                        return null;
                    }
                }
                return null;
            })
            .then(json => {
                if (json && json.value) {
                    delete askedForFile[file];
                    if (json.expires && json.expires > Date.now()) {
                        return json.value;
                    }
                    _log(`_getFile: Key ${key} expired`);
                }

                if (askedForFile[file] <= self.maxRetries) {
                    askedForFile[file] += 1;
                    return Promise.delay(self.retryDelay).then(() => {
                        _log(`Waiting ${self.retryDelay}ms for key ${key}`);
                        return _getFile(key);
                    });
                } else {
                    askedForFile[file] = 1;
                }
                return null;
            });
    }

    function mget(keys, callback) {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const promises = keyArray.reduce((result, key) => {
            result[key] = _getFile(key)
                .then(value => (value === null ? undefined : value))
                .catch(() => undefined);
            return result;
        }, {});

        Promise.props(promises).then(result => {
            callback(null, result);
        });
    }

    function get(key, callback) {
        _getFile(key)
            .then(value => {
                callback(null, value);
            })
            .catch(error => {
                callback(error, null);
            });
    }

    function flush(cb) {
        _log('flush: flushing everything');
        askedForFile = {};
        if (cb) {
            fs.remove(self.tmpDir, cb);
        }

        fs.removeSync(self.tmpDir);
    }

    function del(keys, cb) {
        if (!Array.isArray(keys)) {
            keys = [keys];
        }

        const errors = [];

        if (cb) {
            let count = 0;

            Promise.all(
                keys.map(key => {
                    const file = _getCacheFilePath(key);

                    return fs
                        .pathExists(file)
                        .then(exists => {
                            if (exists) {
                                return fs.remove(file).then(() => {
                                    count = +1;
                                });
                            }
                            return null;
                        })
                        .catch(err => {
                            _log(`Could not delete key ${key}`);
                            _log(e);
                            errors.push(err);
                        });
                })
            ).then(() => {
                if (errors.length > 0) {
                    const error = Error('Could not delete from cache');
                    error.errors = errors;
                    cb(error, count);
                } else {
                    cb(null, count);
                }
            });
        } else {
            keys.forEach(key => {
                const file = _getCacheFilePath(key);
                try {
                    if (fs.pathExistsSync(file)) {
                        fs.removeSync(file);
                    }
                } catch (e) {
                    _log(`Could not delete key ${key}`);
                    _log(e);
                }
            });
        }
    }

    function _safeFile(key, expiration, value, async) {
        const now = Date.now();
        const file = _getCacheFilePath(key);
        fs.ensureDirSync(path.dirname(file));

        const object = CircularJSON.stringify({
            key: key,
            retrieved: now,
            expires: now + expiration * 1000,
            value: value,
        });

        _log(
            `_safeFile: Trying to safe ${key} in ${file} (expiration: ${expiration})`
        );

        if (async) {
            return fs.writeFile(file, object);
        }
        fs.writeFileSync(file, object);
    }

    function mset(obj) {
        const expiration = arguments[1] || self.defaultExpiration;
        const cb = arguments[2];

        if (cb) {
            const promises = [];

            Object.keys(obj).forEach(key => {
                promises.push(_safeFile(key, expiration, obj[key], true));
            });

            Promise.all(promises)
                .then(() => cb(null, true))
                .catch(err => cb(err));
        } else {
            Object.keys(obj).forEach(key => {
                _safeFile(key, expiration, obj[key], false);
            });
        }
    }

    function set() {
        const key = arguments[0];
        const value = arguments[1];
        const expiration = arguments[2] || self.defaultExpiration;
        const refresh = arguments.length === 5 ? arguments[3] : null;
        const cb = arguments.length === 5 ? arguments[4] : arguments[3];

        if (refresh) {
            throw new Error('Refresh is not supported by this store');
        }

        if (cb) {
            _safeFile(key, expiration, value, true)
                .then(() => cb(null, true))
                .catch(error => cb(error));
        } else {
            _safeFile(key, expiration, value, false);
        }
    }

    return {
        type: 'file-cache',
        get: get,
        del: del,
        mget: mget,
        mset: mset,
        set: set,
        flush: flush,
    };
}

module.exports = FileCache;
