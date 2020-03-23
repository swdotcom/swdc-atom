'use babel';

const utilMgr = require('./UtilManager');
const dashboardMgr = require('./DashboardManager');
const wallClockMgr = require('./managers/WallClockManager');
const payloadMgr = require('./managers/PayloadManager');

let userstatusMgr = {};

let loggedInCacheState = null;
let initializedPrefs = false;

/**
 * checks whether the user is logged in or not
 */
userstatusMgr.isLoggedOn = async serverIsOnline => {
    if (serverIsOnline === undefined) {
        serverIsOnline = await utilMgr.serverIsAvailable();
    }

    let jwt = utilMgr.getItem('jwt');
    if (serverIsOnline) {
        let api = '/users/plugin/state';
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            let state = resp.data.state ? resp.data.state : 'UNKNOWN';
            if (state === 'OK') {
                let email = resp.data.email;
                utilMgr.setItem('name', email);
                // check the jwt
                let pluginJwt = resp.data.jwt;
                // update the cached jwt
                cachedJwt = pluginJwt;
                if (pluginJwt && pluginJwt !== jwt) {
                    // update it
                    utilMgr.setItem('jwt', pluginJwt);
                    // re-initialize preferences
                    initializedPrefs = false;
                }
                return { loggedOn: true, state };
            }
            // return the state that is returned
            return { loggedOn: false, state };
        }
    }
    return { loggedOn: false, state: 'UNKNOWN' };
};

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
userstatusMgr.getUserStatus = async serverIsOnline => {
    const utilMgr = require('./UtilManager');

    if (serverIsOnline === undefined) {
        serverIsOnline = await utilMgr.serverIsAvailable();
    }

    let jwt = utilMgr.getItem('jwt');
    let loggedIn = false;
    if (serverIsOnline) {
        let loggedInResp = await userstatusMgr.isLoggedOn(serverIsOnline, jwt);
        // set the loggedIn bool value
        loggedIn = loggedInResp.loggedOn;
    }

    if (serverIsOnline && loggedIn && !initializedPrefs) {
        utilMgr.initializePreferences();
        initializedPrefs = true;
    }

    let userStatus = {
        loggedIn,
    };

    if (!loggedIn) {
        // make sure we don't show the name in the tooltip if they're not logged in
        let name = utilMgr.getItem('name');
        // only update the name if it's not null
        if (name) {
            utilMgr.setItem('name', null);
        }
    }

    let currentUserStatus = {
        loggedIn,
        name: utilMgr.getItem('name'),
    };

    // update the menu item visibility
    utilMgr.updateLoginPreference(loggedIn);

    // set the flag
    loggedInCacheState = loggedIn;

    return currentUserStatus;
};

userstatusMgr.getWebUrl = async () => {
    let userStatus = await userstatusMgr.getUserStatus();
    if (userStatus.loggedIn) {
        return launch_url;
    }
    return utilMgr.getLoginUrl();
};

userstatusMgr.launchLoginUrl = async type => {
    utilMgr.launchUrl(utilMgr.getLoginUrl(type));
    // each retry is 10 seconds long
    userstatusMgr.refetchUserStatusLazily(40);
};

userstatusMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
    setTimeout(async () => {
        let userStatus = await userstatusMgr.getUserStatus(true);
        if (!userStatus.loggedIn) {
            // try again if the count is not zero
            if (tryCountUntilFoundUser > 0) {
                tryCountUntilFoundUser -= 1;
                userstatusMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
            }
        } else {
            // change of logged in state
            utilMgr.sendHeartbeat(
                `STATE_CHANGE:LOGGED_IN:${userStatus.loggedIn}`
            );

            atom.confirm({
                message: '',
                detailedMessage: 'Successfully logged on to Code Time',
            });

            payloadMgr.sendOfflineData();
        }
    }, 10000);
};

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
