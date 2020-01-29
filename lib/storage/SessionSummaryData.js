'use babel';

import SessionSummary from '../model/SessionSummary';
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from '../Constants';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
const wallClockMgr = require('../managers/WallClockManager');
const timeSummaryData = require('./TimeSummaryData');
const fs = require('fs');

const sessionSummaryData = {};

sessionSummaryData.getSessionThresholdSeconds = () => {
    const thresholdSeconds =
        utilMgr.getItem('sessionThresholdInSec') ||
        DEFAULT_SESSION_THRESHOLD_SECONDS;
    return thresholdSeconds;
};

sessionSummaryData.clearSessionSummaryData = () => {
    const sessionSummaryData = new SessionSummary();
    sessionSummaryData.saveSessionSummaryToDisk(sessionSummaryData);
};

sessionSummaryData.getSessionSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

sessionSummaryData.getSessionSummaryData = () => {
    // let fileChangeInfoMap = cacheMgr.get("sessionSummary");
    let sessionSummaryData = sessionSummaryData.getSessionSummaryFileAsJson();
    // make sure it's a valid structure
    if (!sessionSummaryData) {
        // set the defaults
        sessionSummaryData = new SessionSummary();
    }
    // fill in missing attributes
    sessionSummaryData = sessionSummaryData.coalesceMissingAttributes(
        sessionSummaryData
    );
    return sessionSummaryData;
};

sessionSummaryData.coalesceMissingAttributes = data => {
    // ensure all attributes are defined
    const template = new SessionSummary();
    Object.keys(template).forEach(key => {
        if (!data[key]) {
            data[key] = 0;
        }
    });
    return data;
};

sessionSummaryData.getSessionSummaryFileAsJson = () => {
    let sessionSummary = cacheMgr.get('sessionSummary');
    if (!sessionSummary) {
        const file = sessionSummaryData.getSessionSummaryFile();
        sessionSummary = utilMgr.getFileDataAsJson(file);
        if (!sessionSummary) {
            sessionSummary = new SessionSummary();
            sessionSummaryData.saveSessionSummaryToDisk(sessionSummary);
        }
    }
    return sessionSummary;
};

sessionSummaryData.saveSessionSummaryToDisk = sessionSummaryData => {
    const file = sessionSummaryData.getSessionSummaryFile();
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(sessionSummaryData, null, 4);
        fs.writeFileSync(file, content, err => {
            if (err)
                utilMgr.logIt(
                    `Deployer: Error writing session summary data: ${err.message}`
                );
        });
        // update the cache
        if (sessionSummaryData) {
            cacheMgr.set('sessionSummary', sessionSummaryData);
        }
    } catch (e) {
        //
    }
};

sessionSummaryData.setSessionSummaryLiveshareMinutes = minutes => {
    let sessionSummaryData = cacheMgr.get('sessionSummary');
    if (!sessionSummaryData) {
        sessionSummaryData = sessionSummaryData.getSessionSummaryData();
    }
    sessionSummaryData.liveshareMinutes = minutes;

    sessionSummaryData.saveSessionSummaryToDisk(sessionSummaryData);
};

sessionSummaryData.getMinutesSinceLastPayload = () => {
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
            diffInSec <= sessionSummaryData.getSessionThresholdSeconds()
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
                'Code-Time:refreshSessionSummary'
            );
        }, 1000);
    }
    return minutesSinceLastPayload;
};

sessionSummaryData.incrementSessionSummaryData = aggregates => {
    let sessionSummaryData = cacheMgr.get('sessionSummary');
    if (!sessionSummaryData) {
        sessionSummaryData = sessionSummaryData.getSessionSummaryData();
    }
    // fill in missing attributes
    sessionSummaryData = sessionSummaryData.coalesceMissingAttributes(
        sessionSummaryData
    );

    // what is the gap from the previous start
    const incrementMinutes = sessionSummaryData.getMinutesSinceLastPayload();

    sessionSummaryData.currentDayMinutes += incrementMinutes;

    const session_seconds = sessionSummaryData.currentDayMinutes * 60;
    wallClockMgr.updateBasedOnSessionSeconds(session_seconds);
    let editor_seconds = wallClockMgr.getWcTimeInSeconds();

    sessionSummaryData.currentDayKeystrokes += aggregates.keystrokes;
    sessionSummaryData.currentDayLinesAdded += aggregates.linesAdded;
    sessionSummaryData.currentDayLinesRemoved += aggregates.linesRemoved;

    sessionSummaryData.saveSessionSummaryToDisk(sessionSummaryData);

    // get the current time data and update
    const timeData = timeSummaryData.getTodayTimeDataSummary();
    const file_seconds = (timeData.file_seconds += 60);

    timeSummaryData.updateTimeSummaryData(
        editor_seconds,
        session_seconds,
        file_seconds
    );
};

sessionSummaryData.updateStatusBarWithSummaryData = () => {
    let sessionSummaryData = cacheMgr.get('sessionSummary');
    if (!sessionSummaryData) {
        sessionSummaryData = sessionSummaryData.getSessionSummaryData();
    }
    // update the session summary data with what is found in the sessionSummary.json
    sessionSummaryData = sessionSummaryData.getSessionSummaryFileAsJson();

    let currentDayMinutes = sessionSummaryData.currentDayMinutes;
    let averageDailyMinutes = sessionSummaryData.averageDailyMinutes;

    let inFlowIcon = currentDayMinutes > averageDailyMinutes ? '🚀 ' : '';
    const wcTime = wallClockMgr.getHumanizedWcTime();

    // const time = moment().format("h:mm a");
    const msg = `${inFlowIcon}${wcTime}`;
    utilMgr.showStatus(msg, null);
};

module.exports = sessionSummaryData;
