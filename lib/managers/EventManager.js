'use babel';

const utilMgr = require('../UtilManager');
const statusMgr = require('./StatusManager');

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


module.exports = eventMgr;
