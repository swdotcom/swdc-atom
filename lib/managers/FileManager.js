'use babel';

import fileIt from 'file-it';

const fileMgr = {};

fileMgr.getJsonData = (filename) => {
  return fileIt.readJsonFileSync(filename);
};

fileMgr.storeJsonData = (filename, data) => {
  fileIt.writeJsonFileSync(filename, data);
};

fileMgr.getLastSavedKeystrokesStats = (fileName) => {
    return fileIt.findSortedJsonElement(fileName, "start", "desc");
};

module.exports = fileMgr;
