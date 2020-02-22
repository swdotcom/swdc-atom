'use babel';

import KpmStatusView from './KpmStatusView';
import { launch_url, api_endpoint, CODE_TIME_PLUGIN_ID } from './Constants';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';

const { exec } = require('child_process');
const crypto = require('crypto');
const axios = require('axios');
const os = require('os');
const cp = require('child_process');
const moment = require('moment-timezone');

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const SHOW_GIT_METRICS_CONFIG_KEY = 'code-time:showGitMetrics';
const SHOW_RANKING_METRICS_CONFIG_KEY = 'code-time:showWeeklyRanking';

const LOGOUT_COMMAND_KEY = 'Code-Time:log-out';
const LOGIN_COMMAND_KEY = 'Code-Time:log-in';
const LOGIN_MENU_LABEL = 'Log in to see your coding data';

const WEB_DASHBOARD_COMMAND_KEY = 'Code-Time:web-dashboard';
const WEB_DASHBOARD_MENU_LABEL = 'Web dashboard';

const NO_PROJECT_DIR_NAME = 'Unnamed';

const MILLIS_PER_HOUR = 1000 * 60 * 60;

const DASHBOARD_LABEL_WIDTH = 25;
const DASHBOARD_VALUE_WIDTH = 25;
const MARKER_WIDTH = 4;

const dayFormat = 'YYYY-MM-DD';
const dayTimeFormat = 'LLLL';

let telemetryOn = true;
let statusView = new KpmStatusView();

let dashboardFileVisible = false;
let cachedSessionKeys = {};
let editorSessiontoken = null;
let showStatusBarText = true;
let isOnline = null;
let lastOnlineCheck = 0;
let lastMsg = null;
let lastIcon = null;
let whoami = null;
let extensionName = null;

let codeTimeMenu = [];
let codeTimeSubmenu = [];

const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

let _isFocused = true;

window.onfocus = function() {
    _isFocused = true;
};

window.onblur = function() {
    _isFocused = false;
};

utilMgr.isFocused = () => {
    return _isFocused;
};

utilMgr.getEditorSessionToken = () => {
    if (!editorSessiontoken) {
        editorSessiontoken = utilMgr.randomCode();
    }
    return editorSessiontoken;
};

utilMgr.getVersion = () => {
    return atom.packages.getLoadedPackage('code-time').metadata.version;
};

utilMgr.getHostname = async () => {
    const hostname = await utilMgr.getCommandResultLine('hostname');
    return hostname;
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

utilMgr.updateDashboardFileVisibility = visible => {
    dashboardFileVisible = visible;
};

utilMgr.getDefaultProjectName = () => {
    return NO_PROJECT_DIR_NAME;
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
    utilMgr.getStatusView().display('Code Time');
};

utilMgr.showDeactivatedErrorStatus = async () => {
    utilMgr
        .getStatusView()
        .display(
            'Code Time',
            'alert',
            'To see your coding data in Code Time, please reactivate your account.'
        );
};

utilMgr.isTelemetryOn = () => {
    return telemetryOn;
};

utilMgr.randomCode = () => {
    return crypto
        .randomBytes(16)
        .map(value =>
            alpha.charCodeAt(Math.floor((value * alpha.length) / 256))
        )
        .toString();
};

utilMgr.getTelemetryStatus = () => {
    return telemetryOn;
};

utilMgr.updateTelemetryOn = isOn => {
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

utilMgr.getOsUsername = async () => {
    let username = os.userInfo().username;
    if (!username || username.trim() === '') {
        username = await utilMgr.getCommandResultLine('whoami');
    }
    return username;
};

utilMgr.setItem = (key, value) => {
    // update the cached session key map
    cachedSessionKeys[key] = value;

    const jsonObj = utilMgr.getSoftwareSessionAsJson();
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = utilMgr.getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, err => {
        if (err)
            console.log(
                'Code Time: Error writing to the Software session file: ',
                err.message
            );
    });
};

utilMgr.getItem = key => {
    let cachedVal = cachedSessionKeys[key];
    if (cachedVal) {
        return cachedVal;
    }
    const jsonObj = utilMgr.getSoftwareSessionAsJson();

    return jsonObj[key] || null;
};

utilMgr.getSoftwareSessionAsJson = () => {
    let data = null;

    const sessionFile = utilMgr.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile).toString();
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

utilMgr.displayReadmeIfNotExists = (override = false) => {
    const readmeFile = utilMgr.getLocalREADMEFile();
    const fileUri = `markdown-preview://${readmeFile}`;

    // implement me... (copied from vscode)
    const displayedReadme = utilMgr.getItem('atom_CtReadme');
    if (!displayedReadme || override) {
        atom.workspace.open(fileUri, {
            changeFocus: true,
            activatePane: true,
            activateItem: true,
        });
        utilMgr.setItem('atom_CtReadme', true);
    }
};

utilMgr.launchFile = async fsPath => {
    // display it
    atom.workspace.open(fsPath, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

utilMgr.deleteFile = file => {
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

utilMgr.humanizeMinutes = minutes => {
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

utilMgr.execPromise = (command, opts) => {
    return new Promise((resolve, reject) => {
        exec(command, opts, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            return resolve(stdout.trim());
        });
    });
};

utilMgr.getCommandResultLine = async (cmd, projectDir = null) => {
    const resultList = await utilMgr.getCommandResultList(cmd, projectDir);

    let resultLine = '';
    if (resultList && resultList.length) {
        for (let i = 0; i < resultList.length; i++) {
            let line = resultList[i];
            if (line && line.trim().length > 0) {
                resultLine = line.trim();
                break;
            }
        }
    }
    return resultLine;
};

utilMgr.getCommandResultList = async (cmd, projectDir = null) => {
    let result = await utilMgr.wrapExecPromise(cmd, projectDir);
    if (!result) {
        // something went wrong, but don't try to parse a null or undefined str
        return [];
    }
    result = result.trim();
    const resultList = result
        .replace(/\r\n/g, '\r')
        .replace(/\n/g, '\r')
        .replace(/^\s+/g, ' ')
        .split(/\r/);

    return resultList;
};

utilMgr.wrapExecPromise = async (cmd, projectDir = null) => {
    let prop = null;
    try {
        if (projectDir) {
            prop = await utilMgr.execPromise(cmd, {
                cwd: projectDir,
            });
        } else {
            prop = await utilMgr.execPromise(cmd, {});
        }
    } catch (e) {
        // console.error(e.message);
        prop = null;
    }
    return prop;
};

/**
 * Response returns a paylod with the following..
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
utilMgr.softwareGet = async (api, jwt) => {
    if (jwt) {
        beApi.defaults.headers.common['Authorization'] = jwt;
    }

    return await beApi
        .get(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error fetching data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwarePut = async (api, payload, jwt) => {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .put(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwarePost = async (api, payload, jwt) => {
    // POST the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .post(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwareDelete = async (api, jwt) => {
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .delete(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error with delete request for ${api}, message: ${err.message}`
            );
            return err;
        });
};

function getResponseStatus(resp) {
    let status = null;
    if (resp && resp.status) {
        status = resp.status;
    } else if (resp && resp.response && resp.response.status) {
        status = resp.response.status;
    }
    return status;
}

function getResponseData(resp) {
    let data = null;
    if (resp && resp.data) {
        data = resp.data;
    } else if (resp && resp.response && resp.response.data) {
        data = resp.response.data;
    }
    return data;
}

utilMgr.isResponseOk = resp => {
    let status = getResponseStatus(resp);
    if (!resp || (status && status < 400)) {
        return true;
    }
    return false;
};

utilMgr.isUnauthenticated = resp => {
    let status = getResponseStatus(resp);
    if (status && status >= 400 && status < 500) {
        return true;
    }
    return false;
};

utilMgr.isDeactivated = async () => {
    let pingResp = await utilMgr.softwareGet(
        '/users/ping/',
        utilMgr.getItem('jwt')
    );
    return await utilMgr.isUserDeactivated(pingResp);
};

utilMgr.isUserDeactivated = async resp => {
    let deactivated = await utilMgr.isUnauthenticatedAndDeactivated(resp);
    if (deactivated) {
        return true;
    }
    return false;
};

// we send back "NOTFOUND" or "DEACTIVATED" codes
utilMgr.isUnauthenticatedAndDeactivated = async resp => {
    let status = getResponseStatus(resp);
    let data = getResponseData(resp);
    if (status && status >= 400 && data) {
        // check if we have the data object
        let code = data.code || '';
        if (code === 'DEACTIVATED') {
            return true;
        }
    }
    return false;
};

utilMgr.launchSoftwareTopForty = async () => {
    utilMgr.launchUrl('https://api.software.com/music/top40');
};

utilMgr.launchUrl = url => {
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

utilMgr.serverIsAvailable = async () => {
    let nowInSec = utilMgr.nowInSecs();
    let pastThreshold = nowInSec - lastOnlineCheck > 60;
    if (pastThreshold) {
        isOnline = await utilMgr
            .softwareGet('/ping', null)
            .then(result => {
                return utilMgr.isResponseOk(result);
            })
            .catch(e => {
                return false;
            });
    }
    return isOnline;
};

/**
 * get the app jwt
 */
utilMgr.getAppJwt = async () => {
    utilMgr.setItem('app_jwt', null);
    let serverIsOnline = await utilMgr.serverIsAvailable();

    if (serverIsOnline) {
        // get the app jwt
        let resp = await utilMgr.softwareGet(
            `/data/apptoken?token=${utilMgr.nowInSecs()}`,
            null
        );
        if (utilMgr.isResponseOk(resp)) {
            return resp.data.jwt;
        }
    }
    return null;
};

/**
 * create an anonymous user
 */
utilMgr.createAnonymousUser = async serverIsOnline => {
    let appJwt = await utilMgr.getAppJwt();
    if (appJwt) {
        let creation_annotation = 'NO_SESSION_FILE';
        const username = await utilMgr.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await utilMgr.getHostname();

        let resp = await utilMgr.softwarePost(
            `/data/onboard`,
            { timezone, username, creation_annotation, hostname },
            appJwt
        );
        if (utilMgr.isResponseOk(resp) && resp.data && resp.data.jwt) {
            utilMgr.setItem('jwt', resp.data.jwt);
            return resp.data.jwt;
        }
    }

    return null;
};

utilMgr.validateEmail = email => {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
};

utilMgr.initializePreferences = async () => {
    let user = utilMgr.getItem('user');
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline && user) {
        let cachedUser = user;
        if (!cachedUser.id) {
            cachedUser = JSON.parse(cachedUser);
        }
        let userId = parseInt(cachedUser.id, 10);

        let api = `/users/${userId}`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                let prefs = resp.data.data.preferences;
                let prefsShowGit =
                    prefs.showGit !== null && prefs.showGit !== undefined
                        ? prefs.showGit
                        : null;
                let prefsShowRank =
                    prefs.showRank !== null && prefs.showRank !== undefined
                        ? prefs.showRank
                        : null;

                if (prefsShowGit === null || prefsShowRank === null) {
                    await utilMgr.sendPreferencesUpdate(userId, prefs);
                } else {
                    if (prefsShowGit !== null) {
                        await atom.config.set(
                            'code-time.showGitMetrics',
                            prefsShowGit
                        );
                    }
                    if (prefsShowRank !== null) {
                        await atom.config.set(
                            'code-time.showWeeklyRanking',
                            prefsShowRank
                        );
                    }
                }
            }
        }
    }
};

utilMgr.getLoginUrl = () => {
    let jwt = utilMgr.getItem('jwt');
    let loginUrl = `${launch_url}/onboarding?token=${jwt}`;
    return loginUrl;
};

utilMgr.launchWebDashboardUrl = () => {
    utilMgr.launchUrl(launch_url + '/login');
};

utilMgr.getCodeTimeMenu = () => {
    return codeTimeMenu;
};

utilMgr.updateCodeTimeMenu = menu => {
    codeTimeMenu = menu;
};

utilMgr.getCodeTimeSubmenu = () => {
    return codeTimeSubmenu;
};

utilMgr.updateCodeTimeSubmenu = menu => {
    codeTimeSubmenu = menu;
};

utilMgr.updatePreference = (command, flag) => {
    utilMgr.updateMenuPreference(command, flag);
    utilMgr.updatePreferences();
};

utilMgr.removeMenuItem = prefLabel => {
    const result = codeTimeSubmenu.find(n => n.label === prefLabel);
    if (result) {
        codeTimeSubmenu = codeTimeSubmenu.filter(n => n.label !== prefLabel);
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
    const result = codeTimeSubmenu.find(n => n.label === prefLabel);
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

utilMgr.updateLoginPreference = loggedIn => {
    if (loggedIn) {
        utilMgr.removeMenuItem(LOGIN_MENU_LABEL);
        utilMgr.addMenuItem(
            WEB_DASHBOARD_MENU_LABEL,
            WEB_DASHBOARD_COMMAND_KEY
        );
    } else {
        utilMgr.addMenuItem(LOGIN_MENU_LABEL, LOGIN_COMMAND_KEY);
        utilMgr.removeMenuItem(WEB_DASHBOARD_MENU_LABEL);
    }
};

utilMgr.updateMenuPreference = (command, flag) => {
    //
};

utilMgr.sendPreferencesUpdate = async (userId, userPrefs) => {
    let api = `/users/${userId}`;
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');
    userPrefs['showGit'] = showGitMetrics;
    userPrefs['showRank'] = showWeeklyRanking;

    // update the preferences
    // /:id/preferences
    api = `/users/${userId}/preferences`;
    let resp = await utilMgr.softwarePut(
        api,
        userPrefs,
        utilMgr.getItem('jwt')
    );
    if (utilMgr.isResponseOk(resp)) {
        console.log('Code Time: update user code time preferences');
    }
};

utilMgr.getUserId = async () => {
    let jwt = utilMgr.getItem('jwt');
    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                let userId = parseInt(resp.data.data.id, 10);
                return userId;
            }
        }
    }
    return null;
};

utilMgr.updatePreferences = async () => {
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');

    // get the user's preferences and update them if they don't match what we have
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let userId = await utilMgr.getUserId();
        let api = `/users/${userId}`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                let prefs = resp.data.data.preferences;
                let prefsShowGit =
                    prefs.showGit !== null && prefs.showGit !== undefined
                        ? prefs.showGit
                        : null;
                let prefsShowRank =
                    prefs.showRank !== null && prefs.showRank !== undefined
                        ? prefs.showRank
                        : null;

                if (
                    prefsShowGit === null ||
                    prefsShowRank === null ||
                    prefsShowGit !== showGitMetrics ||
                    prefsShowRank !== showWeeklyRanking
                ) {
                    await utilMgr.sendPreferencesUpdate(userId, prefs);
                }
            }
        }
    }
};

utilMgr.sendHeartbeat = async reason => {
    let serverIsOnline = await utilMgr.serverIsAvailable();
    let jwt = utilMgr.getItem('jwt');
    if (serverIsOnline && jwt) {
        let heartbeat = {
            pluginId: CODE_TIME_PLUGIN_ID,
            os: utilMgr.getOs(),
            start: utilMgr.nowInSecs(),
            version: utilMgr.getVersion(),
            hostname: await utilMgr.getHostname(),
            session_ctime: utilMgr.getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: utilMgr.getEditorSessionToken(),
        };

        let api = `/data/heartbeat`;
        utilMgr.softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!utilMgr.isResponseOk(resp)) {
                console.log('Code Time: unable to send heartbeat ping');
            }
        });
    }
};

utilMgr.getDashboardRow = (label, value) => {
    let content = `${utilMgr.getDashboardLabel(
        label
    )} : ${utilMgr.getDashboardValue(value)}\n`;
    return content;
};

utilMgr.getSectionHeader = label => {
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

utilMgr.getDashboardValue = value => {
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

utilMgr.getLastPayloadTimestampDay = latestPayloadTimestamp => {
    const UTC = moment.utc();
    const local = moment(UTC).local();
    const localDayTime = moment
        .unix(latestPayloadTimestamp)
        .utcOffset(moment.parseZone(local).utcOffset())
        .format(dayFormat);
    return localDayTime;
};

/**
 * Return the local and utc unix and day values
 */
utilMgr.getNowTimes = () => {
    const UTC = moment.utc();
    const now_in_sec = UTC.unix();
    const local = moment(UTC).local();
    const offset_in_sec = moment.parseZone(local).utcOffset() * 60;
    const local_now_in_sec = now_in_sec + offset_in_sec;
    const day = moment()
        .utcOffset(moment.parseZone(local).utcOffset())
        .format(dayFormat);
    const utcDay = moment()
        .utcOffset(0)
        .format(dayTimeFormat);
    const localDayTime = moment()
        .utcOffset(moment.parseZone(local).utcOffset())
        .format(dayTimeFormat);

    const dayTimes = {
        now_in_sec,
        local_now_in_sec,
        day,
        utcDay,
        localDayTime,
    };

    return dayTimes;
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
        const content = fs.readFileSync(extInfoFile).toString();
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

utilMgr.launchWebUrl = url => {
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

utilMgr.logIt = message => {
    console.log(`${utilMgr.getExtensionName()}: ${message}`);
};

utilMgr.getUser = async (serverIsOnline, jwt) => {
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                return resp.data.data;
            }
        }
    }
    return null;
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
            Close: function() {
                return;
            },
        },
    });
};

utilMgr.launchLogin = async () => {
    let loginUrl = await utilMgr.buildLoginUrl();
    utilMgr.launchWebUrl(loginUrl);
    utilMgr.refetchUserStatusLazily();
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

utilMgr.refetchUserStatusLazily = (tryCountUntilFoundUser = 20) => {
    setTimeout(() => {
        utilMgr.userStatusFetchHandler(tryCountUntilFoundUser);
    }, 10000);
};

utilMgr.userStatusFetchHandler = async tryCountUntilFoundUser => {
    let serverIsOnline = await utilMgr.serverIsAvailable();
    let userStatus = await userstatusMgr.getUserStatus(serverIsOnline);
    if (!userStatus.loggedIn) {
        // try again if the count is not zero
        if (tryCountUntilFoundUser > 0) {
            tryCountUntilFoundUser -= 1;
            refetchUserStatusLazily(tryCountUntilFoundUser);
        }
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

utilMgr.isValidJson = val => {
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

utilMgr.isValidJson = val => {
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

utilMgr.getOffsetSecends = () => {
    let d = new Date();
    return d.getTimezoneOffset() * 60;
};

utilMgr.deleteFile = file => {
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

utilMgr.getFileDataAsJson = file => {
    let data = null;
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString();
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

utilMgr.getFileDataArray = file => {
    let payloads = [];
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString();
        try {
            payloads = JSON.parse(content);
        } catch (e) {
            utilMgr.logIt(`Error reading file array data: ${e.message}`);
            // error trying to read the session file, delete it
            utilMgr.deleteFile(file);
        }
    }
    return payloads;
};

utilMgr.getFileDataPayloadsAsJson = file => {
    let payloads = [];
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString();
        if (content) {
            payloads = content
                .split(/\r?\n/)
                .map(item => {
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
                .filter(item => item);
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

module.exports = utilMgr;
