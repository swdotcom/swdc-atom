"use babel";
import KpmStatusView from "./KpmStatusView";
const { exec } = require("child_process");
const crypto = require("crypto");
const axios = require("axios");
const os = require("os");
const fs = require("fs");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PROD_URL = "https://app.software.com";
// set the launch url to use
const launch_url = PROD_URL;

let utilMgr = {};

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

const PLUGIN_ID = 7;

let telemetryOn = true;
let isAuthenticated = false;
let statusView = new KpmStatusView();

const PROD_API_ENDPOINT = "https://api.software.com";
// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

utilMgr.getPluginId = () => {
  return PLUGIN_ID;
};

utilMgr.getStatusView = () => {
  return statusView;
};

utilMgr.showErrorStatus = async () => {
  utilMgr
    .getStatusView()
    .display("Software.com", await utilMgr.getLaunchUrl(), "alert");
};

utilMgr.showDeactivatedErrorStatus = async () => {
  utilMgr
    .getStatusView()
    .display(
      "Software.com",
      await utilMgr.getLaunchUrl(),
      "alert",
      "To see your coding data in Software.com, please reactivate your account."
    );
};

utilMgr.isTelemetryOn = () => {
  return telemetryOn;
};

utilMgr.randomCode = () => {
  return crypto
    .randomBytes(16)
    .map(value => alpha.charCodeAt(Math.floor(value * alpha.length / 256)))
    .toString();
};

utilMgr.getLaunchUrl = async () => {
  let webUrl = launch_url;

  const existingJwt = utilMgr.getItem("jwt");
  let tokenVal = utilMgr.getItem("token");
  // let userIsAuthenticated = await utilMgr.isUserAuthenticated();

  let addToken = false;
  if (!tokenVal) {
    tokenVal = utilMgr.randomCode();
    utilMgr.setItem("token", tokenVal);
    addToken = true;
  } else if (!existingJwt || !isAuthenticated) {
    addToken = true;
  }

  if (addToken) {
    webUrl += `/onboarding?token=${tokenVal}`;
  }
  console.log("generating onboarding request: ", webUrl);

  return webUrl;
};

utilMgr.isUserAuthenticated = async () => {
  if (!utilMgr.isTelemetryOn()) {
    return true;
  }

  const tokenVal = utilMgr.getItem("token");
  if (!tokenVal) {
    return false;
  }

  // since we do have a token value, ping the backend using authentication
  // in case they need to re-authenticate
  const authenticated = await utilMgr
    .softwareGet("/users/ping/", utilMgr.getItem("jwt"))
    .then(resp => {
      if (utilMgr.isResponseOk(resp)) {
        // everything is fine, delete the offline data file
        return true;
      } else if (utilMgr.isUserDeactivated(resp)) {
        return false;
      } else {
        console.log(
          "Software.com: User is not authenticated or has not logged in."
        );
        return false;
      }
    });

  return authenticated;
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
        "Software.com: Error writing to the Software session file: ",
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

utilMgr.wrapExecPromise = async (cmd, projectDir) => {
  let prop = null;
  try {
    prop = await utilMgr.execPromise(cmd, {
      cwd: projectDir
    });
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
        `Software.com: error fetching data for ${api}, message: ${err.message}`
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
        `Software.com: error posting data for ${api}, message: ${err.message}`
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
        `Software.com: error with delete request for ${api}, message: ${
          err.message
        }`
      );
      return err;
    });
};

utilMgr.isResponseOk = resp => {
  if (
    (!resp.response && resp.errno) ||
    (resp.response && resp.response.status && resp.response.status >= 400) ||
    (resp.status && resp.status >= 400) ||
    (resp.code && (resp.code === "ECONNREFUSED" || resp.code === "ENOTFOUND"))
  ) {
    isAuthenticated = false;
    return false;
  }
  isAuthenticated = true;
  return true;
};

utilMgr.isUnauthenticated = resp => {
  if (
    resp.response &&
    resp.response.status &&
    resp.response.status >= 400 &&
    resp.response.status < 500
  ) {
    isAuthenticated = false;
    return true;
  }
  isAuthenticated = true;
  return false;
};

utilMgr.isDeactivated = async () => {
  let pingResp = await utilMgr.softwareGet(
    "/users/ping/",
    utilMgr.getItem("jwt")
  );
  return utilMgr.isUserDeactivated(pingResp);
};

utilMgr.isUserDeactivated = async resp => {
  if (!utilMgr.isResponseOk(resp)) {
    let code = resp.code || "";
    if (code === "DEACTIVATED") {
      utilMgr.showDeactivatedErrorStatus();
      return true;
    }
  }
  return false;
};

utilMgr.isUserDeactivated = async resp => {
  if (
    !utilMgr.isResponseOk(resp) &&
    utilMgr.isUnauthenticatedAndDeactivated(resp)
  ) {
    return true;
  }
  return false;
};

utilMgr.isUnauthenticatedAndDeactivated = async resp => {
  if (
    resp &&
    resp.response &&
    resp.response.status &&
    resp.response.status >= 400 &&
    resp.response.data
  ) {
    // check if we have the data object
    let code = resp.response.data.code || "";
    if (code === "DEACTIVATED") {
      isAuthenticated = false;
      return true;
    }
  }
  return false;
};

module.exports = utilMgr;
