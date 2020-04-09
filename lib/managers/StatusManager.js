'use babel';

import { getCodeTimeSummary } from './TimeDataManager';

const fileDataMgr = require('../storage/FileDataManager');
const utilMgr = require('../UtilManager');

const statusMgr = {};

let showStatusBarText = true;

/**
 * Update the status bar text
 **/
statusMgr.updateStatusBarWithSummaryData = () => {
    const data = fileDataMgr.getSessionSummaryData();

    const codeTimeSummary = getCodeTimeSummary();

    const currentDayMinStr = utilMgr.humanizeMinutes(
        codeTimeSummary.activeCodeTimeMinutes
    );

    let icon =
        codeTimeSummary.activeCodeTimeMinutes > data.averageDailyMinutes
            ? 'rocket'
            : '';

    let msg = currentDayMinStr;

    if (!showStatusBarText) {
        msg = '';
        icon = 'clock';
    }
    utilMgr.getStatusView().display(msg, icon, utilMgr.getItem('name'));
};

statusMgr.toggleStatusBarMetrics = () => {
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
