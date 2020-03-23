'use babel';

const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const wallClockMgr = require('./WallClockManager');

const sessionAppMgr = {};

sessionAppMgr.updateSessionSummaryFromServer = async () => {
    const jwt = utilMgr.getItem('jwt');
    const result = await utilMgr.softwareGet(
        `/sessions/summary?refresh=true`,
        jwt
    );
    if (utilMgr.isResponseOk(result) && result.data) {
        const data = result.data;

        // update the session summary data
        const summary = fileDataMgr.getSessionSummaryData();
        Object.keys(data).forEach(key => {
            const val = data[key];
            if (val !== null && val !== undefined) {
                summary[key] = val;
            }
        });

        // if the summary.currentDayMinutes is greater than the wall
        // clock time then it means the plugin was installed on a
        // different computer or the session was deleted
        wallClockMgr.updateBasedOnSessionSeconds(
            summary.currentDayMinutes * 60
        );

        fileDataMgr.saveSessionSummaryToDisk(summary);
    }
};

module.exports = sessionAppMgr;
