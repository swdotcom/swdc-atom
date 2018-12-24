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

  async getLaunchUrl() {
    let webUrl = launch_url;

    if (sessionMgr) {
      const existingJwt = utilMgr.getItem("jwt");
      let tokenVal = utilMgr.getItem("token");
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
}
