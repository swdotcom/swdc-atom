'use babel';

import SessionSummary from '../model/SessionSummary';

const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('./FileDataManager');
const fs = require('fs');

const sessionSummaryDataMgr = {};

sessionSummaryDataMgr.clearSessionSummaryData = () => {
    const data = new SessionSummary();
    fileDataMgr.saveSessionSummaryToDisk(data);
};

sessionSummaryDataMgr.setSessionSummaryLiveshareMinutes = minutes => {
    let data = fileDataMgr.getSessionSummaryData();
    sessionSummaryDataMgr.liveshareMinutes = minutes;

    fileDataMgr.saveSessionSummaryToDisk(data);
};

/**
 * Increment the session summary minutes
 * and update the time summary data summary
 */
sessionSummaryDataMgr.incrementSessionSummaryData = aggregates => {
    let data = fileDataMgr.getSessionSummaryData();

    // what is the gap from the previous start
    const incrementMinutes = utilMgr.getMinutesSinceLastPayload();
    data.currentDayMinutes += incrementMinutes;
    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;

    fileDataMgr.saveSessionSummaryToDisk(data);

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:update-session-summary'
    );
};

module.exports = sessionSummaryDataMgr;
