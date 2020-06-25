'use babel';

import KeystrokeAggregate from '../model/KeystrokeAggregate';
import CodeTimeEvent from '../model/CodeTimeEvent';
import { NO_PROJ_NAME } from '../Constants';
import fileIt from 'file-it';
import path from 'path';

const utilMgr = require('../UtilManager');
const timeUtil = require('../utils/TimeUtil');
const execUtil = require('../utils/ExecUtil');
const statusMgr = require('./StatusManager');
const serviceUtil = require('../utils/ServiceUtil');
const fileChangeInfoSummaryDataMgr = require('../storage/FileChangeInfoSummaryDataManager');
const sessionSummaryMgr = require('./SessionSummaryManager');
const os = require('os');

const eventMgr = {};

// init status bar.
eventMgr.initializeStatus = async () => {
    statusMgr.updateStatusBarWithSummaryData();
};

eventMgr.pauseMetrics = async () => {
    utilMgr.updateTelemetryOn(false);
    utilMgr.getStatusView().display('Paused', '', 'Enable metrics to resume');
};

eventMgr.enableMetrics = async () => {
    utilMgr.updateTelemetryOn(true);
    statusMgr.updateStatusBarWithSummaryData();
};

eventMgr.sendBatchPayload = (api, batch) => {
    return serviceUtil
        .softwarePost(api, batch, utilMgr.getItem('jwt'))
        .catch(e => {
            utilMgr.logIt(
                `Unable to send plugin data batch, error: ${e.message}`
            );
        });
};

/**
 * this should only be called if there's file data in the source
 * @param payload
 */
eventMgr.storePayload = async (payload, sessionMinutes) => {
    // update the aggregates for the tree metrics
    const aggregate = eventMgr.aggregateData(payload);

    // increment the session summary minutes and other metrics for the tree
    await sessionSummaryMgr.incrementSessionSummaryData(
        aggregate,
        sessionMinutes
    );

    // refresh the tree view
    setTimeout(() => {
        // refresh the tree view
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );
    }, 1000);

    // update the status bar
    statusMgr.updateStatusBarWithSummaryData();

    // append the payload into the data.json file
    fileIt.writeJsonFileSync(utilMgr.getSoftwareDataStoreFile(), payload, {flag: "a"});
};

eventMgr.aggregateData = payload => {
    // get a mapping of the current files
    const fileChangeInfoMap = fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson();

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

    // write the fileChangeInfoMap
    fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk(fileChangeInfoMap);

    return aggregate;
};

eventMgr.storeEvent = event => {
  // append the event
  fileIt.writeJsonFileSync(utilMgr.getPluginEventsFile(), event, {flag: "a"});
};

/**
 *
 * @param type i.e. window | mouse | etc...
 * @param name i.e. close | click | etc...
 * @param description
 */
eventMgr.createCodeTimeEvent = async (type, name, description) => {
    const nowTimes = timeUtil.getNowTimes();
    const event = new CodeTimeEvent();
    event.timestamp = nowTimes.now_in_sec;
    event.timestamp_local = nowTimes.local_now_in_sec;
    event.type = type;
    event.name = name;
    event.description = description;
    event.hostname = await execUtil.getHostname();
    eventMgr.storeEvent(event);
};

module.exports = eventMgr;
