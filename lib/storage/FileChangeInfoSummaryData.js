'use babel';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
const fs = require('fs');

const fileChangeInfoSummaryData = {};

fileChangeInfoSummaryData.getFileChangeSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\fileChangeSummary.json';
    } else {
        file += '/fileChangeSummary.json';
    }
    return file;
};

fileChangeInfoSummaryData.clearFileChangeInfoSummaryData = () => {
    fileChangeInfoSummaryData.saveFileChangeInfoToDisk({});
};

// returns a map of file change info
// {fileName => FileChangeInfo, fileName => FileChangeInfo}
fileChangeInfoSummaryData.getFileChangeSummaryAsJson = () => {
    let fileChangeInfoMap = cacheMgr.get('fileChangeSummary');
    if (!fileChangeInfoMap) {
        const file = fileChangeInfoSummaryData.getFileChangeSummaryFile();
        fileChangeInfoMap = utilMgr.getFileDataAsJson(file);
        if (!fileChangeInfoMap) {
            fileChangeInfoMap = {};
        } else {
            cacheMgr.set('fileChangeSummary', fileChangeInfoMap);
        }
    }
    return fileChangeInfoMap;
};

fileChangeInfoSummaryData.saveFileChangeInfoToDisk = fileChangeInfoData => {
    const file = fileChangeInfoSummaryData.getFileChangeSummaryFile();
    if (fileChangeInfoData) {
        try {
            const content = JSON.stringify(fileChangeInfoData, null, 4);
            fs.writeFileSync(file, content, err => {
                if (err)
                    utilMgr.logIt(
                        `Deployer: Error writing session summary data: ${err.message}`
                    );
            });
            // update the cache
            if (fileChangeInfoData) {
                cacheMgr.set('fileChangeSummary', fileChangeInfoData);
            }
        } catch (e) {
            //
        }
    }
};

module.exports = fileChangeInfoSummaryData;
