'use babel';

import KeystrokeManager from '../KeystrokeManager';
import Project from '../model/Project';
import { NO_PROJ_NAME, UNTITLED } from '../Constants';
import { incrementSessionAndFileSecondsAndFetch } from '../managers/TimeDataManager';
const payloadMgr = require('./PayloadManager');
const eventMgr = require('./EventManager');
const dashboardMgr = require('../DashboardManager');
const utilMgr = require('../UtilManager');
const timeUtil = require('../utils/TimeUtil');
const projectMgr = require("./ProjectManager");
const pluginDataMgr = require("./PluginDataManager");
const eventUtil = require("../utils/EventUtil");
const windowMgr = require("./WindowManager");
const fileMgr = require("./FileManager");
const tracker = require("./TrackerManager");

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

const kpmMgr = {};

let keystrokeMgr = null;
let _keystrokeTriggerTimeout = null;

// initialize the keystroke manager
kpmMgr.initializeKeystrokeMgr = async fileName => {
    if (keystrokeMgr) {
        return;
    }

    const dirInfo = fileMgr.getDirectoryAndNameForFile(fileName);

    if (!keystrokeMgr) {
        // create it
        await createNewKeystrokeManager(
            dirInfo.project_name,
            dirInfo.project_directory
        );
    }
};

// start the minute timer to store the data
async function createNewKeystrokeManager(name, dir) {
    keystrokeMgr = new KeystrokeManager(name, dir);

    if (!_keystrokeTriggerTimeout) {
      _keystrokeTriggerTimeout = setTimeout(() => {
          kpmMgr.sendKeystrokeData();
          _keystrokeTriggerTimeout = null;
      }, 1000 * 60);
    }
}

kpmMgr.sendKeystrokesDataNow = () => {
  if (_keystrokeTriggerTimeout) {
    clearTimeout(_keystrokeTriggerTimeout);
    _keystrokeTriggerTimeout = null;
  }
  kpmMgr.sendKeystrokeData(true);
}

kpmMgr.sendBootstrapKpmPayload = () => {
    let rootPath = NO_PROJ_NAME;
    let fileName = UNTITLED;
    let name = NO_PROJ_NAME;

    // send the code time bootstrap payload.
    const initKeystrokeMgr = new KeystrokeManager(name, rootPath);
    initKeystrokeMgr.keystrokeCount.keystrokes = 0;
    let nowTimes = timeUtil.getNowTimes();
    const start = nowTimes.now_in_sec - 60;
    const local_start = nowTimes.local_now_in_sec - 60;
    initKeystrokeMgr.keystrokeCount.start = start;
    initKeystrokeMgr.keystrokeCount.local_start = local_start;
    const fileInfo = {
        add: 1,
        keystrokes: 1,
        start,
        local_start,
    };
    initKeystrokeMgr.keystrokeCount.source[fileName] = fileInfo;

    payloadMgr.postBootstrapPayload(initKeystrokeMgr.keystrokeCount);
};

// send the keystroke data
kpmMgr.sendKeystrokeData = async (isUnfocusEvent = false) => {
    if (
        !keystrokeMgr ||
        !keystrokeMgr.keystrokeCount ||
        !keystrokeMgr.hasData()
    ) {
        // no data to send, reset the keystrokeMgr
        keystrokeMgr = null;
        await utilMgr.updateLatestPayloadLazily(null);
        return;
    }

    // get the keystroke count payload
    const payload = keystrokeMgr.keystrokeCount;
    const nowTimes = timeUtil.getNowTimes();
    keystrokeMgr = null;
    pluginDataMgr.processPayloadHandler(payload, false /*sendNow*/, nowTimes, isUnfocusEvent);
};

/*
 * Observing the active text editor will allow us to monitor
 * opening and closing of a file, and the keystroke changes of the
 * file
 **/
kpmMgr.activeTextEditorHandler = () => {
    const dashboardFile = utilMgr.getDashboardFile();
    atom.workspace.observeTextEditors(async editor => {
        if (!editor || !editor.buffer) {
            return;
        }

        const fileInfo = eventUtil.getFileInfo(editor);
        //
        const buffer = editor.buffer;
        const fileName = fileInfo.full_file_name;

        // file open event
        tracker.trackEditorAction("file", "open", editor);

        buffer.onDidDestroy(async e => {
            if (!windowMgr.isFocused()) {
                return;
            }

            await kpmMgr.initializeKeystrokeMgr(fileName);

            keystrokeMgr.updateLineCount(editor, fileName);
            keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
            tracker.trackEditorAction("file", "close", editor);
        });

        // observe when changes stop
        buffer.onDidChange(async changeEvent => {
            if (!windowMgr.isFocused()) {
                return;
            }
            // make sure its initialized
            await kpmMgr.initializeKeystrokeMgr(fileName);
            keystrokeMgr.updateLineCount(editor, fileName);

            const contentChanges = changeEvent.changes.filter((change) =>
              change.newRange || change.oldRange);



            for (let contentChange of contentChanges) {
              // update keystroke counts
              keystrokeMgr.incrementKeystrokeCount();
              keystrokeMgr.updateFileInfoData(fileName, 1, 'keystrokes');

              // get {linesAdded, linesDeleted, charactersDeleted, charactersAdded, changeType}
              const documentChangeCountsAndType = analyzeDocumentChange(contentChange);
              keystrokeMgr.updateDocumentChangeInfo(
                fileName,
                documentChangeCountsAndType.linesAdded,
                'linesAdded'
              );

              keystrokeMgr.updateDocumentChangeInfo(
                fileName,
                documentChangeCountsAndType.linesDeleted,
                'linesDeleted'
              );

              keystrokeMgr.updateDocumentChangeInfo(
                fileName,
                documentChangeCountsAndType.charactersAdded,
                'charactersAdded'
              );

              keystrokeMgr.updateDocumentChangeInfo(
                fileName,
                documentChangeCountsAndType.charactersDeleted,
                'charactersDeleted'
              );

              switch (documentChangeCountsAndType.changeType) {
                case "singleDelete": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'singleDeletes');
                  break;
                }
                case "multiDelete": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'multiDeletes');
                  break;
                }
                case "singleAdd": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'singleAdds');
                  break;
                }
                case "multiAdd": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'multiAdds');
                  break;
                }
                case "autoIndent": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'autoIndents');
                  break;
                }
                case "replacement": {
                  keystrokeMgr.updateDocumentChangeInfo(fileName, 1, 'replacements');
                  break;
                }
              }
            }

            let changes = changeEvent && changeEvent.changes[0] ? changeEvent.changes[0] : null;
            let diff = 0;
            let isNewLine = false;
            let addedLinesDiff = 0;
            let removedLinesDiff = 0;
            if (changes) {
                if (changes.newRange) {
                    addedLinesDiff =
                        changes.newRange.end.row - changes.newRange.start.row;
                }
                if (changes.oldRange) {
                    removedLinesDiff =
                        changes.oldRange.end.row - changes.oldRange.start.row;
                }
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

            if (diff > 4) {
                // it's a copy and paste Event
                keystrokeMgr.updateFileInfoData(fileName, 1, 'paste');
                keystrokeMgr.updateFileInfoData(fileName, diff, 'charsPasted');

                console.log('Code Time: incremented paste');
            } else if (diff < 0 && removedLinesDiff === 0) {
                keystrokeMgr.updateFileInfoData(fileName, 1, 'delete');
                console.log('Code Time: incremented delete');
            } else if (diff === 1) {
                // increment the count for this specific file
                keystrokeMgr.updateFileInfoData(fileName, 1, 'add');
                console.log('Code Time: incremented add');
            } else if (addedLinesDiff > 0) {
                keystrokeMgr.updateFileInfoData(
                    fileName,
                    addedLinesDiff,
                    'linesAdded'
                );
                console.log(
                    `Code Time: incremented ${addedLinesDiff} lines added`
                );
            } else if (removedLinesDiff > 0) {
                keystrokeMgr.updateFileInfoData(
                    fileName,
                    removedLinesDiff,
                    'linesRemoved'
                );
                console.log(
                    `Code Time: incremented ${removedLinesDiff} lines removed`
                );
            }
        });
    });
};

function analyzeDocumentChange(contentChange) {
  const info = {
    linesAdded: 0,
    linesDeleted: 0,
    charactersDeleted: 0,
    charactersAdded: 0,
    changeType: ""
  };

  // extract lines and character change counts
  extractChangeCounts(info, contentChange);
  characterizeChange(info, contentChange);

  return info;
}

function extractChangeCounts(changeInfo, contentChange) {
  // ranges start counts at 1  Subtract 1 to get to expected values
  changeInfo.linesDeleted = contentChange.oldRange.getRowCount() - 1;
  changeInfo.linesAdded = contentChange.newRange.getRowCount() - 1;

  changeInfo.charactersDeleted = contentChange.oldText.length - changeInfo.linesDeleted;
  changeInfo.charactersAdded = contentChange.newText.length - changeInfo.linesAdded;
}

function characterizeChange(changeInfo, contentChange) {
  if (changeInfo.charactersDeleted > 0 || changeInfo.linesDeleted > 0) {
    if (changeInfo.charactersAdded > 0)
      changeInfo.changeType = "replacement";
    else
      if (changeInfo.charactersDeleted > 1 || changeInfo.linesDeleted > 1)
        changeInfo.changeType = "multiDelete";
      else if (changeInfo.charactersDeleted == 1 || changeInfo.linesDeleted == 1)
        changeInfo.changeType = "singleDelete";
  } else if (changeInfo.charactersAdded > 1 || changeInfo.linesAdded > 1) {
    if (contentChange.newText.match(/^[\n\r]\s*$/)) {
      changeInfo.charactersAdded = 0;
      changeInfo.changeType = "autoIndent";
    } else
      changeInfo.changeType = "multiAdd";
  } else if (changeInfo.charactersAdded == 1 || changeInfo.linesAdded == 1)
    changeInfo.changeType = "singleAdd";
}

module.exports = kpmMgr;
