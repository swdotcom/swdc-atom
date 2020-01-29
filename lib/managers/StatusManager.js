'use babel';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
const sessionSummaryData = require('../storage/SessionSummaryData');
const wallClockMgr = require('../managers/WallClockManager');

const statusMgr = {};

statusMgr.updateStatusBarWithSummaryData = (data, wcTime) => {
    let data = cacheMgr.get('sessionSummary');
    if (!data) {
        data = sessionSummaryData.getSessionSummaryData();
    }
    // update the session summary data with what is found in the sessionSummary.json
    data = sessionSummaryData.getSessionSummaryFileAsJson();

    let currentDayMinutes = data.currentDayMinutes;
    let averageDailyMinutes = data.averageDailyMinutes;

    let inFlowIcon = currentDayMinutes > averageDailyMinutes ? '🚀 ' : '';
    const wcTime = wallClockMgr.getHumanizedWcTime();

    // const time = moment().format("h:mm a");
    const msg = `${inFlowIcon}${wcTime}`;
    utilMgr.showStatus(msg, null);
};

module.exports = statusMgr;
