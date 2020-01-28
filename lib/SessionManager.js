'use babel';

const fs = require('fs');
const open = require('open');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const utilMgr = require('./UtilManager');

//
// SessionManager - handles software session management
//
let sessionMgr = {};

let grubMgr = null;
let kpmInfo = {};

sessionMgr.initializeStatus = async () => {
    let msg = 'Code Time';
    utilMgr.getStatusView().display(msg);
};

sessionMgr.storePayload = payload => {
    fs.appendFile(
        utilMgr.getSoftwareDataStoreFile(),
        JSON.stringify(payload) + os.EOL,
        err => {
            if (err)
                console.log(
                    'Code Time: Error appending to the Software data store file: ',
                    err.message
                );
        }
    );
};

sessionMgr.pauseMetrics = async () => {
    utilMgr.updateTelemetryOn(false);
    utilMgr.getStatusView().display('Paused', '', 'Enable metrics to resume');
};

sessionMgr.enableMetrics = async () => {
    utilMgr.updateTelemetryOn(true);
    utilMgr.getStatusView().display('Code Time');
};

module.exports = sessionMgr;
