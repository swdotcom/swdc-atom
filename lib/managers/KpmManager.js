'use babel';

import KeystrokeManager from '../KeystrokeManager';
import { NO_PROJ_NAME, UNTITLED, UNTITLED_WORKSPACE } from '../Constants';
import { getTodayTimeDataSummary } from '../storage/SessionSummaryDataManager';
const payloadMgr = require('./PayloadManager');
const eventMgr = require('./EventManager');
const dashboardMgr = require('../DashboardManager');
const gitUtil = require('../repo/GitUtil');
const utilMgr = require('../UtilManager');
const timeUtil = require('../utils/TimeUtil');

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

const kpmMgr = {};

let keystrokeMgr = null;

// get the directory and project name based on a given file
kpmMgr.getDirectoryAndNameForFile = file => {
    if (
        atom.workspace.project &&
        atom.workspace.project.rootDirectories.length
    ) {
        const rootDirs = atom.workspace.project.rootDirectories;
        for (let i = 0; i < rootDirs.length; i++) {
            const rootPath = rootDirs[i].path;

            const filePath = file.substring(0, file.lastIndexOf('/'));
            if (filePath.indexOf(rootPath) !== -1) {
                const projectName = rootPath.substring(
                    rootPath.lastIndexOf('/') + 1
                );
                return { directory: rootPath, name: projectName };
            }
        }
    }
    return { directory: UNTITLED, name: NO_PROJ_NAME };
};

kpmMgr.getFirstProjectDirectory = () => {
    if (
        atom.workspace.project &&
        atom.workspace.project.rootDirectories[0] &&
        atom.workspace.project.rootDirectories[0].path
    ) {
        return atom.workspace.project.rootDirectories[0].path;
    }
    return '';
};

// get project directory
kpmMgr.getProjectDirectory = () => {
    if (
        keystrokeMgr &&
        keystrokeMgr.keystrokeCount &&
        keystrokeMgr.keystrokeCount.project
    ) {
        return keystrokeMgr.keystrokeCount.project.directory;
    }

    return kpmMgr.getFirstProjectDirectory();
};

kpmMgr.getProjectNameAndDirectory = () => {
    const rootPath = kpmMgr.getProjectDirectory();
    if (!rootPath) {
        return { directory: UNTITLED, name: NO_PROJ_NAME };
    }
    // Keystroke Manager keeps the keystroke count and project class.
    // We'll load the project name and directory into the project class
    // using the keystroke manager constructor
    const lastSlashIdx = rootPath ? rootPath.lastIndexOf('/') : -1;
    const projectName =
        lastSlashIdx !== -1
            ? rootPath.substring(rootPath.lastIndexOf('/') + 1)
            : rootPath;
    return { directory: rootPath, name: projectName };
};

// initialize the keystroke manager
kpmMgr.initializeKeystrokeMgr = fileName => {
    if (keystrokeMgr && keystrokeMgr.hasDirectory()) {
        return;
    }

    const projectNameAndDir = kpmMgr.getDirectoryAndNameForFile(fileName);

    if (!keystrokeMgr) {
        // create it
        createNewKeystrokeManager(
            projectNameAndDir.name,
            projectNameAndDir.directory
        );
    } else if (!keystrokeMgr.hasDirectory()) {
        // update it
        keystrokeMgr.updateProjectInfo(
            projectNameAndDir.name,
            projectNameAndDir.directory
        );
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
    if (data.project && !data.project.resource.identifier) {
        const resourceInfo = await gitUtil.getResourceInfo(
            data.project.directory
        );

        if (resourceInfo && resourceInfo.identifier) {
            data.project.resource = resourceInfo;
            data.project.identifier = resourceInfo.identifier;
        }
    }

    const nowTimes = timeUtil.getNowTimes();

    // set the cumulative_editor_seconds for this file
    const timeDataSummary: TimeData = await getTodayTimeDataSummary(
        data.project
    );

    const editorSeconds = timeDataSummary
        ? timeDataSummary.editor_seconds || 60
        : 60;

    data.end = nowTimes.now_in_sec;
    data.local_end = nowTimes.local_now_in_sec;
    Object.keys(data.source).forEach(key => {
        // ensure there is an end time
        const end = parseInt(data.source[key]['end'], 10) || 0;
        if (end === 0) {
            // set the end time for this file event
            let nowTimes = timeUtil.getNowTimes();
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

    console.log(`Code Time: storing kpm data: ${JSON.stringify(payload)}`);
    eventMgr.storePayload(payload);
};

/*
 * Observing the active text editor will allow us to monitor
 * opening and closing of a file, and the keystroke changes of the
 * file
 **/
kpmMgr.activeTextEditorHandler = () => {
    const dashboardFile = utilMgr.getDashboardFile();
    atom.workspace.observeTextEditors(editor => {
        if (!editor || !editor.buffer) {
            return;
        }

        let buffer = editor.buffer;
        let file;
        let lineCount;
        let fileName = buffer.file ? buffer.file.path : 'Untitled';
        kpmMgr.initializeKeystrokeMgr(fileName);
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

            kpmMgr.initializeKeystrokeMgr(fileName);

            keystrokeMgr.updateLineCount(editor, fileName);

            if (keystrokeMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                keystrokeMgr.updateFileInfoData(fileName, grammar, 'syntax');
            }
            keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
        });

        // observe when changes stop
        buffer.onDidStopChanging(e => {
            kpmMgr.initializeKeystrokeMgr(fileName);

            keystrokeMgr.updateLineCount(editor, fileName);
        });

        // observer on every keystroke.
        buffer.onDidChange(async e => {
            if (!utilMgr.isFocused()) {
                return;
            }
            // make sure its initialized
            kpmMgr.initializeKeystrokeMgr(fileName);

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
