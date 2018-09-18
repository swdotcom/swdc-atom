"use babel";

import { CompositeDisposable } from "atom";
import AppConstants from "./AppConstants";
import KeystrokeManager from "./KeystrokeManager";
import SessionManager from "./SessionManager";
import axios from "axios";
import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";

const { exec } = require("child_process");

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
let musicMgr = null;
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
    // using the keystroke manager constructor
    const lastSlashIdx = rootPath ? rootPath.lastIndexOf("/") : -1;
    const projectName =
      lastSlashIdx !== -1
        ? rootPath.substring(rootPath.lastIndexOf("/") + 1)
        : rootPath;

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
        "software.com:go-to-software.com": () => sessionMgr.launchWebUrl()
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "software.com:pause-metrics": () => sessionMgr.pauseMetrics()
      })
    );
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "software.com:enable-metrics": () => sessionMgr.enableMetrics()
      })
    );

    // intialize the editor event handling
    this.activeTextEditorHandler();

    let webUrl = sessionMgr.getLaunchWebUrl();
    appConstants
      .getStatusView()
      .display("Software.com", appConstants.getLaunchUrl());

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
    // serialize.
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
        // get the previous line count
        const prevLines = keystrokeMgr.getFileInfoByKey(fileName, "lines");
        lineCount = editor.getLineCount();

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

        if (
          !keystrokeMgr
            .getFileInfoByKey(fileName, "trackInfo")
            .hasOwnProperty("id")
        ) {
          const trackInfo = await this.getCurrentMusicTrackId();
          keystrokeMgr.updateFileInfoData(fileName, trackInfo, "trackInfo");
        }

        // get the repo info if we don't already have it for the project.
        if (
          keystrokeMgr.keystrokeCount.project &&
          (!keystrokeMgr.keystrokeCount.project.resource ||
            this.isEmptyObj(keystrokeMgr.keystrokeCount.project.resource))
        ) {
          keystrokeMgr.keystrokeCount.project.resource = await this.getResourceInfo(
            keystrokeMgr.keystrokeCount.project.directory
          );
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
  },

  async getCurrentMusicTrackId() {
    let trackInfo = {};

    let isSpotifyRunning = await this.getSpotifyRunningPromise();
    let isItunesRunning = await this.isItunesRunningPromise();

    if (isSpotifyRunning) {
      trackInfo = await this.getSpotifyTrackPromise();
      if (!trackInfo && isItunesRunning) {
        // get that track data.
        trackInfo = await this.getItunesTrackPromise();
      }
    } else if (isItunesRunning) {
      trackInfo = await this.getItunesTrackPromise();
    }

    return trackInfo || {};
  },

  /**
   * returns true or an error.
   */
  getSpotifyRunningPromise() {
    return new Promise((resolve, reject) => {
      spotify.isRunning((err, isRunning) => {
        if (err) {
          resolve(false);
        } else {
          resolve(isRunning);
        }
      });
    });
  },

  /**
 * returns i.e.
 * track = {
        artist: 'Bob Dylan',
        album: 'Highway 61 Revisited',
        disc_number: 1,
        duration: 370,
        played count: 0,
        track_number: 1,
        starred: false,
        popularity: 71,
        id: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc',
        name: 'Like A Rolling Stone',
        album_artist: 'Bob Dylan',
        artwork_url: 'http://images.spotify.com/image/e3d720410b4a0770c1fc84bc8eb0f0b76758a358',
        spotify_url: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc' }
    }
 */
  getSpotifyTrackPromise() {
    return new Promise((resolve, reject) => {
      spotify.getTrack((err, track) => {
        if (err || !track) {
          resolve(null);
        } else {
          let trackInfo = {
            id: track.id,
            name: track.name,
            artist: track.artist,
            genre: "" // spotify doesn't provide genre from their app.
          };
          resolve(trackInfo);
        }
      });
    });
  },

  isItunesRunningPromise() {
    return new Promise((resolve, reject) => {
      itunes.isRunning((err, isRunning) => {
        if (err) {
          resolve(false);
        } else {
          resolve(isRunning);
        }
      });
    });
  },

  /**
 * returns an array of data, i.e.
 * 0:"Dance"
    1:"Martin Garrix"
    2:"High on Life (feat. Bonn) - Single"
    3:4938 <- is this the track ID?
    4:375
    5:"High on Life (feat. Bonn)"
    6:"3:50"
 */
  getItunesTrackPromise() {
    return new Promise((resolve, reject) => {
      itunes.track((err, track) => {
        if (err || !track) {
          resolve(null);
        } else {
          let trackInfo = {};
          if (track.length > 0) {
            trackInfo["genre"] = track[0];
          }
          if (track.length >= 1) {
            trackInfo["artist"] = track[1];
          }
          if (track.length >= 3) {
            trackInfo["id"] = `itunes:track:${track[3]}`;
          }
          if (track.length >= 5) {
            trackInfo["name"] = track[5];
          }
          resolve(trackInfo);
        }
      });
    });
  },

  isEmptyObj(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  },

  execPromise(command, opts) {
    return new Promise(function(resolve, reject) {
      exec(command, opts, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout.trim());
      });
    });
  },

  //
  // use "git symbolic-ref --short HEAD" to get the git branch
  // use "git config --get remote.origin.url" to get the remote url
  async getResourceInfo(projectDir) {
    let branch = null;
    try {
      branch = await this.execPromise("git symbolic-ref --short HEAD", {
        cwd: projectDir
      });
    } catch (e) {
      // console.error(e.message);
      branch = null;
    }

    let identifier = null;
    try {
      identifier = await this.execPromise(
        "git config --get remote.origin.url",
        {
          cwd: projectDir
        }
      );
    } catch (e) {
      // console.error(e.message);
      identifier = null;
    }

    // both should be valid to return the resource info
    if (branch && identifier) {
      return { branch, identifier };
    }
    // we don't have git info, return an empty object
    return {};
  }
};
