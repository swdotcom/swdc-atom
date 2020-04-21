'use babel';

import TimeData from '../model/TimeData';
import Project from '../model/Project';
import CodeTimeSummary from '../model/CodeTimeSummary';

const kpmMgr = require('../managers/KpmManager');
const utilMgr = require('../UtilManager');
const payloadMgr = require('../managers/PayloadManager');
const timeUtil = require('../utils/TimeUtil');
const fs = require('fs');

export async function getNewTimeDataSummary(project) {
    const nowTimes = timeUtil.getNowTimes();

    let timeData: TimeData = null;
    if (!project) {
        // but make sure we're not creating a new one on top of one that already exists
        project = await kpmMgr.getActiveProject();
        timeData = findTimeDataSummary(project);
        if (timeData) {
            return timeData;
        }
    }

    timeData = new TimeData();
    timeData.day = nowTimes.day;
    timeData.project = project;
    return timeData;
}

export async function getCurrentTimeSummaryProject(project) {
    if (!project) {
        project = await kpmMgr.getActiveProject();
        return project;
    }

    if (project.directory) {
        const resource = await getResourceInfo(project.directory);
        if (resource) {
            project.resource = resource;
            project.identifier = resource.identifier;
        }
    } else {
        project.directory = NO_PROJ_NAME;
        project.name = UNTITLED;
    }

    return project;
}

/**
 * send the offline TimeData payloads
 */
export async function sendOfflineTimeData() {
    payloadMgr.batchSendArrayData(
        '/data/time',
        utilMgr.getTimeDataSummaryFile()
    );

    clearTimeDataSummary();
}

export function clearTimeDataSummary() {
    let payloads = [];
    try {
        const file = utilMgr.getTimeDataSummaryFile();
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

export async function incrementEditorSeconds(editor_seconds) {
    // this will always bring a project (no name or named)
    const activeProject = await kpmMgr.getActiveProject();

    const timeData = await getTodayTimeDataSummary(activeProject);
    if (timeData) {
        timeData.editor_seconds += editor_seconds;
        timeData.editor_seconds = Math.max(
            timeData.editor_seconds,
            timeData.session_seconds
        );
        saveTimeDataSummaryToDisk(timeData);
    }
}

export async function incrementSessionAndFileSecondsAndFetch(
    project,
    sessionMinutes
) {
    const timeData = await getTodayTimeDataSummary(project);
    if (timeData) {
        const session_seconds = sessionMinutes * 60;
        timeData.session_seconds += session_seconds;

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
    return timeData;
}

export async function updateSessionFromSummaryApi(currentDayMinutes) {
    const nowTimes = timeUtil.getNowTimes();

    const codeTimeSummary = getCodeTimeSummary();

    // find out if there's a diff
    const diffActiveCodeMinutesToAdd =
        codeTimeSummary.activeCodeTimeMinutes < currentDayMinutes
            ? currentDayMinutes - codeTimeSummary.activeCodeTimeMinutes
            : 0;

    // get the current open project
    let project = await kpmMgr.getActiveProject();
    let timeData = null;
    if (project) {
        timeData = await getTodayTimeDataSummary(project);
    } else {
        const file = utilMgr.getTimeDataSummaryFile();
        const payloads = utilMgr.getFileDataArray(file);
        const filtered_payloads = payloads.filter(n => n.day === day);
        if (filtered_payloads && filtered_payloads.length) {
            timeData = filtered_payloads[0];
        }
    }

    if (!timeData) {
        // create a untitled one
        project = new Project();
        project.directory = NO_PROJ_NAME;
        project.name = UNTITLED;

        timeData = new TimeData();
        timeData.day = nowTimes.day;
        timeData.project = project;
    }

    // save the info to disk
    const secondsToAdd = diffActiveCodeMinutesToAdd * 60;
    timeData.session_seconds += secondsToAdd;
    timeData.editor_seconds += secondsToAdd;
    // make sure editor seconds isn't less
    saveTimeDataSummaryToDisk(timeData);
}

export async function getTodayTimeDataSummary(project) {
    let timeData = findTimeDataSummary(project);
    if (!timeData) {
        timeData = await getNewTimeDataSummary(project);
        saveTimeDataSummaryToDisk(timeData);
    }
    return timeData;
}

function findTimeDataSummary(project) {
    if (!project || !project.directory) {
        return null;
    }
    const nowTimes = timeUtil.getNowTimes();

    let timeData = null;
    const file = utilMgr.getTimeDataSummaryFile();
    const payloads = utilMgr.getFileDataArray(file);

    if (payloads && payloads.length) {
        // find the one for this day
        timeData = payloads.find(
            n =>
                n.day === nowTimes.day &&
                n.project.directory === project.directory
        );
    }

    return timeData;
}

export function getCodeTimeSummary() {
    const summary = new CodeTimeSummary();

    const nowTimes = timeUtil.getNowTimes();

    // gather the time data elements for today
    const file = utilMgr.getTimeDataSummaryFile();

    // TimeData[]
    const payloads = utilMgr.getFileDataArray(file);

    const filtered_payloads = payloads.filter(n => n.day === nowTimes.day);

    if (filtered_payloads && filtered_payloads.length) {
        filtered_payloads.forEach(n => {
            summary.activeCodeTimeMinutes += n.session_seconds / 60;
            summary.codeTimeMinutes += n.editor_seconds / 60;
            summary.fileTimeMinutes += n.file_seconds / 60;
        });
    }

    return summary;
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
