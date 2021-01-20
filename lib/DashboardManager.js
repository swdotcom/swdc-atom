'use babel';

import fileIt from 'file-it';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');

const electron = require("electron");
const BrowserWindow = electron.remote.BrowserWindow;

let dashboardMgr = {};

dashboardMgr.launchCodeTimeDashboard = async () => {
    // generate the dashboard
    await dashboardMgr.fetchCodeTimeMetricsDashboard();

    // get the CodeTime file
    const file = await utilMgr.getDashboardFile();
    if(file) {
        const url = `file://${file}`;
        const win = new BrowserWindow({ width: 1000, height: 800 })
        win.loadURL(url);
    }
};

dashboardMgr.fetchCodeTimeMetricsDashboard = async () => {
    const dashboardFile = utilMgr.getDashboardFile();

    const api = `/v1/plugin_dashboard`;
    const response = await serviceUtil.softwareGet(
        api,
        utilMgr.getItem('jwt')
    );

    if (serviceUtil.isResponseOk(response)) {
        fileIt.writeContentFileSync(dashboardFile, response.data.html);
    } else {
        console.error("unable to render dashboard", response);
    }
};

module.exports = dashboardMgr;
