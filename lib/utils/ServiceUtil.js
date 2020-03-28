'use babel';

import {
    launch_url,
    api_endpoint,
    CODE_TIME_PLUGIN_ID,
    DEFAULT_SESSION_THRESHOLD_SECONDS,
} from '../Constants';

const axios = require('axios');
const execUtil = require('./ExecUtil');
const utilMgr = require('../UtilManager');

const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

const serviceUtil = {};

let lastOnlineCheck = 0;

/**
 * create an anonymous user
 */
serviceUtil.createAnonymousUser = async serverIsOnline => {
    let appJwt = await serviceUtil.getAppJwt();
    if (appJwt) {
        let creation_annotation = 'NO_SESSION_FILE';
        const username = await execUtil.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await execUtil.getHostname();

        let resp = await serviceUtil.softwarePost(
            `/data/onboard`,
            { timezone, username, creation_annotation, hostname },
            appJwt
        );
        if (serviceUtil.isResponseOk(resp) && resp.data && resp.data.jwt) {
            utilMgr.setItem('jwt', resp.data.jwt);
            return resp.data.jwt;
        }
    }

    return null;
};

serviceUtil.serverIsAvailable = async () => {
    let nowInSec = utilMgr.nowInSecs();
    let pastThreshold = nowInSec - lastOnlineCheck > 60;
    if (pastThreshold) {
        isOnline = await serviceUtil
            .softwareGet('/ping', null)
            .then(result => {
                return serviceUtil.isResponseOk(result);
            })
            .catch(e => {
                return false;
            });
    }
    return isOnline;
};

serviceUtil.getUserId = async () => {
    let jwt = utilMgr.getItem('jwt');
    let serverIsOnline = await serviceUtil.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await serviceUtil.softwareGet(api, jwt);
        if (serviceUtil.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                let userId = parseInt(resp.data.data.id, 10);
                return userId;
            }
        }
    }
    return null;
};

serviceUtil.initializePreferences = async () => {
    let user = utilMgr.getItem('user');
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await serviceUtil.serverIsAvailable();
    if (jwt && serverIsOnline && user) {
        let cachedUser = user;
        if (!cachedUser.id) {
            cachedUser = JSON.parse(cachedUser);
        }
        let userId = parseInt(cachedUser.id, 10);

        let api = `/users/${userId}`;
        let resp = await serviceUtil.softwareGet(api, jwt);
        if (serviceUtil.isResponseOk(resp)) {
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
                    await serviceUtil.sendPreferencesUpdate(userId, prefs);
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

serviceUtil.sendPreferencesUpdate = async (userId, userPrefs) => {
    let api = `/users/${userId}`;
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');
    userPrefs['showGit'] = showGitMetrics;
    userPrefs['showRank'] = showWeeklyRanking;

    // update the preferences
    // /:id/preferences
    api = `/users/${userId}/preferences`;
    let resp = await serviceUtil.softwarePut(
        api,
        userPrefs,
        utilMgr.getItem('jwt')
    );
    if (serviceUtil.isResponseOk(resp)) {
        console.log('Code Time: update user code time preferences');
    }
};

serviceUtil.updatePreference = (command, flag) => {
    utilMgr.updateMenuPreference(command, flag);
    serviceUtil.updatePreferences();
};

serviceUtil.updatePreferences = async () => {
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');

    // get the user's preferences and update them if they don't match what we have
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await serviceUtil.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let userId = await serviceUtil.getUserId();
        let api = `/users/${userId}`;
        let resp = await serviceUtil.softwareGet(api, jwt);
        if (serviceUtil.isResponseOk(resp)) {
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
                    await serviceUtil.sendPreferencesUpdate(userId, prefs);
                }
            }
        }
    }
};

serviceUtil.sendHeartbeat = async reason => {
    let serverIsOnline = await serviceUtil.serverIsAvailable();
    let jwt = utilMgr.getItem('jwt');
    if (serverIsOnline && jwt) {
        let heartbeat = {
            pluginId: CODE_TIME_PLUGIN_ID,
            os: utilMgr.getOs(),
            start: utilMgr.nowInSecs(),
            version: utilMgr.getVersion(),
            hostname: await execUtil.getHostname(),
            session_ctime: utilMgr.getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: utilMgr.getEditorSessionToken(),
        };

        let api = `/data/heartbeat`;
        serviceUtil.softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!utilMgr.isResponseOk(resp)) {
                console.log('Code Time: unable to send heartbeat ping');
            }
        });
    }
};

/**
 * get the app jwt
 */
serviceUtil.getAppJwt = async () => {
    utilMgr.setItem('app_jwt', null);
    let serverIsOnline = await serviceUtil.serverIsAvailable();

    if (serverIsOnline) {
        // get the app jwt
        let resp = await serviceUtil.softwareGet(
            `/data/apptoken?token=${utilMgr.nowInSecs()}`,
            null
        );
        if (serviceUtil.isResponseOk(resp)) {
            return resp.data.jwt;
        }
    }
    return null;
};

serviceUtil.getUser = async (serverIsOnline, jwt) => {
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await serviceUtil.softwareGet(api, jwt);
        if (serviceUtil.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                return resp.data.data;
            }
        }
    }
    return null;
};

/**
 * Response returns a paylod with the following..
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
serviceUtil.softwareGet = async (api, jwt) => {
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

serviceUtil.softwarePut = async (api, payload, jwt) => {
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

serviceUtil.softwarePost = async (api, payload, jwt) => {
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

serviceUtil.softwareDelete = async (api, jwt) => {
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

serviceUtil.isResponseOk = resp => {
    let status = getResponseStatus(resp);
    if (!resp || (status && status < 400)) {
        return true;
    }
    return false;
};

serviceUtil.isUnauthenticated = resp => {
    let status = getResponseStatus(resp);
    if (status && status >= 400 && status < 500) {
        return true;
    }
    return false;
};

serviceUtil.isDeactivated = async () => {
    let pingResp = await serviceUtil.softwareGet(
        '/users/ping/',
        utilMgr.getItem('jwt')
    );
    return await serviceUtil.isUserDeactivated(pingResp);
};

serviceUtil.isUserDeactivated = async resp => {
    let deactivated = await serviceUtil.isUnauthenticatedAndDeactivated(resp);
    if (deactivated) {
        return true;
    }
    return false;
};

// we send back "NOTFOUND" or "DEACTIVATED" codes
serviceUtil.isUnauthenticatedAndDeactivated = async resp => {
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

module.exports = serviceUtil;
