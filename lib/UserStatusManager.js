'use babel';

import $ from 'jquery';

const utilMgr = require('./UtilManager');
const serviceUtil = require('./utils/ServiceUtil');
const fileDataMgr = require("./storage/FileDataManager");
const sessionAppMgr = require('./managers/SessionAppManager');
import { clearTimeDataSummary } from "./managers/TimeDataManager";

let userstatusMgr = {};

let loggedInCacheState = null;

export const CLOSE_BOX =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=';

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
  const jwt = utilMgr.getItem("jwt");
  const auth_callback_state = utilMgr.getAuthCallbackState();
  const authType = utilMgr.getItem("authType");

  const api = "/users/plugin/state";

  const token = (auth_callback_state) ? auth_callback_state : jwt;

  let resp = await serviceUtil.softwareGet("/users/plugin/state", token);

  let foundUser = !!(serviceUtil.isResponseOk(resp) && resp.data && resp.data.user);
  let state = (foundUser) ? resp.data.state : "UNKNOWN";

  // Use the JWT to check if the user is available (tmp until server uses auth_callback_state for email accounts)
  const isEmailAuth = (authType === "software" || authType === "email");
  if (state !== "OK" && isEmailAuth) {
      // use the jwt
      resp = await serviceUtil.softwareGet(api, jwt);
      foundUser = !!(serviceUtil.isResponseOk(resp) && resp.data && resp.data.user);
      state = (foundUser) ? resp.data.state : "UNKNOWN";
  }

  if (foundUser) {
      // set the jwt, name (email), and use the registration flag
      // to determine if they're logged in or not
      const user = resp.data.user;

      utilMgr.setItem("jwt", user.plugin_jwt);
      if (user.registered) {
          utilMgr.setItem("name", user.email);
      } else {
          utilMgr.setItem("name", null);
      }

      const currentAuthType = utilMgr.getItem("authType");
      if (!currentAuthType) {
          utilMgr.setItem("authType", "software");
      }

      const registered = user.registered;

      utilMgr.setItem("switching_account", false);
      utilMgr.setAuthCallbackState(null);

      // if we need the user it's "resp.data.user"
      return { loggedOn: registered === 1, state };
  }

  // all else fails, set false and UNKNOWN
  return { loggedOn: false, state };
};

userstatusMgr.switchAccounts = async () => {
  const items = ["Google", "GitHub", "Email"];

  const myDiv = document.createElement('div');

  const closeButton = document.createElement('span');
  closeButton.setAttribute(
      'style',
      'float:right;margin-bottom: 10px;cursor:pointer;'
  );
  closeButton.setAttribute('id', 'closeAuthSelection');
  closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
  const selectList = document.createElement('select');
  selectList.setAttribute('id', 'selectDevice');
  selectList.setAttribute(
        'style',
        ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
  );

  myDiv.appendChild(closeButton);
  myDiv.appendChild(selectList);

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.text = 'Switch to a different account?';
  selectList.appendChild(defaultOption);
  items.forEach(authType => {
      const option = document.createElement('option');
      option.value = authType;
      option.text = authType;
      option.title = authType;
      selectList.appendChild(option);
  });

  atom.workspace.addModalPanel({
      item: myDiv,
      visible: true,
      priority: 4,
  });
};

$(document).on('change', '#selectDevice', function() {
    const authType = $(this).val().toLowerCase();
    userstatusMgr.launchLoginUrl(authType, true);
    closeAuthSelector();
});

$(document).on('click', '#closeAuthSelection', function() {
    closeAuthSelector();
});

function closeAuthSelector() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

userstatusMgr.launchLoginUrl = async (type, switching_account = false) => {
    utilMgr.launchUrl(utilMgr.getLoginUrl(type, switching_account));
    // each retry is 10 seconds long
    userstatusMgr.refetchUserStatusLazily(40);
};

userstatusMgr.refetchUserStatusLazily = async (tryCountUntilFoundUser = 3) => {
  const userStatus = await userstatusMgr.getUserStatus();
  if (!userStatus.loggedOn) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
          tryCountUntilFoundUser -= 1;
          setTimeout(() => {
            userstatusMgr.refetchUserStatusLazily(tryCountUntilFoundUser);
          }, 10000);
      } else {
          // clear the auth callback state
          utilMgr.setItem("switching_account", false);
          utilMgr.setAuthCallbackState(null);
      }
  } else {
    // clear the auth callback state
    utilMgr.setItem("switching_account", false);
    utilMgr.setAuthCallbackState(null);

    fileDataMgr.clearSessionSummaryData();
    clearTimeDataSummary();

    atom.confirm({
      message: '',
      detailedMessage: 'Successfully logged on to Code Time',
    });

    await sessionAppMgr.updateSessionSummaryFromServer();
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );
  }
};

userstatusMgr.getLoggedInCacheState = () => {
    return loggedInCacheState;
};

module.exports = userstatusMgr;
