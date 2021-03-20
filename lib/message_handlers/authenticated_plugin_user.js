'use babel';

const userstatusMgr = require("../UserStatusManager");

export async function handleAuthenticatedPluginUser(user: any) {
  userstatusMgr.authenticationCompleteHandler(user);
}
