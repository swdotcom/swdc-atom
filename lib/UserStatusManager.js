'use babel';

import $ from 'jquery';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');
const fileDataMgr = require("./storage/FileDataManager");
const sessionAppMgr = require('./managers/SessionAppManager');
import { clearTimeDataSummary } from "./managers/TimeDataManager";
import { updateSlackIntegrations } from "./managers/SlackManager";

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
  const authType = utilMgr.getItem("authType");

  const token = (auth_callback_state) ? auth_callback_state : jwt;

  let resp = await serviceUtil.softwareGet("/users/plugin/state", token);

  let foundUser = !!(serviceUtil.isResponseOk(resp) && resp.data && resp.data.user);
  let state = (foundUser) ? resp.data.state : "UNKNOWN";

  if (foundUser) {
      // set the jwt, name (email), and use the registration flag
      // to determine if they're logged in or not
      const user = resp.data.user;

      if (!isIntegration || !utilMgr.getItem("jwt")) {
        if (user.plugin_jwt) {
          utilMgr.setItem("jwt", user.plugin_jwt);
        }
        if (user.registered) {
            utilMgr.setItem("name", user.email);
        }
      }

      if (!authType) {
          utilMgr.setItem("authType", "software");
      }

      const registered = user.registered;

      utilMgr.setItem("switching_account", false);
      utilMgr.setAuthCallbackState(null);

      // if we need the user it's "resp.data.user"
      return { loggedOn: registered === 1, state, user };
  }

  // all else fails, set false and UNKNOWN
  return { loggedOn: false, state, user: null };
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
    // clear the current getIntegrations
    utilMgr.syncIntegrations([]);

    // update integrations based on the new user
    updateSlackIntegrations(userStatus.user);

    await sessionAppMgr.updateSessionSummaryFromServer();
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );
  }
};

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
