"use babel";

const fileMgr = require("../managers/FileManager");
import { UNTITLED } from '../Constants';

const eventUtil = {};

eventUtil.getFileInfo = (editor) => {
  const fileInfo = {
    file_name: "",
    file_path: "",
    full_file_name: "",
    syntax: "",
    line_count: 0,
    character_count: 0,
  };

  if (editor && editor.buffer) {
    const buffer = editor.buffer;
    const full_file_name = buffer.file ? buffer.file.path : UNTITLED;
    const { project_name, project_directory, file_name, file_path } = fileMgr.getDirectoryAndNameForFile(full_file_name);

    fileInfo.syntax = editor.getGrammar() ? editor.getGrammar().name : "";
    fileInfo.file_name = file_name;
    fileInfo.file_path = file_path;
    fileInfo.full_file_name = full_file_name;
    fileInfo.line_count = editor.getLineCount();
    fileInfo.character_count = buffer.getLength();
  }

  return fileInfo;
};

module.exports = eventUtil;
