'use babel';

import { api_endpoint, app_endpoint } from '../Constants';

const axios = require('axios');
const execUtil = require('./ExecUtil');
const utilMgr = require('../UtilManager');

const appApi = axios.create({
    baseURL: `${app_endpoint}`,
});

const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

let initializedHeaders = false;

let currentUser = null;
let lastUserFetch = 0;

function initHeaders() {
  const headers = {
    'X-SWDC-Plugin-Id': utilMgr.getPluginId(),
    'X-SWDC-Plugin-Name': utilMgr.getPluginName(),
    'X-SWDC-Plugin-Version': utilMgr.getVersion(),
    'X-SWDC-Plugin-OS': utilMgr.getOs(),
    'X-SWDC-Plugin-TZ': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'X-SWDC-Plugin-Offset': utilMgr.getOffsetSeconds() / 60,
    'X-SWDC-Plugin-UUID': utilMgr.getPluginUuid(),
    'X-SWDC-Plugin-Type': 'codetime',
    'X-SWDC-Plugin-Editor': "atom",
    'X-SWDC-Plugin-Editor-Version': "latest"
  };
  beApi.defaults.headers.common = {...beApi.defaults.headers.common, ...headers};
  appApi.defaults.headers.common = {...appApi.defaults.headers.common, ...headers};
}

const serviceUtil = {};

let lastOnlineCheck = 0;

/**
 * create an anonymous user
 */
serviceUtil.createAnonymousUser = async (ignoreJwt = false) => {
    const jwt = utilMgr.getItem('jwt');
    // check one more time before creating the anon user
    if (!jwt || ignoreJwt) {
        // this should not be undefined if its an account reset
        let plugin_uuid = utilMgr.getPluginUuid();
        let auth_callback_state = utilMgr.getAuthCallbackState();
        const username = await execUtil.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await execUtil.getHostname();

        const resp = await serviceUtil.softwarePost('/plugins/onboard', {
            timezone,
            username,
            plugin_uuid,
            hostname,
            auth_callback_state,
        });
        if (serviceUtil.isResponseOk(resp) && resp.data && resp.data.jwt) {
            utilMgr.setItem('jwt', resp.data.jwt);
            if (!resp.data.user.registered) {
                utilMgr.setItem('name', null);
            }
            utilMgr.setItem('switching_account', false);
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
            .softwareGet('/ping')
            .then((result) => {
                return serviceUtil.isResponseOk(result);
            })
            .catch((e) => {
                return false;
            });
    }
    return isOnline;
};

serviceUtil.getUser = async () => {
  const nowMillis = new Date().getTime();
  if (currentUser && nowMillis - lastUserFetch < 2000) {
    return currentUser;
  }
  const resp = await serviceUtil.appGet('/api/v1/user');
  if (serviceUtil.isResponseOk(resp) && resp.data) {
    currentUser = resp.data;
    lastUserFetch = nowMillis;
  }
  return currentUser;
};

/**
 * Response returns a paylod with the following..
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
serviceUtil.softwareGet = async (api) => {
    updateOutgoingHeader();

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

serviceUtil.softwarePost = async (api, payload) => {
    updateOutgoingHeader();

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

serviceUtil.softwareDelete = async (api) => {
    updateOutgoingHeader();

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

serviceUtil.appGet = async (api) => {
    updateOutgoingHeader();

    return await appApi
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

serviceUtil.appPost = async (api, payload) => {
    updateOutgoingHeader();

    return appApi
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

serviceUtil.appDelete = async (api) => {
    if (!initializedHeaders) {
        initHeaders();
    }

    updateOutgoingHeader();

    return appApi
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
        '/users/ping/'
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

function updateOutgoingHeader() {
  if (!initializedHeaders) {
      initHeaders();
  }

  const token = getAuthorization();
  if (token) {
    appApi.defaults.headers.common['Authorization'] = token;
    beApi.defaults.headers.common['Authorization'] = token;
  }
}

function getAuthorization() {
  let token = utilMgr.getItem('jwt');
  if (token && token.includes('JWT ')) {
    token = `Bearer ${token.substring('JWT '.length)}`;
  }
  return token;
}

module.exports = serviceUtil;
