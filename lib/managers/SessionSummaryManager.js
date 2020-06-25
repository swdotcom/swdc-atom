'use babel';

import SessionSummary from '../model/SessionSummary';
import fileIt from 'file-it';

const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const fileMgr = require("./fileManager");

const sessionSummaryMgr = {};

/**
 * Increment the session summary minutes
 * and update the time summary data summary.
 */
sessionSummaryMgr.incrementSessionSummaryData = (
    aggregates,
    sessionMinutes
) => {
    let data = fileDataMgr.getSessionSummaryData();
    if (sessionMinutes > 0) {
        data.currentDayMinutes += sessionMinutes;
    }
    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;
    sessionSummaryMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryMgr.clearSessionSummaryData = () => {
    const data = new SessionSummary();
    sessionSummaryMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryMgr.getSessionSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

sessionSummaryMgr.getSessionSummaryData = () => {
    // get the session summary file data
    let data = sessionSummaryMgr.getSessionSummaryFileAsJson();
    // fill in missing attributes
    data = sessionSummaryMgr.coalesceMissingAttributes(data);
    return data;
};

sessionSummaryMgr.coalesceMissingAttributes = data => {
    // ensure all attributes are defined
    const template = new SessionSummary();
    Object.keys(template).forEach(key => {
        if (!data[key]) {
            data[key] = 0;
        }
    });
    return data;
};

sessionSummaryMgr.getSessionSummaryFileAsJson = () => {
    const file = sessionSummaryMgr.getSessionSummaryFile();
    let data = fileMgr.getJsonData(file);
    if (!data) {
        data = new SessionSummary();
        sessionSummaryMgr.saveSessionSummaryToDisk(data);
    }
    return data;
};

// save session summary data
sessionSummaryMgr.saveSessionSummaryToDisk = data => {
    const file = sessionSummaryMgr.getSessionSummaryFile();
    fileIt.writeJsonFileSync(file, data, {spaces: 4});
};

module.exports = sessionSummaryMgr;
