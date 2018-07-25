"use babel";

import { CompositeDisposable } from "atom";
import AppConstants from "./AppConstants";
import KeystrokeManager from "./KeystrokeManager";
import SessionManager from "./SessionManager";
import axios from "axios";

const POST_DELAY_IN_SEC = 60;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

let projectMap = {};
let keystrokeMgr = null;
let sessionMgr = null;
let downloadWindowOpen = false;
let progressWindow = null;
let appConstants = null;
let packageVersion = null;
let activated = false;

// initialize the keystroke manager
function initializeKeystrokeMgr() {
  const rootPath =
    atom.workspace.project &&
    atom.workspace.project.rootDirectories[0] &&
    atom.workspace.project.rootDirectories[0].path;

  if (!rootPath) {
    if (!keystrokeMgr) {
      keystrokeMgr = new KeystrokeManager("None", "", packageVersion);
    }
    return;
  }

  if (!keystrokeMgr) {
    // Keystroke Manager keeps the keystroke count and project class.
    // We'll load the project name and directory into the project class
    // using the keystroke manager constructor.
    const lastSlashIdx = rootPath ? rootPath.lastIndexOf("/") : -1;
    const projectName =
      lastSlashIdx !== -1
        ? rootPath.substring(rootPath.lastIndexOf("/") + 1)
        : rootPath;

    const projectDirectory =
      lastSlashIdx !== -1
        ? rootPath.substring(0, rootPath.lastIndexOf("/"))
        : rootPath;

    keystrokeMgr = new KeystrokeManager(
      projectName,
      projectDirectory,
      packageVersion
    );
  }
}

// send the keystroke data
function sendKeystrokeData() {
  sessionMgr.sendOfflineData();

  if (
    !keystrokeMgr ||
    !keystrokeMgr.keystrokeCount ||
    !keystrokeMgr.hasData()
  ) {
    return;
  }

  // set the end time in seconds
  const now = Math.round(Date.now() / 1000);
  keystrokeMgr.keystrokeCount.start = now - 60;
  keystrokeMgr.keystrokeCount.end = now;
  // make sure the data sum value goes out as a string
  keystrokeMgr.keystrokeCount.data = String(keystrokeMgr.keystrokeCount.data);
  const payload = JSON.parse(JSON.stringify(keystrokeMgr.keystrokeCount));

  // turn data into a string value
  payload.data = String(payload.data);

  if (!appConstants.isTelemetryOn()) {
    console.log("Software.com metrics is currently paused.");
    sessionMgr.storePayload(payload);
    return;
  }

  console.log(`Software.com: sending ${JSON.stringify(payload)}`);

  //
  // Send the API POST request
  //
  return appConstants
    .getApi()
    .post("/data", payload)
    .then(response => {
      // everything is fine
      // reset the count and other attributes
      keystrokeMgr.reset();
    })
    .catch(err => {
      // store the payload offline
      console.log("Software.com: Error sending data, saving kpm info offline");
      sessionMgr.storePayload(payload);
      sessionMgr.checkUserAuthenticationStatus();
      // reset the count and other attributes
      keystrokeMgr.reset();
    });
}

export default {
  subscriptions: null,
  sendDataInterval: null,

  activate(state) {
    if (activated) {
      return;
    }

    packageVersion = atom.packages.getLoadedPackage("Software").metadata
      .version;
    console.log(`Software.com: Loaded v${packageVersion}`);

    if (!sessionMgr) {
      sessionMgr = new SessionManager(state);
    }

    if (!appConstants) {
      appConstants = new AppConstants();
    }

    // Subscribe to the "observeActiveTextEditor"
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "software.com:launchdashboard": () => sessionMgr.launchWebUrl()
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "software.com:pausemetrics": () => appConstants.updateTelemetryOn(false)
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "software.com:enablemetrics": () => appConstants.updateTelemetryOn(true)
      })
    );

    // intialize the editor event handling
    this.activeTextEditorHandler();

    let webUrl = sessionMgr.getLaunchWebUrl();
    appConstants.getStatusView().display("Software.com", webUrl, "");

    this.sendDataInterval = setInterval(
      sendKeystrokeData,
      POST_DELAY_IN_SEC * 1000
    );

    sessionMgr.fetchDailyKpmSessionInfo();

    setInterval(() => {
      sessionMgr.fetchDailyKpmSessionInfo();
    }, 1000 * 60);

    // send any offline data
    setTimeout(() => {
      // check if the user is authenticated with what is saved in the software config
      sessionMgr.sendOfflineData();
    }, 5000);

    // check auth status in 10 seconds
    setTimeout(() => {
      sessionMgr.checkUserAuthenticationStatus();
    }, 10000);

    activated = true;
  },

  deactivate() {
    clearInterval(this.sendDataInterval);
    sessionMgr.destroy();
    if (appConstants.getStatusView()) {
      appConstants.getStatusView().destroy();
    }
    this.subscriptions.dispose();
  },

  serialize() {
    // serialize
  },

  /*
   * Observing the active text editor will allow us to monitor
   * opening and closing of a file, and the keystroke changes of the
   * file.
   **/
  activeTextEditorHandler() {
    initializeKeystrokeMgr(keystrokeMgr);

    atom.workspace.observeTextEditors(editor => {
      let buffer = editor.getBuffer();
      let file;
      let fileName = buffer.file ? buffer.file.path : "Untitled";
      let grammar = editor.getGrammar() ? editor.getGrammar().name : "";

      // viewing the file for the 1st time, add to the open
      keystrokeMgr.updateFileInfoData(fileName, 1, "open");

      buffer.onDidDestroy(e => {
        keystrokeMgr.updateFileInfoData(fileName, 1, "close");
      });

      // observe when changes stop
      buffer.onDidStopChanging(e => {
        // get the previous line count
        const prevLines = keystrokeMgr.getFileInfoByKey(fileName, "lines");
        const lineCount = editor.getLineCount();
        if (prevLines !== 0) {
          const diff = lineCount - prevLines;
          if (diff > 0) {
            // lines were added
            keystrokeMgr.updateFileInfoData(fileName, diff, "linesAdded");
          } else if (diff < 0) {
            // lines were removed
            keystrokeMgr.updateFileInfoData(
              fileName,
              Math.abs(diff),
              "linesRemoved"
            );
          }
        }

        // update the line count.
        keystrokeMgr.updateFileInfoData(
          fileName,
          editor.getLineCount(),
          "lines"
        );

        if (keystrokeMgr.getFileInfoByKey(fileName, "syntax") === "") {
          keystrokeMgr.updateFileInfoData(fileName, grammar, "syntax");
        }
      });

      // observer on every keystroke.
      buffer.onDidChange(e => {
        let changes = e && e.changes[0] ? e.changes[0] : null;
        let diff = 0;
        let isNewLine = false;
        if (changes) {
          let newText = changes.newText;
          let oldText = changes.oldText;
          if (spacesRegex.test(newText) && !newLineRegex.test(newText)) {
            // they added only spaces.
            diff = 1;
          } else if (!newLineRegex.test(newText)) {
            // get the diff.
            diff = newText.length - oldText.length;
            if (spacesRegex.test(oldText) && diff > 1) {
              // remove 1 space from old text. for some reason it logs
              // that 1 extra delete occurred
              diff -= 1;
            }
          }
        }

        if (diff > 1) {
          // it's a copy and paste Event
          keystrokeMgr.updateFileInfoData(fileName, diff, "paste");
        } else if (diff < 0) {
          keystrokeMgr.updateFileInfoData(fileName, Math.abs(diff), "delete");
        } else if (diff === 1) {
          // increment the count for this specific file
          keystrokeMgr.updateFileInfoData(fileName, 1, "add");
        }
      });
    });
  }
};
