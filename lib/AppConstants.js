"use babel";

const os = require("os");
const fs = require("fs");

import axios from "axios";
import KpmStatusView from "./KpmStatusView";

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

const PROD_API_ENDPOINT = "https://api.software.com";
const PROD_URL = "https://app.software.com";

// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;
// set the launch url to use
const launch_url = PROD_URL;

let statusView = null;

let telemetryOn = true;

let sessionMgr = null;

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

export default class AppConstants {
  constructor() {
    if (!statusView) {
      statusView = new KpmStatusView();
    }
  }

  setSessionManager(mgr) {
    sessionMgr = mgr;
  }

  // Returns an object that can be retrieved
  // when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    if (statusView) {
      statusView.destroy();
    }
  }

  isTelemetryOn() {
    return telemetryOn;
  }

  updateTelemetryOn(isOn) {
    telemetryOn = isOn;
  }

  getStatusView() {
    return statusView;
  }

  async getLaunchUrl() {
    let webUrl = launch_url;

    if (sessionMgr) {
      const existingJwt = this.getItem("jwt");
      let tokenVal = this.getItem("token");
      let userIsAuthenticated = await sessionMgr.isUserAuthenticated();

      let addToken = false;
      if (!tokenVal) {
        tokenVal = sessionMgr.randomCode();
        this.setItem("token", tokenVal);
        addToken = true;
      } else if (!existingJwt || !userIsAuthenticated) {
        addToken = true;
      }

      if (addToken) {
        webUrl += `/onboarding?token=${tokenVal}`;
        setTimeout(() => {
          sessionMgr.checkTokenAvailability();
        }, 1000 * 60);
      }
      console.log("generating onboarding request: ", webUrl);
    }
    return webUrl;
  }

  nowInSeconds() {
    return Math.round(Date.now() / 1000);
  }

  getApi() {
    return beApi;
  }

  getLongThresholdHours() {
    return LONG_THRESHOLD_HOURS;
  }

  getShortThresholdHours() {
    return SHORT_THRESHOLD_HOURS;
  }

  getMillisPerHour() {
    return MILLIS_PER_HOUR;
  }

  // process.platform return the following...
  //   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
  isWindows() {
    return process.platform.indexOf("win32") !== -1;
  }

  isMac() {
    return process.platform.indexOf("darwin") !== -1;
  }

  setItem(key, value) {
    const jsonObj = this.getSoftwareSessionAsJson();
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = this.getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, err => {
      if (err)
        console.log(
          "Software.com: Error writing to the Software session file: ",
          err.message
        );
    });
  }

  getItem(key) {
    const jsonObj = this.getSoftwareSessionAsJson();

    return jsonObj[key] || null;
  }

  getSoftwareSessionAsJson() {
    let data = null;

    const sessionFile = this.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
      const content = fs.readFileSync(sessionFile).toString();
      if (content) {
        data = JSON.parse(content);
      }
    }
    return data ? data : {};
  }

  /**
   * Get the .software/session.json path/name
   **/
  getSoftwareSessionFile() {
    let file = this.getSoftwareDir();
    if (this.isWindows()) {
      file += "\\session.json";
    } else {
      file += "/session.json";
    }
    return file;
  }

  /**
   * Get the .software directory path/name
   **/
  getSoftwareDir() {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (this.isWindows()) {
      softwareDataDir += "\\.software";
    } else {
      softwareDataDir += "/.software";
    }

    if (!fs.existsSync(softwareDataDir)) {
      fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
  }

  /**
   * Get the .software/data.json path/name
   **/
  getSoftwareDataStoreFile() {
    let file = this.getSoftwareDir();
    if (this.isWindows()) {
      file += "\\data.json";
    } else {
      file += "/data.json";
    }
    return file;
  }
}
