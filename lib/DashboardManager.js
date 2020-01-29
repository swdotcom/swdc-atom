'use babel';

const utilMgr = require('./UtilManager');
const wallClockMgr = require('./managers/WallClockManager');
const sessionSummaryDataMgr = require('./storage/SessionSummaryDataManager');
const fs = require('fs');
const moment = require('moment-timezone');

let dashboardMgr = {};

let lastDashboardFetchTime = 0;
let day_in_sec = 60 * 60 * 24;

const SERVICE_NOT_AVAIL =
    'Our service is temporarily unavailable.\n\nPlease try again later.\n';

dashboardMgr.sendOfflineData = () => {
    if (utilMgr.isTelemetryOn && !utilMgr.isTelemetryOn()) {
        return;
    }

    const dataStoreFile = utilMgr.getSoftwareDataStoreFile();
    if (fs.existsSync(dataStoreFile)) {
        const content = fs.readFileSync(dataStoreFile).toString();
        if (content) {
            console.log(`Code Time: sending batch payloads: ${content}`);
            const payloads = content
                .split(/\r?\n/)
                .map(item => {
                    let obj = null;
                    if (item) {
                        try {
                            obj = JSON.parse(item);
                        } catch (e) {
                            //
                        }
                    }
                    if (obj) {
                        return obj;
                    }
                })
                .filter(item => item);

            // POST the kpm to the PluginManager
            return utilMgr
                .softwarePost('/data/batch', payloads, utilMgr.getItem('jwt'))
                .then(resp => {
                    if (utilMgr.isResponseOk(resp)) {
                        // everything is fine, delete the offline data file
                        utilMgr.deleteFile(dataStoreFile);
                    }
                });
        }
    }
};

dashboardMgr.getSessionSummaryStatus = async (forceSummaryFetch = false) => {
    let data = sessionSummaryDataMgr.getSessionSummaryData();
    const jwt = utilMgr.getItem('jwt');
    const serverOnline = await utilMgr.serverIsAvailable();

    if (serverOnline && jwt && forceSummaryFetch) {
        let start = new Date();
        // set it to the beginning of the day
        start.setHours(0, 0, 0, 0);
        const fromSeconds = Math.round(start.getTime() / 1000);

        utilMgr
            .softwareGet(`/sessions/summary`, jwt)
            .then(resp => {
                if (utilMgr.isResponseOk(resp)) {
                    // everything is fine, delete the offline data file
                    data = { ...resp.data };

                    const session_seconds =
                        sessionSummaryDataMgr.currentDayMinutes * 60;
                    wallClockMgr.updateBasedOnSessionSeconds(session_seconds);

                    // update the file
                    sessionSummaryDataMgr.saveSessionSummaryToDisk(data);
                }
            })
            .catch(err => {
                console.log(
                    `Unable to get session summary response, error: ${err.message}`
                );
            });
    }

    // update the status bar
    sessionSummaryDataMgr.updateStatusBarWithSummaryData();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-code-time-metrics'
    );

    return data;
};

dashboardMgr.fetchCodeTimeMetricsDashboard = async summary => {
    let summaryInfoFile = utilMgr.getSummaryInfoFile();

    let nowSec = utilMgr.nowInSecs();
    let diff = nowSec - lastDashboardFetchTime;
    if (lastDashboardFetchTime === 0 || diff >= day_in_sec) {
        lastDashboardFetchTime = utilMgr.nowInSecs();

        let showGitMetrics = atom.config.get('code-time.showGitMetrics');
        //let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

        let api = `/dashboard?showGit=${showGitMetrics}&linux=${utilMgr.isLinux()}&showToday=false`;
        const dashboardSummary = await utilMgr.softwareGet(
            api,
            utilMgr.getItem('jwt')
        );

        let summaryContent = '';

        if (utilMgr.isResponseOk(dashboardSummary)) {
            // get the content
            summaryContent += dashboardSummary.data;
        } else {
            summaryContent = SERVICE_NOT_AVAIL;
        }

        fs.writeFileSync(summaryInfoFile, summaryContent, err => {
            if (err) {
                console.log(
                    `Error writing to the code time summary content file: ${err.message}`
                );
            }
        });
    }

    // concat summary info with the dashboard file
    let dashboardFile = utilMgr.getDashboardFile();
    let dashboardContent = '';
    const formattedDate = moment().format('ddd, MMM Do h:mma');
    dashboardContent = `CODE TIME          (Last updated on ${formattedDate})`;
    dashboardContent += '\n\n';

    const todayStr = moment().format('ddd, MMM Do');
    dashboardContent += utilMgr.getSectionHeader(`Today (${todayStr})`);

    if (summary) {
        let averageTime = utilMgr.humanizeMinutes(summary.averageDailyMinutes);
        let hoursCodedToday = utilMgr.humanizeMinutes(
            summary.currentDayMinutes
        );
        let liveshareTime = null;
        if (summary.liveshareMinutes) {
            liveshareTime = utilMgr.humanizeMinutes(summary.liveshareMinutes);
        }
        dashboardContent += utilMgr.getDashboardRow(
            'Code time today',
            hoursCodedToday
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
        const summaryContent = fs.readFileSync(summaryInfoFile).toString();

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
