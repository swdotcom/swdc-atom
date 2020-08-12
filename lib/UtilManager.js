'use babel';

import KpmStatusView from './KpmStatusView';
import {
    launch_url,
    api_endpoint,
    CODE_TIME_PLUGIN_ID,
    DEFAULT_SESSION_THRESHOLD_SECONDS,
    CODE_TIME_EXT_ID,
    CODE_TIME_TYPE
} from './Constants';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';
import fileIt from 'file-it';

const cacheMgr = require("./cache/CacheManager");
const crypto = require('crypto');
const os = require('os');
const cp = require('child_process');
const timeUtil = require('./utils/TimeUtil');

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const SHOW_GIT_METRICS_CONFIG_KEY = 'code-time:showGitMetrics';
const SHOW_RANKING_METRICS_CONFIG_KEY = 'code-time:showWeeklyRanking';

const WEB_DASHBOARD_COMMAND_KEY = 'Code-Time:web-dashboard';
const WEB_DASHBOARD_MENU_LABEL = 'Web dashboard';

const MILLIS_PER_HOUR = 1000 * 60 * 60;

const DASHBOARD_LABEL_WIDTH = 25;
const DASHBOARD_VALUE_WIDTH = 25;
const MARKER_WIDTH = 4;

const NUMBER_IN_EMAIL_REGEX = new RegExp('^\\d+\\+');

let telemetryOn = true;
let statusView = new KpmStatusView();

let editorSessiontoken = null;
let whoami = null;
let extensionName = null;
let latestPayload = null;
let workspace_name = null;
let codeTimeMenu = [];
let codeTimeSubmenu = [];
let jwt = null;

utilMgr.getWorkspaceName = () => {
    if (!workspace_name) {
        workspace_name = utilMgr.randomCode();
    }
    return workspace_name;
};

/**
 * Return true if it's a new day
 **/
utilMgr.isNewDay = () => {
    const { day } = timeUtil.getNowTimes();
    const currentDay = utilMgr.getItem('currentDay');
    return currentDay !== day ? true : false;
};

utilMgr.getEditorSessionToken = () => {
    if (!editorSessiontoken) {
        editorSessiontoken = utilMgr.randomCode();
    }
    return editorSessiontoken;
};

utilMgr.getProjectName = (path) => {
    if (!path || path.indexOf('/') === -1) {
        return 'Unnamed';
    }
    return path.substring(path.lastIndexOf('/') + 1);
};

utilMgr.getVersion = () => {
    return atom.packages.getLoadedPackage('code-time').metadata.version;
};

utilMgr.getFileType = (fileName) => {
  let fileType = "";
  const lastDotIdx = fileName.lastIndexOf(".");
  const len = fileName.length;
  if (lastDotIdx !== -1 && lastDotIdx < len - 1) {
    fileType = fileName.substring(lastDotIdx + 1);
  }
  return fileType;
};

utilMgr.getOs = () => {
    let parts = [];
    let osType = os.type();
    if (osType) {
        parts.push(osType);
    }
    let osRelease = os.release();
    if (osRelease) {
        parts.push(osRelease);
    }
    let platform = os.platform();
    if (platform) {
        parts.push(platform);
    }
    if (parts.length > 0) {
        return parts.join('_');
    }
    return '';
};

utilMgr.nowInSecs = () => {
    let d = new Date();
    return Math.round(d.getTime() / 1000);
};

utilMgr.geGitConfigKey = () => {
    return SHOW_GIT_METRICS_CONFIG_KEY;
};

utilMgr.getRankingConfigKey = () => {
    return SHOW_RANKING_METRICS_CONFIG_KEY;
};

utilMgr.getPluginId = () => {
    return CODE_TIME_PLUGIN_ID;
};

utilMgr.getStatusView = () => {
    return statusView;
};

utilMgr.getOpenProjects = () => {
    let openProjectNames = [];
    if (atom.project && atom.project.getPaths()) {
        openProjectNames = atom.project.getPaths();
    }
    return openProjectNames;
};

utilMgr.showErrorStatus = async () => {
    // utilMgr.getStatusView().display('Code Time');
};

utilMgr.showDeactivatedErrorStatus = async () => {
    // utilMgr
    //     .getStatusView()
    //     .display(
    //         'Code Time',
    //         'alert',
    //         'To see your coding data in Code Time, please reactivate your account.'
    //     );
};

utilMgr.isTelemetryOn = () => {
    return telemetryOn;
};

utilMgr.randomCode = () => {
    return crypto
        .randomBytes(16)
        .map((value) =>
            alpha.charCodeAt(Math.floor((value * alpha.length) / 256))
        )
        .toString();
};

utilMgr.getTelemetryStatus = () => {
    return telemetryOn;
};

utilMgr.updateTelemetryOn = (isOn) => {
    telemetryOn = isOn;
};

utilMgr.getMillisPerHour = () => {
    return MILLIS_PER_HOUR;
};

utilMgr.getSessionFileCreateTime = () => {
    let sessionFile = utilMgr.getSoftwareSessionFile();
    const stat = fs.statSync(sessionFile);
    if (stat.birthtime) {
        return stat.birthtime;
    }
    return stat.ctime;
};

utilMgr.isLinux = () => {
    if (!utilMgr.isWindows() && !utilMgr.isMac()) {
        return true;
    }
    return false;
};

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
utilMgr.isWindows = () => {
    return process.platform.indexOf('win32') !== -1;
};

utilMgr.isMac = () => {
    return process.platform.indexOf('darwin') !== -1;
};

utilMgr.setItem = (key, value) => {
  fileIt.setJsonValue(utilMgr.getSoftwareSessionFile(), key, value);
};

utilMgr.getItem = (key) => {
  return fileIt.getJsonValue(utilMgr.getSoftwareSessionFile(), key);
};

/**
 * Store the json data to session.json
 **/
function writeSessionJson(jsonObj) {
  fileIt.writeJsonFileSync(utilMgr.getSoftwareSessionFile(), jsonObj);
}

utilMgr.getSoftwareSessionAsJson = () => {
    return fileIt.readJsonFileSync(utilMgr.getSoftwareSessionFile());
};

utilMgr.jwtExists = () => {
    let jwt = utilMgr.getItem('jwt');
    return !jwt ? false : true;
};

utilMgr.softwareSessionFileExists = () => {
    // don't auto create the file
    const file = utilMgr.getSoftwareSessionFile(false);
    // check if it exists
    return fs.existsSync(file);
};

utilMgr.getTimeCounterFile = () => {
    return utilMgr.getFileName("timeCounter.json");
};

/**
 * Get the .software/session.json path/name
 **/
utilMgr.getSoftwareSessionFile = () => {
    return utilMgr.getFileName("session.json");
};

utilMgr.getSummaryInfoFile = () => {
    return utilMgr.getFileName("SummaryInfo.txt");
};

/**
 * Get the .software directory path/name
 **/
utilMgr.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (utilMgr.isWindows()) {
        softwareDataDir += '\\.software';
    } else {
        softwareDataDir += '/.software';
    }

    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
};

/**
 * Get the .software/data.json path/name
 **/
utilMgr.getSoftwareDataStoreFile = () => {
    return utilMgr.getFileName("data.json");
};

utilMgr.getPluginEventsFile = () => {
    return utilMgr.getFileName("events.json");
};

utilMgr.getDashboardFile = () => {
    return utilMgr.getFileName("CodeTime.txt");
};

utilMgr.getTimeDataSummaryFile = () => {
    return utilMgr.getFileName("projectTimeData.json");
};

utilMgr.getLocalREADMEFile = () => {
    return path.join(__dirname, '..', 'README.md');
};

utilMgr.getImagesDir = () => {
    let dir = __dirname;
    if (utilMgr.isWindows()) {
        dir += '\\images';
    } else {
        dir += '/images';
    }
    return dir;
};

utilMgr.displayReadmeIfNotExists = async (override = false) => {
    const readmeFile = utilMgr.getLocalREADMEFile();
    const fileUri = `markdown-preview://${readmeFile}`;

    // implement me... (copied from vscode)
    const displayedReadme = utilMgr.getItem('atom_CtReadme');
    if (!displayedReadme || override) {
        const openResult = await atom.workspace.open(fileUri, {
            changeFocus: true,
            activatePane: true,
            activateItem: true,
        });
        if (!openResult.loaded && openResult.loading) {
            // close it and re-open
            await atom.workspace.hide(fileUri);
            setTimeout(() => {
                atom.workspace.open(fileUri, {
                    changeFocus: true,
                    activatePane: true,
                    activateItem: true,
                });
            }, 1500);
        }
        utilMgr.setItem('atom_CtReadme', true);
    }
};

utilMgr.launchFile = async (fsPath) => {
    // display it
    atom.workspace.open(fsPath, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

utilMgr.deleteFile = (file) => {
    // if the file exists, get it
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
};

utilMgr.launchSubmitFeedback = async () => {
    utilMgr.launchUrl('mailto:cody@software.com');
};

/**
 * @param num The number to round
 * @param precision The number of decimal places to preserve
 */
function roundUp(num, precision) {
    precision = Math.pow(10, precision);
    return Math.ceil(num * precision) / precision;
}

utilMgr.formatNumber = (num) => {
    let str = '';
    num = num ? parseFloat(num) : 0;
    if (num >= 1000) {
        str = num.toLocaleString();
    } else if (num % 1 === 0) {
        str = num.toFixed(0);
    } else {
        str = num.toFixed(2);
    }
    return str;
};

utilMgr.humanizeMinutes = (minutes) => {
    let humizedStr = '';
    minutes = parseInt(minutes, 10) || 0;
    let sessionTime = '';
    if (minutes === 60) {
        humizedStr = '1 hr';
    } else if (minutes > 60) {
        let hours = minutes / 60;
        if (hours % 1 === 0) {
            humizedStr = hours.toFixed(0) + ' hrs';
        } else {
            const roundedTime = roundUp(hours, 1);
            humizedStr = roundedTime.toFixed(1) + ' hrs';
        }
    } else if (minutes === 1) {
        humizedStr = '1 min';
    } else {
        humizedStr = minutes + ' min';
    }
    return humizedStr;
};

utilMgr.launchSoftwareTopForty = async () => {
    utilMgr.launchUrl('https://api.software.com/music/top40');
};

utilMgr.launchUrl = (url) => {
    let open = 'open';
    let args = [`${url}`];
    if (utilMgr.isWindows()) {
        open = 'cmd';
        // adds the following args to the beginning of the array
        args.unshift('/c', 'start', '""');
    } else if (!utilMgr.isMac()) {
        open = 'xdg-open';
    }

    let process = cp.execFile(open, args, (error, stdout, stderr) => {
        if (error != null) {
            console.log(
                'Code Time: Error launching Software authentication: ',
                error.toString()
            );
        }
    });
};

utilMgr.validateEmail = (email) => {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
};

utilMgr.getLoginUrl = (loginType) => {
    const jwt = utilMgr.getItem('jwt');

    const encodedJwt = encodeURIComponent(jwt);

    const authType = utilMgr.getItem("authType");

    let loginUrl;
    utilMgr.setItem('authType', loginType);
    if (loginType === "github") {
        // github signup/login flow
        loginUrl = `${api_endpoint}/auth/github?token=${encodedJwt}&plugin=${utilMgr.getPluginType()}&redirect=${launch_url}`;
    } else if (loginType === "google") {
        // google signup/login flow
        loginUrl = `${api_endpoint}/auth/google?token=${encodedJwt}&plugin=${utilMgr.getPluginType()}&redirect=${launch_url}`;
    } else if (!authType) {
        // never onboarded, show the signup view
        loginUrl = `${launch_url}/email-signup?token=${encodedJwt}&plugin=${utilMgr.getPluginType()}&auth=software`;
    } else {
        // they've already onboarded before, take them to the login page
        loginUrl = `${launch_url}/onboarding?token=${encodedJwt}&plugin=${utilMgr.getPluginType()}&auth=software&login=true`;
    }
    return loginUrl;
};

utilMgr.launchWebDashboardUrl = () => {
    const jwt = utilMgr.getItem('jwt');
    utilMgr.launchUrl(`${launch_url}?token=${jwt}`);
};

utilMgr.getCodeTimeMenu = () => {
    return codeTimeMenu;
};

utilMgr.updateCodeTimeMenu = (menu) => {
    codeTimeMenu = menu;
};

utilMgr.getCodeTimeSubmenu = () => {
    return codeTimeSubmenu;
};

utilMgr.updateCodeTimeSubmenu = (menu) => {
    codeTimeSubmenu = menu;
};

utilMgr.removeMenuItem = (prefLabel) => {
    const result = codeTimeSubmenu.find((n) => n.label === prefLabel);
    if (result) {
        codeTimeSubmenu = codeTimeSubmenu.filter((n) => n.label !== prefLabel);
        atom.menu.remove(codeTimeMenu);
        codeTimeMenu[0].submenu = codeTimeSubmenu;

        codeTimeMenu = [];
        codeTimeMenu.push({
            label: 'Packages',
            submenu: [
                {
                    label: 'Code Time',
                    submenu: codeTimeSubmenu,
                },
            ],
        });

        atom.menu.add(codeTimeMenu);
        atom.menu.update();
    }
};

utilMgr.addMenuItem = (prefLabel, command) => {
    const result = codeTimeSubmenu.find((n) => n.label === prefLabel);
    if (!result) {
        atom.menu.remove(codeTimeMenu);
        codeTimeSubmenu.push({
            label: prefLabel,
            command,
        });

        codeTimeMenu = [];
        codeTimeMenu.push({
            label: 'Packages',
            submenu: [
                {
                    label: 'Code Time',
                    submenu: codeTimeSubmenu,
                },
            ],
        });

        atom.menu.add(codeTimeMenu);
        atom.menu.update();
    }
};

utilMgr.updateLoginPreference = (loggedIn) => {
    if (loggedIn) {
        utilMgr.addMenuItem(
            WEB_DASHBOARD_MENU_LABEL,
            WEB_DASHBOARD_COMMAND_KEY
        );
    } else {
        utilMgr.removeMenuItem(WEB_DASHBOARD_MENU_LABEL);
    }
};

utilMgr.updateMenuPreference = (command, flag) => {
    //
};

utilMgr.getDashboardRow = (label, value) => {
    let content = `${utilMgr.getDashboardLabel(
        label
    )} : ${utilMgr.getDashboardValue(value)}\n`;
    return content;
};

utilMgr.getSectionHeader = (label) => {
    let content = `${label}\n`;
    // add 3 to account for the " : " between the columns
    let dashLen = DASHBOARD_LABEL_WIDTH + DASHBOARD_VALUE_WIDTH + 15;
    for (let i = 0; i < dashLen; i++) {
        content += '-';
    }
    content += '\n';
    return content;
};

utilMgr.getDashboardLabel = (label, width = DASHBOARD_LABEL_WIDTH) => {
    return utilMgr.getDashboardDataDisplay(width, label);
};

utilMgr.getDashboardValue = (value) => {
    let valueContent = utilMgr.getDashboardDataDisplay(
        DASHBOARD_VALUE_WIDTH,
        value
    );
    let paddedContent = '';
    for (let i = 0; i < 11; i++) {
        paddedContent += ' ';
    }
    paddedContent += valueContent;
    return paddedContent;
};

utilMgr.getDashboardDataDisplay = (widthLen, data) => {
    let len =
        data.constructor === String
            ? widthLen - data.length
            : widthLen - String(data).length;
    let content = '';
    for (let i = 0; i < len; i++) {
        content += ' ';
    }
    return `${content}${data}`;
};

utilMgr.isMusicTime = () => {
    if (whoami === null) {
        whoami = utilMgr.getExtensionName();
    }
    return whoami === 'music-time' ? true : false;
};

utilMgr.isCodeTime = () => {
    if (whoami === null) {
        whoami = utilMgr.getExtensionName();
    }
    return whoami === 'code-time' ? true : false;
};

utilMgr.getExtensionName = () => {
    if (extensionName) {
        return extensionName;
    }
    let extInfoFile = __dirname;
    if (utilMgr.isWindows()) {
        extInfoFile += '\\extensioninfo.json';
    } else {
        extInfoFile += '/extensioninfo.json';
    }

    const data = fileIt.readJsonFileSync(extInfoFile);
    if (data) {
      extensionName = data.name;
    }

    if (!extensionName) {
        extensionName = 'code-time';
    }
    return extensionName;
};

utilMgr.launchWebUrl = (url) => {
    let open = 'open';
    let args = [`${url}`];
    if (utilMgr.isWindows()) {
        open = 'cmd';
        // adds the following args to the beginning of the array
        args.unshift('/c', 'start', '""');
    } else if (!utilMgr.isMac()) {
        open = 'xdg-open';
    }

    let process = cp.execFile(open, args, (error, stdout, stderr) => {
        if (error != null) {
            utilMgr.logIt(
                `Error launching Software web url: ${error.toString()}`
            );
        }
    });
};

utilMgr.logIt = (message) => {
    console.log(`${utilMgr.getExtensionName()}: ${message}`);
};

utilMgr.getScrollDistance = ($child, $parent) => {
    const viewTop = $parent.offset().top,
        viewBottom = viewTop + $parent.height(),
        scrollTop = $parent.scrollTop(),
        // scrollBottom = scrollTop + $parent.height(),
        elemTop = $child.offset().top,
        elemBottom = elemTop + $child.height();

    const ret = {
        needScroll: true,
        distance: 0,
    };
    // Element is upon or under the view
    if (elemTop < viewTop || elemBottom > viewBottom)
        ret.distance = scrollTop + elemTop - viewTop;
    else ret.needScroll = false;

    return ret;
};

utilMgr.selectTreeNode = ($target, vm, opts) => {
    if ($target.is('span')) $target = $target.parent();
    if ($target.is('div')) $target = $target.parent();
    if ($target.is('li')) {
        // ".toggle" would be TRUE if it's double click
        if (opts && opts.toggle) {
            $target.hasClass('list-nested-item') &&
                $target[
                    $target.hasClass('collapsed') ? 'removeClass' : 'addClass'
                ]('collapsed');
        }
        let oldVal = vm.treeNodeId,
            val = $target.attr('node-id');

        // Same node
        if (oldVal === val) return;

        oldVal &&
            $('div.structure-view>div.tree-panel>ol')
                .find('li.selected')
                .removeClass('selected');
        $target.addClass('selected');
        vm.treeNodeId = val;
    }
};

utilMgr.notify = (title, msg) => {
    atom.notifications.addInfo(title, { detail: msg, dismissable: true });
};

utilMgr.alert = (title, msg) => {
    atom.confirm({
        message: title,
        detailedMessage: msg,
        buttons: {
            Close: function () {
                return;
            },
        },
    });
};

utilMgr.getPluginName = () => {
    if (utilMgr.isCodeTime()) {
        return CODE_TIME_EXT_ID;
    }
    return CODE_TIME_EXT_ID;
};

utilMgr.getPluginType = () => {
    if (utilMgr.isCodeTime()) {
        return CODE_TIME_TYPE;
    }
    return CODE_TIME_TYPE;
};

utilMgr.isValidJson = (val) => {
    if (val === null || val === undefined) {
        return false;
    }
    if (typeof val === 'string' || typeof val === 'number') {
        return false;
    }
    try {
        const stringifiedVal = JSON.stringify(val);
        JSON.parse(stringifiedVal);
        return true;
    } catch (e) {
        //
    }
    return false;
};

utilMgr.isValidJson = (val) => {
    if (val === null || val === undefined) {
        return false;
    }
    if (typeof val === 'string' || typeof val === 'number') {
        return false;
    }
    try {
        const stringifiedVal = JSON.stringify(val);
        JSON.parse(stringifiedVal);
        return true;
    } catch (e) {
        //
    }
    return false;
};

utilMgr.getMusicSessionDataStoreFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\MusicSession.json';
    } else {
        file += '/MusicSession.json';
    }
    return file;
};

utilMgr.getOffsetSeconds = () => {
    let d = new Date();
    return d.getTimezoneOffset() * 60;
};

utilMgr.text_truncate = (str, length, ending) => {
    if (length == null) {
        length = 100;
    }
    if (ending == null) {
        ending = '...';
    }
    if (str.length > length) {
        return str.substring(0, length - ending.length) + ending;
    } else {
        return str;
    }
};

utilMgr.getFileDataArray = (file) => {
    let payloads = fileIt.readJsonArraySync(file);
    return payloads;
};

utilMgr.getFileDataPayloadsAsJson = (file) => {
  return fileIt.readJsonLinesSync(file);
};

utilMgr.showOfflinePrompt = () => {
    // shows a prompt that we're not able to communicate with the app server
    let infoMsg =
        'Our service is temporarily unavailable. We will try to reconnect again in 10 minutes. Your status bar will not update at this time.';
    atom.confirm({
        message: '',
        detailedMessage: infoMsg,
        buttons: {
            OK: () => {},
        },
    });
};

/**
 * Return {elapsedSeconds, sessionMinutes}
 * The session minutes is based on a threshold of 15 minutes
 */
utilMgr.getTimeBetweenLastPayload = () => {

    // default to 1 minute
    let sessionSeconds = 0;
    let elapsedSeconds = 60;

    // will be zero if its a new day
    const lastPayloadEnd = utilMgr.getItem("latestPayloadTimestampEndUtc");

    // the last payload end time is reset within the new day checker
    if (lastPayloadEnd && lastPayloadEnd > 0) {
      const nowTimes = timeUtil.getNowTimes();
      // diff from the previous end time
      elapsedSeconds = utilMgr.coalesceNumber(nowTimes.now_in_sec - lastPayloadEnd);

      // if it's less than the threshold then add the minutes to the session time
      if (
          elapsedSeconds > 0 &&
          elapsedSeconds <= utilMgr.getSessionThresholdSeconds()
      ) {
          // it's still the same session, add the gap time in minutes
          sessionSeconds = elapsedSeconds;
      }
      sessionSeconds = utilMgr.coalesceNumber(sessionSeconds);
    }

    return { sessionSeconds, elapsedSeconds };
};

utilMgr.isGitProject = (projectDir) => {
    if (!projectDir) {
        return false;
    }

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
        return false;
    }
    return true;
};

utilMgr.isBatchSizeUnderThreshold = (payloads) => {
    const payloadDataLen = Buffer.byteLength(JSON.stringify(payloads));
    if (payloadDataLen <= 100000) {
        return true;
    }
    return false;
};

utilMgr.getRandomArbitrary = (min, max) => {
    max = max + 0.1;
    return parseInt(Math.random() * (max - min) + min, 10);
};

utilMgr.getSessionThresholdSeconds = () => {
    const thresholdSeconds =
        utilMgr.getItem('sessionThresholdInSec') ||
        DEFAULT_SESSION_THRESHOLD_SECONDS;
    return thresholdSeconds;
};

utilMgr.normalizeGithubEmail = (email, filterOutNonEmails = true) => {
    if (email) {
        if (
            filterOutNonEmails &&
            (email.endsWith('github.com') || email.includes('users.noreply'))
        ) {
            return null;
        } else {
            const found = email.match(NUMBER_IN_EMAIL_REGEX);
            if (found && email.includes('users.noreply')) {
                // filter out the ones that look like
                // 2342353345+username@users.noreply.github.com"
                return null;
            }
        }
    }

    return email;
};

utilMgr.updateLatestPayloadLazily = async (payload) => {
    latestPayload = payload;
};

utilMgr.getLatestPayload = () => {
    return latestPayload;
};

utilMgr.coalesceNumber = (val, defaultVal = 0) => {
    return val || defaultVal;
};

utilMgr.getFileName = (fileName, autoCreate = true) => {
  const file_path = utilMgr.getSoftwareDir(autoCreate);
  if (utilMgr.isWindows()) {
    return `${file_path}\\${fileName}`;
  }
  return `${file_path}/${fileName}`;
};

module.exports = utilMgr;
