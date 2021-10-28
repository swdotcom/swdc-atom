'use babel';

import KeystrokeManager from '../KeystrokeManager';
const utilMgr = require('../UtilManager');
const timeUtil = require('../utils/TimeUtil');
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
  atom.workspace.observeTextEditors(editor => {
    if (!editor || !editor.buffer) {
      return;
    }

    const fileInfo = eventUtil.getFileInfo(editor);

    const buffer = editor.buffer;
    const fileName = fileInfo.full_file_name;

    // (async) make sure its initialized
    kpmMgr.initializeKeystrokeMgr(fileName);

    if (keystrokeMgr) {
      keystrokeMgr.updateFileInfoData(fileName, 1, 'open');
      keystrokeMgr.updateLineCount(editor, fileName);
      tracker.trackEditorAction("file", "open", editor);
    }

    buffer.onDidDestroy(async e => {
      if (!windowMgr.isFocused()) {
        return;
      }

      if (keystrokeMgr) {
        keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
      }
      tracker.trackEditorAction("file", "close", editor);
    });

    // observe when changes stop
    buffer.onDidChange(changeEvent => {
      if (!windowMgr.isFocused()) {
        return;
      }

      if (!keystrokeMgr) {
        // (async) make sure its initialized
        kpmMgr.initializeKeystrokeMgr(fileName);
        return;
      }

      const contentChanges = changeEvent.changes.filter((change) => change.newRange || change.oldRange);

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

      } else if (diff < 0 && removedLinesDiff === 0) {
        keystrokeMgr.updateFileInfoData(fileName, 1, 'delete');
      } else if (diff === 1) {
        // increment the count for this specific file
        keystrokeMgr.updateFileInfoData(fileName, 1, 'add');
      } else if (addedLinesDiff > 0) {
        keystrokeMgr.updateFileInfoData(
          fileName,
          addedLinesDiff,
          'linesAdded'
        );
      } else if (removedLinesDiff > 0) {
        keystrokeMgr.updateFileInfoData(
          fileName,
          removedLinesDiff,
          'linesRemoved'
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
