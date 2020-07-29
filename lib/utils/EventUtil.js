"use babel";

const projectMgr = require("../managers/ProjectManager");
import { NO_PROJ_NAME, UNTITLED } from '../Constants';

const eventUtil = {};

eventUtil.getFileInfo = (editor) => {
  const fileInfo = {
    file_name: "",
    file_path: "",
    syntax: "",
    line_count: 0,
    character_count: 0,
  };

  if (editor && editor.buffer) {
    const buffer = editor.buffer;
    const fileName = buffer.file ? buffer.file.path : UNTITLED;
    const { project_name, project_directory, file_name, file_path } = projectMgr.getDirectoryAndNameForFile(fileName);

    fileInfo.syntax = editor.getGrammar() ? editor.getGrammar().name : "";
    fileInfo.file_name = file_name;
    fileInfo.file_path = file_path;
    fileInfo.line_count = editor.getLineCount();
    fileInfo.character_count = buffer.getLength();
  }

  return fileInfo;
};

module.exports = eventUtil;
