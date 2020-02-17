'use babel';

const utilMgr = require('./UtilManager');
const wallClockMgr = require('./managers/WallClockManager');
const sessionSummaryDataMgr = require('./storage/SessionSummaryDataManager');
const fileDataMgr = require('./storage/FileDataManager');
const statusMgr = require('./managers/StatusManager');
const fileChangeInfoSummaryDataMgr = require('./storage/FileChangeInfoSummaryDataManager');
const timeSummaryDataMgr = require('./storage/TimeSummaryDataManager');
const payloadMgr = require('./managers/PayloadManager');
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

    dashboardMgr.getSessionSummaryStatus();
};

/**
 * Check if its a new day, if so we'll clear the session sumary and
 * file change info summary, then we'll force a fetch from the app
 */
dashboardMgr.newDayChecker = async (isInit = false) => {
    const nowTime = utilMgr.getNowTimes();
    const day = moment.unix(nowTime.local_now_in_sec).format('YYYY-MM-DD');
    if (day !== currentDay) {
        // send the offline data
        await payloadMgr.sendOfflineData();

        // send the offline TimeData payloads
        await payloadMgr.sendOfflineTimeData();

        // day does't match. clear the wall clock time,
        // the session summary, and the file change info summary data
        wallClockMgr.clearWcTime();
        sessionSummaryDataMgr.clearSessionSummaryData();
        timeSummaryDataMgr.clearTimeDataSummary();
        fileChangeInfoSummaryDataMgr.clearFileChangeInfoSummaryData();

        // set the current day
        currentDay = day;

        // update the current day
        utilMgr.setItem('currentDay', currentDay);
        // update the last payload timestamp
        utilMgr.setItem('latestPayloadTimestampEndUtc', 0);

        // refresh everything
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );

        // fetch session summary data in a minute
        setTimeout(() => {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Code-Time:refresh-session-summary'
            );
        }, 1000 * 60);
    } else if (isInit) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );
    }
};

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

dashboardMgr.getSessionSummaryStatus = async () => {
    let summary = fileDataMgr.getSessionSummaryData();
    const jwt = utilMgr.getItem('jwt');
    const serverOnline = await utilMgr.serverIsAvailable();

    if (serverOnline && jwt) {
        utilMgr
            .softwareGet(`/sessions/summary`, jwt)
            .then(resp => {
                if (utilMgr.isResponseOk(resp)) {
                    const dataMinutes = resp.data.currentDayMinutes;

                    const respData = resp.data;

                    if (
                        dataMinutes === 0 ||
                        dataMinutes < summary.currentDayMinutes
                    ) {
                        console.log(
                            'syncing current day minutesSinceLastPayload'
                        );
                        // incoming data current metrics is behind, use the local info
                        respData.currentDayMinutes = summary.currentDayMinutes;
                        respData.currentDayKeystrokes =
                            summary.currentDayKeystrokes;
                        respData.currentDayKpm = summary.currentDayKpm;
                        respData.currentDayLinesAdded =
                            summary.currentDayLinesAdded;
                        respData.currentDayLinesRemoved =
                            summary.currentDayLinesRemoved;
                    }

                    // everything is fine, delete the offline data file
                    summary = { ...respData };

                    // update the file
                    fileDataMgr.saveSessionSummaryToDisk(summary);

                    // latestPayloadTimestampEndUtc:1580043777
                    // check if we need to update the latestPayloadTimestampEndUtc
                    const currentTs = utilMgr.getItem(
                        'latestPayloadTimestampEndUtc'
                    );
                    if (
                        !currentTs ||
                        summary.latestPayloadTimestampEndUtc > currentTs
                    ) {
                        // update the currentTs
                        utilMgr.setItem(
                            'latestPayloadTimestampEndUtc',
                            summary.latestPayloadTimestampEndUtc
                        );
                    }
                }
            })
            .catch(err => {
                console.log(
                    `Unable to get session summary response, error: ${err.message}`
                );
            });
    }

    // update the wallclock time if it's
    // lagging behind the newly gathered current day seconds.
    // this will also update the status bar
    const session_seconds = summary.currentDayMinutes * 60;
    wallClockMgr.updateBasedOnSessionSeconds(session_seconds);

    return summary;
};

dashboardMgr.getDashboardFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\CodeTime.txt';
    } else {
        file += '/CodeTime.txt';
    }
    return file;
};

dashboardMgr.launchCodeTimeDashboard = async () => {
    // generate the dashboard
    await dashboardMgr.fetchCodeTimeMetricsDashboard();

    // get the CodeTime file
    let file = dashboardMgr.getDashboardFile();

    // display it
    atom.workspace.open(file, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

dashboardMgr.fetchCodeTimeMetricsDashboard = async () => {
    const serverOnline = await utilMgr.serverIsAvailable();
    const summaryInfoFile = utilMgr.getSummaryInfoFile();

    if (serverOnline) {
        const showGitMetrics = atom.config.get('code-time.showGitMetrics');
        //let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

        const api = `/dashboard?showGit=${showGitMetrics}&linux=${utilMgr.isLinux()}&showToday=false`;
        const dashboardSummary = await utilMgr.softwareGet(
            api,
            utilMgr.getItem('jwt')
        );

        if (utilMgr.isResponseOk(dashboardSummary)) {
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
    }

    // concat summary info with the dashboard file
    const dashboardFile = dashboardMgr.getDashboardFile();
    let dashboardContent = '';
    const formattedDate = moment().format('ddd, MMM Do h:mma');
    dashboardContent = `CODE TIME          (Last updated on ${formattedDate})`;
    dashboardContent += '\n\n';

    const todayStr = moment().format('ddd, MMM Do');
    dashboardContent += utilMgr.getSectionHeader(`Today (${todayStr})`);

    // get the top section of the dashboard content (today's data)
    const summary = await dashboardMgr.getSessionSummaryStatus();
    if (summary) {
        let averageTime = utilMgr.humanizeMinutes(summary.averageDailyMinutes);
        let hoursCodedToday = utilMgr.humanizeMinutes(
            summary.currentDayMinutes
        );
        let liveshareTime = null;
        if (summary.liveshareMinutes) {
            liveshareTime = utilMgr.humanizeMinutes(summary.liveshareMinutes);
        }
        const currentEditorMinutesStr = wallClockMgr.getHumanizedWcTime();
        dashboardContent += utilMgr.getDashboardRow(
            'Editor time today',
            currentEditorMinutesStr
        );
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
