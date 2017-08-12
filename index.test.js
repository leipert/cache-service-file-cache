var expect = require('expect');
var FileCache = require('./index');
var path = require('path');
var fs = require('fs-extra');
const tempDir = path.join(__dirname, 'temp');
var nodeCache = new FileCache({
    tmpDir: tempDir,
    verbose: true,
});

var key = 'xxx';
var value = 'yyy';

afterEach(() => {
    nodeCache.flush();
});

var fileCount = () => {
    if (fs.pathExistsSync(tempDir)) {
        return fs.readdirSync(tempDir).length;
    }
    return 0;
};

describe('nodeCacheModule Tests', () => {
    it('Getting absent key should return null', done => {
        nodeCache.get(key, (err, result) => {
            expect(result).toBe(null);
            done();
        });
    });
    it('Setting then getting key should return value', done => {
        nodeCache.set(key, value);
        nodeCache.get(key, (err, result) => {
            expect(result).toBe(value);
            done();
        });
    });
    it('Setting then deleting then getting key should return null', function(
        done
    ) {
        nodeCache.set(key, value);
        nodeCache.del(key);
        nodeCache.get(key, (err, result) => {
            expect(result).toBe(null);
            done();
        });
    });

    it('Setting several keys then calling .mget() should retrieve all keys', function(
        done
    ) {
        nodeCache.set(key, value);
        nodeCache.set('key2', 'value2');
        nodeCache.set('key3', 'value3');
        nodeCache.mget([key, 'key2', 'key3', 'key4'], (err, response) => {
            expect(response[key]).toBe(value);
            expect(response.key2).toBe('value2');
            expect(response.key3).toBe('value3');
            expect(response.key4).toBe(undefined);
            done();
        });
    });
    it('Setting several keys via .mset() then calling .mget() should retrieve all keys', function(
        done
    ) {
        nodeCache.mset({ [key]: value, key2: 'value2', key3: 'value3' });
        nodeCache.mget([key, 'key2', 'key3', 'key4'], (err, response) => {
            expect(response[key]).toBe(value);
            expect(response.key2).toBe('value2');
            expect(response.key3).toBe('value3');
            expect(response.key4).toBe(undefined);
            done();
        });
    });
    it('Setting several keys then calling .flush() should remove all keys', function(
        done
    ) {
        var keyCount = fileCount();
        expect(keyCount).toBe(0);
        nodeCache.set(key, value);
        nodeCache.set('key2', 'value2');
        nodeCache.set('key3', 'value3');
        keyCount = fileCount();
        expect(keyCount).toBe(3);
        nodeCache.flush();
        keyCount = fileCount();
        expect(keyCount).toBe(0);
        done();
    });

    it('Should wait correctly if a cache is not filled', done => {
        nodeCache.get(key, (err, returned) => {
            expect(returned).toBe(null);
            setTimeout(() => {
                nodeCache.set(key, value);
            }, 500);
        });
        setTimeout(() => {
            nodeCache.get(key, (err, returned) => {
                expect(returned).toBe(value);
                done();
            });
        }, 150);
    });

    it('Should wait correctly if a cache is not filled', done => {
        nodeCache.get(key, (err, returned) => {
            expect(returned).toBe(null);
        });
        setTimeout(() => {
            nodeCache.get(key, (err, returned) => {
                expect(returned).toBe(null);
                done();
            });
        }, 150);
    });
});
