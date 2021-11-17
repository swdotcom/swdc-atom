'use babel';

const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const serviceUtil = require('../utils/ServiceUtil');
const statusMgr = require('./StatusManager');
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
        const summary = result.data;
        fileDataMgr.saveSessionSummaryToDisk(summary);
    }

    statusMgr.updateStatusBarWithSummaryData();
};

module.exports = sessionAppMgr;
