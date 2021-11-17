'use babel';

import Project from './model/Project';

const utilMgr = require('./UtilManager');
const timeUtil = require('./utils/TimeUtil');
const eventUtil = require("./utils/EventUtil");

export default class KeystrokeManager {
    constructor(projectName, projectDirectory) {
        this.keystrokeCount = new KeystrokeCount(projectName, projectDirectory);
    }

    // Returns an object that can be retrieved
    // when package is activated

    serialize() { }

    hasDirectory() {
        if (
            this.keystrokeCount &&
            this.keystrokeCount.project &&
            this.keystrokeCount.project.directory
        ) {
            return true;
        } else {
            return false;
        }
    }

    // Tear down any state and detach.
    destroy() {
        this.keystrokeCount.remove();
    }

    getKeystrokeCount() {
        return this.keystrokeCount;
    }

    incrementKeystrokeCount() {
        this.keystrokeCount.keystrokes += 1;
    }

    getFileInfoByKey(fileName, property) {
        const keystrokeCount = this.keystrokeCount;
        if (!keystrokeCount) {
            return;
        }

        // add it, it's not in the current set
        let fileInfo = this.findFileInfoInSource(
            keystrokeCount.source,
            fileName
        );
        if (!fileInfo) {
            // "add" = additive keystrokes
            // "netkeys" = add - delete
            // "keys" = add + delete
            // "delete" = delete keystrokes
            // initialize and add it
            fileInfo = {
                keystrokes: 0,
                paste: 0,
                charsPasted: 0,
                open: 0,
                close: 0,
                length: 0,
                delete: 0,
                lines: 0,
                add: 0,
                netkeys: 0,
                linesAdded: 0,
                linesRemoved: 0,
                syntax: '',
                documentChangeInfo: {
                    linesAdded: 0,
                    linesDeleted: 0,
                    charactersAdded: 0,
                    charactersDeleted: 0,
                    singleDeletes: 0,
                    multiDeletes: 0,
                    singleAdds: 0,
                    multiAdds: 0,
                    autoIndents: 0,
                    replacements: 0
                }
            };
            keystrokeCount.source[fileName] = fileInfo;
        }
        return fileInfo[property];
    }

    updateProjectInfo(projectName, projectDirectory) {
        if (this.keystrokeCount && this.keystrokeCount.project) {
            this.keystrokeCount.project.name = projectName;
            this.keystrokeCount.project.directory = projectDirectory;
        }
    }

    updateDocumentChangeInfo(filename, data, propertyToUpdate) {
        this.updateFileInfoData(filename, data, propertyToUpdate, true);
    }

    updateFileInfoData(fileName, data, propertyToUpdate, isDocumentChangeInfo = false) {
        const keystrokeCount = this.keystrokeCount;
        if (!keystrokeCount) {
            return;
        }

        if (keystrokeCount.source) {
            Object.keys(keystrokeCount.source).forEach(key => {
                if (key !== fileName) {
                    // ending a file session that doesn't match the incoming file
                    const end =
                        parseInt(keystrokeCount.source[key]['end'], 10) || 0;
                    if (end === 0) {
                        // set the end time for this file event
                        let nowTimes = timeUtil.getNowTimes();
                        keystrokeCount.source[key]['end'] = nowTimes.now_in_sec;
                        keystrokeCount.source[key]['local_end'] =
                            nowTimes.local_now_in_sec;
                    }
                } else {
                    // they're working on this file again, zero out the end
                    keystrokeCount.source[key]['end'] = 0;
                    keystrokeCount.source[key]['local_end'] = 0;
                }
            });
        }

        // add it, it's not in the current set
        let fileInfo = this.findFileInfoInSource(
            keystrokeCount.source,
            fileName
        );
        if (!fileInfo) {
            const nowTimes = timeUtil.getNowTimes();
            // "add" = additive keystrokes
            // "netkeys" = add - delete
            // "keys" = add + delete
            // "delete" = delete keystrokes
            // initialize and add it
            fileInfo = {
                keystrokes: 0,
                paste: 0,
                charsPasted: 0,
                open: 0,
                close: 0,
                length: 0,
                delete: 0,
                lines: 0,
                add: 0,
                netkeys: 0,
                linesAdded: 0,
                linesRemoved: 0,
                start: nowTimes.now_in_sec,
                local_start: nowTimes.local_now_in_sec,
                syntax: '',
                documentChangeInfo: {
                    linesAdded: 0,
                    linesDeleted: 0,
                    charactersAdded: 0,
                    charactersDeleted: 0,
                    singleDeletes: 0,
                    multiDeletes: 0,
                    singleAdds: 0,
                    multiAdds: 0,
                    autoIndents: 0,
                    replacements: 0
                }
            };
            keystrokeCount.source[fileName] = fileInfo;
        }

        if (isDocumentChangeInfo) {
            fileInfo['documentChangeInfo'][propertyToUpdate] += data;
        } else {
            // update the data for this fileInfo keys count....
            if (propertyToUpdate === 'lines' || propertyToUpdate === 'syntax') {
                fileInfo[propertyToUpdate] = data;
            } else {
                fileInfo[propertyToUpdate] = fileInfo[propertyToUpdate] + data;
            }

            if (
                propertyToUpdate === 'add' ||
                propertyToUpdate === 'delete' ||
                propertyToUpdate === 'paste' ||
                propertyToUpdate === 'linesAdded' ||
                propertyToUpdate === 'linesRemoved'
            ) {
                // update the netkeys and the keys
                // "netkeys" = add - delete
                // "keys" = add + delete
                fileInfo['netkeys'] = fileInfo['add'] - fileInfo['delete'];
                fileInfo['keys'] = fileInfo['add'] + fileInfo['delete'];
            }
        }
    }

    reset() {
        this.keystrokeCount.reset();
    }

    /**
     * check if the payload should be sent or not
     */
    hasData() {
        const keys = this.keystrokeCount
            ? Object.keys(this.keystrokeCount.source)
            : null;
        if (!keys || keys.length === 0) {
            return false;
        }

        // delete files that don't have any kpm data
        let foundKpmData = false;
        if (this.keystrokeCount.keystrokes > 0) {
            foundKpmData = true;
        }

        // Now remove files that don't have any keystrokes that only
        // have an open or close associated with them. If they have
        // open AND close then it's ok, keep it.
        let keystrokesTally = 0;
        keys.forEach(key => {
            const data = this.keystrokeCount.source[key];

            const hasOpen = data.open > 0;
            const hasClose = data.close > 0;
            const hasKeystrokes = data.keystrokes > 0;
            keystrokesTally += data.keystrokes;
            if (
                (hasOpen && !hasClose && !hasKeystrokes) ||
                (hasClose && !hasOpen && !hasKeystrokes)
            ) {
                // delete it, no keystrokes and only an open
                delete this.keystrokeCount.source[key];
            } else if (!foundKpmData && hasOpen && hasClose) {
                foundKpmData = true;
            }
        });

        if (
            keystrokesTally > 0 &&
            keystrokesTally !== this.keystrokeCount.keystrokes
        ) {
            // use the keystrokes tally
            foundKpmData = true;
            this.keystrokeCount.keystrokes = keystrokesTally;
        }
        return foundKpmData;
    }

    /**
     * Find source objects matching the fileName
     **/
    findFileInfoInSource(source, filenameToMatch) {
        if (
            source[filenameToMatch] !== undefined &&
            source[filenameToMatch] !== null
        ) {
            return source[filenameToMatch];
        }
        return null;
    }

    updateLineCount(editor, fileName) {
        const fileInfo = eventUtil.getFileInfo(editor);

        // update the line count.
        this.updateFileInfoData(fileName, fileInfo.line_count, 'lines');

        if (this.getFileInfoByKey(fileName, 'syntax') === '') {
            this.updateFileInfoData(fileName, fileInfo.syntax, 'syntax');
        }

        // update the length attribute
        if (!this.getFileInfoByKey(fileName, 'length')) {
            this.updateFileInfoData(
                fileName,
                fileInfo.character_count,
                'length'
            );
        }
    }
}

export class KeystrokeCount {
    constructor(projectName, projectDirectory) {
        this.reset();
        this.project = new Project();
        this.project.name = projectName;
        this.project.directory = projectDirectory;
    }

    /**
     * The reset ensures every variable has a defined non-null value
     **/
    reset() {
        let d = new Date();
        d = new Date(d.getTime() - 1000 * 60);
        let offset_sec = d.getTimezoneOffset() * 60;
        // sublime = 1, vscode = 2, eclipse = 3, intelliJ = 4,
        // visual studio = 6, atom = 7
        this.pluginId = utilMgr.getPluginId();
        // the value that goes with this object, which is a Number
        // but kept as a String
        this.keystrokes = 0;
        // unique set of file names
        this.source = {};
        // start time in seconds
        this.start = Math.round(Date.now() / 1000);
        // end time in seconds
        this.local_start = this.start - offset_sec;
        // setting a default, but this will be set within the constructor
        this.version = utilMgr.getVersion();
        this.os = utilMgr.getOs();
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.project = new Project();
        this.elapsed_seconds = 0;
        this.workspace_name = '';
    }
}
