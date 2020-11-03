"use babel";

import { incrementEditorSeconds } from "../managers/TimeDataManager";
const utilMgr = require("../UtilManager");
const statusMgr = require("./StatusManager");
const windowMgr = require("./WindowManager");

const wallClockMgr = {};

const SECONDS_INCREMENT = 30;
const CLOCK_INTERVAL = 1000 * SECONDS_INCREMENT;

let _wcIntervalHandle = null;
let _wctime = 0;

wallClockMgr.init = async () => {
    _wctime = utilMgr.getItem("wctime") || 0;
    _wcIntervalHandle = setInterval(() => {
        const hasLatestPayload = utilMgr.getLatestPayload() ? true : false;
        if (windowMgr.isFocused() || hasLatestPayload) {
            wallClockMgr.updateWcTime();
        }
        wallClockMgr.dispatchStatusViewUpdate();
    }, CLOCK_INTERVAL);

    statusMgr.updateStatusBarWithSummaryData();
};

wallClockMgr.updateWcTime = () => {
    _wctime = utilMgr.getItem("wctime") || 0;
    _wctime += SECONDS_INCREMENT;
    utilMgr.setItem("wctime", _wctime);

    incrementEditorSeconds(SECONDS_INCREMENT);
};

wallClockMgr.dispatchStatusViewUpdate = () => {
    statusMgr.updateStatusBarWithSummaryData();

    // update the code time metrics tree view and status bar
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "Code-Time:refresh-code-time-metrics"
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
    utilMgr.setItem("wctime", seconds);
    wallClockMgr.updateWcTime();
};

module.exports = wallClockMgr;
