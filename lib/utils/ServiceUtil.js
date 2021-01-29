'use babel';

import {
    api_endpoint,
    CODE_TIME_PLUGIN_ID,
} from '../Constants';
import { v4 as uuidv4 } from "uuid";

const axios = require('axios');
const execUtil = require('./ExecUtil');
const utilMgr = require('../UtilManager');

const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

let initializedHeaders = false;

function initHeaders() {
    if (!initializedHeaders) {
        beApi.defaults.headers.common[
            'X-SWDC-Plugin-Id'
        ] = utilMgr.getPluginId();
        beApi.defaults.headers.common[
            'X-SWDC-Plugin-Name'
        ] = utilMgr.getPluginName();
        beApi.defaults.headers.common[
            'X-SWDC-Plugin-Version'
        ] = utilMgr.getVersion();
        beApi.defaults.headers.common['X-SWDC-Plugin-OS'] = utilMgr.getOs();
        beApi.defaults.headers.common[
            'X-SWDC-Plugin-TZ'
        ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
        beApi.defaults.headers.common['X-SWDC-Plugin-UUID'] = utilMgr.getPluginUuid();
        beApi.defaults.headers.common['X-SWDC-Plugin-Offset'] =
            utilMgr.getOffsetSeconds() / 60;
        initializedHeaders = true;
    }
}

const serviceUtil = {};

let lastOnlineCheck = 0;

/**
 * create an anonymous user
 */
serviceUtil.createAnonymousUser = async (ignoreJwt = false) => {
  const jwt = utilMgr.getItem("jwt");
    // check one more time before creating the anon user
    if (!jwt || ignoreJwt) {
        // this should not be undefined if its an account reset
        let plugin_uuid = utilMgr.getPluginUuid();
        let auth_callback_state = utilMgr.getAuthCallbackState();
        const username = await execUtil.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await execUtil.getHostname();

        const resp = await serviceUtil.softwarePost(
            "/plugins/onboard",
            {
                timezone,
                username,
                plugin_uuid,
                hostname,
                auth_callback_state
            }
        );
        if (serviceUtil.isResponseOk(resp) && resp.data && resp.data.jwt) {
            utilMgr.setItem("jwt", resp.data.jwt);
            if (!resp.data.user.registered) {
                utilMgr.setItem("name", null);
            }
            utilMgr.setItem("switching_account", false);
            utilMgr.setAuthCallbackState(null);
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
            .then((result) => {
                return serviceUtil.isResponseOk(result);
            })
            .catch((e) => {
                return false;
            });
    }
    return isOnline;
};

serviceUtil.getUserId = async () => {
    let jwt = utilMgr.getItem('jwt');
    if (jwt) {
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
    const jwt = utilMgr.getItem('jwt');

    if (jwt) {
        const api = '/users/me';
        const resp = await serviceUtil.softwareGet(api, jwt);
        if (serviceUtil.isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                const prefs = resp.data.data.preferences;
                const { disableGitData } = prefs;

                await utilMgr.setItem('disableGitData', !!disableGitData);

                return prefs;
            }
        }
        return {};
    }
    return {};
};

serviceUtil.getUser = async (jwt) => {
    if (jwt) {
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

    if (!initializedHeaders) {
        initHeaders();
    }

    return await beApi
        .get(api)
        .then((resp) => {
            return resp;
        })
        .catch((err) => {
            console.log(
                `Code Time: error fetching data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

serviceUtil.softwarePut = async (api, payload, jwt) => {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;

    if (!initializedHeaders) {
        initHeaders();
    }

    return beApi
        .put(api, payload)
        .then((resp) => {
            return resp;
        })
        .catch((err) => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

serviceUtil.softwarePost = async (api, payload, jwt) => {
    // POST the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;

    if (!initializedHeaders) {
        initHeaders();
    }

    return beApi
        .post(api, payload)
        .then((resp) => {
            return resp;
        })
        .catch((err) => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

serviceUtil.softwareDelete = async (api, jwt) => {
    beApi.defaults.headers.common['Authorization'] = jwt;

    if (!initializedHeaders) {
        initHeaders();
    }

    return beApi
        .delete(api)
        .then((resp) => {
            return resp;
        })
        .catch((err) => {
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

serviceUtil.isResponseOk = (resp) => {
    let status = getResponseStatus(resp);
    if (!resp || (status && status < 400)) {
        return true;
    }
    return false;
};

serviceUtil.isUnauthenticated = (resp) => {
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

serviceUtil.isUserDeactivated = async (resp) => {
    let deactivated = await serviceUtil.isUnauthenticatedAndDeactivated(resp);
    if (deactivated) {
        return true;
    }
    return false;
};

// we send back "NOTFOUND" or "DEACTIVATED" codes
serviceUtil.isUnauthenticatedAndDeactivated = async (resp) => {
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
