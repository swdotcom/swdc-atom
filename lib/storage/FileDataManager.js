'use babel';

import SessionSummary from '../model/SessionSummary';
import fileIt from 'file-it';

const utilMgr = require('../UtilManager');
const fileMgr = require("../managers/FileManager");

const fileDataMgr = {};

// clear session summary data
fileDataMgr.clearSessionSummaryData = () => {
    const data = new SessionSummary();
    fileDataMgr.saveSessionSummaryToDisk(data);
};

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
    let data = fileMgr.getJsonData(file);
    if (!data) {
        data = new SessionSummary();
        fileDataMgr.saveSessionSummaryToDisk(data);
    }
    return data;
};

// save session summary data
fileDataMgr.saveSessionSummaryToDisk = data => {
    const file = fileDataMgr.getSessionSummaryFile();
    fileIt.writeJsonFileSync(file, data, {spaces: 4});
};

module.exports = fileDataMgr;
