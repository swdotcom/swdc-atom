"use babel";

const wallClockMgr = require("./WallClockManager");
const projectMgr = require('./ProjectManager');
const tracker = require("./TrackerManager");
const utilMgr = require("../UtilManager");
const timeUtil = require("../utils/TimeUtil");
const gitUtil = require("../repo/GitUtil");
const fileDataMgr = require("../storage/FileDataManager");
const fileChangeInfoSummaryDataMgr = require("../storage/FileChangeInfoSummaryDataManager");

const path = require("path");

const pluginDataMgr = {};

const TWO_MIN_INTERVAL = 1000 * 60 * 2;

pluginDataMgr.initializePluginDataMgr = () => {

  // initialize the midnight checker
  dayCheckTimer = setInterval(() => {
    midnightCheckHandler();
  }, TWO_MIN_INTERVAL);

  // run it once
  midnightCheckHandler();
};

pluginDataMgr.editorFocusHandler = () => {
};

pluginDataMgr.editorUnFocusHandler = () => {

};

pluginDataMgr.processPayloadHandler = async (payload, sendNow, nowTimes, isUnfocusEvent = false) => {
  // this should take the now_in_sec as the truth since the unfocus
  // will trigger the process payload and can happen under a minute
  const now = Math.min(nowTimes.now_in_sec, payload.start + 60);

  // set the payload's end times
  payload.end = now;
  payload.local_end = nowTimes.local_now_in_sec;
  // set the timezone
  payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // populate the project info (dir, name, repo identifier)
  payload.project = await projectMgr.getProjectInfo();

  Object.keys(payload.source).forEach((key) => {
    const fileInfo = payload.source[key];
    /**
     * update the project info
     * project has {directory, name}
     */
    const baseName = path.basename(key);
    fileInfo.name = baseName;
    fileInfo.fsPath = key;
    fileInfo.projectDir = payload.project.directory;
  });

  await populateRepoMetrics(payload);

  // make sure all files have an end time
  await completeFileEndTimes(payload, nowTimes);

  payload.workspace_name = utilMgr.getWorkspaceName();

  // Update the latestPayloadTimestampEndUtc. It's used to determine session time and elapsed_seconds
  const latestPayloadTimestampEndUtc = timeUtil.getNowTimes().now_in_sec;
  utilMgr.setItem("latestPayloadTimestampEndUtc", latestPayloadTimestampEndUtc);

  // update the status and tree
  wallClockMgr.dispatchStatusViewUpdate();

  // Set the unfocused timestamp only if the isUnfocus flag is true.
  // When the user is typing more than a minute or if this is the bootstrap
  // payload, the "isUnfocus" will not be set to true
  if (!isUnfocusEvent) {
    pluginDataMgr.editorUnFocusHandler();
  }

  // send the payload to the tracker manager
  tracker.trackCodeTimeEvent(payload);
};


async function completeFileEndTimes(payload, nowTimes) {
  const keys = Object.keys(payload.source);
  // go through each file and make sure the end time is set
  if (keys && keys.length) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const fileInfo = payload.source[key];
      // ensure there is an end time
      if (!fileInfo.end) {
        fileInfo.end = nowTimes.now_in_sec;
        fileInfo.local_end = nowTimes.local_now_in_sec;
      }

      // only get the contributor info if we have a repo identifier
      if (payload.project && payload.project.identifier) {
        // set the contributor count per file
        const repoFileContributorCount = await gitUtil.getFileContributorCount(key);
        fileInfo.repoFileContributorCount = repoFileContributorCount || 0;
      }
      payload.source[key] = fileInfo;
    }
  }
}

async function midnightCheckHandler() {
  if (utilMgr.isNewDay()) {

    // clear the session summary data
    fileDataMgr.clearSessionSummaryData();

    fileChangeInfoSummaryDataMgr.clearFileChangeInfoSummaryData();

    // set the current day
    const nowTime = timeUtil.getNowTimes();

    // update the current day
    utilMgr.setItem('currentDay', nowTime.day);

    // refresh everything
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );
  }
}

async function populateRepoMetrics(payload) {
  if (payload.project && payload.project.identifier && payload.project.directory) {
    // REPO contributor count
    const repoContributorInfo = await gitUtil.getRepoContributorInfo(
      payload.project.directory
    );
    payload.repoContributorCount = repoContributorInfo ? repoContributorInfo.count || 0 : 0;

    // REPO file count
    const repoFileCount = await gitUtil.getRepoFileCount(payload.project.directory);
    payload.repoFileCount = repoFileCount || 0;
  } else {
    payload.repoContributorCount = 0;
    payload.repoFileCount = 0;
  }
}

module.exports = pluginDataMgr;
