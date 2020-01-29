'use babel';

import SessionSummary from '../model/SessionSummary';
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from '../Constants';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
const wallClockMgr = require('../managers/WallClockManager');
const timeSummaryDataMgr = require('./TimeSummaryDataManager');
const fs = require('fs');

const sessionSummaryDataMgr = {};

sessionSummaryDataMgr.getSessionThresholdSeconds = () => {
    const thresholdSeconds =
        utilMgr.getItem('sessionThresholdInSec') ||
        DEFAULT_SESSION_THRESHOLD_SECONDS;
    return thresholdSeconds;
};

sessionSummaryDataMgr.clearSessionSummaryData = () => {
    const data = new SessionSummary();
    sessionSummaryDataMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryDataMgr.getSessionSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

sessionSummaryDataMgr.getSessionSummaryData = () => {
    // let fileChangeInfoMap = cacheMgr.get("sessionSummary");
    let data = sessionSummaryDataMgr.getSessionSummaryFileAsJson();
    // make sure it's a valid structure
    if (!data) {
        // set the defaults
        data = new SessionSummary();
    }
    // fill in missing attributes
    data = sessionSummaryDataMgr.coalesceMissingAttributes(data);
    return data;
};

sessionSummaryDataMgr.coalesceMissingAttributes = data => {
    // ensure all attributes are defined
    const template = new SessionSummary();
    Object.keys(template).forEach(key => {
        if (!data[key]) {
            data[key] = 0;
        }
    });
    return data;
};

sessionSummaryDataMgr.getSessionSummaryFileAsJson = () => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        const file = sessionSummaryDataMgr.getSessionSummaryFile();
        data = utilMgr.getFileDataAsJson(file);
        if (!data) {
            data = new SessionSummary();
            sessionSummaryDataMgr.saveSessionSummaryToDisk(data);
        }
    }
    return data;
};

sessionSummaryDataMgr.saveSessionSummaryToDisk = data => {
    const file = sessionSummaryDataMgr.getSessionSummaryFile();
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

sessionSummaryDataMgr.setSessionSummaryLiveshareMinutes = minutes => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        data = sessionSummaryDataMgr.getSessionSummaryData();
    }
    sessionSummaryDataMgr.liveshareMinutes = minutes;

    sessionSummaryDataMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryDataMgr.getMinutesSinceLastPayload = () => {
    let minutesSinceLastPayload = 1;
    const lastPayloadEnd = utilMgr.getItem('latestPayloadTimestampEndUtc');
    if (lastPayloadEnd) {
        const nowTimes = utilMgr.getNowTimes();
        const nowInSec = nowTimes.now_in_sec;
        // diff from the previous end time
        const diffInSec = nowInSec - lastPayloadEnd;

        // if it's less than the threshold then add the minutes to the session time
        if (
            diffInSec > 0 &&
            diffInSec <= sessionSummaryDataMgr.getSessionThresholdSeconds()
        ) {
            // it's still the same session, add the gap time in minutes
            minutesSinceLastPayload = diffInSec / 60;
        }
    } else {
        // schedule fetching the sesssion summary data
        // since we don't have the latest payload timestamp
        setTimeout(() => {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Code-Time:refresh-session-summary'
            );
        }, 1000);
    }
    return minutesSinceLastPayload;
};

sessionSummaryDataMgr.incrementSessionSummaryData = aggregates => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        data = sessionSummaryDataMgr.getSessionSummaryData();
    }
    // fill in missing attributes
    data = sessionSummaryDataMgr.coalesceMissingAttributes(data);

    // what is the gap from the previous start
    const incrementMinutes = sessionSummaryDataMgr.getMinutesSinceLastPayload();

    data.currentDayMinutes += incrementMinutes;

    const session_seconds = data.currentDayMinutes * 60;
    wallClockMgr.updateBasedOnSessionSeconds(session_seconds);
    let editor_seconds = wallClockMgr.getWcTimeInSeconds();

    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;

    sessionSummaryDataMgr.saveSessionSummaryToDisk(data);

    // get the current time data and update
    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    const file_seconds = (timeData.file_seconds += 60);

    timeSummaryDataMgr.updateTimeSummaryData(
        editor_seconds,
        session_seconds,
        file_seconds
    );
};

sessionSummaryDataMgr.updateStatusBarWithSummaryData = () => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        data = sessionSummaryDataMgr.getSessionSummaryData();
    }
    if (!data) {
        data = new SessionSummary();
    }

    utilMgr.updateStatusBarWithSummaryData(
        data,
        wallClockMgr.getHumanizedWcTime()
    );
};

module.exports = sessionSummaryDataMgr;
