'use babel';

const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const wallClockMgr = require('./WallClockManager');
const serviceUtil = require('../utils/ServiceUtil');

const sessionAppMgr = {};

// update the sessionSummary.json data from the server
sessionAppMgr.updateSessionSummaryFromServer = async (isNewDay = false) => {
    const jwt = utilMgr.getItem('jwt');
    const result = await serviceUtil.softwareGet(
        `/sessions/summary?refresh=true`,
        jwt
    );
    if (serviceUtil.isResponseOk(result) && result.data) {
        const data = result.data;

        // update the session summary data
        const summary = fileDataMgr.getSessionSummaryData();
        Object.keys(data).forEach(key => {
            const val = data[key];
            if (val !== null && val !== undefined) {
                if (key === 'currentDayMinutes') {
                    if (!isNewDay) {
                        const currDayMin = parseInt(val, 10);
                        if (currDayMin > summary.currentDayMinutes) {
                            summary.currentDayMinutes = currDayMin;
                        }
                    }
                } else {
                    summary[key] = val;
                }
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
