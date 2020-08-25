'use babel';

import KeystrokeAggregate from '../model/KeystrokeAggregate';
import CodeTimeEvent from '../model/CodeTimeEvent';
import fileIt from 'file-it';

const utilMgr = require('../UtilManager');
const timeUtil = require('../utils/TimeUtil');
const execUtil = require('../utils/ExecUtil');
const statusMgr = require('./StatusManager');
const serviceUtil = require('../utils/ServiceUtil');

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
 * Store the keystrokes payload offline
 * @param payload
 */
eventMgr.storePayload = async (payload) => {
    if (!payload) {
      return;
    }

    const dataFile = utilMgr.getSoftwareDataStoreFile();

    // update the status bar
    statusMgr.updateStatusBarWithSummaryData();

    // append the payload into the data.json file
    fileIt.appendJsonFileSync(dataFile, payload);

    // refresh the tree view
    setTimeout(() => {
        // refresh the tree view
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );
    }, 1000);
};

eventMgr.storeEvent = event => {
  // append the event
  fileIt.writeJsonFileSync(utilMgr.getPluginEventsFile(), event, {flag: "a"});
};

module.exports = eventMgr;
