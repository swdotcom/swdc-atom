'use babel';

import Project from '../model/Project';
import { NO_PROJ_NAME, UNTITLED } from '../Constants';

const gitUtil = require('../repo/GitUtil');
const path = require("path");

const projectMgr = {};

// get the directory and project name based on a given file.
projectMgr.getProjectInfo = async (directory = null) => {
  if (!directory) {
    // get the current active project
    return projectMgr.getActiveProject();
  }

  const project = new Project();
  const projectName = path.basename(directory);

  project.name = projectName;
  project.directory = directory;

  if (
    atom.workspace.project &&
    atom.workspace.project.rootDirectories.length
  ) {
    const rootDirs = atom.workspace.project.rootDirectories;
    if (rootDirs && rootDirs.length) {
      for (let i = 0; i < rootDirs.length; i++) {
        const rootPath = rootDirs[i].path;

        if (rootPath === project.directory) {
          const resourceInfo = await gitUtil.getResourceInfo(directory);
          if (resourceInfo && resourceInfo.identifier) {
            project.identifier = resourceInfo.identifier;
            project.resource = resourceInfo;
          }
          break;
        }
      }
    }
  }

  return project;
};

projectMgr.getFirstProjectDirectory = () => {
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
projectMgr.getProjectDirectory = () => {
  return projectMgr.getFirstProjectDirectory();
};

projectMgr.getActiveProject = async () => {
  const rootPath = projectMgr.getProjectDirectory();

  let project = new Project();
  if (!rootPath) {
    project.directory = UNTITLED;
    project.name = NO_PROJ_NAME;
    return project;
  }

  const projectName = path.basename(rootPath);

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

projectMgr.getProjectDirectoryAndName = () => {
  const rootPath = projectMgr.getProjectDirectory();

  if (!rootPath) {
    return { directory: UNTITLED, name: NO_PROJ_NAME };
  }

  const projectName = path.basename(rootPath);

  return { directory: rootPath, name: projectName };
};

module.exports = projectMgr;
