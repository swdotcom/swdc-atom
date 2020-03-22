'use babel';

import TimeData from '../model/TimeData';
import Project from '../model/Project';

const kpmMgr = require('../managers/KpmManager');
const utilMgr = require('../UtilManager');
const fs = require('fs');
const moment = require('moment-timezone');

const timeSummaryDataMgr = {};

timeSummaryDataMgr.getEndDayTimes = () => {
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
    return { utcEndOfDay, localEndOfDay, day };
};

timeSummaryDataMgr.getNewTimeDataSummary = () => {
    const {
        utcEndOfDay,
        localEndOfDay,
        day,
    } = timeSummaryDataMgr.getEndDayTimes();
    const project = timeSummaryDataMgr.getCurrentTimeSummaryProject();

    const timeData = new TimeData();
    timeData.day = day;
    timeData.project = project;
    timeData.timestamp_local = localEndOfDay;
    timeData.timestamp = utcEndOfDay;
    return timeData;
};

timeSummaryDataMgr.getCurrentTimeSummaryProject = async () => {
    const project = new Project();

    const projectNameAndDir = kpmMgr.getProjectNameAndDirectory();

    if (projectNameAndDir.directory) {
        // create the project
        project.directory = projectNameAndDir.directory;
        project.name = projectNameAndDir.name;

        try {
            const resource = await getResourceInfo(projectNameAndDir.directory);
            if (resource) {
                project.resource = resource;
                project.identifier = resource.identifier;
            }
        } catch (e) {
            //
        }
    } else {
        project.directory = NO_PROJ_NAME;
        project.name = UNTITLED;
    }

    return project;
};

timeSummaryDataMgr.clearTimeDataSummary = () => {
    const data = timeSummaryDataMgr.getNewTimeDataSummary();
    timeSummaryDataMgr.saveTimeDataSummaryToDisk(data);
};

timeSummaryDataMgr.updateEditorSeconds = editor_seconds => {
    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    timeData.editor_seconds += editor_seconds;
    timeSummaryDataMgr.saveTimeDataSummaryToDisk(timeData);
};

timeSummaryDataMgr.incrementSessionAndFileSeconds = () => {
    const minutes_since_payload = utilMgr.getMinutesSinceLastPayload();
    const timeData = timeSummaryDataMgr.getTodayTimeDataSummary();
    const session_seconds = minutes_since_payload * 60;
    timeData.session_seconds += session_seconds;
    timeData.file_seconds += 60;
    timeSummaryDataMgr.saveTimeDataSummaryToDisk(timeData);
};

timeSummaryDataMgr.getTodayTimeDataSummary = () => {
    const { day } = timeSummaryDataMgr.getEndDayTimes();
    const projectNameAndDir = kpmMgr.getProjectNameAndDirectory();

    let timeData = null;
    const file = utilMgr.getTimeDataSummaryFile();
    const payloads = utilMgr.getFileDataArray(file);
    if (payloads && payloads.length) {
        // find the one for this day
        timeData = payloads.find(
            n =>
                n.day === day &&
                n.project.directory === projectNameAndDir.directory
        );
    }
    if (!timeData) {
        timeData = timeSummaryDataMgr.getNewTimeDataSummary();
        timeSummaryDataMgr.saveTimeDataSummaryToDisk(timeData);
    }
    return timeData;
};

timeSummaryDataMgr.saveTimeDataSummaryToDisk = data => {
    if (!data) {
        return;
    }

    let payloads = utilMgr.getFileDataArray(utilMgr.getTimeDataSummaryFile());

    if (payloads && payloads.length) {
        // find the one for this day
        const idx = payloads.findIndex(
            n =>
                n.day === data.day &&
                n.project.directory === data.project.directory
        );
        if (idx !== -1) {
            payloads[idx] = data;
        } else {
            // add it
            payloads.push(data);
        }
    } else {
        payloads = [data];
    }

    try {
        const content = JSON.stringify(payloads, null, 4);
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
