'use babel';

import fileIt from 'file-it';

const fileMgr = {};

fileMgr.getJsonData = (filename) => {
  return fileIt.readJsonFileSync(filename);
}

module.exports = fileMgr;
