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
    if (incrementMinutes > 0) {
        data.currentDayMinutes += incrementMinutes;
    }
    data.currentDayKeystrokes += aggregates.keystrokes;
    data.currentDayLinesAdded += aggregates.linesAdded;
    data.currentDayLinesRemoved += aggregates.linesRemoved;
    fileDataMgr.saveSessionSummaryToDisk(data);
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

export function getNewTimeDataSummary(project) {
    const { utcEndOfDay, localEndOfDay, day } = getEndDayTimes();

    const timeData = new TimeData();
    timeData.day = day;
    timeData.project = project;
    timeData.timestamp_local = localEndOfDay;
    timeData.timestamp = utcEndOfDay;
    return timeData;
}

export async function getCurrentTimeSummaryProject(project) {
    let projectNameAndDir = {};
    if (!project) {
        project = new Project();
        project = { ...kpmMgr.getProjectNameAndDirectory() };
    }

    if (project.directory) {
        // create the project
        project.directory = project.directory;
        project.name = project.name;

        try {
            const resource = await getResourceInfo(project.directory);
            if (resource) {
                project.resource = resource;
                project.identifier = resource.identifier;
            }
        } catch (e) {
            //
        }
    } else {
        project.directory = projectNameAndDir.directory || NO_PROJ_NAME;
        project.name = projectNameAndDir.name || UNTITLED;
    }

    return project;
}

export function clearTimeDataSummary() {
    let payloads = [];
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

export function updateEditorSeconds(editor_seconds) {
    const projectNameAndDir = kpmMgr.getProjectNameAndDirectory();

    const timeData = getTodayTimeDataSummary(projectNameAndDir);
    timeData.editor_seconds += editor_seconds;
    timeData.editor_seconds = Math.max(
        timeData.editor_seconds,
        timeData.session_seconds
    );
    saveTimeDataSummaryToDisk(timeData);
}

export function incrementSessionAndFileSeconds(project) {
    const minutes_since_payload = utilMgr.getMinutesSinceLastPayload();
    const timeData = getTodayTimeDataSummary(project);
    if (minutes_since_payload > 0) {
        const session_seconds = minutes_since_payload * 60;
        timeData.session_seconds += session_seconds;
    }

    // update the editor seconds in case its lagging
    timeData.editor_seconds = Math.max(
        timeData.editor_seconds,
        timeData.session_seconds
    );
    timeData.file_seconds += 60;
    timeData.file_seconds = Math.min(
        timeData.file_seconds,
        timeData.session_seconds
    );

    saveTimeDataSummaryToDisk(timeData);
}

export function getTodayTimeDataSummary(project) {
    if (!project || !project.directory) {
        return null;
    }
    const { day } = getEndDayTimes();

    let timeData = null;
    const file = utilMgr.getTimeDataSummaryFile();
    const payloads = utilMgr.getFileDataArray(file);
    if (payloads && payloads.length) {
        // find the one for this day
        timeData = payloads.find(
            n => n.day === day && n.project.directory === project.directory
        );
    }
    if (!timeData) {
        timeData = getNewTimeDataSummary(project);
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
