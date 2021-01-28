'use babel';

import { getConfigSettings } from './ConfigManager';
import {
  checkRegistration,
  pauseSlackNotifications,
  setFlowModeStatus,
  updateSlackPresence,
  enableSlackNotifications,
  getSlackStatus,
  getSlackPresence,
  getSlackDnDInfo,
  showModalSignupPrompt,
  clearSlackInfoCache,
  hasSlackWorkspaces
} from "./SlackManager";
import { getScreenMode, enterFullScreen, exitFullScreen,
  ZEN_MODE_ID, FULL_SCREEN_MODE_ID, NORMAL_SCREEN_MODE } from "./ScreenManager";

export let enablingFlow = false;
export let enabledFlow = false;
let useSlackSettings = true;

export async function checkToDisableFlow() {
  if (!enabledFlow || enablingFlow) {
    return;
  } else if (!useSlackSettings && !isScreenStateInFlow()) {
    // slack isn't connected but the screen state changed out of flow
    pauseFlowInitiate();
    return;
  }

  const [slackStatus, slackPresence, slackDnDInfo] = await Promise.all([getSlackStatus(), getSlackPresence(), getSlackDnDInfo()]);
  if (enabledFlow && !isInFlowMode(slackStatus, slackPresence, slackDnDInfo)) {
    // disable it
    pauseFlowInitiate();
  }
}

export async function initiateFlow() {
  const isRegistered = checkRegistration(false);
  if (!isRegistered) {
    // show the flow mode prompt
    showModalSignupPrompt("To use Flow Mode, please first sign up or login.");
    return;
  }
  enablingFlow = true;

  const configSettings = getConfigSettings();

  // set slack status to away
  if (configSettings.slackAwayStatus) {
    await updateSlackPresence("away", false /*showSuccessNotification*/, false /*initiateFlowRefresh*/);
  }

  // set the status text to what the user set in the settings
  const statusData = {
    status_text: configSettings.slackAwayStatusText,
    status_emoji: ":large_purple_circle:",
    status_expiration: 0,
  };

  await setFlowModeStatus(statusData);

  // pause slack notifications
  if (configSettings.pauseSlackNotifications) {
    await pauseSlackNotifications(false /*showNotification*/, false /*refreshFlowTree*/, true /*isFlowRequest*/);
  }

  // set to zen mode
  let screenChanged = false;
  if (configSettings.screenMode.includes("Full Screen")) {
    screenChanged = enterFullScreen();
  } else {
    screenChanged = exitFullScreen();
  }

  clearSlackInfoCache();

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );

  enabledFlow = true;
  enablingFlow = false;
}

export async function pauseFlowInitiate() {
  const configSettings = getConfigSettings();

  // set slack status to away
  await updateSlackPresence("auto", false /*showSuccessNotification*/, false /*initiateFlowRefresh*/);

  // clear the status
  const status = {
    status_text: "",
    status_emoji: "",
  };
  await setFlowModeStatus(status);

  // pause slack notifications
  if (configSettings.pauseSlackNotifications) {
    await enableSlackNotifications(false /*showNotification*/, false /*refreshFlowTree*/, true /*isFlowRequest*/);
  }

  const screenChanged = exitFullScreen();

  clearSlackInfoCache();

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );

  enabledFlow = false;
  enablingFlow = false;
}

export function isInFlowMode(slackStatus, slackPresence, slackDnDInfo) {
  if (enablingFlow) {
    return true;
  } else if (!enabledFlow) {
    return false;
  }
  const configSettings = getConfigSettings();

  const screen_mode = getScreenMode();

  useSlackSettings = hasSlackWorkspaces();

  // determine if this editor should be in flow mode
  let screenInFlowState = isScreenStateInFlow();

  // determine if the pause slack notification is in flow
  let pauseSlackNotificationsInFlowState = false;
  if (!useSlackSettings) {
    pauseSlackNotificationsInFlowState = true;
  } else if (configSettings.pauseSlackNotifications && slackDnDInfo && slackDnDInfo.snooze_enabled) {
    pauseSlackNotificationsInFlowState = true;
  } else if (!configSettings.pauseSlackNotifications && slackDnDInfo && !slackDnDInfo.snooze_enabled) {
    pauseSlackNotificationsInFlowState = true;
  }

  // determine if the slack away status text is in flow
  let slackAwayStatusMsgInFlowState = false;
  if (!useSlackSettings) {
    slackAwayStatusMsgInFlowState = true;
  } else if (configSettings.slackAwayStatusText === slackStatus) {
    slackAwayStatusMsgInFlowState = true;
  }

  let slackAwayPresenceInFlowState = false;
  if (!useSlackSettings) {
    slackAwayPresenceInFlowState = true;
  } else if (configSettings.slackAwayStatus && slackPresence === "away") {
    slackAwayPresenceInFlowState = true;
  } else if (!configSettings.slackAwayStatus && slackPresence === "active") {
    slackAwayPresenceInFlowState = true;
  }

  // otherwise check the exact settings
  const inFlowModeState = screenInFlowState && pauseSlackNotificationsInFlowState && slackAwayStatusMsgInFlowState && slackAwayPresenceInFlowState;

  return inFlowModeState;
}

function isScreenStateInFlow() {
  const configSettings = getConfigSettings();
  const screen_mode = getScreenMode();
  // determine if this editor should be in flow mode
  let screenInFlowState = false;
  if (configSettings.screenMode.includes("Full Screen") && screen_mode === FULL_SCREEN_MODE_ID) {
    screenInFlowState = true;
  } else if (configSettings.screenMode.includes("Zen") && screen_mode === ZEN_MODE_ID) {
    screenInFlowState = true;
  } else if (configSettings.screenMode.includes("None") && screen_mode === NORMAL_SCREEN_MODE) {
    screenInFlowState = true;
  }

  return screenInFlowState;
}
