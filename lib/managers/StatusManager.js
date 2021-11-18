'use babel';

const fileDataMgr = require('../storage/FileDataManager');
const utilMgr = require('../UtilManager');

const statusMgr = {};

let showStatusBarText = true;

/**
 * Update the status bar text
 **/
statusMgr.updateStatusBarWithSummaryData = () => {
    const summary = fileDataMgr.getSessionSummaryData();

    const currentDayMinStr = utilMgr.humanizeMinutes(
        summary.currentDayMinutes
    );

    let icon =
        summary.currentDayMinutes > summary.averageDailyMinutes
            ? 'rocket'
            : '';

    let msg = currentDayMinStr;

    if (!showStatusBarText) {
        msg = '';
        icon = 'clock';
    }
    utilMgr.getStatusView().display(msg, icon, utilMgr.getItem('name'));
};

statusMgr.toggleStatusBarMetrics = (interactionType) => {
    const cta_text = showStatusBarText ? "Hide status bar metrics" : "Show status bar metrics";
    showStatusBarText = !showStatusBarText;
    statusMgr.updateStatusBarWithSummaryData();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-code-time-metrics'
    );
};

statusMgr.showingStatusBarText = () => {
    return showStatusBarText;
};

module.exports = statusMgr;
