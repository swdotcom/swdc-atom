'use babel';

import { getCodeTimeSummary } from './managers/TimeDataManager';
import fileIt from 'file-it';

const utilMgr = require('./UtilManager');
const fileDataMgr = require('./storage/FileDataManager');
const serviceUtil = require('./utils/ServiceUtil');
const moment = require('moment-timezone');

let dashboardMgr = {};

dashboardMgr.launchCodeTimeDashboard = async () => {
    // generate the dashboard
    await dashboardMgr.fetchCodeTimeMetricsDashboard();

    // get the CodeTime file
    let file = utilMgr.getDashboardFile();

    // display it
    atom.workspace.open(file, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

dashboardMgr.fetchCodeTimeMetricsDashboard = async () => {
    const summaryInfoFile = utilMgr.getSummaryInfoFile();

    const codeTimeSummary = getCodeTimeSummary();

    const api = `/dashboard?linux=${utilMgr.isLinux()}&showToday=true`;
    const dashboardSummary = await serviceUtil.softwareGet(
        api,
        utilMgr.getItem('jwt')
    );

    if (serviceUtil.isResponseOk(dashboardSummary)) {
        // get the content
        fileIt.writeContentFileSync(summaryInfoFile, dashboardSummary.data);
    }

    // concat summary info with the dashboard file
    const dashboardFile = utilMgr.getDashboardFile();
    let dashboardContent = '';

    const summaryContent = fileIt.readContentFileSync(summaryInfoFile);
    if (summaryContent) {
      // create the dashboard file
      dashboardContent += summaryContent;
    }

    fileIt.writeContentFileSync(dashboardFile, dashboardContent);
};

module.exports = dashboardMgr;
