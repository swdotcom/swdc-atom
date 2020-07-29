"use babel";

import swdcTracker from "swdc-tracker";
import { api_endpoint } from '../Constants';

const utilMgr = require("../UtilManager");
const gitUtil = require("../repo/GitUtil");
const projectMgr = require("./ProjectManager");
const moment = require("moment-timezone");

const tracker = {};

let trackerReady = false;

tracker.init = async () => {
  jwtParams = getJwtParams();

  // initialize tracker with swdc api host, namespace, and appId
  const result = await swdcTracker.initialize(
    api_endpoint,
    "CodeTime",
    utilMgr.getPluginName()
  );
  if (result.status === 200) {
    trackerReady = true;
  }
};

tracker.trackCodeTimeEvent = async (item) => {
  if (!trackerReady) {
    return;
  }

  // extract the project info from the keystroke stats
  const projectInfo = {
    project_directory: item.project.directory,
    project_name: item.project.name,
  };

  const tzOffsetParams = getTzOffsetParams();

  // loop through the files in the keystroke stats "source"
  const fileKeys = Object.keys(item.source);
  for (let i = 0; i < fileKeys.length; i++) {
    const file = fileKeys[i];
    const fileData: FileChangeInfo = item.source[file];

    // still need to capture "chars_pasted" in KpmManager
    const codetime_entity = {
      keystrokes: fileData.keystrokes,
      chars_added: fileData.add,
      chars_deleted: fileData.delete,
      pastes: fileData.paste,
      lines_added: fileData.linesAdded,
      lines_deleted: fileData.linesRemoved,
      start_time: moment.unix(fileData.start).utc().format(),
      end_time: moment.unix(fileData.end).utc().format(),
      tz_offset_minutes: tzOffsetParams.tz_offset_minutes,
      chars_pasted: 0
    };

    const file_entity = {
      file_name: fileData.name,
      file_path: fileData.fsPath,
      syntax: fileData.syntax,
      line_count: fileData.lines,
      character_count: fileData.length,
    };

    const repoParams = await getRepoParams(item.project.directory);

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
 * {name, location, color (optional), interactionIcon, hideCTAInTracker, label|description|tooltip}
 **/
tracker.trackUIInteraction = async (item) => {
  if (!trackerReady) {
    return;
  }

  const ui_interaction = {
    interaction_type: item.interactionType,
  };

  const cta_text = item.hideCTAInTracker ? "redacted" : item.label || item.description || item.tooltip;

  const ui_element = {
    cta_text,
    element_name: item.name,
    element_location: item.location,
    color: item.color,
    icon_name: item.interactionIcon,
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

tracker.trackEditorAction = async (entity, type, event = {}) => {
  if (!trackerReady) {
    return;
  }

  const projectParams = await getProjectParams();
  const repoParams = await getRepoParams(projectParams.project_directory);
  const fileParams = getFileParams(event, projectParams.project_directory);

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
  let jwt = utilMgr.getJwt();
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

async function getProjectParams() {
  const dirNameInfo = projectMgr.getProjectDirectoryAndName();
  return {
    project_directory: dirNameInfo.directory,
    project_name: dirNameInfo.name
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

function getFileParams(event, projectDirectory) {
  if (!event) {
    return {};
  }

  return {
    file_name: "",
    file_path: "",
    syntax: "",
    line_count: 0,
    character_count: 0,
  };
}

module.exports = tracker;
