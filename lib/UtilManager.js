'use babel';

import KpmStatusView from './KpmStatusView';
import {
    launch_url,
    api_endpoint,
    CODE_TIME_PLUGIN_ID,
    DEFAULT_SESSION_THRESHOLD_SECONDS,
    CODE_TIME_EXT_ID,
    CODE_TIME_TYPE,
    SOFTWARE_DIR
} from './Constants';
import fs from 'fs';
import path from 'path';
import fileIt from 'file-it';
import { v4 as uuidv4 } from "uuid";

const open = require("open");
const queryString = require('query-string');
const crypto = require('crypto');
const os = require('os');
const timeUtil = require('./utils/TimeUtil');

import { format } from "date-fns";

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const WEB_DASHBOARD_COMMAND_KEY = 'Code-Time:see-advanced-metrics';
const WEB_DASHBOARD_MENU_LABEL = 'See advanced metrics';

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
 */
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
    let fileType = '';
    const lastDotIdx = fileName.lastIndexOf('.');
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

utilMgr.getPluginUuid = () => {
  let plugin_uuid = fileIt.getJsonValue(utilMgr.getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
      // set it for the 1st and only time
      plugin_uuid = uuidv4();
      fileIt.setJsonValue(utilMgr.getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
};

utilMgr.getAuthCallbackState = (autoCreate = true) => {
  let auth_callback_state = fileIt.getJsonValue(utilMgr.getDeviceFile(), "auth_callback_state");
  if (!auth_callback_state && autoCreate) {
      auth_callback_state = uuidv4();
      fileIt.setJsonValue(utilMgr.getDeviceFile(), "auth_callback_state", auth_callback_state);
  }
  return auth_callback_state;
};

utilMgr.setAuthCallbackState = (value) => {
  fileIt.setJsonValue(utilMgr.getDeviceFile(), "auth_callback_state", value);
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
    return utilMgr.getFileName('timeCounter.json');
};

/**
 * Get the .software/session.json path/name
 */
utilMgr.getSoftwareSessionFile = () => {
    return utilMgr.getFileName('session.json');
};

utilMgr.getDeviceFile = () => {
    return utilMgr.getFileName("device.json");
}

utilMgr.getSummaryInfoFile = () => {
    return utilMgr.getFileName('SummaryInfo.txt');
};

/**
 * Get the .software directory path/name
 **/
utilMgr.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = utilMgr.isWindows() ? `${homedir}\\${SOFTWARE_DIR}` : `${homedir}/${SOFTWARE_DIR}`;
    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
};

/**
 * Get the .software/data.json path/name
 */
utilMgr.getSoftwareDataStoreFile = () => {
    return utilMgr.getFileName('data.json');
};

utilMgr.getDashboardFile = () => {
    return utilMgr.getFileName('CodeTime Dashboard.html');
};

utilMgr.getTimeDataSummaryFile = () => {
    return utilMgr.getFileName('projectTimeData.json');
};

utilMgr.getIntegrationsFile = () => {
    return utilMgr.getFileName('integrations.json');
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

utilMgr.launchSubmitFeedback = async () => {
    utilMgr.launchUrl('mailto:cody@software.com');
};

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
        humizedStr = '1h';
    } else if (minutes > 60) {
        let hours = minutes / 60;
        const hoursStr = hours.toFixed(0) + 'h';
        if (hours % 1 === 0) {
          humizedStr = hoursStr;
        } else {
          const minutesStr = (60 * (hours % 1)).toFixed(0) + 'm';
          humizedStr = `${hoursStr} ${minutesStr}`;
        }
    } else if (minutes === 1) {
        humizedStr = '1m';
    } else {
        humizedStr = minutes + 'm';
    }
    return humizedStr;
};

utilMgr.launchSoftwareTopForty = async () => {
    utilMgr.launchUrl('https://api.software.com/music/top40');
};

utilMgr.launchUrl = (url) => {
  open(url, {wait: true});
};

utilMgr.getLoginUrl = (loginType, switching_account = false) => {

    utilMgr.setItem("authType", loginType);
    utilMgr.setItem("switching_account", switching_account);

    const auth_callback_state = uuidv4();
    utilMgr.setAuthCallbackState(auth_callback_state);
    const jwt = utilMgr.getItem("jwt");
    const name = utilMgr.getItem("name");

    let url = launch_url;
    utilMgr.setItem('authType', loginType);
    let obj = {
        plugin: utilMgr.getPluginType(),
        pluginVersion: utilMgr.getVersion(),
        plugin_id: utilMgr.getPluginId(),
        auth_callback_state
    }

    // send plugin uuid and jwt if not registered
    if (!name) {
      obj["plugin_uuid"] = utilMgr.getPluginUuid();
      obj["plugin_token"] = jwt;
    }

    if (loginType === "github") {
        // github signup/login flow
        obj["redirect"] = launch_url;
        url = `${api_endpoint}/auth/github`;
    } else if (loginType === "google") {
        // google signup/login flow
        obj["redirect"] = launch_url;
        url = `${api_endpoint}/auth/google`;
    } else {
      obj["token"] = utilMgr.getItem("jwt");
      obj["auth"] = "software";
      if (!switching_account) {
        // its a signup request
        url = `${launch_url}/email-signup`;
      } else {
        obj["login"] = true;
        // switch account is associated with login
        url = `${launch_url}/onboarding`;
      }
    }

    const qryStr = queryString.stringify(obj);

    return `${url}?${qryStr}`;
};

utilMgr.launchWebDashboardUrl = () => {
  if (!utilMgr.getItem("name")) {
    // show the sign up popup
    atom.confirm({
        message: `Sign up or log in to see more data visualizations.`,
        detailedMessage: "",
        buttons: ["Sign up", "Cancel"]
    }, (resp) => {
        if (resp === 0) {
          atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              'Code-Time:sign-up',
              "click"
          );
        }
    });
    return;
  }
  const jwt = utilMgr.getItem('jwt');
  utilMgr.launchUrl(`${launch_url}/login`);
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
  open(url);
};

utilMgr.logIt = (message) => {
    console.log(`${utilMgr.getExtensionName()}: ${message}`);
};

utilMgr.notify = (title, msg) => {
    atom.notifications.addInfo(title, { detail: msg, dismissable: true });
};

utilMgr.alert = (title, msg) => {
    atom.confirm({
        message: title,
        detailedMessage: msg,
        buttons: {
            Close: function() {
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
  if (!str) {
    return "";
  }
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
    // Still trying to find out when "undefined" is set into the data.json
    // but this will help remove it so we can process the json lines without failure
    let content = fileIt.readContentFileSync(file);
    if (content && content.indexOf('undefined') !== -1) {
        // remove "undefined" and re-save, then read
        content = content.replace('undefined', '');
        fileIt.writeContentFileSync(file, content);
    }
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
            OK: () => { },
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
    const lastPayloadEnd = utilMgr.getItem('latestPayloadTimestampEndUtc');

    // the last payload end time is reset within the new day checker
    if (lastPayloadEnd && lastPayloadEnd > 0) {
        const nowTimes = timeUtil.getNowTimes();
        // diff from the previous end time
        elapsedSeconds = utilMgr.coalesceNumber(
            nowTimes.now_in_sec - lastPayloadEnd
        );

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

utilMgr.getIntegrations = () => {
  let integrations = fileIt.readJsonFileSync(utilMgr.getIntegrationsFile());
  if (!integrations) {
    integrations = [];
    utilMgr.syncIntegrations(integrations);
  }
  return integrations;
};

utilMgr.syncIntegrations = (integrations) => {
  fileIt.writeJsonFileSync(utilMgr.getIntegrationsFile(), integrations);
};

/**
 * Checks whether we need to fetch the sessions/summary or not
 */
utilMgr.shouldFetchSessionSummaryData = () => {
  const now = new Date();
  // this is the format used across other plugins
  const nowDay = format(now, "yyyy-MM-dd");
  const currentDay = utilMgr.getItem("updatedTreeDate");
  if (currentDay == nowDay) {
    // only initialize once during a day for a specific user
    return false;
  }
  utilMgr.setItem("updatedTreeDate", nowDay);
  return true;
};

module.exports = utilMgr;
