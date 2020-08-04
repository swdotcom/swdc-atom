'use babel';

import fileIt from 'file-it';
import { NO_PROJ_NAME, UNTITLED } from '../Constants';
const path = require("path");

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

/**
 * returns
 * {project_directory, name, file_name, file_path}
 **/
fileMgr.getDirectoryAndNameForFile = (file) => {
  const dirInfo = {
    project_directory: UNTITLED,
    project_name: NO_PROJ_NAME,
    file_name: file,
    file_path: file ? path.dirname(file) : "",
    full_file_name: file
  };

  if (
      file &&
      atom.workspace.project &&
      atom.workspace.project.rootDirectories.length
  ) {
      const rootDirs = atom.workspace.project.rootDirectories;
      if (rootDirs && rootDirs.length) {
        for (let i = 0; i < rootDirs.length; i++) {
            const projectDirectory = rootDirs[i].path;
            if (file.indexOf(projectDirectory) !== -1) {
              // found the project directory, return it
              const projectName = path.basename(projectDirectory);
              dirInfo.file_name = file.split(projectDirectory)[1];
              dirInfo.project_name = projectName;
              dirInfo.project_directory = projectDirectory;
              break;
            }
        }
      }
  }

  return dirInfo;
}

module.exports = fileMgr;
