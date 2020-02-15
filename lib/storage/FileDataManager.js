'use babel';

import SessionSummary from '../model/SessionSummary';

const utilMgr = require('../UtilManager');
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
    // get the session summary file data
    let data = fileDataMgr.getSessionSummaryFileAsJson();
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
    const file = fileDataMgr.getSessionSummaryFile();
    let data = utilMgr.getFileDataAsJson(file);
    if (!data) {
        data = new SessionSummary();
        fileDataMgr.saveSessionSummaryToDisk(data);
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
                    `Code time: Error writing session summary data: ${err.message}`
                );
        });
    } catch (e) {
        utilMgr.logIt(
            `Code time: Error writing session summary data: ${e.message}`
        );
    }
};

module.exports = fileDataMgr;
