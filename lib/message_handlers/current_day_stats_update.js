'use babel';

const statusMgr = require('../managers/StatusManager');

export async function handleCurrentDayStatsUpdateSocketEvent(data) {
  statusMgr.updateStatusBarWithSummaryData();
}
