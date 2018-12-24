"use babel";

import AppConstants from "./AppConstants";

const fs = require("fs");
const open = require("open");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const cp = require("child_process");
const utilMgr = require("./UtilManager");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let appConstants = null;
let grubMgr = null;
let kpmInfo = {};
let checkingStatus = false;

//
// SessionManager - handles software session management
//
export default class SessionManager {
  constructor(serializedState) {
    if (!appConstants) {
      appConstants = new AppConstants();
      appConstants.setSessionManager(this);
    }

    this.init();
  }

  async init() {
    appConstants
      .getStatusView()
      .display("Software.com", await appConstants.getLaunchUrl());
  }

  // Returns an object that can be retrieved
  // when package is activated.
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  async serverIsAvailable() {
    return await this.checkOnline();
  }

  async isUserAuthenticated() {
    if (!utilMgr.isTelemetryOn()) {
      return true;
    }

    const tokenVal = utilMgr.getItem("token");
    if (!tokenVal) {
      return false;
    }
    // since we do have a token value, ping the backend using authentication
    // in case they need to re-authenticate
    appConstants.getApi().defaults.headers.common[
      "Authorization"
    ] = utilMgr.getItem("jwt");
    const authenticated = await appConstants
      .getApi()
      .get("/users/ping/")
      .then(() => {
        return true;
      })
      .catch(() => {
        console.log("Software.com: The user is not authenticated");
        return false;
      });

    return authenticated;
  }

  async checkOnline() {
    if (!utilMgr.isTelemetryOn()) {
      return;
    }
    // non-authenticated ping, no need to set the Authorization header
    const isOnline = await appConstants
      .getApi()
      .get("/ping")
      .then(() => {
        return true;
      })
      .catch(() => {
        console.log("Software.com: Server not reachable");
        return false;
      });
    return isOnline;
  }

  storePayload(payload) {
    fs.appendFile(
      utilMgr.getSoftwareDataStoreFile(),
      JSON.stringify(payload) + os.EOL,
      err => {
        if (err)
          console.log(
            "Software.com: Error appending to the Software data store file: ",
            err.message
          );
      }
    );
  }

  sendOfflineData() {
    if (!utilMgr.isTelemetryOn()) {
      return;
    }

    const dataStoreFile = utilMgr.getSoftwareDataStoreFile();
    if (fs.existsSync(dataStoreFile)) {
      const content = fs.readFileSync(dataStoreFile).toString();
      if (content) {
        console.error(`Software.com: sending batch payloads: ${content}`);
        const payloads = content
          .split(/\r?\n/)
          .map(item => {
            let obj = null;
            if (item) {
              try {
                obj = JSON.parse(item);
              } catch (e) {
                //
              }
            }
            if (obj) {
              return obj;
            }
          })
          .filter(item => item);
        // POST the kpm to the PluginManager
        appConstants.getApi().defaults.headers.common[
          "Authorization"
        ] = utilMgr.getItem("jwt");
        return appConstants
          .getApi()
          .post("/data/batch", payloads)
          .then(response => {
            // everything is fine, delete the offline data file
            this.deleteFile(utilMgr.getSoftwareDataStoreFile());
          })
          .catch(err => {
            console.log(
              "Software.com: Unable to send offline data: ",
              err.message
            );
          });
      }
    }
  }

  deleteFile(file) {
    //
    // if the file exists, get it
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  checkUserAuthenticationStatus() {
    if (checkingStatus) {
      return;
    }
    checkingStatus = true;
    const serverAvailablePromise = this.serverIsAvailable();
    const isAuthenticatedPromise = this.isUserAuthenticated();
    const pastThresholdTime = this.isPastTimeThreshold();
    const tokenVal = utilMgr.getItem("token");
    const lastUpdateTime = utilMgr.getItem("atom_lastUpdateTime");

    Promise.all([serverAvailablePromise, isAuthenticatedPromise]).then(
      values => {
        const serverAvailable = values[0];
        const isAuthenticated = values[1];
        //
        // Show the dialog if the user is not authenticated but online,
        // and it's past the threshold time and the confirm window is null
        //
        if (
          !tokenVal ||
          !lastUpdateTime ||
          (serverAvailable && !isAuthenticated && pastThresholdTime)
        ) {
          // set the last update time so we don't try to ask too frequently
          utilMgr.setItem("atom_lastUpdateTime", Date.now());
          let infoMsg =
            "To see your coding data in Software.com, please log in to your account.";
          atom.confirm({
            message: "",
            detailedMessage: infoMsg,
            buttons: {
              "Log In": () => {
                checkingStatus = false;
                this.launchWebUrl();
              },
              "Not now": () => {
                checkingStatus = false;
              }
            }
          });
        }

        if (!isAuthenticated) {
          this.showStatus("Software.com", "alert");

          setTimeout(() => {
            checkingStatus = false;
            this.checkTokenAvailability();
          }, 1000 * 60);
        }
      }
    );
  }

  /**
   * Checks the last time we've updated the session info
   */
  isPastTimeThreshold() {
    const existingJwt = utilMgr.getItem("jwt");
    const thresholdHoursBeforeCheckingAgain = utilMgr.getShortThresholdHours();
    const lastUpdateTime = utilMgr.getItem("atom_lastUpdateTime");

    const oneHour = 1000 * 60 * 60 * 1;

    if (lastUpdateTime && Date.now() - lastUpdateTime < oneHour) {
      return false;
    }

    return true;
  }

  randomCode() {
    return crypto
      .randomBytes(16)
      .map(value => alpha.charCodeAt(Math.floor(value * alpha.length / 256)))
      .toString();
  }

  checkTokenAvailability() {
    if (!utilMgr.isTelemetryOn()) {
      return;
    }
    const tokenVal = utilMgr.getItem("token");

    if (!tokenVal) {
      return;
    }

    // ned to get back...
    // response.data.user, response.data.jwt
    // non-authorization API
    appConstants
      .getApi()
      .get(`/users/plugin/confirm?token=${tokenVal}`)
      .then(response => {
        if (response.data && response.data.jwt && response.data.user) {
          utilMgr.setItem("jwt", response.data.jwt);
          utilMgr.setItem("user", response.data.user);
          utilMgr.setItem("atom_lastUpdateTime", Date.now());
        }
      })
      .catch(err => {
        console.log(
          "Software.com: unable to obtain session token: ",
          err.message
        );
        // try again in a couple of minutes
        setTimeout(() => {
          this.checkTokenAvailability();
        }, 1000 * 120);
      });
  }

  /**
   * Launch the browser to the dashboard or to the onboarding view
   **/
  async launchWebUrl() {
    let url = await appConstants.getLaunchUrl();
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
          "Software.com: Error launching Software authentication: ",
          error.toString()
        );
      }
    });
  }

  async fetchDailyKpmSessionInfo() {
    if (!utilMgr.isTelemetryOn()) {
      console.log(
        "Software.com: Metrics is currently paused. Enable to view your KPM activity."
      );
      return;
    }

    let start = new Date();
    // set it to the beginning of the day
    start.setHours(0, 0, 0, 0);
    const fromSeconds = Math.round(start.getTime() / 1000);

    appConstants.getApi().defaults.headers.common[
      "Authorization"
    ] = utilMgr.getItem("jwt");
    appConstants
      .getApi()
      .get(`/sessions?from=${fromSeconds}&summary=true`)
      .then(response => {
        const sessions = response.data;
        let avgKpm = sessions.lastKpm ? parseInt(sessions.lastKpm, 10) : 0;
        let currentSessionGoalPercent = sessions.currentSessionGoalPercent
          ? parseFloat(sessions.currentSessionGoalPercent)
          : 0;

        let currentSessionMinutes = sessions.currentSessionMinutes
          ? parseInt(sessions.currentSessionMinutes, 10)
          : 0;

        currentSessionMinutes = currentSessionMinutes.toFixed(0);
        const inFlow =
          sessions.inFlow !== undefined && sessions.inFlow !== null
            ? sessions.inFlow
            : true;
        let sessionTime = this.humanizeMinutes(currentSessionMinutes);

        let sessionTimeIcon = "";
        if (currentSessionGoalPercent > 0) {
          if (currentSessionGoalPercent < 0.4) {
            sessionTimeIcon = "🌘";
          } else if (currentSessionGoalPercent < 0.7) {
            sessionTimeIcon = "🌗";
          } else if (currentSessionGoalPercent < 0.93) {
            sessionTimeIcon = "🌖";
          } else if (currentSessionGoalPercent < 1.3) {
            sessionTimeIcon = "🌕";
          } else {
            sessionTimeIcon = "🌔";
          }
        }

        // const avgKpm = totalKpm > 0 ? totalKpm / sessionLen : 0;
        kpmInfo["kpmAvg"] = avgKpm.toFixed(0);
        kpmInfo["sessionTime"] = sessionTime;

        if (avgKpm > 0 || currentSessionMinutes > 0) {
          let kpmMsg = `${kpmInfo["kpmAvg"]} KPM`;
          if (inFlow) {
            kpmMsg = "🚀" + " " + kpmMsg;
          }
          let sessionMsg = `${kpmInfo["sessionTime"]}`;
          if (sessionTimeIcon !== "") {
            sessionMsg = sessionTimeIcon + " " + sessionMsg;
          }
          // let icon = avgKpm <= 0 || !inFlow ? "" : "rocket";
          this.showStatus("&lt;S&gt; " + kpmMsg + ", " + sessionMsg, "");

          // if (avgKpm > 0) {
          //   // the user has kpm activity, is it lunch or dinner time?
          //   setTimeout(() => {
          //     // is it taco time?
          //     if (grubMgr.isTacoTime()) {
          //       grubMgr.showTacoTime();
          //     }
          //   }, 5000);
          // }
        } else {
          this.showStatus("Software.com", "");
        }
      })
      .catch(err => {
        console.log(
          "Software.com: error getting session information: ",
          err.message
        );
        this.showStatus("Software.com", "alert");
      });
  }

  humanizeMinutes(minutes) {
    let humizedStr = "";
    minutes = parseInt(minutes, 10) || 0;
    let sessionTime = "";
    if (minutes === 60) {
      humizedStr = "1 hr";
    } else if (minutes > 60) {
      humizedStr = (minutes / 60).toFixed(2) + " hrs";
    } else if (minutes === 1) {
      humizedStr = "1 min";
    } else {
      humizedStr = minutes + " min";
    }
    return humizedStr;
  }

  async pauseMetrics() {
    utilMgr.updateTelemetryOn(false);
    appConstants
      .getStatusView()
      .display(
        "Paused",
        await utilMgr.getLaunchUrl(),
        "",
        "Enable metrics to resume"
      );
  }

  async enableMetrics() {
    utilMgr.updateTelemetryOn(true);
    appConstants
      .getStatusView()
      .display("Software.com", await utilMgr.getLaunchUrl());
  }

  async showStatus(msg, icon) {
    appConstants
      .getStatusView()
      .display(msg, await utilMgr.getLaunchUrl(), icon);
  }
}
