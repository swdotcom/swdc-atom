'use babel';

import KeystrokeAggregate from './model/KeystrokeAggregate';
import CodeTimeEvent from '../model/CodeTimeEvent';
import { NO_PROJ_NAME } from '../Constants';

const utilMgr = require('../UtilManager');
const offlineMgr = require('../OfflineManager');
const fileChangeInfoSummaryData = require('../storage/FileChangeInfoSummaryData');
const fs = require('fs');
const os = require('os');

const eventMgr = {};

eventMgr.sendBatchPayload = (api, batch) => {
    utilMgr.softwarePost(api, batch, utilMgr.getItem('jwt')).catch(e => {
        utilMgr.logIt(`Unable to send plugin data batch, error: ${e.message}`);
    });
};

/**
 * this should only be called if there's file data in the source
 * @param payload
 */
eventMgr.storePayload = payload => {
    // get a mapping of the current files
    const fileChangeInfoMap = fileChangeInfoSummaryData.getFileChangeSummaryAsJson();

    const aggregate = new KeystrokeAggregate();
    aggregate.directory = payload.project
        ? payload.project.directory || NO_PROJ_NAME
        : NO_PROJ_NAME;
    Object.keys(payload.source).forEach(key => {
        const fileInfo = payload.source[key];
        /**
         * update the project info
         * project has {directory, name}
         */
        const baseName = path.basename(key);
        fileInfo.name = baseName;
        fileInfo.fsPath = key;
        fileInfo.projectDir = payload.project.directory;
        fileInfo.duration_seconds = fileInfo.end - fileInfo.start;

        // update the aggregate info
        aggregate.add += fileInfo.add;
        aggregate.close += fileInfo.close;
        aggregate.delete += fileInfo.delete;
        aggregate.keystrokes += fileInfo.keystrokes;
        aggregate.linesAdded += fileInfo.linesAdded;
        aggregate.linesRemoved += fileInfo.linesRemoved;
        aggregate.open += fileInfo.open;
        aggregate.paste += fileInfo.paste;

        const existingFileInfo = fileChangeInfoMap[key];
        if (!existingFileInfo) {
            fileInfo.update_count = 1;
            fileInfo.kpm = aggregate.keystrokes;
            fileChangeInfoMap[key] = fileInfo;
        } else {
            // aggregate
            existingFileInfo.update_count += 1;
            existingFileInfo.keystrokes += fileInfo.keystrokes;
            existingFileInfo.kpm =
                existingFileInfo.keystrokes / existingFileInfo.update_count;
            existingFileInfo.add += fileInfo.add;
            existingFileInfo.close += fileInfo.close;
            existingFileInfo.delete += fileInfo.delete;
            existingFileInfo.keystrokes += fileInfo.keystrokes;
            existingFileInfo.linesAdded += fileInfo.linesAdded;
            existingFileInfo.linesRemoved += fileInfo.linesRemoved;
            existingFileInfo.open += fileInfo.open;
            existingFileInfo.paste += fileInfo.paste;
            existingFileInfo.duration_seconds += fileInfo.duration_seconds;

            // non aggregates, just set
            existingFileInfo.lines = fileInfo.lines;
            existingFileInfo.length = fileInfo.length;
        }
    });

    // this will increment and store it offline
    offlineMgr.incrementSessionSummaryData(aggregate);

    // write the fileChangeInfoMap
    fileChangeInfoSummaryData.saveFileChangeInfoToDisk(fileChangeInfoMap);

    setTimeout(() => {
        // refresh the tree view
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refreshCodeTimeTree'
        );
    }, 1000);

    // store the payload into the data.json file

    fs.appendFile(
        utilMgr.getSoftwareDataStoreFile(),
        JSON.stringify(payload) + os.EOL,
        err => {
            if (err)
                utilMgr.logIt(
                    `Error appending to the Software data store file: ${err.message}`
                );
        }
    );
};

eventMgr.storeEvent = event => {
    fs.appendFile(
        utilMgr.getPluginEventsFile(),
        JSON.stringify(event) + os.EOL,
        err => {
            if (err) {
                utilMgr.logIt(
                    `Error appending to the events data file: ${err.message}`
                );
            }
        }
    );
};

/**
 *
 * @param type i.e. window | mouse | etc...
 * @param name i.e. close | click | etc...
 * @param description
 */
eventMgr.createCodeTimeEvent = async (type, name, description) => {
    const nowTimes = utilMgr.getNowTimes();
    const event = new CodeTimeEvent();
    event.timestamp = nowTimes.now_in_sec;
    event.timestamp_local = nowTimes.local_now_in_sec;
    event.type = type;
    event.name = name;
    event.description = description;
    event.hostname = await utilMgr.getHostname();
    eventMgr.storeEvent(event);
};

module.exports = eventMgr;
