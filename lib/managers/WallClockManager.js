'use babel';
import { updateEditorSeconds } from '../storage/SessionSummaryDataManager';
const utilMgr = require('../UtilManager');
const statusMgr = require('./StatusManager');
const moment = require('moment-timezone');

const wallClockMgr = {};

const SECONDS_INCREMENT = 30;
const CLOCK_INTERVAL = 1000 * SECONDS_INCREMENT;

let _wcIntervalHandle = null;
let _wctime = 0;

wallClockMgr.init = async () => {
    _wctime = utilMgr.getItem('wctime') || 0;
    _wcIntervalHandle = setInterval(() => {
        if (utilMgr.isFocused()) {
            wallClockMgr.updateWcTime();
        }
        wallClockMgr.dispatchStatusViewUpdate();
    }, CLOCK_INTERVAL);

    statusMgr.updateStatusBarWithSummaryData();
};

wallClockMgr.updateWcTime = () => {
    _wctime = utilMgr.getItem('wctime') || 0;
    _wctime += SECONDS_INCREMENT;
    utilMgr.setItem('wctime', _wctime);

    updateEditorSeconds(SECONDS_INCREMENT);
};

wallClockMgr.dispatchStatusViewUpdate = () => {
    statusMgr.updateStatusBarWithSummaryData();

    // update the code time metrics tree view and status bar
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-code-time-metrics'
    );
};

wallClockMgr.clearWcTime = () => {
    wallClockMgr.setWcTime(0);
};

wallClockMgr.getHumanizedWcTime = () => {
    return utilMgr.humanizeMinutes(_wctime / 60);
};

wallClockMgr.getWcTimeInSeconds = () => {
    return _wctime;
};

wallClockMgr.setWcTime = seconds => {
    utilMgr.setItem('wctime', seconds);
    wallClockMgr.updateWcTime();
};

wallClockMgr.updateBasedOnSessionSeconds = session_seconds => {
    let editor_seconds = wallClockMgr.getWcTimeInSeconds();

    // check to see if the session seconds has gained before the editor seconds
    // if so, then update the editor seconds
    if (editor_seconds < session_seconds) {
        editor_seconds = session_seconds + 1;
        wallClockMgr.setWcTime(editor_seconds);
    }
};

module.exports = wallClockMgr;
