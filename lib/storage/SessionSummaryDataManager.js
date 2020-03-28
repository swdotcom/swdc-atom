'use babel';

import SessionSummary from '../model/SessionSummary';
import TimeData from '../model/TimeData';
import Project from '../model/Project';

const kpmMgr = require('../managers/KpmManager');
const wallClockMgr = require('../managers/WallClockManager');
const moment = require('moment-timezone');
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('./FileDataManager');
const timeUtil = require('../utils/TimeUtil');
const fs = require('fs');

export function clearSessionSummaryData() {
    const data = new SessionSummary();
    fileDataMgr.saveSessionSummaryToDisk(data);
}

/**
 * Increment the session summary minutes
 * and update the time summary data summary.
 */
export function incrementSessionSummaryData(aggregates) {
    let data = fileDataMgr.getSessionSummaryData();

    // what is the gap from the previous start
    const incrementMinutes = utilMgr.getMinutesSinceLastPayload();
    data.currentDayMinutes += incrementMinutes;
    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;

    fileDataMgr.saveSessionSummaryToDisk(data);

    incrementSessionAndFileSeconds();
}

export function getEndDayTimes() {
    const nowTime = timeUtil.getNowTimes();
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
}

export function getNewTimeDataSummary() {
    const { utcEndOfDay, localEndOfDay, day } = getEndDayTimes();
    const project = getCurrentTimeSummaryProject();

    const timeData = new TimeData();
    timeData.day = day;
    timeData.project = project;
    timeData.timestamp_local = localEndOfDay;
    timeData.timestamp = utcEndOfDay;
    return timeData;
}

export async function getCurrentTimeSummaryProject() {
    const project = new Project();

    const projectNameAndDir = kpmMgr.getProjectNameAndDirectory();

    if (projectNameAndDir.directory) {
        // create the project
        project.directory = projectNameAndDir.directory;
        project.name = projectNameAndDir.name;

        try {
            const resource = await getResourceInfo(projectNameAndDir.directory);
            console.log('resource data: ', JSON.stringify(resource));
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
}

export function clearTimeDataSummary() {
    const data = getNewTimeDataSummary();
    saveTimeDataSummaryToDisk(data);
}

export function updateEditorSeconds(editor_seconds) {
    const timeData = getTodayTimeDataSummary();
    timeData.editor_seconds += editor_seconds;
    saveTimeDataSummaryToDisk(timeData);
}

export function incrementSessionAndFileSeconds() {
    const minutes_since_payload = utilMgr.getMinutesSinceLastPayload();
    const timeData = getTodayTimeDataSummary();
    const session_seconds = minutes_since_payload * 60;
    timeData.session_seconds += session_seconds;
    timeData.file_seconds += 60;
    saveTimeDataSummaryToDisk(timeData);
}

export function getTodayTimeDataSummary() {
    const { day } = getEndDayTimes();
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
        timeData = getNewTimeDataSummary();
        saveTimeDataSummaryToDisk(timeData);
    }
    return timeData;
}

export function saveTimeDataSummaryToDisk(data) {
    if (!data) {
        return;
    }

    const file = utilMgr.getTimeDataSummaryFile();
    let payloads = utilMgr.getFileDataArray(file);

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
}
