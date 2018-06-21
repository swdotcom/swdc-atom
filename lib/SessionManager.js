"use babel";

import AppConstants from "./AppConstants";

const request = require("request");
const fs = require("fs");
const open = require("open");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const cp = require("child_process");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let appConstants = null;
let kpmInfo = {};
let checkingStatus = false;

//
// SessionManager - handles software session management.
//
export default class SessionManager {
  constructor(serializedState) {
    if (!appConstants) {
      appConstants = new AppConstants();
    }
  }

  // Returns an object that can be retrieved
  // when package is activated.
  serialize() {}

  // Tear down any state and detach
  destroy() {
    if (appConstants.getStatusView()) {
      appConstants.statusView.destroy();
    }
  }

  getSoftwareDir() {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (appConstants.isWindows()) {
      softwareDataDir += "\\.software";
    } else {
      softwareDataDir += "/.software";
    }

    if (!fs.existsSync(softwareDataDir)) {
      fs.mkdirSync(softwareDataDir).toString();
    }

    return softwareDataDir;
  }

  getSoftwareSessionFile() {
    let file = this.getSoftwareDir();
    if (appConstants.isWindows()) {
      file += "\\session.json";
    } else {
      file += "/session.json";
    }
    return file;
  }

  getSoftwareDataStoreFile() {
    let file = this.getSoftwareDir();
    if (appConstants.isWindows()) {
      file += "\\data.json";
    } else {
      file += "/data.json";
    }
    return file;
  }

  async serverIsAvailable() {
    return await this.checkOnline();
  }

  /**
   * User session will have...
   * { user: user, jwt: jwt }
   */
  async isAuthenticated() {
    const tokenVal = this.getItem("token");
    if (!tokenVal) {
      this.showStatus("Software.com", "alert");
      return false;
    }

    // since we do have a token value, ping the backend using authentication
    // in case they need to re-authenticate
    appConstants.getApi().defaults.headers.common[
      "Authorization"
    ] = this.getItem("jwt");
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

    if (!authenticated) {
      this.showStatus("Software.com", "alert");
    }

    return authenticated;
  }

  async checkOnline() {
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
      this.getSoftwareDataStoreFile(),
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
    const dataStoreFile = this.getSoftwareDataStoreFile();
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
        ] = this.getItem("jwt");
        return appConstants
          .getApi()
          .post("/data/batch", payloads)
          .then(response => {
            // everything is fine, delete the offline data file
            this.deleteFile(this.getSoftwareDataStoreFile());
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

  deleteFile(file) {
    //
    // if the file exists, get it
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  chekUserAuthenticationStatus() {
    if (checkingStatus) {
      return;
    }
    checkingStatus = true;
    const serverAvailablePromise = this.serverIsAvailable();
    const isAuthenticatedPromise = this.isAuthenticated();
    const pastThresholdTime = this.isPastTimeThreshold();
    const existingJwt = this.getItem("jwt");

    Promise.all([serverAvailablePromise, isAuthenticatedPromise]).then(
      values => {
        const serverAvailable = values[0];
        const isAuthenticated = values[1];
        //
        // Show the dialog if the user is not authenticated but online,
        // and it's past the threshold time and the confirm window is null
        //
        if (serverAvailable && !isAuthenticated && pastThresholdTime) {
          // set the last update time so we don't try to ask too frequently
          this.setItem("atom_lastUpdateTime", Date.now());
          let infoMsg =
            "To see your coding data in Software.com, please sign in to your account.";
          atom.confirm({
            message: "",
            detailedMessage: infoMsg,
            buttons: {
              "Sign in": () => {
                checkingStatus = false;
                const tokenVal = this.randomCode();
                // update the .software data with the token we've just created
                this.setItem("token", tokenVal);
                this.launchWebUrl(
                  `${appConstants.getLaunchUrl()}/onboarding?token=${tokenVal}`
                );
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
    const existingJwt = this.getItem("jwt");
    const thresholdHoursBeforeCheckingAgain = !existingJwt
      ? appConstants.getShortThresholdHours()
      : appConstants.getLongThresholdHours();
    const lastUpdateTime = this.getItem("atom_lastUpdateTime");
    if (
      lastUpdateTime &&
      Date.now() - lastUpdateTime <
        appConstants.getMillisPerHour() * thresholdHoursBeforeCheckingAgain
    ) {
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
    const tokenVal = this.getItem("token");

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
        if (response.data) {
          this.setItem("jwt", response.data.jwt);
          this.setItem("user", response.data.user);
          this.setItem("atom_lastUpdateTime", Date.now());
        }
      })
      .catch(err => {
        console.log(
          "Software.com: unable to obtain session token: ",
          err.message
        );
        // try again in 1 minute
        setTimeout(() => {
          this.checkTokenAvailability();
        }, 1000 * 120);
      });
  }

  launchWebUrl(url) {
    let open = "open";
    let args = [`${url}`];
    if (appConstants.isWindows()) {
      open = "cmd";
      // adds the following args to the beginning of the array
      args.unshift("/c", "start", '""');
    } else if (!appConstants.isMac()) {
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
    if (await !this.isAuthenticated()) {
      console.log(
        "Software.com: Not authenticated to fetch KPM info, trying again later"
      );
      return;
    }

    const fromSeconds = appConstants.nowInSeconds();
    appConstants.getApi().defaults.headers.common[
      "Authorization"
    ] = this.getItem("jwt");
    appConstants
      .getApi()
      .get(`/sessions?from=${fromSeconds}&summary=true`)
      .then(response => {
        const sessions = response.data;
        let avgKpm = sessions.kpm ? parseInt(sessions.kpm, 10) : 0;
        let totalMin = sessions.minutesTotal;
        const inFlow =
          sessions.inFlow !== undefined && sessions.inFlow !== null
            ? sessions.inFlow
            : true;
        let sessionTime = "";
        if (totalMin === 60) {
          sessionTime = "1 hr";
        } else if (totalMin > 60) {
          sessionTime = (totalMin / 60).toFixed(2) + " hrs";
        } else if (totalMin === 1) {
          sessionTime = "1 min";
        } else {
          sessionTime = totalMin + " min";
        }
        // const avgKpm = totalKpm > 0 ? totalKpm / sessionLen : 0;
        kpmInfo["kpmAvg"] = avgKpm > 0 ? avgKpm.toFixed(0) : avgKpm.toFixed(2);
        kpmInfo["sessionTime"] = sessionTime;

        if (avgKpm > 0 || totalMin > 0) {
          let icon = avgKpm <= 0 || !inFlow ? "" : "rocket";
          this.showStatus(
            `${kpmInfo["kpmAvg"]} KPM, ${kpmInfo["sessionTime"]}`,
            icon
          );
        } else {
          this.showStatus("Software.com", "");
        }
      })
      .catch(err => {
        console.log(
          "Software.com: error getting session information: ",
          err.message
        );
        this.chekUserAuthenticationStatus();
      });
  }

  getSelectedKpm() {
    if (kpmInfo["kpmAvg"]) {
      return `${kpmInfo["kpmAvg"]} KPM, ${kpmInfo["sessionTime"]}`;
    }
    return "";
  }

  handleKpmClickedEvent() {
    let webUrl = this.getLaunchWebUrl();

    this.launchWebUrl(webUrl);
  }

  getLaunchWebUrl() {
    const existingJwt = this.getItem("jwt");
    let webUrl = appConstants.getLaunchUrl();
    if (!existingJwt) {
      const tokenVal = this.randomCode();
      // update the .software data with the token we've just created
      this.setItem("token", tokenVal);
      webUrl += `/onboarding?token=${tokenVal}`;
    }
    return webUrl;
  }

  showStatus(msg, icon) {
    let webUrl = this.getLaunchWebUrl();
    appConstants.getStatusView().display(msg, webUrl, icon);
  }
}
