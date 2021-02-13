'use babel';

const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const serviceUtil = require('../utils/ServiceUtil');
const statusMgr = require('./StatusManager');
const { updateSessionFromSummaryApi } = require('./TimeDataManager');
import { format } from "date-fns";

const sessionAppMgr = {};

// update the sessionSummary.json data from the server
sessionAppMgr.updateSessionSummaryFromServer = async () => {
    const jwt = utilMgr.getItem('jwt');
    const result = await serviceUtil.softwareGet(
        `/sessions/summary`,
        jwt
    );
    const nowDay = format(new Date(), "MM/dd/yyyy");
    utilMgr.setItem("updatedTreeDate", nowDay);
    if (serviceUtil.isResponseOk(result) && result.data) {
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
        updateSessionFromSummaryApi(summary.currentDayMinutes);

        fileDataMgr.saveSessionSummaryToDisk(summary);
    }

    statusMgr.updateStatusBarWithSummaryData();
};

module.exports = sessionAppMgr;
