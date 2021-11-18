'use babel';

const utilMgr = require('./UtilManager');
import { app_endpoint } from './Constants';


let dashboardMgr = {};

dashboardMgr.launchCodeTimeDashboard = async () => {
  utilMgr.launchUrl(`${app_endpoint}/dashboard/code_time?view=summary`);
};

dashboardMgr.launchCodeTimeSettings = async () => {
  utilMgr.launchUrl(`${app_endpoint}/preferences`);
};

module.exports = dashboardMgr;
