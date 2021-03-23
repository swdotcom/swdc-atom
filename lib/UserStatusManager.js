'use babel';

import $ from 'jquery';
import { initializeWebsockets } from "./websockets";
import { clearTimeDataSummary } from "./managers/TimeDataManager";
import { updateSlackIntegrations, disconectAllSlackIntegrations } from "./managers/SlackManager";

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');
const fileDataMgr = require("./storage/FileDataManager");
const sessionAppMgr = require('./managers/SessionAppManager');

let userstatusMgr = {};

let loggedInCacheState = null;

/**
 * checks whether the user is logged in or not
 */
userstatusMgr.isLoggedOn = async () => {
    const name = utilMgr.getItem("name");
    return name ? true : false;
};

userstatusMgr.launchLoginUrl = async (type, switching_account = false) => {
    utilMgr.launchUrl(utilMgr.getLoginUrl(type, switching_account));
};

userstatusMgr.authenticationCompleteHandler = async (user) => {
  // clear the auth callback state
  utilMgr.setItem("switching_account", false);
  utilMgr.setAuthCallbackState(null);

  const registered = user.registered;

  if (user.plugin_jwt) {
    utilMgr.setItem("jwt", user.plugin_jwt);
  }
  if (registered === 1) {
      utilMgr.setItem("name", user.email);
  }

  const currentAuthType = utilMgr.getItem("authType");
  if (!currentAuthType) {
    utilMgr.setItem("authType", "software");
  }

  fileDataMgr.clearSessionSummaryData();
  clearTimeDataSummary();
  setTimeout(() => {
    atom.confirm({
      message: '',
      detailedMessage: 'Successfully logged on to Code Time',
    });
  }, 0);

  // clear the slack integrations
  await disconectAllSlackIntegrations();

  // update integrations based on the new user
  updateSlackIntegrations(user);

  try {
    initializeWebsockets();
  } catch (e) {
      console.error('[MusicTime] failed to initialize websockets', e);
  }

  await sessionAppMgr.updateSessionSummaryFromServer();
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
