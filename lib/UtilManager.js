'use babel';

import KpmStatusView from './KpmStatusView';
import {
    launch_url,
    api_endpoint,
    CODE_TIME_PLUGIN_ID,
    DEFAULT_SESSION_THRESHOLD_SECONDS,
    CODE_TIME_EXT_ID
} from './Constants';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';

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

let dashboardFileVisible = false;
let editorSessiontoken = null;
let whoami = null;
let extensionName = null;
let latestPayload = null;
let workspace_name = null;
let codeTimeMenu = [];
let codeTimeSubmenu = [];

let _isFocused = true;

window.onfocus = function () {
    _isFocused = true;
};

window.onblur = function () {
    _isFocused = false;
};

utilMgr.getWorkspaceName = () => {
    if (!workspace_name) {
        workspace_name = utilMgr.randomCode();
    }
    return workspace_name;
};

utilMgr.isFocused = () => {
    return _isFocused;
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

utilMgr.updateDashboardFileVisibility = (visible) => {
    dashboardFileVisible = visible;
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

utilMgr.isDashboardFileOpen = () => {
    return dashboardFileVisible;
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
    const jsonObj = utilMgr.getSoftwareSessionAsJson();
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = utilMgr.getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, (err) => {
        if (err)
            console.log(
                'Code Time: Error writing to the Software session file: ',
                err.message
            );
    });
};

utilMgr.getItem = (key) => {
    const jsonObj = utilMgr.getSoftwareSessionAsJson();

    return jsonObj[key] || null;
};

utilMgr.getSoftwareSessionAsJson = () => {
    let data = null;

    const sessionFile = utilMgr.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile, {encoding: 'utf8'}).toString();
        if (content) {
            data = JSON.parse(content);
        }
    }
    return data ? data : {};
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

/**
 * Get the .software/session.json path/name
 **/
utilMgr.getSoftwareSessionFile = (autoCreate = true) => {
    let file = utilMgr.getSoftwareDir(autoCreate);
    if (utilMgr.isWindows()) {
        file += '\\session.json';
    } else {
        file += '/session.json';
    }
    return file;
};

utilMgr.getSummaryInfoFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\SummaryInfo.txt';
    } else {
        file += '/SummaryInfo.txt';
    }
    return file;
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
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\data.json';
    } else {
        file += '/data.json';
    }
    return file;
};

utilMgr.getPluginEventsFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\events.json';
    } else {
        file += '/events.json';
    }
    return file;
};

utilMgr.getDashboardFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\CodeTime.txt';
    } else {
        file += '/CodeTime.txt';
    }
    return file;
};

utilMgr.getTimeDataSummaryFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\projectTimeData.json';
    } else {
        file += '/projectTimeData.json';
    }
    return file;
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
    //
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
    let jwt = utilMgr.getItem('jwt');
    const encodedJwt = encodeURIComponent(jwt);
    let loginUrl = '';
    utilMgr.setItem('authType', loginType);
    if (loginType === 'software') {
        loginUrl = `${launch_url}/email-signup?token=${encodedJwt}&plugin=codetime&auth=software`;
    } else if (loginType === 'github') {
        loginUrl = `${api_endpoint}/auth/github?token=${encodedJwt}&plugin=codetime&redirect=${launch_url}`;
    } else if (loginType === 'google') {
        loginUrl = `${api_endpoint}/auth/google?token=${encodedJwt}&plugin=codetime&redirect=${launch_url}`;
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
    if (fs.existsSync(extInfoFile)) {
        const content = fs.readFileSync(extInfoFile, {encoding: 'utf8'}).toString();
        if (content) {
            try {
                const data = JSON.parse(content);
                if (data) {
                    extensionName = data.name;
                }
            } catch (e) {
                utilMgr.logIt(`unable to read ext info name: ${e.message}`);
            }
        }
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

utilMgr.buildLoginUrl = async () => {
    let jwt = utilMgr.getItem('jwt');
    if (jwt) {
        const encodedJwt = encodeURIComponent(jwt);
        const loginUrl = `${launch_url}/onboarding?token=${encodedJwt}&plugin=${getPluginType()}`;
        return loginUrl;
    } else {
        // no need to build an onboarding url if we dn't have the token
        return launch_url;
    }
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

utilMgr.deleteFile = (file) => {
    // if the file exists, get it
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
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

utilMgr.getFileDataAsJson = (file) => {
    let data = null;
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            } catch (e) {
                utilMgr.logIt(`unable to read session info: ${e.message}`);
                // error trying to read the session file, delete it
                utilMgr.deleteFile(file);
            }
        }
    }
    return data;
};

utilMgr.getFileDataArray = (file) => {
    let payloads = [];
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
        try {
            const jsonData = JSON.parse(content);
            if (Array.isArray(jsonData)) {
                payloads = jsonData;
            } else {
                payloads.push(jsonData);
            }
        } catch (e) {
            utilMgr.logIt(`Error reading file array data: ${e.message}`);
            // error trying to read the session file, delete it
            utilMgr.deleteFile(file);
        }
    }
    return payloads;
};

utilMgr.getFileDataPayloadsAsJson = (file) => {
    let payloads = [];
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
        if (content) {
            payloads = content
                .split(/\r?\n/)
                .map((item) => {
                    let obj = null;
                    if (item) {
                        try {
                            obj = JSON.parse(item);
                        } catch (e) {
                            //
                        }
                    }
                    if (obj) {
                        return obj;
                    }
                })
                .filter((item) => item);
        }
    }
    return payloads;
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
    let sessionMinutes = 1;
    let elapsedSeconds = 60;
    const lastPayloadEnd = utilMgr.getItem('latestPayloadTimestampEndUtc');
    if (lastPayloadEnd && lastPayloadEnd > 0) {
        const nowTimes = timeUtil.getNowTimes();
        const nowInSec = nowTimes.now_in_sec;
        // diff from the previous end time
        elapsedSeconds = Math.max(60, nowInSec - lastPayloadEnd);

        // if it's less than the threshold then add the minutes to the session time
        if (
            elapsedSeconds > 0 &&
            elapsedSeconds <= utilMgr.getSessionThresholdSeconds()
        ) {
            // it's still the same session, add the gap time in minutes
            sessionMinutes = elapsedSeconds / 60;
        }
        sessionMinutes = Math.max(1, sessionMinutes);
    }
    return { sessionMinutes, elapsedSeconds };
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

module.exports = utilMgr;
