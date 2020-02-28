'use babel';

import KeystrokeManager from '../KeystrokeManager';
import { NO_PROJ_NAME, UNTITLED, UNTITLED_WORKSPACE } from '../Constants';

const payloadMgr = require('./PayloadManager');
const eventMgr = require('./EventManager');
const dashboardMgr = require('../DashboardManager');
const gitUtil = require('../repo/GitUtil');
const utilMgr = require('../UtilManager');

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

const kpmMgr = {};

let keystrokeMgr = null;

// get project directory
kpmMgr.getProjectDirectory = () => {
    if (
        keystrokeMgr &&
        keystrokeMgr.keystrokeCount &&
        keystrokeMgr.keystrokeCount.project
    ) {
        return keystrokeMgr.keystrokeCount.project.directory;
    }
    return null;
};

// initialize the keystroke manager
kpmMgr.initializeKeystrokeMgr = () => {
    if (keystrokeMgr && keystrokeMgr.hasDirectory()) {
        return;
    }

    const rootPath =
        atom.workspace.project &&
        atom.workspace.project.rootDirectories[0] &&
        atom.workspace.project.rootDirectories[0].path;

    if (!rootPath) {
        if (!keystrokeMgr) {
            createNewKeystrokeManager(UNTITLED, NO_PROJ_NAME);
        }
        return;
    }

    // Keystroke Manager keeps the keystroke count and project class.
    // We'll load the project name and directory into the project class
    // using the keystroke manager constructor
    const lastSlashIdx = rootPath ? rootPath.lastIndexOf('/') : -1;
    const projectName =
        lastSlashIdx !== -1
            ? rootPath.substring(rootPath.lastIndexOf('/') + 1)
            : rootPath;

    if (rootPath && keystrokeMgr && !keystrokeMgr.hasDirectory()) {
        // update the project name and directory
        keystrokeMgr.updateProjectInfo(projectName, rootPath);
    } else if (!keystrokeMgr) {
        createNewKeystrokeManager(projectName, rootPath);
    }
};

// start the minute timer to store the data
function createNewKeystrokeManager(name, dir) {
    keystrokeMgr = new KeystrokeManager(name, dir);
    setTimeout(() => {
        kpmMgr.sendKeystrokeData();
    }, 1000 * 60);
}

kpmMgr.sendBootstrapKpmPayload = () => {
    let rootPath = NO_PROJ_NAME;
    let fileName = UNTITLED;
    let name = UNTITLED_WORKSPACE;

    // send the code time bootstrap payload.
    const initKeystrokeMgr = new KeystrokeManager(name, rootPath);
    initKeystrokeMgr.keystrokeCount.keystrokes = 1;
    let nowTimes = utilMgr.getNowTimes();
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
kpmMgr.sendKeystrokeData = async () => {
    if (
        !keystrokeMgr ||
        !keystrokeMgr.keystrokeCount ||
        !keystrokeMgr.hasData()
    ) {
        // no data to send, reset the keystrokeMgr
        keystrokeMgr = null;
        return;
    }

    let data = keystrokeMgr.keystrokeCount;
    // reset the keystroke mgr
    keystrokeMgr = null;

    // get the repo info if we don't already have it for the project.
    if (
        data.project &&
        (!data.project.resource ||
            Object.keys(data.project.resource).length === 0)
    ) {
        const resourceInfo = await gitUtil.getResourceInfo(
            data.project.directory
        );
        if (resourceInfo && resourceInfo.identifier) {
            data.project.resource = resourceInfo;
            data.project.identifier = resourceInfo.identifier;
        }
    }

    const nowTimes = utilMgr.getNowTimes();

    // Update the latestPayloadTimestampEndUtc. It's used to determine session time
    utilMgr.setItem('latestPayloadTimestampEndUtc', nowTimes.now_in_sec);

    data.end = nowTimes.now_in_sec;
    data.local_end = nowTimes.local_now_in_sec;
    Object.keys(data.source).forEach(key => {
        // ensure there is an end time
        const end = parseInt(data.source[key]['end'], 10) || 0;
        if (end === 0) {
            // set the end time for this file event
            let nowTimes = utilMgr.getNowTimes();
            data.source[key]['end'] = nowTimes.now_in_sec;
            data.source[key]['local_end'] = nowTimes.local_now_in_sec;
        }
    });

    // make sure the data sum value goes out as a string
    data.keystrokes = String(data.keystrokes);
    data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = JSON.parse(JSON.stringify(data));

    // turn data into a string value
    payload.keystrokes = String(payload.keystrokes);

    console.log(
        `Code Time: processing code time metrics: ${JSON.stringify(payload)}`
    );
    eventMgr.storePayload(payload);
};

/*
 * Observing the active text editor will allow us to monitor
 * opening and closing of a file, and the keystroke changes of the
 * file.
 **/
kpmMgr.activeTextEditorHandler = () => {
    const dashboardFile = dashboardMgr.getDashboardFile();
    atom.workspace.observeTextEditors(editor => {
        if (!editor || !editor.buffer) {
            return;
        }

        kpmMgr.initializeKeystrokeMgr();

        let buffer = editor.buffer;
        let file;
        let lineCount;
        let fileName = buffer.file ? buffer.file.path : 'Untitled';
        let grammar = editor.getGrammar() ? editor.getGrammar().name : '';

        if (fileName === dashboardFile) {
            utilMgr.updateDashboardFileVisibility(true);
        }

        // viewing the file for the 1st time, add to the open
        keystrokeMgr.updateFileInfoData(fileName, 1, 'open');

        keystrokeMgr.updateFileInfoData(fileName, buffer.getLength(), 'length');

        // update the line count.
        lineCount = editor.getLineCount();
        keystrokeMgr.updateFileInfoData(fileName, lineCount, 'lines');

        buffer.onDidDestroy(e => {
            if (!utilMgr.isFocused()) {
                return;
            }
            if (fileName === dashboardFile) {
                utilMgr.updateDashboardFileVisibility(false);
            }

            keystrokeMgr.updateLineCount(editor, fileName);

            if (keystrokeMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                keystrokeMgr.updateFileInfoData(fileName, grammar, 'syntax');
            }
            keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
        });

        // observe when changes stop
        buffer.onDidStopChanging(e => {
            kpmMgr.initializeKeystrokeMgr();

            keystrokeMgr.updateLineCount(editor, fileName);
        });

        // observer on every keystroke.
        buffer.onDidChange(async e => {
            if (!utilMgr.isFocused()) {
                return;
            }
            // make sure its initialized
            kpmMgr.initializeKeystrokeMgr();

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

            if (diff > 8) {
                // it's a copy and paste Event
                keystrokeMgr.updateFileInfoData(fileName, 1, 'paste');
                console.log('Code Time: incremented paste');
            } else if (diff < 0) {
                keystrokeMgr.updateFileInfoData(fileName, 1, 'delete');
                console.log('Code Time: incremented delete');
            } else if (diff === 1) {
                // increment the count for this specific file
                keystrokeMgr.updateFileInfoData(fileName, 1, 'add');
                console.log('Code Time: incremented add');
            }

            if (diff !== 0) {
                keystrokeMgr.updateFileInfoData(fileName, 1, 'keystrokes');
                // increment the top level data property as well
                keystrokeMgr.incrementKeystrokeCount();
            }
        });
    });
};

module.exports = kpmMgr;
