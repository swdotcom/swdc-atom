"use babel";

const utilMgr = require("./UtilManager");
const dashboardMgr = require("./DashboardManager");

let userstatusMgr = {};

let loggedInCacheState = null;
let initializedPrefs = false;

userstatusMgr.isLoggedOn = async serverIsOnline => {
  if (serverIsOnline === undefined) {
    serverIsOnline = await utilMgr.serverIsAvailable();
  }
  const utilMgr = require("./UtilManager");
  let jwt = utilMgr.getItem("jwt");
  if (serverIsOnline) {
    let api = "/users/plugin/state";
    let resp = await utilMgr.softwareGet(api, jwt);
    if (utilMgr.isResponseOk(resp) && resp.data) {
      // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
      let state = resp.data.state ? resp.data.state : "UNKNOWN";
      if (state === "OK") {
        let email = resp.data.email;
        utilMgr.setItem("name", email);
        // check the jwt
        let pluginJwt = resp.data.jwt;
        // update the cached jwt
        cachedJwt = pluginJwt;
        if (pluginJwt && pluginJwt !== jwt) {
          // update it
          utilMgr.setItem("jwt", pluginJwt);
          // re-initialize preferences
          initializedPrefs = false;
        }
        return { loggedOn: true, state };
      }
      // return the state that is returned
      return { loggedOn: false, state };
    }
  }
  return { loggedOn: false, state: "UNKNOWN" };
};

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
userstatusMgr.getUserStatus = async serverIsOnline => {
  const utilMgr = require("./UtilManager");

  if (serverIsOnline === undefined) {
    serverIsOnline = await utilMgr.serverIsAvailable();
  }
  utilMgr.cleanSessionInfo();

  let jwt = utilMgr.getItem("jwt");
  let loggedIn = false;
  if (serverIsOnline) {
    let loggedInResp = await userstatusMgr.isLoggedOn(serverIsOnline, jwt);
    // set the loggedIn bool value
    loggedIn = loggedInResp.loggedOn;
  }

  if (serverIsOnline && loggedIn && !initializedPrefs) {
    utilMgr.initializePreferences();
    initializedPrefs = true;
  }

  let userStatus = {
    loggedIn
  };

  if (!loggedIn) {
    // make sure we don't show the name in the tooltip if they're not logged in
    let name = utilMgr.getItem("name");
    // only update the name if it's not null
    if (name) {
      utilMgr.setItem("name", null);
    }
  }

  let currentUserStatus = {
    loggedIn,
    name: utilMgr.getItem("name")
  };

  // update the menu item visibility
  utilMgr.updateLoginPreference(loggedIn);
  // update the KpmStatusView
  utilMgr.getStatusView().updateCurrentStatus(currentUserStatus);

  if (
    serverIsOnline &&
    loggedInCacheState !== null &&
    loggedInCacheState !== loggedIn
  ) {
    // change of logged in state
    utilMgr.sendHeartbeat(`STATE_CHANGE:LOGGED_IN:${loggedIn}`);
    setTimeout(() => {
      dashboardMgr.fetchDailyKpmSessionInfo();
    }, 1000);
  }

  loggedInCacheState = loggedIn;

  return currentUserStatus;
};

userstatusMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
  setTimeout(async () => {
    let userStatus = await userstatusMgr.getUserStatus();
    if (!userStatus.loggedIn) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
        tryCountUntilFoundUser -= 1;
        userstatusMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
      }
    }
  }, 10000);
};

userstatusMgr.getWebUrl = async () => {
  let userStatus = await userstatusMgr.getUserStatus();
  if (userStatus.loggedIn) {
    return launch_url;
  }
  return utilMgr.getLoginUrl();
};

userstatusMgr.launchLoginUrl = async () => {
  
  let serverIsAvailable = await utilMgr.serverIsAvailable();
  if (!serverIsAvailable) {
    userstatusMgr.showOfflinePrompt(false);
  } else {
      utilMgr.launchUrl(utilMgr.getLoginUrl());
      // each retry is 10 seconds long
      userstatusMgr.refetchUserStatusLazily(10);
  }
};

userstatusMgr.showOfflinePrompt = () => {
  // shows a prompt that we're not able to communicate with the app server
  let infoMsg =
    "Our service is temporarily unavailable. We will try to reconnect again in 10 minutes. Your status bar will not update at this time.";
  atom.confirm({
    message: "",
    detailedMessage: infoMsg,
    buttons: {
      OK: () => {}
    }
  });
}

userstatusMgr.launchLoginPrompt = async () => {
  const serverAvailable = await utilMgr.serverIsAvailable();

  //
  // Show the dialog if the user is not authenticated but online,
  // and it's past the threshold time and the confirm window is null
  //
  if (serverAvailable) {
    // set the last update time so we don't try to ask too frequently
    let infoMsg =
      "To see your coding data in Code Time, please log in to your account.";
    atom.confirm({
      message: "",
      detailedMessage: infoMsg,
      buttons: {
        "Log In": async () => {
          await userstatusMgr.launchLoginUrl();
          setTimeout(() => {
            userstatusMgr.refetchUserStatusLazily(10);
          }, 15000);
        },
        "Not now": () => {
          //
        }
      }
    });
  }
};

userstatusMgr.getLoggedInCacheState = () => {
  return loggedInCacheState;
};

module.exports = userstatusMgr;
