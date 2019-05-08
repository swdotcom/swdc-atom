"use babel";

import KpmStatusView from "./KpmStatusView";
const { exec } = require("child_process");
const crypto = require("crypto");
const axios = require("axios");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// API endpoint...
const PROD_API_ENDPOINT = "https://api.software.com";
// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;

// Domain endpoint
const PROD_URL = "https://app.software.com";
// set the launch url to use.
const launch_url = PROD_URL;

const NO_DATA = "CODE TIME\n\nNo data available\n";
const SHOW_MUSIC_METRICS_CONFIG_KEY = "code-time.showMusicMetrics";
const SHOW_GIT_METRICS_CONFIG_KEY = "code-time:showGitMetrics";
const SHOW_RANKING_METRICS_CONFIG_KEY = "code-time:showWeeklyRanking";

const TOP_MUSIC_MENU_LABEL = "Software top 40";

const LOGOUT_COMMAND_KEY = "Code-Time:log-out";
const LOGIN_COMMAND_KEY = "Code-Time:log-in";
const LOGIN_MENU_LABEL = "Log in to see your coding data";

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

let loggedInCacheState = null;
let dashboardFileVisible = false;
let initializedPrefs = false;
let cachedSessionKeys = {};
let editorSessiontoken = null;
let showStatusBarText = true;
let isOnline = null;
let lastOnlineCheck = 0;
let lastMsg = null;
let lastIcon = null;

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

utilMgr.getEditorSessionToken = () => {
    if (!editorSessiontoken) {
        editorSessiontoken = utilMgr.randomCode();
    }
    return editorSessiontoken;
};

utilMgr.getVersion = () => {
  let packageVersion = atom.packages.getLoadedPackage("code-time").metadata
    .version;
  return packageVersion;
};

utilMgr.getHostname = async () => {
  let hostname = await utilMgr.getCommandResult("hostname");
  return hostname;
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

utilMgr.nowInSecs = () => {
  let d = new Date();
  return Math.round(d.getTime() / 1000);
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

utilMgr.getPluginId = () => {
  return PLUGIN_ID;
};

utilMgr.getStatusView = () => {
  return statusView;
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

utilMgr.getSessionFileCreateTime = () => {
    let sessionFile = utilMgr.getSoftwareSessionFile();
    const stat = fs.statSync(sessionFile);
    if (stat.birthtime) {
        return stat.birthtime;
    }
    return stat.ctime;
};

utilMgr.isLinux = () => {
  if (!utilMgr.isWindows() && !utilMgr.isMac()) {
    return true;
  }
  return false;
};

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
utilMgr.isWindows = () => {
  return process.platform.indexOf("win32") !== -1;
};

utilMgr.isMac = () => {
  return process.platform.indexOf("darwin") !== -1;
};

utilMgr.getOsUsername = async () => {
  let username = os.userInfo().username;
  if (!username || username.trim() === "") {
      username = await utilMgr.getCommandResult("whoami");
  }
  return username;
};

utilMgr.getCommandResult = async (cmd, maxLines = -1) => {
    let result = await utilMgr.wrapExecPromise(`${cmd}`, null);
    if (!result) {
        return "";
    }
    let contentList = result
        .replace(/\r\n/g, "\r")
        .replace(/\n/g, "\r")
        .split(/\r/);
    if (contentList && contentList.length > 0) {
      let len =
          maxLines !== -1
              ? Math.min(contentList.length, maxLines)
              : contentList.length;
      for (let i = 0; i < len; i++) {
            let line = contentList[i];
            if (line && line.trim().length > 0) {
                result = line.trim();
                break;
            }
        }
    }
    return result;
};

utilMgr.cleanSessionInfo = () => {
  const jsonObj = utilMgr.getSoftwareSessionAsJson();
  if (jsonObj) {
    let keys = Object.keys(jsonObj);
    let removedKeys = false;
    if (keys) {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (key !== "jwt" && key !== "name") {
          // remove  it
          delete jsonObj[key];
          removedKeys = true;
        }
      }
    }

    if (removedKeys) {
      const content = JSON.stringify(jsonObj);

      const sessionFile = utilMgr.getSoftwareSessionFile();
      fs.writeFileSync(sessionFile, content, err => {
        if (err)
          console.log(
            "Code Time: Error writing to the Software session file: ",
            err.message
          );
      });
    }

  }
}

utilMgr.setItem = (key, value) => {
  // update the cached session key map
  cachedSessionKeys[key] = value;

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
  let cachedVal = cachedSessionKeys[key];
  if (cachedVal) {
    return cachedVal;
  }
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

utilMgr.jwtExists = () => {
    let jwt = utilMgr.getItem("jwt");
    return !jwt ? false : true;
};

utilMgr.softwareSessionFileExists = () => {
    // don't auto create the file
    const file = utilMgr.getSoftwareSessionFile(false);
    // check if it exists
    return fs.existsSync(file);
};

/**
 * Get the .software/session.json path/name
 **/
utilMgr.getSoftwareSessionFile = (autoCreate = true) => {
  let file = utilMgr.getSoftwareDir(autoCreate);
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
utilMgr.getSoftwareDir = (autoCreate = true) => {
  const homedir = os.homedir();
  let softwareDataDir = homedir;
  if (utilMgr.isWindows()) {
    softwareDataDir += "\\.software";
  } else {
    softwareDataDir += "/.software";
  }

  if (autoCreate && !fs.existsSync(softwareDataDir)) {
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
  if (!showStatusBarText) {
    msg = "";
    icon = "clock";
  } else {
    lastMsg = msg;
    lastIcon = icon;
  }
  utilMgr.getStatusView().display(msg, icon);
};

utilMgr.toggleStatusBarMetrics = () => {
  showStatusBarText = !showStatusBarText;
  utilMgr.showStatus(lastMsg, lastIcon);
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
  let nowInSec = utilMgr.nowInSecs();
  let pastThreshold = nowInSec - lastOnlineCheck > 60;
  if (pastThreshold) {
    isOnline = await utilMgr
      .softwareGet("/ping", null)
      .then(result => {
        return utilMgr.isResponseOk(result);
      })
      .catch(e => {
        return false;
      });
  }
  return isOnline
};

/**
 * get the app jwt
 */
utilMgr.getAppJwt = async () => {
  utilMgr.setItem("app_jwt", null);
  let serverIsOnline = await utilMgr.serverIsAvailable();

  if (serverIsOnline) {
    // get the app jwt
    let resp = await utilMgr.softwareGet(
      `/data/apptoken?token=${utilMgr.nowInSecs()}`,
      null
    );
    if (utilMgr.isResponseOk(resp)) {
      return resp.data.jwt;
    }
  }
  return null;
};

/**
 * create an anonymous user
 */
utilMgr.createAnonymousUser = async serverIsOnline => {
  let appJwt = await utilMgr.getAppJwt();
  if (appJwt) {
      let creation_annotation = "NO_SESSION_FILE";
      const username = await utilMgr.getOsUsername();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hostname = await utilMgr.getHostname();

      let resp = await utilMgr.softwarePost(`/data/onboard`,
        { timezone, username, creation_annotation, hostname },
        appJwt
      );
      if (
        utilMgr.isResponseOk(resp) &&
        resp.data &&
        resp.data.jwt
      ) {
        utilMgr.setItem("jwt", resp.data.jwt);
        return resp.data.jwt;
      }
  }

  return null;
};

utilMgr.validateEmail = (email) => {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
};

utilMgr.getUser = async (serverIsOnline) => {
    let jwt = utilMgr.getItem("jwt");
    if (jwt && serverIsOnline) {
        let api = "/users/me";
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                return resp.data.data;
            }
        }
    }
    return null;
};

utilMgr.isLoggedOn = async (serverIsOnline) => {
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
}

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
utilMgr.getUserStatus = async (token = null) => {
  utilMgr.cleanSessionInfo();

  let jwt = utilMgr.getItem("jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();
  let loggedIn = false;
  if (serverIsOnline) {
      let loggedInResp = await utilMgr.isLoggedOn(serverIsOnline, jwt);
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

  if (serverIsOnline && loggedInCacheState !== null && loggedInCacheState !== loggedIn) {
    // change of logged in state
    utilMgr.sendHeartbeat(`STATE_CHANGE:LOGGED_IN:${loggedIn}`);
    setTimeout(() => {
      utilMgr.fetchDailyKpmSessionInfo();
    }, 1000);
  }

  loggedInCacheState = loggedIn;

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

utilMgr.getWebUrl = async () => {
  let userStatus = await utilMgr.getUserStatus();
  if (userStatus.loggedIn) {
    return launch_url;
  }
  return utilMgr.getLoginUrl();
};

utilMgr.getLoginUrl = () => {
  let jwt = utilMgr.getItem("jwt");
  let loginUrl = `${launch_url}/onboarding?token=${jwt}`;
  return loginUrl;
}

utilMgr.launchLoginUrl = () => {
  launchUrl(utilMgr.getLoginUrl());
  utilMgr.refetchUserStatusLazily(10);
};

utilMgr.launchWebDashboardUrl = () => {
  launchUrl(launch_url + "/login");
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
  utilMgr.updateMenuPreference(command, flag);
  utilMgr.updatePreferences();
};

utilMgr.removeMenuItem = prefLabel => {
  const result = codeTimeSubmenu.find(n => n.label === prefLabel);
  if (result) {
    codeTimeSubmenu = codeTimeSubmenu.filter(n => n.label !== prefLabel);
    atom.menu.remove(codeTimeMenu);
    codeTimeMenu[0].submenu = codeTimeSubmenu;

    codeTimeMenu = [];
    codeTimeMenu.push({
      label: "Packages",
      submenu: [{
        label: "Code Time",
        submenu: codeTimeSubmenu
      }]
    });

    atom.menu.add(codeTimeMenu);
    atom.menu.update();
  }
};

utilMgr.addMenuItem = (prefLabel, command) => {
  const result = codeTimeSubmenu.find(n => n.label === prefLabel);
  if (!result) {
    atom.menu.remove(codeTimeMenu);
    codeTimeSubmenu.push({
      label: prefLabel,
      command
    });

    codeTimeMenu = [];
    codeTimeMenu.push({
      label: "Packages",
      submenu: [{
        label: "Code Time",
        submenu: codeTimeSubmenu
      }]
    });

    atom.menu.add(codeTimeMenu);
    atom.menu.update();
  }
};

utilMgr.updateLoginPreference = (loggedIn) => {
  if (loggedIn) {
    utilMgr.removeMenuItem(LOGIN_MENU_LABEL);
    utilMgr.addMenuItem(WEB_DASHBOARD_MENU_LABEL, WEB_DASHBOARD_COMMAND_KEY);
  } else {
    utilMgr.addMenuItem(LOGIN_MENU_LABEL, LOGIN_COMMAND_KEY);
    utilMgr.removeMenuItem(WEB_DASHBOARD_MENU_LABEL);
  }
};

utilMgr.updateMenuPreference = (command, flag) => {

  // only concerned with the music setting to update the dropdown menu
  if (command === SHOW_MUSIC_METRICS_CONFIG_KEY) {
    let prefLabel = TOP_MUSIC_MENU_LABEL;
    if (!flag) {
      utilMgr.removeMenuItem(prefLabel);
    } else {
      utilMgr.addMenuItem(prefLabel, command);
    }
  }
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

utilMgr.getUserId = async () => {
    let jwt = utilMgr.getItem("jwt");
    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                let userId = parseInt(resp.data.data.id, 10);
                return userId;
            }
        }
    }
    return null;
};

utilMgr.updatePreferences = async () => {
  let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
  let showGitMetrics = atom.config.get("code-time.showGitMetrics");
  let showWeeklyRanking = atom.config.get("code-time.showWeeklyRanking");

  // get the user's preferences and update them if they don't match what we have
  let jwt = utilMgr.getItem("jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();
  if (jwt && serverIsOnline) {

    let userId = await utilMgr.getUserId();
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
    let userStatus = await utilMgr.getUserStatus();
    if (!userStatus.loggedIn) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
        tryCountUntilFoundUser -= 1;
        utilMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
      }
    }
  }, 10000);
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
        let msg = `${inFlowIcon}${currentDayMinutesTime}`;
        if (averageDailyMinutes > 0) {
          msg += ` | ${averageDailyMinutesTime}`;
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

utilMgr.sendHeartbeat = async (reason) => {
    let serverIsOnline = await utilMgr.serverIsAvailable();
    let jwt = utilMgr.getItem("jwt");
    if (serverIsOnline && jwt) {

        let heartbeat = {
            pluginId: PLUGIN_ID,
            os: utilMgr.getOs(),
            start: utilMgr.nowInSecs(),
            version: utilMgr.getVersion(),
            hostname: await utilMgr.getHostname(),
            session_ctime: utilMgr.getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: utilMgr.getEditorSessionToken()
        };

        let api = `/data/heartbeat`;
        utilMgr.softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!utilMgr.isResponseOk(resp)) {
                console.log("Code Time: unable to send heartbeat ping");
            }
        });
    }
};

module.exports = utilMgr;
