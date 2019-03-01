"use babel";

import KpmStatusView from "./KpmStatusView";
const { exec } = require("child_process");
const crypto = require("crypto");
const axios = require("axios");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");
const macaddress = require("getmac");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PROD_URL = "https://app.software.com";
// set the launch url to use.
const launch_url = PROD_URL;
const NO_DATA = "CODE TIME\n\nNo data available\n";
const SHOW_MUSIC_METRICS_CONFIG_KEY = "code-time.showMusicMetrics";
const SHOW_GIT_METRICS_CONFIG_KEY = "code-time:showGitMetrics";
const SHOW_RANKING_METRICS_CONFIG_KEY = "code-time:showWeeklyRanking";
const TOP_MUSIC_MENU_LABEL = "Software top 40";
const LOGOUT_COMMAND_KEY = "Code-Time:log-out";
const LOGOUT_MENU_LABEL = "Log out from Code Time";
const LOGIN_COMMAND_KEY = "Code-Time:log-in";
const LOGIN_MENU_LABEL = "Log in to see your coding data";
const SIGNUP_COMMAND_KEY = "Code-Time:sign-up";
const SIGNUP_MENU_LABEL = "Sign up a new account";
const WEB_DASHBOARD_COMMAND_KEY = "Code-Time:web-dashboard";
const WEB_DASHBOARD_MENU_LABEL = "Web dashboard";

const NO_PROJECT_DIR_NAME = "Unnamed";

let utilMgr = {};

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

const PLUGIN_ID = 7;

let telemetryOn = true;
let statusView = new KpmStatusView();

let userStatus = null;
let lastRegisterUserCheck = null;

const PROD_API_ENDPOINT = "https://api.software.com";
// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;

let currentUserStatus = {};

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

utilMgr.getDefaultProjectName = () => {
  return NO_PROJECT_DIR_NAME;
};

utilMgr.getMusicConfigKey = () => {
  return SHOW_MUSIC_METRICS_CONFIG_KEY;
};

utilMgr.geGitConfigKey = () => {
  return SHOW_GIT_METRICS_CONFIG_KEY;
};

utilMgr.getRankingConfigKey = () => {
  return SHOW_RANKING_METRICS_CONFIG_KEY;
};

utilMgr.getCurrentUserStatus = () => {
  return currentUserStatus;
};

utilMgr.getPluginId = () => {
  return PLUGIN_ID;
};

utilMgr.getStatusView = () => {
  return statusView;
};

utilMgr.getWebUrl = async () => {
  let loggedIn = currentUserStatus && currentUserStatus.loggedIn ? true : false;
  let needsToken = await utilMgr.userNeedsToken();
  let requiresToken = needsToken || !loggedIn ? true : false;
  let webUrl = await utilMgr.buildLaunchUrl(requiresToken);
  return webUrl;
};

utilMgr.showErrorStatus = async () => {
  utilMgr.getStatusView().display("Code Time", await utilMgr.getWebUrl());
};

utilMgr.showDeactivatedErrorStatus = async () => {
  utilMgr
    .getStatusView()
    .display(
      "Code Time",
      await utilMgr.getWebUrl(),
      "alert",
      "To see your coding data in Code Time, please reactivate your account."
    );
};

utilMgr.isTelemetryOn = () => {
  return telemetryOn;
};

utilMgr.randomCode = () => {
  return crypto
    .randomBytes(16)
    .map(value => alpha.charCodeAt(Math.floor((value * alpha.length) / 256)))
    .toString();
};

utilMgr.buildLaunchUrl = async requiresToken => {
  let webUrl = launch_url;
  if (requiresToken) {
    let tokenVal = utilMgr.getItem("token");
    if (!tokenVal) {
      tokenVal = randomCode();
      utilMgr.setItem("token", tokenVal);
    }

    let macAddress = await utilMgr.getMacAddress();
    if (macAddress) {
      webUrl += `/onboarding?addr=${encodeURIComponent(
        macAddress
      )}&token=${tokenVal}`;
    } else {
      webUrl += `/onboarding?token=${tokenVal}`;
    }
  }

  return webUrl;
};

utilMgr.checkTokenAvailability = async tryAgainIfFailed => {
  if (!utilMgr.isTelemetryOn()) {
    return;
  }
  const tokenVal = utilMgr.getItem("token");

  if (!tokenVal) {
    return;
  }

  tryAgainIfFailed =
    tryAgainIfFailed === undefined || tryAgainIfFailed === null
      ? true
      : tryAgainIfFailed;

  // ned to get back...
  // response.data.user, response.data.jwt
  // non-authorization API
  utilMgr.softwareGet(`/users/plugin/confirm?token=${tokenVal}`).then(resp => {
    if (
      utilMgr.isResponseOk(resp) &&
      resp.data &&
      resp.data.jwt &&
      resp.data.user
    ) {
      utilMgr.setItem("jwt", resp.data.jwt);
      utilMgr.setItem("user", resp.data.user);
      utilMgr.setItem("atom_lastUpdateTime", Date.now());
    } else {
      if (tryAgainIfFailed) {
        // try again in a couple of minutes
        setTimeout(() => {
          utilMgr.checkTokenAvailability();
        }, 1000 * 120);
      }
    }
  });
};

utilMgr.getTelemetryStatus = () => {
  return telemetryOn;
};

utilMgr.updateTelemetryOn = isOn => {
  telemetryOn = isOn;
};

utilMgr.getLongThresholdHours = () => {
  return LONG_THRESHOLD_HOURS;
};

utilMgr.getShortThresholdHours = () => {
  return SHORT_THRESHOLD_HOURS;
};

utilMgr.getMillisPerHour = () => {
  return MILLIS_PER_HOUR;
};

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
utilMgr.isWindows = () => {
  return process.platform.indexOf("win32") !== -1;
};

utilMgr.isMac = () => {
  return process.platform.indexOf("darwin") !== -1;
};

utilMgr.setItem = (key, value) => {
  const jsonObj = utilMgr.getSoftwareSessionAsJson();
  jsonObj[key] = value;

  const content = JSON.stringify(jsonObj);

  const sessionFile = utilMgr.getSoftwareSessionFile();
  fs.writeFileSync(sessionFile, content, err => {
    if (err)
      console.log(
        "Code Time: Error writing to the Software session file: ",
        err.message
      );
  });
};

utilMgr.getItem = key => {
  const jsonObj = utilMgr.getSoftwareSessionAsJson();

  return jsonObj[key] || null;
};

utilMgr.getSoftwareSessionAsJson = () => {
  let data = null;

  const sessionFile = utilMgr.getSoftwareSessionFile();
  if (fs.existsSync(sessionFile)) {
    const content = fs.readFileSync(sessionFile).toString();
    if (content) {
      data = JSON.parse(content);
    }
  }
  return data ? data : {};
};

/**
 * Get the .software/session.json path/name
 **/
utilMgr.getSoftwareSessionFile = () => {
  let file = utilMgr.getSoftwareDir();
  if (utilMgr.isWindows()) {
    file += "\\session.json";
  } else {
    file += "/session.json";
  }
  return file;
};

utilMgr.getDashboardFile = () => {
  let file = utilMgr.getSoftwareDir();
  if (utilMgr.isWindows()) {
    file += "\\CodeTime.txt";
  } else {
    file += "/CodeTime.txt";
  }
  return file;
};

/**
 * Get the .software directory path/name
 **/
utilMgr.getSoftwareDir = () => {
  const homedir = os.homedir();
  let softwareDataDir = homedir;
  if (utilMgr.isWindows()) {
    softwareDataDir += "\\.software";
  } else {
    softwareDataDir += "/.software";
  }

  if (!fs.existsSync(softwareDataDir)) {
    fs.mkdirSync(softwareDataDir);
  }

  return softwareDataDir;
};

/**
 * Get the .software/data.json path/name
 **/
utilMgr.getSoftwareDataStoreFile = () => {
  let file = utilMgr.getSoftwareDir();
  if (utilMgr.isWindows()) {
    file += "\\data.json";
  } else {
    file += "/data.json";
  }
  return file;
};

utilMgr.deleteFile = file => {
  //
  // if the file exists, get it
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};

utilMgr.showStatus = async (msg, icon) => {
  utilMgr.getStatusView().display(msg, await utilMgr.getWebUrl(), icon);
};

utilMgr.launchCodeTimeDashboard = async () => {
  // launch the CodeTime file
  let file = utilMgr.getDashboardFile();
  const dashboardSummary = await utilMgr.softwareGet(
    `/dashboard`,
    utilMgr.getItem("jwt")
  );
  let content =
    dashboardSummary && dashboardSummary.data ? dashboardSummary.data : NO_DATA;

  fs.writeFileSync(file, content, "UTF8");

  atom.workspace.open(file, {
    changeFocus: true,
    activatePane: true,
    activateItem: true
  });
};

utilMgr.humanizeMinutes = minutes => {
  let humizedStr = "";
  minutes = parseInt(minutes, 10) || 0;
  let sessionTime = "";
  if (minutes === 60) {
    humizedStr = "1 hr";
  } else if (minutes > 60) {
    let hours = minutes / 60;
    if (hours % 1 === 0) {
      humizedStr = hours.toFixed(0) + " hrs";
    } else {
      humizedStr = (Math.round(hours * 10) / 10).toFixed(1) + " hrs";
    }
  } else if (minutes === 1) {
    humizedStr = "1 min";
  } else {
    humizedStr = minutes + " min";
  }
  return humizedStr;
};

utilMgr.execPromise = (command, opts) => {
  return new Promise((resolve, reject) => {
    exec(command, opts, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }

      return resolve(stdout.trim());
    });
  });
};

utilMgr.wrapExecPromise = async (cmd, projectDir = null) => {
  let prop = null;
  try {
    if (projectDir) {
      prop = await utilMgr.execPromise(cmd, {
        cwd: projectDir
      });
    } else {
      prop = await utilMgr.execPromise(cmd, {});
    }
  } catch (e) {
    // console.error(e.message);
    prop = null;
  }
  return prop;
};

/**
 * Response returns a paylod with the following..
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
utilMgr.softwareGet = async (api, jwt) => {
  if (jwt) {
    beApi.defaults.headers.common["Authorization"] = jwt;
  }

  return await beApi
    .get(api)
    .then(resp => {
      return resp;
    })
    .catch(err => {
      console.log(
        `Code Time: error fetching data for ${api}, message: ${err.message}`
      );
      return err;
    });
};

utilMgr.softwarePut = async (api, payload, jwt) => {
  // PUT the kpm to the PluginManager
  beApi.defaults.headers.common["Authorization"] = jwt;
  return beApi
    .put(api, payload)
    .then(resp => {
      return resp;
    })
    .catch(err => {
      console.log(
        `Code Time: error posting data for ${api}, message: ${err.message}`
      );
      return err;
    });
};

utilMgr.softwarePost = async (api, payload, jwt) => {
  // POST the kpm to the PluginManager
  beApi.defaults.headers.common["Authorization"] = jwt;
  return beApi
    .post(api, payload)
    .then(resp => {
      return resp;
    })
    .catch(err => {
      console.log(
        `Code Time: error posting data for ${api}, message: ${err.message}`
      );
      return err;
    });
};

utilMgr.softwareDelete = async (api, jwt) => {
  beApi.defaults.headers.common["Authorization"] = jwt;
  return beApi
    .delete(api)
    .then(resp => {
      return resp;
    })
    .catch(err => {
      console.log(
        `Code Time: error with delete request for ${api}, message: ${
          err.message
        }`
      );
      return err;
    });
};

function getResponseStatus(resp) {
  let status = null;
  if (resp && resp.status) {
    status = resp.status;
  } else if (resp && resp.response && resp.response.status) {
    status = resp.response.status;
  }
  return status;
}

function getResponseData(resp) {
  let data = null;
  if (resp && resp.data) {
    data = resp.data;
  } else if (resp && resp.response && resp.response.data) {
    data = resp.response.data;
  }
  return data;
}

utilMgr.isResponseOk = resp => {
  let status = getResponseStatus(resp);
  if (!resp || (status && status < 400)) {
    return true;
  }
  return false;
};

utilMgr.isUnauthenticated = resp => {
  let status = getResponseStatus(resp);
  if (status && status >= 400 && status < 500) {
    return true;
  }
  return false;
};

utilMgr.isDeactivated = async () => {
  let pingResp = await utilMgr.softwareGet(
    "/users/ping/",
    utilMgr.getItem("jwt")
  );
  return await utilMgr.isUserDeactivated(pingResp);
};

utilMgr.isUserDeactivated = async resp => {
  let deactivated = await utilMgr.isUnauthenticatedAndDeactivated(resp);
  if (deactivated) {
    return true;
  }
  return false;
};

// we send back "NOTFOUND" or "DEACTIVATED" codes
utilMgr.isUnauthenticatedAndDeactivated = async resp => {
  let status = getResponseStatus(resp);
  let data = getResponseData(resp);
  if (status && status >= 400 && data) {
    // check if we have the data object
    let code = data.code || "";
    if (code === "DEACTIVATED") {
      return true;
    }
  }
  return false;
};

utilMgr.launchSoftwareTopForty = async () => {
  launchUrl("https://api.software.com/music/top40");
};

/**
 * Launch the browser to the dashboard or to the onboarding view
 **/
utilMgr.launchWebUrl = async () => {
  let url = await utilMgr.getWebUrl();
  launchUrl(url);
};

/**
 * get the mac address
 */
utilMgr.getMacAddress = async () => {
  const homedir = os.homedir();
  let createTimeMs = null;
  if (fs.existsSync(homedir)) {
    let folderStats = fs.statSync(homedir);
    createTimeMs = folderStats.birthtimeMs;
  }
  const username = os.userInfo().username;
  let macAddrId = null;
  let result = await new Promise(function(resolve, reject) {
    macaddress.getMac(async (err, macAddress) => {
      if (err) {
        reject({ status: "failed", message: err.message });
      } else {
        resolve({ status: "success", macAddress });
      }
    });
  });
  let parts = [];
  if (username) {
    parts.push(username);
  }
  if (result && result["status"] === "success") {
    parts.push(result["macAddress"]);
  }
  if (createTimeMs) {
    parts.push(createTimeMs);
  }

  if (parts.length > 0) {
    macAddrId = parts.join("_");
  }

  return macAddrId;
};

async function launchUrl(url) {
  let open = "open";
  let args = [`${url}`];
  if (utilMgr.isWindows()) {
    open = "cmd";
    // adds the following args to the beginning of the array
    args.unshift("/c", "start", '""');
  } else if (!utilMgr.isMac()) {
    open = "xdg-open";
  }

  let process = cp.execFile(open, args, (error, stdout, stderr) => {
    if (error != null) {
      console.log(
        "Code Time: Error launching Software authentication: ",
        error.toString()
      );
    }
  });
}

utilMgr.serverIsAvailable = async () => {
  return await utilMgr
    .softwareGet("/ping", null)
    .then(result => {
      return utilMgr.isResponseOk(result);
    })
    .catch(e => {
      return false;
    });
};

/**
 * checks if the user needs to be created
 */
utilMgr.requiresUserCreation = async () => {
  const sessionFile = utilMgr.getSoftwareSessionFile();
  // set the last auth check time to -1 if the sesison file doesn't yet exist
  const hasSessionFile = fs.existsSync(sessionFile);
  const serverAvailable = await utilMgr.serverIsAvailable();
  const existingJwt = utilMgr.getItem("jwt");
  const existingAppJwt = utilMgr.getItem("app_jwt");
  let authenticatingJwt = existingJwt ? existingJwt : existingAppJwt;

  if (serverAvailable && (!authenticatingJwt || !hasSessionFile)) {
    return true;
  }
  return false;
};

/**
 * User session will have...
 * { user: user, jwt: jwt }
 */
utilMgr.isAuthenticated = async () => {
  const tokenVal = utilMgr.getItem("token");
  if (!tokenVal) {
    return false;
  }

  // since we do have a token value, ping the backend using authentication
  // in case they need to re-authenticate
  const resp = await utilMgr.softwareGet("/users/ping", utilMgr.getItem("jwt"));
  if (utilMgr.isResponseOk(resp)) {
    return true;
  } else {
    console.log("Code Time: The user is not logged in");
    return false;
  }
};

/**
 * get the app jwt
 */
utilMgr.getAppJwt = async () => {
  let appJwt = utilMgr.getItem("app_jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();

  if (!appJwt && serverIsOnline) {
    let macAddress = await utilMgr.getMacAddress();
    if (macAddress) {
      // get the app jwt
      let resp = await utilMgr.softwareGet(
        `/data/token?addr=${encodeURIComponent(macAddress)}`,
        null
      );
      if (utilMgr.isResponseOk(resp)) {
        appJwt = resp.data.jwt;
        utilMgr.setItem("app_jwt", appJwt);
      }
    }
  }
  return utilMgr.getItem("app_jwt");
};

/**
 * create an anonymous user based on github email or mac addr
 */
utilMgr.createAnonymousUser = async () => {
  let appJwt = await utilMgr.getAppJwt();
  let jwt = await utilMgr.getItem("jwt");
  let macAddress = await utilMgr.getMacAddress();
  if (appJwt && !jwt && macAddress) {
    let plugin_token = utilMgr.getItem("token");
    if (!plugin_token) {
      plugin_token = utilMgr.randomCode();
      utilMgr.setItem("token", plugin_token);
    }

    let email = null; //await getGitEmail();
    if (!email) {
      email = macAddress;
    }

    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let resp = await utilMgr.softwarePost(
      `/data/onboard?addr=${encodeURIComponent(macAddress)}`,
      { email, plugin_token, timezone },
      utilMgr.getItem("app_jwt")
    );
    if (
      utilMgr.isResponseOk(resp) &&
      resp.data &&
      resp.data.jwt &&
      resp.data.user
    ) {
      utilMgr.setItem("jwt", resp.data.jwt);
      utilMgr.setItem("user", resp.data.user);
      utilMgr.setItem("vscode_lastUpdateTime", Date.now());
    } else {
      console.log(
        "Code Time: error confirming onboarding plugin token: ",
        resp.message
      );
    }
  }
};

utilMgr.getAuthenticatedPluginAccounts = async (token = null) => {
  let jwt = utilMgr.getItem("jwt");
  let app_jwt = utilMgr.getItem("app_jwt");
  let serverIsOnline = await utilMgr.serverIsAvailable();
  let tokenQryStr = "";
  if (!token) {
    let macAddress = await utilMgr.getMacAddress();
    tokenQryStr = `?token=${encodeURIComponent(macAddress)}`;
  } else {
    tokenQryStr = `?token=${token}`;
  }

  let authenticatingJwt = jwt ? jwt : appJwt;

  let macAddress = !token ? await utilMgr.getMacAddress() : token;
  if (authenticatingJwt && serverIsOnline && macAddress) {
    let api = `/users/plugin/accounts${tokenQryStr}`;
    let resp = await utilMgr.softwareGet(api, authenticatingJwt);
    if (utilMgr.isResponseOk(resp)) {
      if (resp && resp.data && resp.data.users && resp.data.users.length > 0) {
        for (let i = 0; i < resp.data.users.length; i++) {
          return resp.data.users;
        }
      }
    }
  }

  return null;
};

utilMgr.isLoggedIn = async authAccounts => {
  let macAddress = await utilMgr.getMacAddress();
  if (authAccounts && authAccounts.length > 0) {
    let foundUser = null;
    for (let i = 0; i < authAccounts.length; i++) {
      let user = authAccounts[i];
      let userId = parseInt(user.id, 10);
      let userMacAddr = user.mac_addr;
      let userEmail = user.email;
      if (userMacAddr === macAddress && userEmail !== macAddress) {
        // having a mac_addr present and the email not equal to the mac address
        // means they are logged in with this account
        let cachedUser = utilMgr.getItem("user");
        if (cachedUser && !cachedUser.id) {
          // turn it into an object
          cachedUser = cachedUser ? JSON.parse(cachedUser) : null;
        }
        let cachedUserId = cachedUser ? cachedUser.id : null;

        if (cachedUser && userId !== cachedUserId) {
          // save this user in case we don't find a matching userId
          foundUser = user;
        } else if (cachedUser && userId === cachedUserId) {
          return user;
        }
      }

      if (foundUser) {
        // update the user, they've switched accounts
        let foundUserObj = { id: foundUser.id };
        utilMgr.setItem("jwt", foundUser.plugin_jwt);
        utilMgr.setItem("user", foundUserObj);
        utilMgr.setItem("vscode_lastUpdateTime", Date.now());

        return foundUser;
      }
    }
  }
  return null;
};

utilMgr.hasRegisteredAccounts = async authAccounts => {
  let macAddress = await utilMgr.getMacAddress();
  if (authAccounts && authAccounts.length > 0) {
    for (let i = 0; i < authAccounts.length; i++) {
      let user = authAccounts[i];
      if (user.email !== macAddress) {
        return true;
      }
    }
  }
  return false;
};

utilMgr.hasPluginAccount = async authAccounts => {
  if (authAccounts && authAccounts.length > 0) {
    return true;
  }
  return false;
};

utilMgr.userNeedsToken = async () => {
  let requiresToken = false;
  const existingJwt = utilMgr.getItem("jwt");
  if (!existingJwt || !(await utilMgr.isAuthenticated())) {
    requiresToken = true;
  }
  return requiresToken;
};

/**
 * check if the user is registered or not
 * return {loggedIn: true|false, hasAccounts: true|false, hasUserAccounts: true|false, email}
 */
utilMgr.getUserStatus = async (token = null) => {
  let nowMillis = Date.now();
  if (userStatus !== null && lastRegisterUserCheck !== null) {
    if (nowMillis - lastRegisterUserCheck <= 20000) {
      userStatus;
    }
  }

  let authAccounts = await utilMgr.getAuthenticatedPluginAccounts(token);
  let loggedInP = utilMgr.isLoggedIn(authAccounts);
  let hasAccountsP = utilMgr.hasPluginAccount(authAccounts);
  let hasUserAccountsP = utilMgr.hasRegisteredAccounts(authAccounts);

  let loggedInUser = await loggedInP;

  currentUserStatus = {
    loggedIn: loggedInUser ? true : false,
    email: loggedInUser ? loggedInUser.email : "",
    hasAccounts: await hasAccountsP,
    hasUserAccounts: await hasUserAccountsP
  };

  utilMgr.updateMenuPreference(LOGOUT_COMMAND_KEY, currentUserStatus.loggedIn);

  lastRegisterUserCheck = Date.now();
  utilMgr.getStatusView().updateCurrentStatus(currentUserStatus);
  return currentUserStatus;
};

utilMgr.initializePreferences = async () => {
  let user = utilMgr.getItem("user");
  let jwt = utilMgr.getItem("jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();
  if (jwt && serverIsOnline && user) {
    let cachedUser = user;
    if (!cachedUser.id) {
      cachedUser = JSON.parse(cachedUser);
    }
    let userId = parseInt(cachedUser.id, 10);

    let api = `/users/${userId}`;
    let resp = await utilMgr.softwareGet(api, jwt);
    if (utilMgr.isResponseOk(resp)) {
      if (resp && resp.data && resp.data.data && resp.data.data.preferences) {
        let prefs = resp.data.data.preferences;
        let prefsShowMusic =
          prefs.showMusic !== null && prefs.showMusic !== undefined
            ? prefs.showMusic
            : null;
        let prefsShowGit =
          prefs.showGit !== null && prefs.showGit !== undefined
            ? prefs.showGit
            : null;
        let prefsShowRank =
          prefs.showRank !== null && prefs.showRank !== undefined
            ? prefs.showRank
            : null;

        if (
          prefsShowMusic === null ||
          prefsShowGit === null ||
          prefsShowRank === null
        ) {
          await utilMgr.sendPreferencesUpdate(userId, prefs);
        } else {
          if (prefsShowMusic !== null) {
            await atom.config.set(
              SHOW_MUSIC_METRICS_CONFIG_KEY,
              prefsShowMusic
            );
            utilMgr.updateMenuPreference(
              SHOW_MUSIC_METRICS_CONFIG_KEY,
              prefsShowMusic
            );
          }
          if (prefsShowGit !== null) {
            await atom.config.set("code-time.showGitMetrics", prefsShowGit);
          }
          if (prefsShowRank !== null) {
            await atom.config.set("code-time.showWeeklyRanking", prefsShowRank);
          }
        }
      }
    }
  }
};

utilMgr.launchLoginUrl = async () => {
  let macAddress = await utilMgr.getMacAddress();
  let loginUrl = `${launch_url}/login?addr=${macAddress}`;
  launchUrl(loginUrl);
  setTimeout(() => {
    utilMgr.getUserStatus();
  }, 10000);
};

utilMgr.launchSignupUrl = async () => {
  let macAddress = await utilMgr.getMacAddress();
  let signupUrl = `${launch_url}/onboarding?addr=${macAddress}`;
  launchUrl(signupUrl);
  setTimeout(() => {
    utilMgr.getUserStatus();
  }, 45000);
};

let codeTimeSubmenu = [];
let codeTimeMenu = [];

utilMgr.getCodeTimeMenu = () => {
  return codeTimeMenu;
};

utilMgr.updateCodeTimeMenu = menu => {
  codeTimeMenu = menu;
};

utilMgr.getCodeTimeSubmenu = () => {
  return codeTimeSubmenu;
};

utilMgr.updateCodeTimeSubmenu = menu => {
  codeTimeSubmenu = menu;
};

utilMgr.updatePreference = (command, flag) => {
  let updatedMenuPreference = utilMgr.updateMenuPreference(command, flag);

  if (updatedMenuPreference) {
    utilMgr.updatePreferences();
  }
};

utilMgr.removeMenuItem = prefLabel => {
  codeTimeSubmenu = codeTimeSubmenu.filter(n => n.label !== prefLabel);
  atom.menu.remove(codeTimeMenu);
  codeTimeMenu[0].submenu = codeTimeSubmenu;
  atom.menu.add(codeTimeMenu);
};

utilMgr.addMenuItem = (prefLabel, command) => {
  const result = codeTimeSubmenu.find(n => n.label === prefLabel);
  if (!result) {
    atom.menu.remove(codeTimeMenu);
    codeTimeSubmenu.push({
      label: prefLabel,
      command
    });
    atom.menu.add(codeTimeMenu);
    return true;
  }
  return false;
};

utilMgr.updateMenuPreference = (command, flag) => {
  let prefLabel = "";
  let updatedPref = false;
  if (command === SHOW_MUSIC_METRICS_CONFIG_KEY) {
    prefLabel = TOP_MUSIC_MENU_LABEL;
    updatedPref = true;
  } else if (command === LOGOUT_COMMAND_KEY) {
    prefLabel = LOGOUT_MENU_LABEL;
  }

  if (!flag) {
    // remove it
    utilMgr.removeMenuItem(prefLabel);
    if (command === LOGOUT_COMMAND_KEY) {
      // remove the web dashboard
      utilMgr.removeMenuItem(WEB_DASHBOARD_MENU_LABEL);
      // add the Log in
      utilMgr.addMenuItem(LOGIN_MENU_LABEL, LOGIN_COMMAND_KEY);
      // add the signup
      utilMgr.addMenuItem(SIGNUP_MENU_LABEL, SIGNUP_COMMAND_KEY);
    }
  } else {
    // add it
    if (command === LOGOUT_COMMAND_KEY) {
      // add the web dashboard
      utilMgr.addMenuItem(WEB_DASHBOARD_MENU_LABEL, WEB_DASHBOARD_COMMAND_KEY);
    }
    let alreadyFound = utilMgr.addMenuItem(prefLabel, command);
    if (updatedPref && alreadyFound) {
      updatedPref = false;
    }
    if (command === LOGOUT_COMMAND_KEY) {
      // remove the login menu item
      utilMgr.removeMenuItem(LOGIN_MENU_LABEL);
      // remove the signup menu item
      utilMgr.removeMenuItem(SIGNUP_MENU_LABEL);
    }
  }

  return updatedPref;
};

utilMgr.sendPreferencesUpdate = async (userId, userPrefs) => {
  let api = `/users/${userId}`;
  let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
  let showGitMetrics = atom.config.get("code-time.showGitMetrics");
  let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");
  userPrefs["showMusic"] = showMusicMetrics;
  userPrefs["showGit"] = showGitMetrics;
  userPrefs["showRank"] = showWeeklyRanking;

  // update the preferences
  // /:id/preferences
  api = `/users/${userId}/preferences`;
  let resp = await utilMgr.softwarePut(api, userPrefs, utilMgr.getItem("jwt"));
  if (utilMgr.isResponseOk(resp)) {
    console.log("Code Time: update user code time preferences");
  }
};

utilMgr.updatePreferences = async () => {
  let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
  let showGitMetrics = atom.config.get("code-time.showGitMetrics");
  let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

  // get the user's preferences and update them if they don't match what we have
  let user = utilMgr.getItem("user");
  let jwt = utilMgr.getItem("jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();
  if (jwt && serverIsOnline && user) {
    let cachedUser = user;
    if (!cachedUser.id) {
      cachedUser = JSON.parse(cachedUser);
    }
    let userId = parseInt(cachedUser.id, 10);

    let api = `/users/${userId}`;
    let resp = await utilMgr.softwareGet(api, jwt);
    if (utilMgr.isResponseOk(resp)) {
      if (resp && resp.data && resp.data.data && resp.data.data.preferences) {
        let prefs = resp.data.data.preferences;
        let prefsShowMusic =
          prefs.showMusic !== null && prefs.showMusic !== undefined
            ? prefs.showMusic
            : null;
        let prefsShowGit =
          prefs.showGit !== null && prefs.showGit !== undefined
            ? prefs.showGit
            : null;
        let prefsShowRank =
          prefs.showRank !== null && prefs.showRank !== undefined
            ? prefs.showRank
            : null;

        if (
          prefsShowMusic === null ||
          prefsShowGit === null ||
          prefsShowRank === null ||
          prefsShowMusic !== showMusicMetrics ||
          prefsShowGit !== showGitMetrics ||
          prefsShowRank !== showWeeklyRanking
        ) {
          await utilMgr.sendPreferencesUpdate(userId, prefs);
        }
      }
    }
  }
};

utilMgr.refetchUserStatusLazily = async () => {
  setTimeout(() => {
    utilMgr.clearUserStatusCache();
    utilMgr.getUserStatus();
  }, 8000);
};

utilMgr.pluginLogout = async () => {
  let resp = await utilMgr.softwarePost(
    "/users/plugin/logout",
    {},
    utilMgr.getItem("jwt")
  );

  utilMgr.clearUserStatusCache();
  utilMgr.getUserStatus();

  if (utilMgr.isResponseOk(resp)) {
    // delete the session.json file
    const sessionFile = utilMgr.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
      utilMgr.deleteFile(sessionFile);
    }
    if (await utilMgr.requiresUserCreation()) {
      await utilMgr.createAnonymousUser();
    }

    setTimeout(() => {
      utilMgr.fetchDailyKpmSessionInfo();
    }, 1000);
  } else {
    console.log("error logging out");
  }
};

utilMgr.fetchDailyKpmSessionInfo = async () => {
  let start = new Date();
  // set it to the beginning of the day
  start.setHours(0, 0, 0, 0);
  const fromSeconds = Math.round(start.getTime() / 1000);

  utilMgr
    .softwareGet(
      `/sessions?from=${fromSeconds}&summary=true`,
      utilMgr.getItem("jwt")
    )
    .then(resp => {
      if (utilMgr.isResponseOk(resp)) {
        // everything is fine, delete the offline data file
        const sessions = resp.data;
        let avgKpm = sessions.lastKpm ? parseInt(sessions.lastKpm, 10) : 0;
        let currentSessionGoalPercent = sessions.currentSessionGoalPercent
          ? parseFloat(sessions.currentSessionGoalPercent)
          : 0;

        let currentSessionMinutes =
          parseInt(sessions.currentSessionMinutes, 10) || 0;
        let currentSessionTime = utilMgr.humanizeMinutes(currentSessionMinutes);
        let currentDayMinutes = parseInt(sessions.currentDayMinutes, 10) || 0;
        let currentDayMinutesTime = utilMgr.humanizeMinutes(currentDayMinutes);
        let averageDailyMinutes =
          parseInt(sessions.averageDailyMinutes, 10) || 0;
        let averageDailyMinutesTime = utilMgr.humanizeMinutes(
          averageDailyMinutes
        );

        let inFlowIcon = currentDayMinutes > averageDailyMinutes ? "🚀 " : "";
        let msg = `Code time: ${inFlowIcon}${currentDayMinutesTime}`;
        if (averageDailyMinutes > 0) {
          msg += ` | Avg: ${averageDailyMinutesTime}`;
        }

        utilMgr.showStatus(msg);
        utilMgr.fetchCodeTimeMetricsDashboard();
      }
    })
    .catch(err => {
      console.log(`Unable to get KPM response, error: ${err.message}`);
    });
};

utilMgr.fetchCodeTimeMetricsDashboard = async () => {
  let filePath = utilMgr.getDashboardFile();

  let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
  let showGitMetrics = atom.config.get("code-time.showGitMetrics");
  let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

  const dashboardSummary = await utilMgr.softwareGet(
    `/dashboard?showMusic=${showMusicMetrics}&showGit=${showGitMetrics}&showRank=${showWeeklyRanking}`,
    utilMgr.getItem("jwt")
  );
  // get the content
  let content =
    dashboardSummary && dashboardSummary.data ? dashboardSummary.data : NO_DATA;

  fs.writeFileSync(filePath, content, err => {
    if (err) {
      console.log(
        "Code Time: Error writing to the Software session file: ",
        err.message
      );
    }
  });
};

utilMgr.clearUserStatusCache = () => {
  lastRegisterUserCheck = null;
};

module.exports = utilMgr;
