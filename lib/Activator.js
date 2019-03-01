"use babel";

import { CompositeDisposable } from "atom";
import KeystrokeManager from "./KeystrokeManager";
import KpmMusicManager from "./KpmMusicManager";

const utilMgr = require("./UtilManager");
const kpmRepoMgr = require("./KpmRepoManager");
const sessionMgr = require("./SessionManager");

const { exec } = require("child_process");

const POST_DELAY_IN_SEC = 60;
const DEFAULT_DURATION = 60;
const DEFAULT_DURATION_MILLIS = DEFAULT_DURATION * 1000;

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

let projectMap = {};
let keystrokeMgr = null;
let musicMgr = null;
let packageVersion = null;
let activated = false;

let token_check_interval = null;

// initialize the keystroke manager....
function initializeKeystrokeMgr() {
  if (keystrokeMgr && keystrokeMgr.hasDirectory()) {
    return;
  }

  const rootPath =
    atom.workspace.project &&
    atom.workspace.project.rootDirectories[0] &&
    atom.workspace.project.rootDirectories[0].path;

  if (!rootPath) {
    if (!keystrokeMgr) {
      let defaultName = utilMgr.getDefaultProjectName();
      keystrokeMgr = new KeystrokeManager(
        defaultName,
        defaultName,
        packageVersion
      );
    }
    return;
  }

  // Keystroke Manager keeps the keystroke count and project class.
  // We'll load the project name and directory into the project class
  // using the keystroke manager constructor
  const lastSlashIdx = rootPath ? rootPath.lastIndexOf("/") : -1;
  const projectName =
    lastSlashIdx !== -1
      ? rootPath.substring(rootPath.lastIndexOf("/") + 1)
      : rootPath;

  if (rootPath && keystrokeMgr && !keystrokeMgr.hasDirectory()) {
    // update the project name and directory
    keystrokeMgr.updateProjectInfo(projectName, rootPath);
  } else if (!keystrokeMgr) {
    keystrokeMgr = new KeystrokeManager(projectName, rootPath, packageVersion);
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

  let d = new Date();
  d = new Date(d.getTime() - DEFAULT_DURATION_MILLIS);
  // get the true offset and multiply by 60 to get offset seconds
  let offset_sec = d.getTimezoneOffset() * 60;
  // set the end time in seconds
  const now = Math.round(Date.now() / 1000);
  keystrokeMgr.keystrokeCount.start = now - 60;
  keystrokeMgr.keystrokeCount.local_start =
    keystrokeMgr.keystrokeCount.start - offset_sec;
  // make sure the data sum value goes out as a string
  keystrokeMgr.keystrokeCount.keystrokes = String(
    keystrokeMgr.keystrokeCount.keystrokes
  );
  keystrokeMgr.keystrokeCount.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const payload = JSON.parse(JSON.stringify(keystrokeMgr.keystrokeCount));

  // turn data into a string value
  payload.keystrokes = String(payload.keystrokes);

  if (!utilMgr.isTelemetryOn()) {
    console.log("Code Time metrics is currently paused.");
    sessionMgr.storePayload(payload);
    return;
  }

  console.log(`Code Time: sending ${JSON.stringify(payload)}`);

  //
  // Send the API POST request
  //
  return utilMgr
    .softwarePost("/data", payload, utilMgr.getItem("jwt"))
    .then(resp => {
      if (!utilMgr.isResponseOk(resp) && !utilMgr.isDeactivated()) {
        // store the payload offline
        console.log("Code Time: Error sending data, saving kpm info offline");
        sessionMgr.storePayload(payload);
        sessionMgr.checkUserAuthenticationStatus();
      } else if (utilMgr.isDeactivated()) {
        // check back in a day
        setTimeout(() => {
          sessionMgr.checkUserAuthenticationStatus();
        }, 1000 * 60 * 60 * 24);
      } else {
        // not authenticated, check back in a minute
        setTimeout(() => {
          sessionMgr.checkUserAuthenticationStatus();
        }, 1000 * 60);
      }
      // reset the data
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

    packageVersion = atom.packages.getLoadedPackage("code-time").metadata
      .version;
    console.log(`Code Time: Loaded v${packageVersion}`);

    if (!musicMgr) {
      musicMgr = new KpmMusicManager(state);
    }

    // Subscribe to the "observeActiveTextEditor"
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:dashboard": () => utilMgr.launchCodeTimeDashboard()
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:web-dashboard": () => utilMgr.launchWebUrl()
      })
    );

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:software-top-40": () => utilMgr.launchSoftwareTopForty()
      })
    );

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:log-out": () => utilMgr.pluginLogout()
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:log-in": () => utilMgr.launchLoginUrl()
      })
    );

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:sign-up": () => utilMgr.launchSignupUrl()
      })
    );

    let submenu = utilMgr.getCodeTimeSubmenu();
    let menu = utilMgr.getCodeTimeMenu();

    submenu.push({
      label: "Code time dashboard",
      command: "Code-Time:dashboard"
    });
    submenu.push({
      label: "Web dashboard",
      command: "Code-Time:web-dashboard"
    });
    submenu.push({
      label: "Software top 40",
      command: "Code-Time:software-top-40"
    });

    menu.push({
      label: "Code Time",
      submenu: submenu
    });

    atom.menu.add(menu);

    // intialize the editor event handling
    this.activeTextEditorHandler();

    this.sendDataInterval = setInterval(
      sendKeystrokeData,
      POST_DELAY_IN_SEC * 1000
    );

    utilMgr.fetchDailyKpmSessionInfo();

    let one_min = 1000 * 60;

    setInterval(() => {
      utilMgr.fetchDailyKpmSessionInfo();
    }, one_min);

    // check and update the user status info
    token_check_interval = setInterval(() => {
      utilMgr.clearUserStatusCache();
      utilMgr.getUserStatus();
    }, one_min);

    // send any offline data
    setTimeout(() => {
      // check if the user is authenticated with what is saved in the software config
      sessionMgr.sendOfflineData();
    }, 5000);

    // gather music info every 15 seconds
    setInterval(() => {
      musicMgr.gatherMusicInfo();
    }, 15000);

    // call the get repo users once an hour
    setInterval(() => {
      this.processRepoMembers();
    }, one_min * 60);

    // call the get repo users once in 2 minutes
    setTimeout(() => {
      this.processRepoMembers();
    }, one_min * 2);

    // call the get repo commits once in 2.5 minutes
    setTimeout(() => {
      this.processCommits();
    }, one_min * 2 + 30000);

    // with an interval of every hour plus 1 minute
    setInterval(() => {
      this.processCommits();
    }, one_min * 60 + 60000);

    activated = true;

    sessionMgr.initializeStatus();

    this.initializeUserInfo();

    atom.config.onDidChange(utilMgr.getMusicConfigKey(), [], event =>
      this.musicConfigChanged(event)
    );
    atom.config.onDidChange(utilMgr.geGitConfigKey(), [], event =>
      this.gitConfigChanged(event)
    );
    atom.config.onDidChange(utilMgr.getRankingConfigKey(), [], event =>
      this.rankingConfigChanged(event)
    );
  },

  deactivate() {
    // utilMgr
    //   .softwareDelete(
    //     `/integrations/${utilMgr.getPluginId()}`,
    //     utilMgr.getItem("jwt")
    //   )
    //   .then(resp => {
    //     if (utilMgr.isResponseOk(resp)) {
    //       if (resp.data) {
    //         console.log("Code Time: Uninstalled plugin");
    //       } else {
    //         console.log(
    //           "Code Time: Failed to update Code  about the uninstall event"
    //         );
    //       }
    //     }
    //   });

    clearInterval(this.sendDataInterval);
    if (token_check_interval) {
      clearInterval(token_check_interval);
    }
    if (utilMgr.getStatusView()) {
      utilMgr.getStatusView().destroy();
    }
    this.subscriptions.dispose();
  },

  serialize() {
    //
  },

  async initializeUserInfo() {
    if (await utilMgr.requiresUserCreation()) {
      await utilMgr.createAnonymousUser();
    }

    // {loggedIn: true|false, hasAccounts: true|false, hasUserAccounts: true|false}
    let userStatus = await utilMgr.getUserStatus();
    if (userStatus.loggedIn) {
      utilMgr.initializePreferences();
    } else {
      setTimeout(() => {
        sessionMgr.checkUserAuthenticationStatus();
      }, 9000);
    }
  },

  musicConfigChanged(event) {
    utilMgr.updatePreference(utilMgr.getMusicConfigKey(), event.newValue);
  },

  rankingConfigChanged(event) {
    utilMgr.updatePreferences();
  },

  gitConfigChanged(event) {
    utilMgr.updatePreferences();
  },

  processRepoMembers() {
    initializeKeystrokeMgr(keystrokeMgr);
    if (
      keystrokeMgr &&
      keystrokeMgr.keystrokeCount &&
      keystrokeMgr.keystrokeCount.project
    ) {
      kpmRepoMgr.getRepoUsers(keystrokeMgr.keystrokeCount.project.directory);
    }
  },

  processCommits() {
    initializeKeystrokeMgr(keystrokeMgr);
    if (
      keystrokeMgr &&
      keystrokeMgr.keystrokeCount &&
      keystrokeMgr.keystrokeCount.project
    ) {
      kpmRepoMgr.getHistoricalCommits(
        keystrokeMgr.keystrokeCount.project.directory
      );
    }
  },

  /*
   * Observing the active text editor will allow us to monitor
   * opening and closing of a file, and the keystroke changes of the
   * file.
   **/
  activeTextEditorHandler() {
    atom.workspace.observeTextEditors(editor => {
      if (!editor || !editor.buffer) {
        return;
      }

      initializeKeystrokeMgr(keystrokeMgr);

      let buffer = editor.buffer;
      let file;
      let lineCount;
      let fileName = buffer.file ? buffer.file.path : "Untitled";
      let grammar = editor.getGrammar() ? editor.getGrammar().name : "";

      // viewing the file for the 1st time, add to the open
      keystrokeMgr.updateFileInfoData(fileName, 1, "open");

      // update the line count.
      lineCount = editor.getLineCount();
      keystrokeMgr.updateFileInfoData(fileName, lineCount, "lines");

      buffer.onDidDestroy(e => {
        keystrokeMgr.updateFileInfoData(fileName, 1, "close");
      });

      // observe when changes stop
      buffer.onDidStopChanging(e => {
        initializeKeystrokeMgr(keystrokeMgr);

        // get the previous line count
        const prevLines = keystrokeMgr.getFileInfoByKey(fileName, "lines");
        lineCount = editor.getLineCount();

        if (prevLines !== 0) {
          const diff = lineCount - prevLines;
          if (diff > 0) {
            // lines were added
            keystrokeMgr.updateFileInfoData(fileName, diff, "linesAdded");
            console.log("Code Time: incremented lines added");
          } else if (diff < 0) {
            // lines were removed
            keystrokeMgr.updateFileInfoData(
              fileName,
              Math.abs(diff),
              "linesRemoved"
            );
            console.log("Code Time: incremented lines removed");
          }
        }

        // update the line count.
        keystrokeMgr.updateFileInfoData(fileName, lineCount, "lines");

        if (keystrokeMgr.getFileInfoByKey(fileName, "syntax") === "") {
          keystrokeMgr.updateFileInfoData(fileName, grammar, "syntax");
        }
      });

      // observer on every keystroke.
      buffer.onDidChange(async e => {
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

        // get the repo info if we don't already have it for the project.
        if (
          keystrokeMgr.keystrokeCount.project &&
          (!keystrokeMgr.keystrokeCount.project.resource ||
            Object.keys(keystrokeMgr.keystrokeCount.project.resource).length ===
              0)
        ) {
          const resourceInfo = await kpmRepoMgr.getResourceInfo(
            keystrokeMgr.keystrokeCount.project.directory
          );
          if (resourceInfo && resourceInfo.identifier) {
            keystrokeMgr.keystrokeCount.project.resource = resourceInfo;
            keystrokeMgr.keystrokeCount.project.identifier =
              resourceInfo.identifier;
          }
        }

        if (diff > 1) {
          // it's a copy and paste Event
          keystrokeMgr.updateFileInfoData(fileName, 1, "paste");
          console.log("Code Time: incremented paste");
        } else if (diff < 0) {
          keystrokeMgr.updateFileInfoData(fileName, 1, "delete");
          console.log("Code Time: incremented delete");
        } else if (diff === 1) {
          // increment the count for this specific file
          keystrokeMgr.updateFileInfoData(fileName, 1, "add");
          console.log("Code Time: incremented add");
        }
      });
    });
  }
};
