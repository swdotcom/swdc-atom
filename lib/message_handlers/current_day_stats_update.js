'use babel';

const statusMgr = require('../managers/StatusManager');
const fileDataMgr = require('../storage/FileDataManager');

export async function handleCurrentDayStatsUpdateSocketEvent(currentDayStatsInfo) {
  if (currentDayStatsInfo.data) {
    fileDataMgr.saveSessionSummaryToDisk(currentDayStatsInfo.data);
    statusMgr.updateStatusBarWithSummaryData();
  }
}
