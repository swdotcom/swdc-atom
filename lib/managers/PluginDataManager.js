"use babel";

import { clearTimeDataSummary, incrementSessionAndFileSecondsAndFetch } from "./TimeDataManager";
import { NO_PROJ_NAME } from '../Constants';

const TimeCounterStats = require("../model/TimeCounterStats");
const KeystrokeAggregate = require("../model/KeystrokeAggregate");
const wallClockMgr = require("./WallClockManager");
const projectMgr = require('./ProjectManager');
const tracker = require("./TrackerManager");
const fileMgr = require("./FileManager");
const utilMgr = require("../UtilManager");
const timeUtil = require("../utils/TimeUtil");
const gitUtil = require("../repo/GitUtil");
const execUtil = require('../utils/ExecUtil');
const fileDataMgr = require("../storage/FileDataManager");
const sessionSummaryMgr = require('./SessionSummaryManager');
const fileChangeInfoSummaryDataMgr = require("../storage/FileChangeInfoSummaryDataManager");
const sessionAppMgr = require('./SessionAppManager');

const path = require("path");
const moment = require("moment-timezone");

const pluginDataMgr = {};

let stats = null;

const FIFTEEN_MIN_IN_SECONDS = 60 * 15;
const TWO_MIN_INTERVAL = 1000 * 60 * 2;

pluginDataMgr.initializePluginDataMgr = () => {
  fetchTimeCounterStats();

  // set this window as focused
  const nowTimes = timeUtil.getNowTimes();
  stats.last_focused_timestamp_utc = nowTimes.now_in_sec;
  updateFileData();

  // initialize the midnight checker
  dayCheckTimer = setInterval(() => {
    midnightCheckHandler();
  }, TWO_MIN_INTERVAL);

  // run it once
  midnightCheckHandler();
};

pluginDataMgr.editorFocusHandler = () => {
  fetchTimeCounterStats();

  const now = moment.utc().unix();

  // step 1: replace last_focused_timestamp_utc with current time (utc)
  stats.last_focused_timestamp_utc = now;

  // step 2: update elapsed_code_time_seconds
  const unfocused_diff = utilMgr.coalesceNumber(now - stats.last_unfocused_timestamp_utc);
  const diff = Math.max(unfocused_diff, 0);
  if (diff <= FIFTEEN_MIN_IN_SECONDS) {
    stats.elapsed_code_time_seconds += diff;
  }

  // step 3: clear last_unfocused_timestmap_utc
  stats.last_unfocused_timestamp_utc = 0;

  // update the file
  updateFileData();
};

pluginDataMgr.editorUnFocusHandler = () => {
  fetchTimeCounterStats();

  const now = moment.utc().unix();

  // step 1: replace last_unfocused_timestamp_utc with current time (utc)
  stats.last_unfocused_timestamp_utc = now;

  // step 2: update elapsed_code_time_seconds
  const focused_diff = utilMgr.coalesceNumber(now - stats.last_focused_timestamp_utc);
  const diff = Math.max(focused_diff, 0);
  if (diff <= FIFTEEN_MIN_IN_SECONDS) {
    stats.elapsed_code_time_seconds += diff;
  }

  // step 3: clear last_focused_timestamp_utc
  stats.last_focused_timestamp_utc = 0;

  // update the file
  updateFileData();
};

pluginDataMgr.processPayloadHandler = async (payload, sendNow, nowTimes, isUnfocusEvent = false) => {
  // this should take the now_in_sec as the truth since the unfocus
  // will trigger the process payload and can happen under a minute
  const now = Math.min(nowTimes.now_in_sec, payload.start + 60);

  fetchTimeCounterStats();

  // set the payload's end times
  payload.end = now;
  payload.local_end = nowTimes.local_now_in_sec;
  // set the timezone
  payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Step 1) add to the elapsed code time seconds if its less than 15 min
  // set the focused_editor_seconds to the diff
  // get the time from the last time the window was focused and unfocused
  const payload_diff = utilMgr.coalesceNumber(now - stats.last_focused_timestamp_utc);
  const diff = Math.max(payload_diff, 0);
  if (diff <= FIFTEEN_MIN_IN_SECONDS) {
    stats.elapsed_code_time_seconds += diff;
    stats.focused_editor_seconds = diff;
  }

  // Step 2) Replace "last_focused_timestamp_utc" with now
  stats.last_focused_timestamp_utc = now;

  // Step 3) update the elapsed seconds based on the now minus the last payload end time
  const elapsed_seconds_diff = utilMgr.coalesceNumber(now - stats.last_payload_end_utc);
  stats.elapsed_seconds = Math.max(elapsed_seconds_diff, 0);

  // Step 4) Update "elapsed_active_code_time_seconds"
  // get the MIN of elapsed_seconds and focused_editor_seconds
  let min_elapsed_active_code_time_seconds = Math.min(
    stats.elapsed_seconds,
    stats.focused_editor_seconds
  );
  min_elapsed_active_code_time_seconds = utilMgr.coalesceNumber(min_elapsed_active_code_time_seconds);
  // make sure min_elapsed_active_code_time_seconds is not negative
  min_elapsed_active_code_time_seconds = Math.max(min_elapsed_active_code_time_seconds, 0);
  // set the elapsed_active_code_time_seconds to the min of the above only
  // if its greater than zero and less than/equal to 15 minutes
  stats.elapsed_active_code_time_seconds =
    min_elapsed_active_code_time_seconds <= FIFTEEN_MIN_IN_SECONDS
      ? min_elapsed_active_code_time_seconds
      : 0;

  // Step 5) Update "cumulative_code_time_seconds"
  stats.cumulative_code_time_seconds += stats.elapsed_code_time_seconds;
  // Step 6) Update "cumulative_active_code_time_seconds"
  stats.cumulative_active_code_time_seconds += stats.elapsed_active_code_time_seconds;

  // Step 7) Replace "last_payload_end_utc" with now
  stats.last_payload_end_utc = now;

  // PAYLOAD related updates. stats have been merged to payload object by now
  payload.elapsed_code_time_seconds = stats.elapsed_code_time_seconds;
  payload.elapsed_active_code_time_seconds = stats.elapsed_active_code_time_seconds;
  payload.cumulative_code_time_seconds = stats.cumulative_code_time_seconds;
  payload.cumulative_active_code_time_seconds = stats.cumulative_active_code_time_seconds;

  // Final steps after setting the payload above
  // Step 8) Clear "elapsed_code_time_seconds"
  // Step 9) Clear "focused_editor_seconds"
  stats.focused_editor_seconds = 0;
  stats.elapsed_code_time_seconds = 0;

  // FINAL: update the file with the updated stats
  updateFileData();

  // populate the project info (dir, name, repo identifier)
  payload.project = await projectMgr.getProjectInfo();

  await populateRepoMetrics(payload);

  // make sure all files have an end time
  await completeFileEndTimes(payload, nowTimes);

  // Get time between payloads
  const { sessionSeconds } = utilMgr.getTimeBetweenLastPayload();
  await updateCumulativeSessionTime(payload, sessionSeconds);

  // update the aggregation data for the tree info
  aggregateFileMetrics(payload, sessionSeconds);

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

//// private functions

function updateFileData() {
  if (stats) {
    // store the file data
    fileMgr.storeJsonData(utilMgr.getTimeCounterFile(), stats)
  }
}

function fetchTimeCounterStats() {
  const timeCounterJson = fileMgr.getJsonData(utilMgr.getTimeCounterFile());
  if (timeCounterJson) {
    stats = {
      ...timeCounterJson
    };
  } else {
    stats = new TimeCounterStats();
  }
}

function clearStats() {
  fetchTimeCounterStats();

  const nowTimes = timeUtil.getNowTimes();
  // reset stats
  stats.cumulative_code_time_seconds = 0;
  stats.cumulative_active_code_time_seconds = 0;
  stats.elapsed_code_time_seconds = 0;
  stats.focused_editor_seconds = 0;
  // set the current day
  stats.current_day = nowTimes.day;
  // update the file with the updated stats
  updateFileData();
}

async function completeFileEndTimes(payload, nowTimes) {
  const keys = Object.keys(payload.source);
  // go through each file and make sure the end time is set
  if (keys && keys.length) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const fileInfo: FileChangeInfo = payload.source[key];
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

async function updateCumulativeSessionTime(payload, sessionSeconds) {
  // increment the projects session and file seconds
  // This will find a time data object based on the current day
  let td = await incrementSessionAndFileSecondsAndFetch(
    payload.project,
    sessionSeconds
  );

  // default error to empty
  payload.project_null_error = "";

  // get the latest payload (in-memory or on file)
  let lastPayload = await fileMgr.getLastSavedKeystrokesStats(utilMgr.getSoftwareDataStoreFile());

  // check to see if we're in a new day
  if (utilMgr.isNewDay()) {
    lastPayload = null;
    if (td) {
      // don't rely on the previous TimeData
      td = null;
      payload.project_null_error = `TimeData should be null as its a new day`;
    }
    await midnightCheckHandler();
  }

  // set the workspace name
  payload.workspace_name = utilMgr.getWorkspaceName();
  payload.hostname = await execUtil.getHostname();

  // set the project null error if we're unable to find the time project metrics for this payload
  if (!td) {
    // We don't have a TimeData value, use the last recorded kpm data
    payload.project_null_error = `No TimeData for: ${payload.project.directory}`;
  }

  // get the editor seconds
  let cumulative_editor_seconds = 60;
  let cumulative_session_seconds = 60;
  if (td) {
    // We found a TimeData object, use that info
    cumulative_editor_seconds = td.editor_seconds;
    cumulative_session_seconds = td.session_seconds;
  } else if (lastPayload) {
    // use the last saved keystrokestats
    if (lastPayload.cumulative_editor_seconds) {
      cumulative_editor_seconds = lastPayload.cumulative_editor_seconds + 60;
    }
    if (lastPayload.cumulative_session_seconds) {
      cumulative_session_seconds = lastPayload.cumulative_session_seconds + 60;
    }
  }

  // Check if the final cumulative editor seconds is less than the cumulative session seconds
  if (cumulative_editor_seconds < cumulative_session_seconds) {
    // make sure to set it to at least the session seconds
    cumulative_editor_seconds = cumulative_session_seconds;
  }

  // update the cumulative editor seconds
  payload.cumulative_editor_seconds = cumulative_editor_seconds;
  payload.cumulative_session_seconds = cumulative_session_seconds;
}

async function midnightCheckHandler() {
  if (utilMgr.isNewDay()) {

    // clear the time counter stats
    clearStats();

    // clear the session summary data
    fileDataMgr.clearSessionSummaryData();

    // send the offline TimeData payloads
    clearTimeDataSummary();

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

    setTimeout(() => {
      sessionAppMgr.updateSessionSummaryFromServer();
    }, 5000);
  }
}

async function populateRepoMetrics(payload) {
  if (payload.project && payload.project.identifier && payload.project.directory) {
    // REPO contributor count
    const repoContributorInfo = await gitUtil.getRepoContributorInfo(
      payload.project.directory,
      true
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

async function aggregateFileMetrics(payload, sessionSeconds) {
  // get a mapping of the current files
  const fileChangeInfoMap = fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson();
  await updateAggregateInfo(fileChangeInfoMap, payload, sessionSeconds);

  // write the fileChangeInfoMap
  fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk(fileChangeInfoMap);
}

async function updateAggregateInfo(fileChangeInfoMap, payload, sessionSeconds) {
  const aggregate = new KeystrokeAggregate();
  aggregate.directory = payload.project
    ? payload.project.directory || NO_PROJ_NAME
    : NO_PROJ_NAME;
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
    fileInfo.duration_seconds = fileInfo.end - fileInfo.start;

    // update the aggregate info
    aggregate.add += fileInfo.add;
    aggregate.close += fileInfo.close;
    aggregate.delete += fileInfo.delete;
    aggregate.keystrokes += fileInfo.keystrokes;
    aggregate.linesAdded += fileInfo.linesAdded;
    aggregate.linesRemoved += fileInfo.linesRemoved;
    aggregate.open += fileInfo.open;
    aggregate.paste += fileInfo.paste;
    aggregate.charsPasted += fileInfo.charsPasted;

    const existingFileInfo = fileChangeInfoMap[key];
    if (!existingFileInfo) {
      fileInfo.update_count = 1;
      fileInfo.kpm = aggregate.keystrokes;
      fileChangeInfoMap[key] = fileInfo;
    } else {
      // aggregate
      existingFileInfo.update_count += 1;
      existingFileInfo.keystrokes += fileInfo.keystrokes;
      existingFileInfo.kpm = existingFileInfo.keystrokes / existingFileInfo.update_count;
      existingFileInfo.add += fileInfo.add;
      existingFileInfo.close += fileInfo.close;
      existingFileInfo.delete += fileInfo.delete;
      existingFileInfo.keystrokes += fileInfo.keystrokes;
      existingFileInfo.linesAdded += fileInfo.linesAdded;
      existingFileInfo.linesRemoved += fileInfo.linesRemoved;
      existingFileInfo.open += fileInfo.open;
      existingFileInfo.paste += fileInfo.paste;
      existingFileInfo.duration_seconds += fileInfo.duration_seconds;

      // non aggregates, just set
      existingFileInfo.lines = fileInfo.lines;
      existingFileInfo.length = fileInfo.length;
    }
  });

  // this will increment and store it offline
  await sessionSummaryMgr.incrementSessionSummaryData(aggregate, sessionSeconds);
};

module.exports = pluginDataMgr;
