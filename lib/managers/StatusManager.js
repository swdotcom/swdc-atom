'use babel';

import { getCodeTimeSummary } from './TimeDataManager';

const fileDataMgr = require('../storage/FileDataManager');
const utilMgr = require('../UtilManager');
const tracker = require("./TrackerManager");

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

statusMgr.toggleStatusBarMetrics = (interactionType) => {
    const cta_text = showStatusBarText ? "Hide status bar metrics" : "Show status bar metrics";
    showStatusBarText = !showStatusBarText;
    statusMgr.updateStatusBarWithSummaryData();

    interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
    const uiElement = {
      element_name: interactionType === "click" ? "ct_toggle_status_bar_metrics_btn" : "ct_toggle_status_bar_metrics_cmd",
      element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
      cta_text,
      color: interactionType === "click" ? "blue" : null,
      icon_name: interactionType === "click" ? "slash-eye" : null
    };
    tracker.trackUIInteraction(interactionType, uiElement);

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-code-time-metrics'
    );
};

statusMgr.showingStatusBarText = () => {
    return showStatusBarText;
};

module.exports = statusMgr;
