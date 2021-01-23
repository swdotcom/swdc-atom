'use babel';

import { showSettingsUpdateOptions, showSettingsTextUpdatePrompt } from "../utils/PopupUtil";

/**
 * Screen Mode: full screen
 * Pause Notifications: on
 * Slack Away Msg: It's CodeTime!
 */
export function getConfigSettingsTooltip() {
  const preferences = [];
  const configSettings = getConfigSettings();
  preferences.push(`**Screen Mode**: *${configSettings.screenMode.toLowerCase()}*`);

  const notificationState = configSettings.pauseSlackNotifications ? "on" : "off";
  preferences.push(`**Pause Notifications**: *${notificationState}*`);

  const slackAwayStatusMsg = configSettings.slackAwayStatusText || "";
  preferences.push(`**Slack Away Msg**: *${slackAwayStatusMsg}*`);

  // 2 spaces followed by a newline will create newlines in markdown
  return preferences.length ? preferences.join("  \n") : "";
}

export function getConfigSettings() {
  return {
    pauseSlackNotifications: atom.config.get("code-time.pauseSlackNotifications"),
    slackAwayStatus: atom.config.get("code-time.slackAwayStatus"),
    slackAwayStatusText: atom.config.get("code-time.slackAwayStatusText"),
    screenMode: atom.config.get("code-time.screenMode")
  }
}

export function editPauseSlackNotifications() {
  const configSettings = getConfigSettings();
  const title = "Pause Slack Notifications";
  const prompt = "Automatically pause Slack notifications when I'm in flow.";
  const items = [
    {value: true, text: "On"},
    {value: false, text: "Off"}
  ];
  const defaultValueText = configSettings.pauseSlackNotifications ? "On" : "Off";
  const defaultValueOption = {value: configSettings.pauseSlackNotifications, text: defaultValueText};
  showSettingsUpdateOptions(items, title, prompt, editPauseSlackNotificationsCallback, defaultValueOption);
}

export function editPauseSlackNotificationsCallback(value) {
  if (value !== undefined && value !== null) {
    atom.config.set("code-time.pauseSlackNotifications", value);
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}

export function editSlackAwayStatus() {
  const configSettings = getConfigSettings();
  const title = "Slack Away Status";
  const prompt = "Automatically set my status away when I'm in flow.";
  const items = [
    {value: true, text: "On"},
    {value: false, text: "Off"}
  ];
  const defaultValueText = configSettings.slackAwayStatus ? "On" : "Off";
  const defaultValueOption = {value: configSettings.slackAwayStatus, text: defaultValueText};
  showSettingsUpdateOptions(items, title, prompt, editSlackAwayStatusCallback, defaultValueOption);
}

export function editSlackAwayStatusCallback(value) {
  if (value !== undefined && value !== null) {
    atom.config.set("code-time.slackAwayStatus", value);
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}

export function editSlackAwayText() {
  const configSettings = getConfigSettings();
  const title = "Slack Away Status Text";
  const prompt = "Customize your away status in Slack.";
  const defaultValue = configSettings.slackAwayStatusText;
  showSettingsTextUpdatePrompt(title, prompt, editSlackAwayTextCallback, defaultValue);
}

export function editSlackAwayTextCallback(value) {
  if (value !== undefined && value !== null) {
    atom.config.set("code-time.slackAwayStatusText", value);
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}

export function editScreenMode() {
  const configSettings = getConfigSettings();
  const title = "Screen Mode";
  const prompt = "Automatically toggle a selected screen mode when I'm in flow.";
  const items = [
    {value: "Full Screen", text: "Full Screen"},
    {value: "None", text: "None"}
  ];
  const defaultValueOption = configSettings.screenMode === "Full Screen" ? items[0] : items[1];
  showSettingsUpdateOptions(items, title, prompt, editScreenModeCallback, defaultValueOption);
}

export function editScreenModeCallback(value) {
  if (value !== undefined && value !== null) {
    atom.config.set("code-time.screenMode", value);
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}
