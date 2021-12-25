'use babel';

import { initializeWebsockets } from "./websockets";
import { disconectAllSlackIntegrations } from "./managers/SlackManager";

const utilMgr = require('./UtilManager');
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

  if (registered === 1) {
    if (user.plugin_jwt) {
      utilMgr.setItem("jwt", user.plugin_jwt);
    }
    const currName = utilMgr.getItem("name");
    if (currName != user.email) {

      utilMgr.setItem("name", user.email);

      // clear the slack integrations
      await disconectAllSlackIntegrations();

      fileDataMgr.clearSessionSummaryData();

      setTimeout(() => {
        atom.confirm({
          message: '',
          detailedMessage: 'Successfully logged on to Code Time',
        });
      }, 0);

      try {
        initializeWebsockets();
      } catch (e) {
        console.error("Failed to initialize codetime websockets", e);
      }

      await sessionAppMgr.updateSessionSummaryFromServer();
    }
  }

  const currentAuthType = utilMgr.getItem("authType");
  if (!currentAuthType) {
    utilMgr.setItem("authType", "software");
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
