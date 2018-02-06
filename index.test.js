'use strict';

const mocha = require('mocha');

const describe = mocha.describe;
const it = mocha.it;

const should = require('should');
const FileCache = require('./index');
const path = require('path');
const fs = require('fs-extra');
const tempDir = path.join(__dirname, 'temp');
const nodeCache = new FileCache({
    tmpDir: tempDir,
    verbose: true,
});

const key = 'xxx';
const value = 'yyy';

afterEach(() => {
    nodeCache.flush();
});

const fileCount = () => {
    if (fs.pathExistsSync(tempDir)) {
        return fs.readdirSync(tempDir).length;
    }
    return 0;
};

const corruptCache = () => {
    if (fs.pathExistsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            fs.writeFileSync(path.join(tempDir, file), 'corrupt');
        });
    }
};

describe('nodeCacheModule Tests', () => {
    it('Getting absent key should return null', done => {
        nodeCache.get(key, (err, result) => {
            should(result).be.null();
            done();
        });
    });
    it('Setting then getting key should return value', done => {
        nodeCache.set(key, value);
        nodeCache.get(key, (err, result) => {
            should(result).equal(value);
            done();
        });
    });
    it('Setting then deleting then getting key should return null', function(done) {
        nodeCache.set(key, value);
        nodeCache.del(key);
        nodeCache.get(key, (err, result) => {
            should(result).be.null();
            done();
        });
    });

    it('Setting several keys then calling .mget() should retrieve all keys', function(done) {
        nodeCache.set(key, value);
        nodeCache.set('key2', 'value2');
        nodeCache.set('key3', 'value3');
        nodeCache.mget([key, 'key2', 'key3', 'key4'], (err, response) => {
            should(response[key]).equal(value);
            should(response.key2).equal('value2');
            should(response.key3).equal('value3');
            should(response.key4).be.undefined();
            done();
        });
    });
    it('Setting several keys via .mset() then calling .mget() should retrieve all keys', function(done) {
        nodeCache.mset({ [key]: value, key2: 'value2', key3: 'value3' });
        nodeCache.mget([key, 'key2', 'key3', 'key4'], (err, response) => {
            should(response[key]).equal(value);
            should(response.key2).equal('value2');
            should(response.key3).equal('value3');
            should(response.key4).be.undefined();
            done();
        });
    });
    it('Setting several keys then calling .flush() should remove all keys', function(done) {
        let keyCount = fileCount();
        should(keyCount).equal(0);
        nodeCache.set(key, value);
        nodeCache.set('key2', 'value2');
        nodeCache.set('key3', 'value3');
        keyCount = fileCount();
        should(keyCount).equal(3);
        nodeCache.flush();
        keyCount = fileCount();
        should(keyCount).equal(0);
        done();
    });

    it('Should wait if a cache is not filled', done => {
        nodeCache.get(key, (err, returned) => {
            should(returned).be.null();
            setTimeout(() => {
                nodeCache.set(key, value);
            }, 500);
        });
        setTimeout(() => {
            nodeCache.get(key, (err, returned) => {
                should(returned).equal(value);
                done();
            });
        }, 150);
    });

    it('Should wait if a cache is not filled, but get null later on', done => {
        nodeCache.get(key, (err, returned) => {
            should(returned).be.null();
        });
        setTimeout(() => {
            nodeCache.get(key, (err, returned) => {
                should(returned).be.null();
                done();
            });
        }, 150);
    });

    it('Saving data with newlines should be saved correctly', done => {
        const newLines = 'foo\nbar';

        nodeCache.set(key, newLines);
        nodeCache.get(key, (err, result) => {
            should(result).equal(newLines);
            done();
        });
    });

    it('Saving data with circular data should be saved correctly', done => {
        const object = {};
        object.number = 1;
        object.arr = [object, object];
        object.arr.push(object.arr);
        object.obj = object;

        nodeCache.set(key, object);
        nodeCache.get(key, (err, result) => {
            should(result.obj.number).equal(result.obj.number);
            done();
        });
    });

    it('Loading corrupted keys should work just fine', done => {
        nodeCache.set(key, value);

        corruptCache();

        nodeCache.get(key, (err, result) => {
            should(result).be.null();
            done();
        });
    });
});
