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

    const showGitMetrics = atom.config.get('code-time.showGitMetrics');
    //let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

    const api = `/dashboard?showGit=${showGitMetrics}&linux=${utilMgr.isLinux()}&showToday=false`;
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
    const formattedDate = moment().format('ddd, MMM Do h:mma');
    dashboardContent = `CODE TIME          (Last updated on ${formattedDate})`;
    dashboardContent += '\n\n';

    const todayStr = moment().format('ddd, MMM Do');
    dashboardContent += utilMgr.getSectionHeader(`Today (${todayStr})`);

    // get the top section of the dashboard content (today's data)
    const summary = await fileDataMgr.getSessionSummaryData();
    if (summary) {
        let averageTime = utilMgr.humanizeMinutes(summary.averageDailyMinutes);

        let liveshareTime = null;
        if (summary.liveshareMinutes) {
            liveshareTime = utilMgr.humanizeMinutes(summary.liveshareMinutes);
        }

        const currentEditorMinutesStr = utilMgr.humanizeMinutes(
            codeTimeSummary.codeTimeMinutes
        );
        const codeTimeMinutes = utilMgr.humanizeMinutes(
            codeTimeSummary.activeCodeTimeMinutes
        );
        dashboardContent += utilMgr.getDashboardRow(
            'Code time today',
            currentEditorMinutesStr
        );
        dashboardContent += utilMgr.getDashboardRow(
            'Active code time today',
            codeTimeMinutes
        );
        dashboardContent += utilMgr.getDashboardRow('90-day avg', averageTime);
        if (liveshareTime) {
            dashboardContent += utilMgr.getDashboardRow(
                'Live Share',
                liveshareTime
            );
        }
        dashboardContent += '\n';
    }

    const summaryContent = fileIt.readContentFileSync(summaryInfoFile);
    if (summaryContent) {
      // create the dashboard file
      dashboardContent += summaryContent;
    }

    fileIt.writeContentFileSync(dashboardFile, dashboardContent);
};

module.exports = dashboardMgr;
