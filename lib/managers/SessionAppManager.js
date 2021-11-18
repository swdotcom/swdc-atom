'use babel';

const fileDataMgr = require('../storage/FileDataManager');
const serviceUtil = require('../utils/ServiceUtil');
const statusMgr = require('./StatusManager');

const sessionAppMgr = {};

// update the sessionSummary.json data from the server
sessionAppMgr.updateSessionSummaryFromServer = async () => {
    const result = await serviceUtil.appGet('/api/v1/user/session_summary');
    if (serviceUtil.isResponseOk(result) && result.data) {
        const summary = result.data;
        fileDataMgr.saveSessionSummaryToDisk(summary);
    }

    statusMgr.updateStatusBarWithSummaryData();
};

module.exports = sessionAppMgr;
