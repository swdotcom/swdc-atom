'use babel';

import {
    sendOfflineTimeData,
    getCodeTimeSummary,
} from './managers/TimeDataManager';

const utilMgr = require('./UtilManager');
const timeUtil = require('./utils/TimeUtil');
const wallClockMgr = require('./managers/WallClockManager');
const fileDataMgr = require('./storage/FileDataManager');
const statusMgr = require('./managers/StatusManager');
const fileChangeInfoSummaryDataMgr = require('./storage/FileChangeInfoSummaryDataManager');
const payloadMgr = require('./managers/PayloadManager');
const serviceUtil = require('./utils/ServiceUtil');
const sessionAppMgr = require('./managers/SessionAppManager');
const fs = require('fs');
const moment = require('moment-timezone');

let dashboardMgr = {};

let day_in_sec = 60 * 60 * 24;
let currentDay = null;
let dayChecker = null;
const DAY_CHECK_TIMER_INTERVAL = 1000 * 60;

dashboardMgr.init = () => {
    if (currentDay) {
        // this has already been initialized
        return;
    }
    // fetch the current day from the sessions.json
    currentDay = utilMgr.getItem('currentDay');

    // start timer to check if it's a new day or not
    dayCheckTimer = setInterval(async () => {
        dashboardMgr.newDayChecker();
    }, DAY_CHECK_TIMER_INTERVAL);

    setTimeout(() => {
        dashboardMgr.newDayChecker(true /*isInit*/);
    }, 1000);
};

/**
 * Check if its a new day, if so we'll clear the session sumary and
 * file change info summary, then we'll force a fetch from the app
 */
dashboardMgr.newDayChecker = async (isInit = false) => {
    if (utilMgr.isNewDay()) {
        fileDataMgr.clearSessionSummaryData();

        // send the offline data ...
        await payloadMgr.sendOfflineData();

        payloadMgr.clearLastSavedKeystrokeStats();

        // clear the last saved keystrokes
        await payloadMgr.clearLastSavedKeystrokeStats();

        // send the offline TimeData payloads
        await sendOfflineTimeData();

        // day does't match. clear the wall clock time,
        // the session summary, and the file change info summary data
        wallClockMgr.clearWcTime();

        fileChangeInfoSummaryDataMgr.clearFileChangeInfoSummaryData();

        // set the current day
        const nowTime = timeUtil.getNowTimes();
        currentDay = nowTime.day;

        // update the current day
        utilMgr.setItem('currentDay', currentDay);
        // update the last payload timestamp
        utilMgr.setItem('latestPayloadTimestampEndUtc', 0);

        // refresh everything
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );

        setTimeout(() => {
            sessionAppMgr.updateSessionSummaryFromServer();
        }, 5000);
    } else if (isInit) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );
    }
};

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
        const summaryContent = dashboardSummary.data;
        fs.writeFileSync(summaryInfoFile, summaryContent, err => {
            if (err) {
                console.log(
                    `Error writing to the code time summary content file: ${err.message}`
                );
            }
        });
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

    if (fs.existsSync(summaryInfoFile)) {
        const summaryContent = fs.readFileSync(summaryInfoFile, {encoding: 'utf8'}).toString();

        // create the dashboard file
        dashboardContent += summaryContent;
    }

    fs.writeFileSync(dashboardFile, dashboardContent, err => {
        if (err) {
            console.log(
                `Error writing to the code time dashboard content file: ${err.message}`
            );
        }
    });
};

module.exports = dashboardMgr;
