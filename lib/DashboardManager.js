'use babel';

import fileIt from 'file-it';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');
import { launch_url } from './Constants';

const electron = require("electron");
const BrowserWindow = electron.remote.BrowserWindow;

let dashboardMgr = {};

dashboardMgr.launchCodeTimeDashboard = async () => {
  utilMgr.launchUrl(`${launch_url}/dashboard/code_time?view=summary`);
};

dashboardMgr.launchCodeTimeSettings = async () => {
  utilMgr.launchUrl(`${launch_url}/preferences`);
};

module.exports = dashboardMgr;
