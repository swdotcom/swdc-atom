'use babel';

import KpmStatusView from './KpmStatusView';
import {
    app_endpoint,
    CODE_TIME_PLUGIN_ID,
    DEFAULT_SESSION_THRESHOLD_SECONDS,
    CODE_TIME_EXT_ID,
    CODE_TIME_TYPE,
    SOFTWARE_DIR
} from './Constants';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from "uuid";

const fileMgr = require('./managers/FileManager');

const open = require("open");
const queryString = require('query-string');
const crypto = require('crypto');
const os = require('os');

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const WEB_DASHBOARD_COMMAND_KEY = 'Code-Time:see-advanced-metrics';
const WEB_DASHBOARD_MENU_LABEL = 'See advanced metrics';

const NUMBER_IN_EMAIL_REGEX = new RegExp('^\\d+\\+');

let statusView = new KpmStatusView();

let extensionName = null;
let latestPayload = null;
let workspace_name = null;
let codeTimeMenu = [];
let codeTimeSubmenu = [];

utilMgr.getWorkspaceName = () => {
    if (!workspace_name) {
        workspace_name = utilMgr.randomCode();
    }
    return workspace_name;
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

utilMgr.randomCode = () => {
    return crypto
        .randomBytes(16)
        .map((value) =>
            alpha.charCodeAt(Math.floor((value * alpha.length) / 256))
        )
        .toString();
};

utilMgr.updateTelemetryOn = (isOn) => {
    telemetryOn = isOn;
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
    fileMgr.setJsonItem(utilMgr.getSoftwareSessionFile(), key, value);
};

utilMgr.getItem = (key) => {
    return fileMgr.getJsonItem(utilMgr.getSoftwareSessionFile(), key);
};

utilMgr.isInFlow = () => {
  const inFlowVal = fileMgr.getJsonItem(utilMgr.getFlowChangeFile(), 'in_flow');
  if (inFlowVal === undefined || inFlowVal === null) {
    utilMgr.updateInFlow(false);
    return false;
  }
  return inFlowVal;
}

utilMgr.updateInFlow = (inFlowVal) => {
  fileMgr.setJsonItem(utilMgr.getFlowChangeFile(), 'in_flow', inFlowVal);
}

utilMgr.getPluginUuid = () => {
  let plugin_uuid = fileMgr.getJsonItem(utilMgr.getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
      // set it for the 1st and only time
      plugin_uuid = uuidv4();
      fileMgr.setJsonItem(utilMgr.getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
};

utilMgr.getAuthCallbackState = (autoCreate = true) => {
  let auth_callback_state = fileMgr.getJsonItem(utilMgr.getDeviceFile(), "auth_callback_state");
  if (!auth_callback_state && autoCreate) {
      auth_callback_state = uuidv4();
      fileMgr.setJsonItem(utilMgr.getDeviceFile(), "auth_callback_state", auth_callback_state);
  }
  return auth_callback_state;
};

utilMgr.setAuthCallbackState = (value) => {
  fileMgr.setJsonItem(utilMgr.getDeviceFile(), "auth_callback_state", value);
};

/**
 * Store the json data to session.json
 **/
function writeSessionJson(jsonObj) {
    fileMgr.storeJsonData(utilMgr.getSoftwareSessionFile(), jsonObj);
}

utilMgr.getSoftwareSessionAsJson = () => {
    return fileMgr.getFileDataAsJson(utilMgr.getSoftwareSessionFile());
};

/**
 * Get the .software/session.json path/name
 */
utilMgr.getSoftwareSessionFile = () => {
    return utilMgr.getFileName('session.json');
};

utilMgr.getFlowChangeFile = () => {
  return utilMgr.getFileName('flowChange.json');
}

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

utilMgr.displayReadmeIfNotExists = async () => {
    const displayedReadme = utilMgr.getItem('atom_CtReadme');
    if (!displayedReadme) {
        utilMgr.displayReadme();
        utilMgr.setItem('atom_CtReadme', true);
        utilMgr.displayReadme();
        return true;
    }
    return false;
};

utilMgr.displayReadme = async () => {
  const readmeFile = utilMgr.getLocalREADMEFile();
  const fileUri = `markdown-preview://${readmeFile}`;
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
}

utilMgr.launchFile = async (fsPath) => {
    // display it
    atom.workspace.open(fsPath, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

utilMgr.submitAnIssue = async () => {
    utilMgr.launchUrl('https://github.com/swdotcom/swdc-atom/issues');
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

    let url = app_endpoint;
    utilMgr.setItem('authType', loginType);
    let obj = {
        plugin_id: utilMgr.getPluginId(),
        plugin_uuid: utilMgr.getPluginUuid(),
        plugin_version: utilMgr.getVersion(),
        auth_callback_state
    }

    if (loginType === "github") {
        // github signup/login flow
        url = `${app_endpoint}/auth/github`;
    } else if (loginType === "google") {
        // google signup/login flow
        url = `${app_endpoint}/auth/google`;
    } else {
      if (!switching_account) {
        // its a signup request
        url = `${app_endpoint}/email-signup`;
      } else {
        obj["login"] = true;
        // switch account is associated with login
        url = `${app_endpoint}/onboarding`;
      }
    }

    const qryStr = queryString.stringify(obj);

    return `${url}?${qryStr}`;
};

utilMgr.launchWebApp = () => {
  utilMgr.launchUrl(`${app_endpoint}`);
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

    const data = fileMgr.getFileDataAsJson(extInfoFile);
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
    return CODE_TIME_EXT_ID;
};

utilMgr.getEditorVersion = () => {
  return atom.getVersion();
}

utilMgr.getPluginType = () => {
    return CODE_TIME_TYPE;
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
