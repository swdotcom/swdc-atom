'use babel';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');

let userstatusMgr = {};

let loggedInCacheState = null;

/**
 * checks whether the user is logged in or not
 */
userstatusMgr.isLoggedOn = async () => {
    const name = utilMgr.getItem("name");
    return name ? true : false;
};

/**
 * check if the user is registered or not
 * return {loggedIn: true|false}
 */
userstatusMgr.getUserStatus = async () => {
  let jwt = utilMgr.getItem('jwt');

  let api = '/users/plugin/state';
  let resp = await serviceUtil.softwareGet(api, jwt);
  if (serviceUtil.isResponseOk(resp) && resp.data) {
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
          }
          return { loggedOn: true, state };
      }
      // return the state that is returned
      return { loggedOn: false, state };
  }
  return { loggedOn: false, state: 'UNKNOWN' };
};

userstatusMgr.launchLoginUrl = async type => {
    utilMgr.launchUrl(utilMgr.getLoginUrl(type));
    // each retry is 10 seconds long
    userstatusMgr.refetchUserStatusLazily(40);
};

userstatusMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
    setTimeout(async () => {
        let userStatus = await userstatusMgr.getUserStatus(true);
        if (!userStatus.loggedOn) {
            // try again if the count is not zero
            if (tryCountUntilFoundUser > 0) {
                tryCountUntilFoundUser -= 1;
                userstatusMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
            }
        } else {
            atom.confirm({
                message: '',
                detailedMessage: 'Successfully logged on to Code Time',
            });
        }
    }, 10000);
};

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
