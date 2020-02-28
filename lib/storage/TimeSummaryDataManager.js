'use babel';

import TimeData from '../model/TimeData';

const utilMgr = require('../UtilManager');
const fs = require('fs');
const moment = require('moment-timezone');

const timeSummaryDataMgr = {};

timeSummaryDataMgr.getTimeDataSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\timeDataSummary.json';
    } else {
        file += '/timeDataSummary.json';
    }
    return file;
};

timeSummaryDataMgr.clearTimeDataSummary = () => {
    const data = new TimeData();
    timeSummaryDataMgr.saveTimeDataSummaryToDisk(data);
};

timeSummaryDataMgr.updateTimeSummaryData = (
    editor_seconds,
    session_seconds,
    file_seconds
) => {
    const nowTime = utilMgr.getNowTimes();
    const day = moment.unix(nowTime.local_now_in_sec).format('YYYY-MM-DD');
    const utcEndOfDay = moment
        .unix(nowTime.now_in_sec)
        .endOf('day')
        .unix();
    const localEndOfDay = moment
        .unix(nowTime.local_now_in_sec)
        .endOf('day')
        .unix();

    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    timeData.editor_seconds = editor_seconds;
    timeData.session_seconds = session_seconds;
    timeData.file_seconds = file_seconds;
    timeData.timestamp = utcEndOfDay;
    timeData.timestamp_local = localEndOfDay;
    timeData.day = day;
    // save the info to disk
    timeSummaryDataMgr.saveTimeDataSummaryToDisk(timeData);
};

timeSummaryDataMgr.getTodayTimeDataSummary = () => {
    const nowTime = utilMgr.getNowTimes();
    const day = moment.unix(nowTime.local_now_in_sec).format('YYYY-MM-DD');

    let timeData = null;
    const file = timeSummaryDataMgr.getTimeDataSummaryFile();
    const payloads = utilMgr.getFileDataArray(file);
    if (payloads && payloads.length) {
        // find the one for this day
        timeData = payloads.find(n => n.day === day);
    }
    if (!timeData) {
        timeData = new TimeData();
        timeData.day = day;
        timeSummaryDataMgr.saveTimeDataSummaryToDisk(timeData);
    }
    return timeData;
};

timeSummaryDataMgr.saveTimeDataSummaryToDisk = data => {
    if (!data) {
        return;
    }

    try {
        const content = JSON.stringify(data, null, 4);

        fs.writeFileSync(file, content, err => {
            if (err) {
                utilMgr.logIt(
                    `Code time: Error writing time summary data: ${err.message}`
                );
            } else {
                utilMgr.logIt(`Code time: updated time summary data to disk`);
            }
        });
    } catch (e) {
        //
    }
};

module.exports = timeSummaryDataMgr;
