"use babel";

import axios from "axios";
import KpmStatusView from "./KpmStatusView";

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

const TEST_API_ENDPOINT = "http://localhost:5000";
const TEST_URL = "http://localhost:3000";

const PROD_API_ENDPOINT = "https://api.software.com";
const PROD_URL = "https://alpha.software.com";

// set the api endpoint to use
const api_endpoint = PROD_API_ENDPOINT;
// set the launch url to use
const launch_url = PROD_URL;

let statusView = null;

const beApi = axios.create({
  baseURL: `${api_endpoint}`
});

export default class AppConstants {
  constructor() {
    if (!statusView) {
      statusView = new KpmStatusView();
    }
  }

  // Returns an object that can be retrieved
  // when package is activated.
  serialize() {}

  // Tear down any state and detach
  destroy() {
    if (statusView) {
      statusView.destroy();
    }
  }

  getStatusView() {
    return statusView;
  }

  getLaunchUrl() {
    return launch_url;
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
}
