'use babel';

const userstatusMgr = require("../UserStatusManager");

export async function handleAuthenticatedPluginUser(user) {
  userstatusMgr.authenticationCompleteHandler(user);
}
