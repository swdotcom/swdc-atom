'use babel';

import SessionSummary from '../model/SessionSummary';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
const fs = require('fs');

const fileDataMgr = {};

fileDataMgr.getSessionSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

fileDataMgr.getSessionSummaryData = () => {
    // get the session summary file data .......
    let data = fileDataMgr.getSessionSummaryFileAsJson();
    // make sure it's a valid structure
    if (!data) {
        // set the defaults
        data = new SessionSummary();
    }
    // fill in missing attributes
    data = fileDataMgr.coalesceMissingAttributes(data);
    return data;
};

fileDataMgr.coalesceMissingAttributes = data => {
    // ensure all attributes are defined
    const template = new SessionSummary();
    Object.keys(template).forEach(key => {
        if (!data[key]) {
            data[key] = 0;
        }
    });
    return data;
};

fileDataMgr.getSessionSummaryFileAsJson = () => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        const file = fileDataMgr.getSessionSummaryFile();
        data = utilMgr.getFileDataAsJson(file);
        if (!data) {
            data = new SessionSummary();
            fileDataMgr.saveSessionSummaryToDisk(data);
        }
    }
    return data;
};

// save session summary data
fileDataMgr.saveSessionSummaryToDisk = data => {
    const file = fileDataMgr.getSessionSummaryFile();
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(data, null, 4);
        fs.writeFileSync(file, content, err => {
            if (err)
                utilMgr.logIt(
                    `Deployer: Error writing session summary data: ${err.message}`
                );
        });
        // update the cache
        if (data) {
            cacheMgr.set('sessionSummary', data);
        }
    } catch (e) {
        //
    }
};

module.exports = fileDataMgr;
