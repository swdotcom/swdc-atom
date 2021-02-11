'use babel';

import $ from 'jquery';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');
const fileDataMgr = require("./storage/FileDataManager");
const sessionAppMgr = require('./managers/SessionAppManager');
import { clearTimeDataSummary } from "./managers/TimeDataManager";
import { updateSlackIntegrations, disconectAllSlackIntegrations } from "./managers/SlackManager";

let userstatusMgr = {};

let loggedInCacheState = null;

/**
 * checks whether the user is logged in or not
 */
userstatusMgr.isLoggedOn = async () => {
    const name = utilMgr.getItem("name");
    return name ? true : false;
};

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
userstatusMgr.getUserRegistrationState = async (isIntegration = false) => {
  const jwt = utilMgr.getItem("jwt");
  const auth_callback_state = utilMgr.getAuthCallbackState(false /*autoCreate*/);

  const token = (auth_callback_state) ? auth_callback_state : jwt;

  let resp = await serviceUtil.softwareGet("/users/plugin/state", token);

  let user = (serviceUtil.isResponseOk(resp) && resp.data) ? resp.data.user : null;

  if (!user && isIntegration && auth_callback_state) {
    // we've used the auth callback state and its an integration, try with the jwt
    resp = await serviceUtil.softwareGet("/users/plugin/state", jwt);
    user = (serviceUtil.isResponseOk(resp) && resp.data) ? resp.data.user : null;
  }

  if (user) {

      const registered = user.registered;

      if (!isIntegration) {
        if (user.plugin_jwt) {
          utilMgr.setItem("jwt", user.plugin_jwt);
        }
        if (registered === 1) {
            utilMgr.setItem("name", user.email);
        }
      }

      const currentAuthType = utilMgr.getItem("authType");
      if (!currentAuthType) {
        utilMgr.setItem("authType", "software");
      }

      utilMgr.setItem("switching_account", false);
      utilMgr.setAuthCallbackState(null);

      // if we need the user it's "resp.data.user"
      return { loggedOn: registered === 1, state: "OK", user };
  }

  // all else fails, set false and UNKNOWN
  return { loggedOn: false, state: "UNKNOWN", user: null };
};

userstatusMgr.launchLoginUrl = async (type, switching_account = false) => {
    utilMgr.launchUrl(utilMgr.getLoginUrl(type, switching_account));
    // each retry is 10 seconds long
    userstatusMgr.refetchUserStatusLazily(40);
};

userstatusMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
  const userStatus = await userstatusMgr.getUserRegistrationState();
  if (!userStatus.loggedOn) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
          tryCountUntilFoundUser -= 1;
          setTimeout(() => {
            userstatusMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
          }, 10000);
      } else {
          // clear the auth callback state
          utilMgr.setItem("switching_account", false);
          utilMgr.setAuthCallbackState(null);
      }
  } else {
    // clear the auth callback state
    utilMgr.setItem("switching_account", false);
    utilMgr.setAuthCallbackState(null);

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
    updateSlackIntegrations(userStatus.user);

    await sessionAppMgr.updateSessionSummaryFromServer();
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );

    try {
      initializeWebsockets();
    } catch(e) {
      console.error("[CodeTime] failed to initialize websockets", e);
    }
  }
};

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
