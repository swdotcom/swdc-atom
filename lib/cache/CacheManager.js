'use babel';

const NodeCache = require('node-cache');

const cacheMgr = {};

let myCache;

cacheMgr.init = () => {
    // default cache of 2 minutes
    myCache = new NodeCache({ stdTTL: 120 });
};

cacheMgr.get = key => {
    if (!myCache) {
        myCache = new NodeCache({ stdTTL: 120 });
    }
    return myCache.get(key);
};

cacheMgr.set = (key, value, ttl = -1) => {
    if (!myCache) {
        myCache = new NodeCache({ stdTTL: 120 });
    }
    if (ttl > 0) {
        myCache.set(key, value, ttl);
    } else {
        // use the standard cache ttl
        myCache.set(key, value);
    }
};

module.exports = cacheMgr;
