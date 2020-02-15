'use babel';

const utilMgr = require('../UtilManager');
const fs = require('fs');

const fileChangeInfoSummaryDataMgr = {};

fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\fileChangeSummary.json';
    } else {
        file += '/fileChangeSummary.json';
    }
    return file;
};

fileChangeInfoSummaryDataMgr.clearFileChangeInfoSummaryData = () => {
    fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk({});
};

// returns a map of file change info
// {fileName => FileChangeInfo, fileName => FileChangeInfo}
fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson = () => {
    const file = fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile();
    let fileChangeInfoMap = utilMgr.getFileDataAsJson(file);
    if (!fileChangeInfoMap) {
        fileChangeInfoMap = {};
    }
    return fileChangeInfoMap;
};

fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk = fileChangeInfoData => {
    const file = fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile();
    if (fileChangeInfoData) {
        try {
            const content = JSON.stringify(fileChangeInfoData, null, 4);
            fs.writeFileSync(file, content, err => {
                if (err)
                    utilMgr.logIt(
                        `Code time: Error writing file change data: ${err.message}`
                    );
            });
        } catch (e) {
            utilMgr.logIt(
                `Code time: Error writing file change data: ${e.message}`
            );
        }
    }
};

module.exports = fileChangeInfoSummaryDataMgr;
