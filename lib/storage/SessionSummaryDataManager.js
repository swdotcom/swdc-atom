'use babel';

import SessionSummary from '../model/SessionSummary';
import { DEFAULT_SESSION_THRESHOLD_SECONDS } from '../Constants';

const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const wallClockMgr = require('../managers/WallClockManager');
const timeSummaryDataMgr = require('./TimeSummaryDataManager');
const fileDataMgr = require('./FileDataManager');
const fs = require('fs');

const sessionSummaryDataMgr = {};

// get the session threshold seconds
sessionSummaryDataMgr.getSessionThresholdSeconds = () => {
    const thresholdSeconds =
        utilMgr.getItem('sessionThresholdInSec') ||
        DEFAULT_SESSION_THRESHOLD_SECONDS;
    return thresholdSeconds;
};

sessionSummaryDataMgr.clearSessionSummaryData = () => {
    console.log('--- clearing session summary data ---');
    const data = new SessionSummary();
    fileDataMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryDataMgr.setSessionSummaryLiveshareMinutes = minutes => {
    let data = fileDataMgr.getSessionSummaryData();
    sessionSummaryDataMgr.liveshareMinutes = minutes;

    fileDataMgr.saveSessionSummaryToDisk(data);
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

/**
 * Increment the session summary minutes
 * and update the time summary data summary
 */
sessionSummaryDataMgr.incrementSessionSummaryData = aggregates => {
    let data = fileDataMgr.getSessionSummaryData();

    // what is the gap from the previous start
    const incrementMinutes = sessionSummaryDataMgr.getMinutesSinceLastPayload();

    data.currentDayMinutes += incrementMinutes;
    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;

    fileDataMgr.saveSessionSummaryToDisk(data);

    // get the current time data and update
    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    const file_seconds = (timeData.file_seconds += 60);

    const session_seconds = data.currentDayMinutes * 60;
    wallClockMgr.updateBasedOnSessionSeconds(session_seconds);
    let editor_seconds = wallClockMgr.getWcTimeInSeconds();

    timeSummaryDataMgr.updateTimeSummaryData(
        editor_seconds,
        session_seconds,
        file_seconds
    );
};

module.exports = sessionSummaryDataMgr;
