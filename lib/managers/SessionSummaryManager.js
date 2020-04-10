'use babel';

import SessionSummary from '../model/SessionSummary';

const utilMgr = require('../UtilManager');
const fs = require('fs');
const fileDataMgr = require('../storage/FileDataManager');

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
    let data = utilMgr.getFileDataAsJson(file);
    if (!data) {
        data = new SessionSummary();
        sessionSummaryMgr.saveSessionSummaryToDisk(data);
    }
    return data;
};

// save session summary data
sessionSummaryMgr.saveSessionSummaryToDisk = data => {
    const file = sessionSummaryMgr.getSessionSummaryFile();
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(data, null, 4);

        fs.writeFileSync(file, content, err => {
            if (err) {
                utilMgr.logIt(
                    `Code time: Error writing session summary data: ${err.message}`
                );
            } else {
                utilMgr.logIt(
                    `Code time: updated session summary data to disk`
                );
            }
        });
    } catch (e) {
        utilMgr.logIt(
            `Code time: Error writing session summary data: ${e.message}`
        );
    }
};

module.exports = sessionSummaryMgr;
