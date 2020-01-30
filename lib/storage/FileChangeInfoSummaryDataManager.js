'use babel';

const utilMgr = require('../UtilManager');
const cacheMgr = require('../cache/CacheManager');
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
    let fileChangeInfoMap = cacheMgr.get('fileChangeSummary');
    if (!fileChangeInfoMap) {
        const file = fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile();
        fileChangeInfoMap = utilMgr.getFileDataAsJson(file);
        if (!fileChangeInfoMap) {
            fileChangeInfoMap = {};
        } else {
            cacheMgr.set('fileChangeSummary', fileChangeInfoMap);
        }
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

module.exports = fileChangeInfoSummaryDataMgr;
