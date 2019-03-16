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
const PROD_API_ENDPOINT = "https://api.software.com";
// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;
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

let loggedInCacheState = false;
let lastRegisterUserCheck = null;
let dashboardFileVisible = false;
let initializedPrefs = false;

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
      let content = "";
      if (utilMgr.isWindows()) {
          content = await utilMgr.wrapExecPromise("cmd /c whoami", null);
      } else {
          // use the windows commmand
          content = await utilMgr.wrapExecPromise("/bin/sh -c whoami", null);
      }
      let contentList = content
          .replace(/\r\n/g, "\r")
          .replace(/\n/g, "\r")
          .split(/\r/);
      if (contentList && contentList.length > 0) {
          for (let i = 0; i < contentList.length; i++) {
              let line = contentList[i];
              if (line && line.trim().length > 0) {
                  username = line.trim();
                  break;
              }
          }
      }
  }
  return username;
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
    // get the app jwt
    let d = new Date();
    let nowInSec = Math.round(d.getTime() / 1000);
    let resp = await utilMgr.softwareGet(
      `/data/apptoken?token=${nowInSec}`,
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
    let username = await utilMgr.getOsUsername();
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let resp = await utilMgr.softwarePost(
      `/data/onboard`,
      { timezone, username },
      appJwt
    );
    if (
      utilMgr.isResponseOk(resp) &&
      resp.data &&
      resp.data.jwt
    ) {
      utilMgr.setItem("jwt", resp.data.jwt);
    }
  }
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
      let user = await utilMgr.getUser(serverIsOnline);
        if (user && utilMgr.validateEmail(user.email)) {
            utilMgr.setItem("name", user.email);
            utilMgr.setItem("jwt", user.plugin_jwt);
            return true;
        }

        let api = "/users/plugin/state";
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            if (resp.data.state === "OK") {
              let email = resp.data.email;
              utilMgr.setItem("name", email);
              // check the jwt
              let pluginJwt = resp.data.jwt;
              if (pluginJwt && pluginJwt !== jwt) {
                  // update it
                  utilMgr.setItem("jwt", pluginJwt);
                  // re-initialize preferences
                  initializedPrefs = false;
              }
              return true;
            } else if (resp.data.state !== "ANONYMOUS") {
              // wipe out the jwt so we can re-create the anonymous user
              utilMgr.setItem("jwt", null);
            }
        } else {
          // wipe out the jwt so we can re-create the anonymous user
          utilMgr.setItem("jwt", null);
        }
    }
    utilMgr.setItem("name", null);
    return false;
}

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
utilMgr.getUserStatus = async (token = null) => {
  utilMgr.cleanSessionInfo();

  let jwt = utilMgr.getItem("jwt");

  let serverIsOnline = await utilMgr.serverIsAvailable();

  if (!jwt) {
    await utilMgr.createAnonymousUser(serverIsOnline);
  }

  let loggedIn = await utilMgr.isLoggedOn(serverIsOnline);

  // the jwt may have been nulled out
  jwt = utilMgr.getItem("jwt");
  if (!jwt) {
      // create an anonymous user
      await utilMgr.createAnonymousUser(serverIsOnline);
  }

  if (loggedIn && !initializedPrefs) {
    initializedPrefs = true;
    setTimeout(() => {
      utilMgr.initializePreferences();
    }, 1000);
  }

  let currentUserStatus = {
    loggedIn,
    name: utilMgr.getItem("name")
  };

  utilMgr.updateLoginPreference(loggedIn);
  // update the KpmStatusView
  utilMgr.getStatusView().updateCurrentStatus(currentUserStatus);

  if (!loggedInCacheState && loggedIn) {
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
  utilMgr.updateMenuPreference(command, flag);

  utilMgr.updatePreferences();
};

utilMgr.removeMenuItem = prefLabel => {
  const result = codeTimeSubmenu.find(n => n.label === prefLabel);
  if (result) {
    codeTimeSubmenu = codeTimeSubmenu.filter(n => n.label !== prefLabel);
    atom.menu.remove(codeTimeMenu);
    codeTimeMenu[0].submenu = codeTimeSubmenu;
    atom.menu.add(codeTimeMenu);
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
    atom.menu.add(codeTimeMenu);
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
    let jwt = getItem("jwt");
    let serverIsOnline = await serverIsAvailable();
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await softwareGet(api, jwt);
        if (isResponseOk(resp)) {
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
    utilMgr.clearUserStatusCache();
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
