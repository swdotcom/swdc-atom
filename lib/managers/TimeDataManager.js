'use babel';

import CodeTimeSummary from '../model/CodeTimeSummary';
import { NO_PROJ_NAME, UNTITLED } from '../Constants';
import fileIt from 'file-it';

const gitUtil = require('../repo/GitUtil');
const projectMgr = require("../managers/ProjectManager");
const utilMgr = require('../UtilManager');


export async function getCurrentTimeSummaryProject(project) {
    if (!project) {
        project = await projectMgr.getActiveProject();
        return project;
    }

    if (project.directory) {
        const resource = await gitUtil.getResourceInfo(project.directory);
        if (resource) {
            project.resource = resource;
            project.identifier = resource.identifier;
        }
    } else {
        project.directory = UNTITLED;
        project.name = NO_PROJ_NAME;
    }

    return project;
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

    fileIt.writeJsonFileSync(file, payloads, { spaces: 4 });
}
