"use babel";

import swdcTracker from "swdc-tracker";
import { api_endpoint, UNTITLED, NO_PROJ_NAME } from '../Constants';

const utilMgr = require("../UtilManager");
const gitUtil = require("../repo/GitUtil");
const projectMgr = require("./ProjectManager");
const eventUtil = require("../utils/EventUtil");
const moment = require("moment-timezone");

const tracker = {};

let trackerReady = false;

tracker.init = async () => {
  jwtParams = getJwtParams();

  // initialize tracker with swdc api host, namespace, and appId
  const result = await swdcTracker.initialize(
    api_endpoint,
    "CodeTime",
    "swdc-atom"
  );
  if (result.status === 200) {
    trackerReady = true;
  }
};

tracker.trackCodeTimeEvent = async (event) => {
  if (!trackerReady) {
    return;
  }

  // extract the project info from the keystroke stats
  const projectInfo = {
    project_directory: event.project_directory,
    project_name: event.project_name,
  };

  const tzOffsetParams = getTzOffsetParams();

  // loop through the files in the keystroke stats "source"
  const keys = Object.keys(event.docs_changed);
  for (let i = 0; i < keys.length; i++) {
    const file = keys[i]
    const fileData = event.docs_changed[file];

    const codetime_entity = {
      keystrokes: fileData.keystrokes,
      lines_added: fileData.linesAdded,
      lines_deleted: fileData.linesDeleted,
      characters_added: fileData.charactersAdded,
      characters_deleted: fileData.charactersDeleted,
      single_deletes: fileData.singleDeletes,
      multi_deletes: fileData.multiDeletes,
      single_adds: fileData.singleAdds,
      multi_adds: fileData.multiAdds,
      auto_indents: fileData.autoIndents,
      replacements: fileData.replacements,
      start_time: moment.unix(fileData.start).utc().format(),
      end_time: moment.unix(fileData.end).utc().format()
    };

    const file_entity = {
      file_name: fileData.file_name,
      file_path: fileData.file_path,
      syntax: fileData.syntax,
      line_count: fileData.line_count,
      character_count: fileData.character_count
    };

    const repoParams = await getRepoParams(fileData.project_directory);

    const codetime_event = {
      ...codetime_entity,
      ...file_entity,
      ...projectInfo,
      ...repoParams,
      ...getPluginParams(),
      ...getTzOffsetParams(),
      ...getJwtParams(),
    };

    swdcTracker.trackCodeTimeEvent(codetime_event);
  }
};

/**
 * item should have the following:
 * {element_name, element_location, cta_text, color, icon_name}
 **/
tracker.trackUIInteraction = async (interactionType, uiElement) => {
  if (!trackerReady) {
    return;
  }

  const ui_interaction = {
    interaction_type: interactionType,
  };

  const ui_element = {
    ...uiElement
  };

  const ui_event = {
    ...ui_interaction,
    ...ui_element,
    ...getPluginParams(),
    ...getTzOffsetParams(),
    ...getJwtParams(),
  };

  swdcTracker.trackUIInteraction(ui_event);
};

tracker.trackEditorAction = async (entity, type, editor = null) => {
  if (!trackerReady) {
    return;
  }

  const projectParams = await getProjectParams(entity);
  const repoParams = await getRepoParams(projectParams.project_directory);
  const fileParams = getFileParams(editor);

  const editor_event = {
    entity,
    type,
    ...projectParams,
    ...fileParams,
    ...repoParams,
    ...getPluginParams(),
    ...getTzOffsetParams(),
    ...getJwtParams(),
  };

  // send the event
  swdcTracker.trackEditorAction(editor_event);
};

function getJwtParams() {
  let jwt = utilMgr.getItem("jwt");
  return { jwt: jwt ? jwt.split("JWT ")[1] : null };
}

function getPluginParams() {
  return {
    plugin_id: utilMgr.getPluginId(),
    plugin_name: utilMgr.getPluginName(),
    plugin_version: utilMgr.getVersion()
  }
}

function getTzOffsetParams() {
  return {
    tz_offset_minutes: moment.parseZone(moment().local()).utcOffset()
  }
}

async function getProjectParams(event) {
 if (event.project_directory) {
   return {
     project_directory: event.project_directory,
     project_name: event.name
   };
 }

 return {
   project_directory: UNTITLED,
   project_name: NO_PROJ_NAME
 };
}

async function getRepoParams(directory) {
  const resourceInfo = await gitUtil.getResourceInfo(directory);
  if (!resourceInfo || !resourceInfo.identifier) {
    // return empty data, no need to parse further
    return {
      identifier: "",
      org_name: "",
      repo_name: "",
      repo_identifier: "",
      git_branch: "",
      git_tag: "",
    };
  }

  // retrieve the git identifier info
  const gitIdentifiers = gitUtil.getRepoIdentifierInfo(resourceInfo.identifier);

  return {
    ...gitIdentifiers,
    repo_identifier: resourceInfo.identifier,
    git_branch: resourceInfo.branch,
    git_tag: resourceInfo.tag,
  };
}

function getFileParams(editor) {
  let fileParams = eventUtil.getFileInfo(editor);

  return {
    syntax: fileParams.syntax,
    file_name: fileParams.file_name,
    file_path: fileParams.full_file_name,
    line_count: fileParams.line_count,
    character_count: fileParams.character_count
  }
}

module.exports = tracker;
