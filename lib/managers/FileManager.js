'use babel';

import { NO_PROJ_NAME, UNTITLED } from '../Constants';
const fs = require('fs');
const path = require('path');

const fileMgr = {};

fileMgr.getJsonItem = (file, key) => {
  const data = fileMgr.getFileDataAsJson(file);
  return data ? data[key] : null;
}

fileMgr.setJsonItem = (file, key, value) => {
  let json = fileMgr.getFileDataAsJson(file);
  if (!json) {
    json = {};
  }
  json[key] = value;
  fileMgr.storeJsonData(file, json);
}

fileMgr.getJsonData = (filename) => {
  return fileMgr.getFileDataAsJson(filename);
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

fileMgr.getFileContent = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8').trimEnd();
  } catch (e) {
    console.log(`Unable to read ${getBaseName(filePath)} info: ${e.message}`, true);
  }
  return "";
}

fileMgr.getFileDataAsJson = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trimEnd();
    return JSON.parse(content);
  } catch (e) {
    console.log(`Unable to read ${getBaseName(filePath)} info: ${e.message}`, true);
  }
  return null;
}

/**
 * Single place to write json data (json obj or json array)
 * @param filePath
 * @param json
 */
fileMgr.storeJsonData = (filePath, json) => {
  try {
    const content = JSON.stringify(json);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.log(`Unable to write ${getBaseName(filePath)} info: ${e.message}`, true);
  }
}

function getBaseName(filePath: string) {
  let baseName = filePath;
  try { baseName = path.basename(filePath); } catch (e) {}
  return baseName;
}

module.exports = fileMgr;
