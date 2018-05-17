'use babel';

import { CompositeDisposable } from 'atom';
import KeystrokeManager from './KeystrokeManager';
import DownloadManager from './DownloadManager';
import axios from 'axios';

const DOWNLOAD_NOW_LABEL = "Download";
const NOT_NOW_LABEL = "Not now";
const NO_PM_INSTALLED_MSG = "We are having trouble sending data to Software.com. The Plugin Manager may not be installed. Would you like to download it now?";
const VERSION = '0.2.5';
const PLUGINMGR_URL = 'http://localhost:19234';
const POST_DELAY_IN_SEC = 60;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
const api = axios.create({
  baseURL: `${PLUGINMGR_URL}/api/v1/`
});

let wasMessageShown = false;
let projectMap = {};
let keystrokeMgr = null;
let downloadMgr = null;
let checkedForPmInstallation = false;
let lastMillisCheckedForPmInstallation = 0;
let downloadWindowOpen = false;
let progressWindow = null;

// initialize the keystroke manager
function initializeKeystrokeMgr() {
  if (!downloadMgr) {
    downloadMgr = new DownloadManager();
  }

  const rootPath = atom.workspace.project
                  && atom.workspace.project.rootDirectories[0]
                  && atom.workspace.project.rootDirectories[0].path;

  if (!rootPath) {
    if (!keystrokeMgr) {
      keystrokeMgr = new KeystrokeManager(
        'None', '', VERSION
      );
    }
    return;
  }

  if (!keystrokeMgr) {
    //
    // Keystroke Manager keeps the keystroke count and project class.
    // We'll load the project name and directory into the project class
    // using the keystroke manager constructor.
    //
    const lastSlashIdx = (rootPath) ? rootPath.lastIndexOf("/") : -1;
    const projectName = (lastSlashIdx !== -1) ?
      rootPath.substring(rootPath.lastIndexOf("/") + 1) :
      rootPath;

    const projectDirectory = (lastSlashIdx !== -1) ?
      rootPath.substring(0, rootPath.lastIndexOf("/")) :
      rootPath;

    keystrokeMgr = new KeystrokeManager(
      projectName,
      projectDirectory,
      VERSION
    );
  }

  return rootPath;
}

// send the keystroke data
function sendKeystrokeData() {
  if (!keystrokeMgr ||
      !keystrokeMgr.keystrokeCount ||
      !keystrokeMgr.hasData()) {
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

  console.log(`Software.com: sending ${JSON.stringify(payload)}`)

  //
  // Send the API POST request
  //
  return api.post('/data', payload)
  .then((response) => {
    // everything is fine
    // reset the count and other attributes
    keystrokeMgr.reset();
  })
  .catch((err) => {
    if (downloadWindowOpen || downloadMgr.isDownloading()) {
      // the download window is still open
      return;
    }

    const foundPmBinary = downloadMgr.hasPluginInstalled();
    if (foundPmBinary) {
        // update checkedForPmInstallation to true
        checkedForPmInstallation = true;
    } else if (
        !foundPmBinary &&
        checkedForPmInstallation &&
        lastMillisCheckedForPmInstallation > 0 &&
        Date.now() - lastMillisCheckedForPmInstallation >
            MILLIS_PER_DAY
    ) {
        // it's been over a day since we've asked the user to download the
        // pm that we're unable to locate, update the checked flag to false
        checkedForPmInstallation = false;
    }

    //
    // If the pm binary isn't found in the install path
    // we'll ask if we should download it.
    //
    if (!checkedForPmInstallation && !foundPmBinary) {

      downloadWindowOpen = true;
      checkedForPmInstallation = true;

      const chosen = atom.confirm({
        message: "",
        detailedMessage: NO_PM_INSTALLED_MSG,
        buttons: {
          "Download": () => {
            downloadWindowOpen = false;
            downloadMgr.downloadPM();
          },
          "Not now": () => {
            downloadWindowOpen = false;
            console.log("Decided not to download now.");
          }
        }
      });

      return;
    }

    if (!wasMessageShown && checkedForPmInstallation && foundPmBinary) {
      // set it to true so we show the confirm only once
      wasMessageShown = true;

      //
      // Received a non-success response, show the error message,
      // but only once
      //
      let confirmOptions = {
        message: "",
        detailedMessage: 'We are having trouble sending data to Software.com. ' +
                  'Please make sure the Plugin Manager is running and logged on.'
      }
      atom.confirm(confirmOptions);
    }

    // reset the count and other attributes
    keystrokeMgr.reset();
  });
}

export default {

  subscriptions: null,
  sendDataInterval: null,

  activate(state) {
    console.log(`Software.com: Loaded v${VERSION}`);

    // Subscribe to the "observeActiveTextEditor"
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.workspace.observeActiveTextEditor(this.activeTextEditorHandler)
    );
    this.subscriptions.add(
      atom.workspace.observeActivePane(this.paneItemHandler)
    );
    this.sendDataInterval =
      setInterval(sendKeystrokeData, POST_DELAY_IN_SEC * 1000);
  },

  deactivate() {
    clearInterval(this.sendDataInterval);
    this.subscriptions.dispose();
  },

  serialize() {
    // serialize
  },

  // lkjlkj
  paneItemHandler(item) {
    let fileName = '';

    const rootPath = initializeKeystrokeMgr();

    let isFileOpen = false;
    if (item && item.activeItem && item.activeItem.selectedPath) {
      // we'll only have the selectedPath if it's a file open request
      fileName = item.activeItem.selectedPath;
      isFileOpen = true;
    } else if (item && item.activeItem && item.activeItem && item.activeItem.buffer) {
      fileName = item.activeItem.buffer.file.path;
    }

    if (isFileOpen) {
      keystrokeMgr.updateFileInfoData(fileName, 1, 'open');
    } else {
      keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
    }
  },

  /*
   * Observing the active text editor will allow us to monitor
   * opening and closing of a file, and the keystroke changes of the file
   **/
  activeTextEditorHandler(editor) {
    const rootPath = initializeKeystrokeMgr(keystrokeMgr);

    if (editor && editor.getBuffer()) {
      let buffer = editor.getBuffer();
      let file;
      buffer.onDidChange((e) => {
          let changeCount = (e && e.changes[0]) ?
            e.changes[0].newText.length - e.changes[0].oldText.length :
            0;

          file = buffer.file;
          const fileName = file && file.path;

          if (changeCount > 1) {
            // it's a copy and paste Event
            keystrokeMgr.updateFileInfoData(fileName, changeCount, 'paste');
          } else if (changeCount < 0) {
            keystrokeMgr.updateFileInfoData(fileName, Math.abs(changeCount), 'delete');
          } else if (changeCount === 1) {
            // increment the count for this specific file
            keystrokeMgr.updateFileInfoData(fileName, 1, 'keys');
          }
      });
    }
  },

};
