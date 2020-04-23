'use babel';

import KeystrokeManager from '../KeystrokeManager';
import Project from '../model/Project';
import { NO_PROJ_NAME, UNTITLED } from '../Constants';
import { incrementSessionAndFileSecondsAndFetch } from '../managers/TimeDataManager';
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

kpmMgr.getActiveProject = async () => {
    const rootPath = kpmMgr.getProjectDirectory();

    let project = new Project();
    if (!rootPath) {
        project.directory = UNTITLED;
        project.name = NO_PROJ_NAME;
        return project;
    }
    // Keystroke Manager keeps the keystroke count and project class.
    // We'll load the project name and directory into the project class
    // using the keystroke manager constructor
    const lastSlashIdx = rootPath ? rootPath.lastIndexOf('/') : -1;
    const projectName =
        lastSlashIdx !== -1
            ? rootPath.substring(rootPath.lastIndexOf('/') + 1)
            : rootPath;

    project.name = projectName;
    project.directory = rootPath;

    // set the project identifier info
    const resourceInfo = await gitUtil.getResourceInfo(rootPath);
    if (resourceInfo && resourceInfo.identifier) {
        project.identifier = resourceInfo.identifier;
        project.resource = resourceInfo;
    }

    return project;
};

// initialize the keystroke manager
kpmMgr.initializeKeystrokeMgr = async fileName => {
    if (keystrokeMgr && keystrokeMgr.hasDirectory()) {
        return;
    }

    const projectNameAndDir = kpmMgr.getDirectoryAndNameForFile(fileName);

    if (!keystrokeMgr) {
        // create it
        await createNewKeystrokeManager(
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
async function createNewKeystrokeManager(name, dir) {
    keystrokeMgr = new KeystrokeManager(name, dir);

    setTimeout(() => {
        kpmMgr.sendKeystrokeData();
    }, 1000 * 60);
}

kpmMgr.sendBootstrapKpmPayload = () => {
    let rootPath = NO_PROJ_NAME;
    let fileName = UNTITLED;
    let name = NO_PROJ_NAME;

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
        await utilMgr.updateLatestPayloadLazily(null);
        return;
    }

    // get the keystroke count payload
    let payload = keystrokeMgr.keystrokeCount;
    payload = JSON.parse(JSON.stringify(payload));

    // reset the keystroke mgr
    keystrokeMgr = null;
    await utilMgr.updateLatestPayloadLazily(null);

    // set the project
    payload.project = await kpmMgr.getActiveProject();
    // get the now times
    const nowTimes = timeUtil.getNowTimes();

    const {
        sessionMinutes,
        elapsedSeconds,
    } = utilMgr.getTimeBetweenLastPayload();

    // update the cumulative payload
    await kpmMgr.validateAndUpdateCumulativeData(payload, sessionMinutes);

    // set the elapsed seconds (last end time to this end time)
    payload.elapsed_seconds = elapsedSeconds;

    // update the local end and cumulative seconds
    payload.end = nowTimes.now_in_sec;
    payload.local_end = nowTimes.local_now_in_sec;
    Object.keys(payload.source).forEach(key => {
        // ensure there is an end time
        const end = parseInt(payload.source[key]['end'], 10) || 0;
        if (end === 0) {
            // set the end time for this file event
            let nowTimes = timeUtil.getNowTimes();
            payload.source[key]['end'] = nowTimes.now_in_sec;
            payload.source[key]['local_end'] = nowTimes.local_now_in_sec;
        }
    });

    // make sure the payload sum value goes out as a string
    payload.keystrokes = String(payload.keystrokes);
    payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // turn payload into a string value
    payload.keystrokes = String(payload.keystrokes);

    console.log(`Code Time: storing kpm payload: ${JSON.stringify(payload)}`);
    eventMgr.storePayload(payload, sessionMinutes);

    // Update the latestPayloadTimestampEndUtc. It's used to determine session time
    utilMgr.setItem('latestPayloadTimestampEndUtc', nowTimes.now_in_sec);
};

/**
 * This will update the cumulative editor and session seconds.
 * It will also provide any error details if any are encountered.
 * @param payload
 * @param sessionMinutes
 */
kpmMgr.validateAndUpdateCumulativeData = async (payload, sessionMinutes) => {
    // increment the projects session and file seconds
    let td = await incrementSessionAndFileSecondsAndFetch(
        payload.project,
        sessionMinutes
    );

    // default error to empty
    payload.project_null_error = '';

    // get the current payloads so we can compare our last cumulative seconds.
    let lastPayload = await payloadMgr.getLastSavedKeystrokeStats();

    // check to see if we're in a new day
    if (utilMgr.isNewDay()) {
        lastPayload = null;
        await dashboardMgr.newDayChecker();
        if (td) {
            // don't rely on the previous TimeData
            td = null;
            payload.project_null_error = `TimeData should be null as its a new day`;
        }
    }

    // set the workspace name
    payload.workspace_name = utilMgr.getWorkspaceName();

    // set the project null error if we're unable to find the time project metrics for this payload
    if (!td) {
        // We don't have a TimeData value, use the last recorded kpm data
        payload.project_null_error = `No TimeData for: ${payload.project.directory}`;
    }

    // get the editor seconds
    let cumulative_editor_seconds = 60;
    let cumulative_session_seconds = 60;
    if (td) {
        // We found a TimeData object, use that info
        cumulative_editor_seconds = td.editor_seconds;
        cumulative_session_seconds = td.session_seconds;
    } else if (lastPayload) {
        // use the last saved keystrokestats
        if (lastPayload.cumulative_editor_seconds) {
            cumulative_editor_seconds =
                lastPayload.cumulative_editor_seconds + 60;
        }
        if (lastPayload.cumulative_session_seconds) {
            cumulative_session_seconds =
                lastPayload.cumulative_session_seconds + 60;
        }
    }

    // Check if the final cumulative editor seconds is
    // less than the cumulative session seconds
    if (cumulative_editor_seconds < cumulative_session_seconds) {
        // make sure to set it to at least the session seconds
        cumulative_editor_seconds = cumulative_session_seconds;
    }

    // update the cumulative editor seconds
    payload.cumulative_editor_seconds = cumulative_editor_seconds;
    payload.cumulative_session_seconds = cumulative_session_seconds;
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

        let buffer = editor.buffer;
        let file;
        let lineCount;
        let fileName = buffer.file ? buffer.file.path : 'Untitled';
        await kpmMgr.initializeKeystrokeMgr(fileName);
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

        buffer.onDidDestroy(async e => {
            if (!utilMgr.isFocused()) {
                return;
            }
            if (fileName === dashboardFile) {
                utilMgr.updateDashboardFileVisibility(false);
            }

            await kpmMgr.initializeKeystrokeMgr(fileName);

            keystrokeMgr.updateLineCount(editor, fileName);

            if (keystrokeMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                keystrokeMgr.updateFileInfoData(fileName, grammar, 'syntax');
            }
            keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
        });

        // observe when changes stop
        buffer.onDidStopChanging(async e => {
            await kpmMgr.initializeKeystrokeMgr(fileName);

            keystrokeMgr.updateLineCount(editor, fileName);
        });
        // observer on every keystroke.
        buffer.onDidChange(async e => {
            if (!utilMgr.isFocused()) {
                return;
            }
            // make sure its initialized
            await kpmMgr.initializeKeystrokeMgr(fileName);
            let changes = e && e.changes[0] ? e.changes[0] : null;
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

            if (diff > 8) {
                // it's a copy and paste Event
                keystrokeMgr.updateFileInfoData(fileName, 1, 'paste');
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

            if (diff !== 0 || removedLinesDiff !== 0 || addedLinesDiff !== 0) {
                keystrokeMgr.updateFileInfoData(fileName, 1, 'keystrokes');
                // increment the top level data property as well
                keystrokeMgr.incrementKeystrokeCount();
            }
        });
    });
};

module.exports = kpmMgr;
