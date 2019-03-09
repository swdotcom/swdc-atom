"use babel";

import KpmStatusView from "./KpmStatusView";
const { exec } = require("child_process");
const crypto = require("crypto");
const axios = require("axios");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");

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
let dashboardFileVisible = false;

const PROD_API_ENDPOINT = "https://api.software.com";
// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;

const MAC_PAIR_PATTERN = new RegExp(
  "^([a-fA-F0-9]{2}[:\\.-]?){5}[a-fA-F0-9]{2}$"
);
const MAC_TRIPLE_PATTERN = new RegExp(
  "^([a-fA-F0-9]{3}[:\\.-]?){3}[a-fA-F0-9]{3}$"
);
const MAC_PATTERN = new RegExp("^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$");

let currentUserStatus = {};

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

utilMgr.getVersion = () => {
  let packageVersion = atom.packages.getLoadedPackage("code-time").metadata
    .version;
  return packageVersion;
};

utilMgr.getOs = () => {
  let parts = [];
  let osType = os.type();
  if (osType) {
    parts.push(osType);
  }
  let osRelease = os.release();
  if (osRelease) {
    parts.push(osRelease);
  }
  let platform = os.platform();
  if (platform) {
    parts.push(platform);
  }
  if (parts.length > 0) {
    return parts.join("_");
  }
  return "";
};

utilMgr.updateDashboardFileVisibility = visible => {
  dashboardFileVisible = visible;
};

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

utilMgr.getOpenProjects = () => {
  let openProjectNames = [];
  if (atom.project && atom.project.getPaths()) {
    openProjectNames = atom.project.getPaths();
  }
  return openProjectNames;
};

utilMgr.isDashboardFileOpen = () => {
  return dashboardFileVisible;
};

utilMgr.showErrorStatus = async () => {
  utilMgr.getStatusView().display("Code Time");
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
  utilMgr.getStatusView().display(msg, icon);
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

utilMgr.isMacEmail = email => {
  if (email.includes("_")) {
    let parts = email.split("_");
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      if (
        MAC_PAIR_PATTERN.test(part) ||
        MAC_TRIPLE_PATTERN.test(part) ||
        MAC_PATTERN.test(part)
      ) {
        return true;
      }
    }
  } else if (
    MAC_PAIR_PATTERN.test(email) ||
    MAC_TRIPLE_PATTERN.test(email) ||
    MAC_PATTERN.test(email)
  ) {
    return true;
  }
  return false;
};

/**
 * get the mac address
 */
utilMgr.getIdentity = async () => {
  let identityId = "";
  const username = os.userInfo().username;
  let content = "";
  if (!utilMgr.isWindows()) {
    content = await utilMgr.wrapExecPromise(
      '/bin/sh -c ifconfig | grep "ether " | grep -v 127.0.0.1 | cut -d " " -f2',
      null
    );
  } else {
    // use the windows commmand
    content = await utilMgr.wrapExecPromise(
      "cmd /c wmic nic get MACAddress",
      null
    );
  }

  let contentList = content
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split(/\r/);

  let foundIdentity = "";
  if (contentList && contentList.length > 0) {
    for (let i = 0; i < contentList.length; i++) {
      let line = contentList[i].trim();
      if (
        line &&
        line.length > 0 &&
        (MAC_PAIR_PATTERN.test(line) ||
          MAC_TRIPLE_PATTERN.test(line) ||
          MAC_PATTERN.test(line))
      ) {
        foundIdentity = line.trim();
        break;
      }
    }
  }

  let parts = [];
  if (username) {
    parts.push(username);
  }
  if (foundIdentity) {
    parts.push(foundIdentity);
  }

  identityId = parts.join("_");
  return identityId;
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
 * get the app jwt
 */
utilMgr.getAppJwt = async () => {
  utilMgr.setItem("app_jwt", null);

  let serverIsOnline = await utilMgr.serverIsAvailable();

  if (serverIsOnline) {
    let identityId = await utilMgr.getIdentity();
    if (identityId) {
      // get the app jwt
      let resp = await utilMgr.softwareGet(
        `/data/token?addr=${encodeURIComponent(identityId)}`,
        null
      );
      if (utilMgr.isResponseOk(resp)) {
        return resp.data.jwt;
      }
    }
  }
  return null;
};

/**
 * create an anonymous user based on github email or mac addr
 */
utilMgr.createAnonymousUser = async updateJson => {
  let appJwt = await utilMgr.getAppJwt();
  let identityId = await utilMgr.getIdentity();
  if (appJwt && identityId) {
    let plugin_token = utilMgr.getItem("token");
    if (!plugin_token) {
      plugin_token = utilMgr.randomCode();
      utilMgr.setItem("token", plugin_token);
    }

    let email = identityId;

    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let resp = await utilMgr.softwarePost(
      `/data/onboard?addr=${encodeURIComponent(identityId)}`,
      { email, plugin_token, timezone },
      appJwt
    );
    if (
      utilMgr.isResponseOk(resp) &&
      resp.data &&
      resp.data.jwt &&
      resp.data.user &&
      updateJson
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

utilMgr.getAuthenticatedPluginAccounts = async (identityId, token = null) => {
  let serverIsOnline = await utilMgr.serverIsAvailable();
  let tokenQryStr = "";
  if (!token) {
    tokenQryStr = `?token=${encodeURIComponent(identityId)}`;
  } else {
    tokenQryStr = `?token=${token}`;
  }

  if (serverIsOnline) {
    let api = `/users/plugin/accounts${tokenQryStr}`;
    let resp = await utilMgr.softwareGet(api, null);
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

utilMgr.getLoggedInUser = (identityId, authAccounts) => {
  if (authAccounts && authAccounts.length > 0) {
    for (let i = 0; i < authAccounts.length; i++) {
      let user = authAccounts[i];
      let userIdentityId = user.mac_addr;
      let userEmail = user.email;
      let userIdentityIdShare = user.mac_addr_share;
      if (
        userEmail !== userIdentityId &&
        userEmail !== identityId &&
        userEmail !== userIdentityIdShare &&
        userIdentityId === identityId
      ) {
        return user;
      }
    }
  }
  return null;
};

utilMgr.hasRegisteredUserAccount = (identityId, authAccounts) => {
  if (authAccounts && authAccounts.length > 0) {
    for (let i = 0; i < authAccounts.length; i++) {
      let user = authAccounts[i];
      if (user.email && !utilMgr.isMacEmail(user.email)) {
        return true;
      }
    }
  }
  return false;
};

utilMgr.getAnonymousUser = authAccounts => {
  if (authAccounts && authAccounts.length > 0) {
    for (let i = 0; i < authAccounts.length; i++) {
      let user = authAccounts[i];
      if (user.email && utilMgr.isMacEmail(user.email)) {
        return user;
      }
    }
  }
  return null;
};

function updateSessionUserInfo(user) {
  let userObj = { id: user.id };
  utilMgr.setItem("jwt", user.plugin_jwt);
  utilMgr.setItem("user", userObj);
  utilMgr.setItem("vscode_lastUpdateTime", Date.now());
}

/**
 * check if the user is registered or not
 * return {loggedIn: true|false, hasUserAccounts: true|false, email}
 */
utilMgr.getUserStatus = async (token = null) => {
  let nowMillis = Date.now();
  if (userStatus !== null && lastRegisterUserCheck !== null) {
    if (nowMillis - lastRegisterUserCheck <= 5000) {
      return userStatus;
    }
  }

  let identityId = await utilMgr.getIdentity();

  let authAccounts = await utilMgr.getAuthenticatedPluginAccounts(
    identityId,
    token
  );

  let loggedInUser = utilMgr.getLoggedInUser(identityId, authAccounts);
  let anonUser = utilMgr.getAnonymousUser(authAccounts);
  if (anonUser) {
    let updateJson = !loggedInUser ? true : false;
    await utilMgr.createAnonymousUser(updateJson);
    // fetch the authAccounts again now that we've created an anonymous user
    authAccounts = await utilMgr.getAuthenticatedPluginAccounts(
      identityId,
      token
    );
    anonUser = utilMgr.getAnonymousUser(authAccounts);
  }
  let hasUserAccounts = utilMgr.hasRegisteredUserAccount(
    identityId,
    authAccounts
  );

  if (loggedInUser) {
    updateSessionUserInfo(loggedInUser);
  } else if (anonUser) {
    updateSessionUserInfo(anonUser);
  }

  currentUserStatus = {
    loggedIn: loggedInUser ? true : false,
    email: loggedInUser ? loggedInUser.email : "",
    hasUserAccounts
  };

  utilMgr.updateMenuPreference(LOGOUT_COMMAND_KEY, currentUserStatus.loggedIn);
  utilMgr.getStatusView().updateCurrentStatus(currentUserStatus);

  lastRegisterUserCheck = Date.now();

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
  let identityId = await utilMgr.getIdentity();
  let loginUrl = `${launch_url}/login?addr=${identityId}`;
  launchUrl(loginUrl);
  utilMgr.refetchUserStatusLazily();
};

utilMgr.launchSignupUrl = async () => {
  let identityId = await utilMgr.getIdentity();
  let signupUrl = `${launch_url}/onboarding?addr=${identityId}`;
  launchUrl(signupUrl);
  utilMgr.refetchUserStatusLazily(6);
};

utilMgr.launchWebDashboardUrl = () => {
  launchUrl(launch_url);
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

utilMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
  setTimeout(async () => {
    utilMgr.clearUserStatusCache();
    let userStatus = await utilMgr.getUserStatus();
    if (!userStatus.loggedIn) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
        tryCountUntilFoundUser -= 1;
        utilMgr.efetchUserStatusLazily(tryCountUntilFoundUser);
      }
    }
  }, 10000);
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
        let filePath = utilMgr.getDashboardFile();
        if (utilMgr.isDashboardFileOpen()) {
          utilMgr.fetchCodeTimeMetricsDashboard();
        }
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
