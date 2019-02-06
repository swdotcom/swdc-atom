"use babel";

const fs = require("fs");
const open = require("open");
const path = require("path");
const os = require("os");
const cp = require("child_process");
const utilMgr = require("./UtilManager");

//
// SessionManager - handles software session management
//
let sessionMgr = {};

let grubMgr = null;
let kpmInfo = {};
let checkingStatus = false;

sessionMgr.initialize = async () => {
  utilMgr.getStatusView().display("Code Time", await utilMgr.getLaunchUrl());
};

sessionMgr.serverIsAvailable = async () => {
  return await sessionMgr.checkOnline();
};

sessionMgr.checkOnline = async () => {
  if (!utilMgr.isTelemetryOn()) {
    return;
  }
  // non-authenticated ping, no need to set the Authorization header
  const isOnline = await utilMgr.softwareGet("/ping").then(resp => {
    if (utilMgr.isResponseOk(resp)) {
      return true;
    } else {
      return false;
    }
  });
  return isOnline;
};

sessionMgr.storePayload = payload => {
  fs.appendFile(
    utilMgr.getSoftwareDataStoreFile(),
    JSON.stringify(payload) + os.EOL,
    err => {
      if (err)
        console.log(
          "Code Time: Error appending to the Software data store file: ",
          err.message
        );
    }
  );
};

sessionMgr.sendOfflineData = () => {
  if (!utilMgr.isTelemetryOn()) {
    return;
  }

  const dataStoreFile = utilMgr.getSoftwareDataStoreFile();
  if (fs.existsSync(dataStoreFile)) {
    const content = fs.readFileSync(dataStoreFile).toString();
    if (content) {
      console.error(`Code Time: sending batch payloads: ${content}`);
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
      return utilMgr
        .softwarePost("/data/batch", payloads, utilMgr.getItem("jwt"))
        .then(resp => {
          if (utilMgr.isResponseOk(resp)) {
            // everything is fine, delete the offline data file
            sessionMgr.deleteFile(utilMgr.getSoftwareDataStoreFile());
          }
        });
    }
  }
};

sessionMgr.deleteFile = file => {
  //
  // if the file exists, get it
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};

sessionMgr.checkUserAuthenticationStatus = async () => {
  if (checkingStatus) {
    return;
  }

  checkingStatus = true;
  const serverAvailable = await sessionMgr.serverIsAvailable();
  const isAuthenticated = await utilMgr.isUserAuthenticated();
  const pastThresholdTime = await sessionMgr.isPastTimeThreshold();
  const tokenVal = utilMgr.getItem("token");
  const lastUpdateTime = utilMgr.getItem("atom_lastUpdateTime");

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
      "To see your coding data in Code Time, please log in to your account.";
    atom.confirm({
      message: "",
      detailedMessage: infoMsg,
      buttons: {
        "Log In": () => {
          checkingStatus = false;
          utilMgr.launchWebUrl();
        },
        "Not now": () => {
          checkingStatus = false;
        }
      }
    });
  }

  if (!isAuthenticated) {
    if (utilMgr.isDeactivated()) {
      // they're deactivated, check back in a day
      setTimeout(() => {
        sessionMgr.checkTokenAvailability();
      }, 1000 * 60 * 60 * 24);
    } else {
      utilMgr.showErrorStatus();
      setTimeout(() => {
        sessionMgr.checkTokenAvailability();
      }, 1000 * 60);
    }
  }
};

/**
 * Checks the last time we've updated the session info
 */
sessionMgr.isPastTimeThreshold = () => {
  const existingJwt = utilMgr.getItem("jwt");
  const thresholdHoursBeforeCheckingAgain = utilMgr.getShortThresholdHours();
  const lastUpdateTime = utilMgr.getItem("atom_lastUpdateTime");

  const oneHour = 1000 * 60 * 60 * 1;

  if (lastUpdateTime && Date.now() - lastUpdateTime < oneHour) {
    return false;
  }

  return true;
};

sessionMgr.checkTokenAvailability = () => {
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
      // try again in a couple of minutes
      setTimeout(() => {
        sessionMgr.checkTokenAvailability();
      }, 1000 * 120);
    }
  });
};

sessionMgr.launchCodeTimeDashboard = async () => {
  // launch the CodeTime file
  let file = utilMgr.getDashboardFile();
  const dashboardSummary = await utilMgr.softwareGet(
    `/dashboard`,
    utilMgr.getItem("jwt")
  );
  let content =
    dashboardSummary && dashboardSummary.data ? dashboardSummary.data : NO_DATA;

  fs.writeFileSync(file, content, "UTF8");
  let shouldFocus = utilMgr.isDashboardOpen() ? false : true;
  atom.workspace.open(file, {
    changeFocus: shouldFocus,
    activatePane: shouldFocus,
    activateItem: shouldFocus
  });
  utilMgr.updateDashboardIsOpen(true);
};

sessionMgr.fetchDailyKpmSessionInfo = async () => {
  if (!utilMgr.isTelemetryOn()) {
    console.log(
      "Code Time: Metrics is currently paused. Enable to view your KPM activity."
    );
    return;
  }

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
        let currentSessionTime = sessionMgr.humanizeMinutes(
          currentSessionMinutes
        );
        let currentDayMinutes = parseInt(sessions.currentDayMinutes, 10) || 0;
        let currentDayMinutesTime = sessionMgr.humanizeMinutes(
          currentDayMinutes
        );
        let averageDailyMinutes =
          parseInt(sessions.averageDailyMinutes, 10) || 0;
        let averageDailyMinutesTime = sessionMgr.humanizeMinutes(
          averageDailyMinutes
        );

        let inFlowIcon = currentDayMinutes > averageDailyMinutes ? "🚀 " : "";
        let msg = `Code time: ${inFlowIcon}${currentDayMinutesTime}`;
        if (averageDailyMinutes > 0) {
          msg += ` | Avg: ${averageDailyMinutesTime}`;
        }

        sessionMgr.showStatus(msg);

        if (utilMgr.isDashboardOpen()) {
          sessionMgr.launchCodeTimeDashboard();
        }
      } else if (!utilMgr.isDeactivated()) {
        utilMgr.showErrorStatus();
      }
    });
};

sessionMgr.humanizeMinutes = minutes => {
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

sessionMgr.pauseMetrics = async () => {
  utilMgr.updateTelemetryOn(false);
  utilMgr
    .getStatusView()
    .display(
      "Paused",
      await utilMgr.getLaunchUrl(),
      "",
      "Enable metrics to resume"
    );
};

sessionMgr.enableMetrics = async () => {
  utilMgr.updateTelemetryOn(true);
  utilMgr.getStatusView().display("Code Time", await utilMgr.getLaunchUrl());
};

sessionMgr.showStatus = async (msg, icon) => {
  utilMgr.getStatusView().display(msg, await utilMgr.getLaunchUrl(), icon);
};

module.exports = sessionMgr;
