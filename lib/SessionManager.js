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

sessionMgr.initializeStatus = async () => {
  utilMgr.getStatusView().display("Code Time");
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
            utilMgr.deleteFile(utilMgr.getSoftwareDataStoreFile());
          }
        });
    }
  }
};

sessionMgr.checkUserAuthenticationStatus = async () => {
  const serverAvailable = await utilMgr.serverIsAvailable();
  let userStatus = await utilMgr.getUserStatus();
  const tokenVal = utilMgr.getItem("token");
  if (!userStatus.loggedIn && !userStatus.hasUserAccounts && tokenVal) {
    // not logged in, no user accounts, check by token
    userStatus = await utilMgr.getUserStatus(tokenVal);
  }
  const lastUpdateTime = utilMgr.getItem("atom_lastUpdateTime");

  //
  // Show the dialog if the user is not authenticated but online,
  // and it's past the threshold time and the confirm window is null
  //
  if (serverAvailable && !lastUpdateTime && !userStatus.hasUserAccounts) {
    // set the last update time so we don't try to ask too frequently
    utilMgr.setItem("atom_lastUpdateTime", Date.now());
    let infoMsg =
      "To see your coding data in Code Time, please log in to your account.";
    atom.confirm({
      message: "",
      detailedMessage: infoMsg,
      buttons: {
        "Log In": async () => {
          await utilMgr.launchSignupUrl();
          setTimeout(() => {
            utilMgr.getUserStatus();
          }, 45000);
        },
        "Not now": () => {
          //
        }
      }
    });
  }
};

sessionMgr.pauseMetrics = async () => {
  utilMgr.updateTelemetryOn(false);
  utilMgr
    .getStatusView()
    .display(
      "Paused",
      await utilMgr.getWebUrl(),
      "",
      "Enable metrics to resume"
    );
};

sessionMgr.enableMetrics = async () => {
  utilMgr.updateTelemetryOn(true);
  utilMgr.getStatusView().display("Code Time");
};

module.exports = sessionMgr;
