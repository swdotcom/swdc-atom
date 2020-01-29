'use babel';

const utilMgr = require('../UtilManager');
const timeSummaryDataMgr = require('../storage/TimeSummaryDataManager');

const wallClockMgr = {};

const SECONDS_INCREMENT = 30;
const CLOCK_INTERVAL = 1000 * SECONDS_INCREMENT;

let _wcIntervalHandle = null;
let _wctime = 0;

wallClockMgr.init = () => {
    _wctime = utilMgr.getItem('atom_wctime') || 0;
    _wcIntervalHandle = setInterval(() => {
        _wctime += SECONDS_INCREMENT;
        utilMgr.setItem('atom_wctime', _wctime);

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );

        wallClockMgr.updateTimeData();
    }, CLOCK_INTERVAL);
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
    _wctime = seconds;
    utilMgr.setItem('atom_wctime', seconds);
    clearInterval(_wcIntervalHandle);
    wallClockMgr.init();

    // update the status bar
    wallClockMgr.updateTimeData();
};

wallClockMgr.updateTimeData = () => {
    // get the current time data and update
    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    const editor_seconds = _wctime;

    timeSummaryDataMgr.updateTimeSummaryData(
        editor_seconds,
        timeData.session_seconds,
        timeData.file_seconds
    );
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
