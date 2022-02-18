'use babel';

const utilMgr = require('../UtilManager');
const serviceUtil = require('../utils/ServiceUtil');
const {
    initiateSignupFlow,
    showSlackWorkspaceMenuOptions,
} = require('../utils/PopupUtil');

// -------------------------------------------
// - public methods
// -------------------------------------------

export async function slackWorkspaceSelectCallback(selectedTeamDomain) {
    if (selectedTeamDomain) {
        return await getWorkspaceAccessToken(selectedTeamDomain);
    }
    return null;
}

export async function hasSlackWorkspaces() {
    return await !!getSlackWorkspaces().length;
}

export async function getSlackWorkspaces() {
  const currentUser = await serviceUtil.getUser();
  if (currentUser && currentUser.integration_connections && currentUser.integration_connections.length) {
    return currentUser.integration_connections.filter(
      (integration) => integration.status === 'ACTIVE' && (integration.integration_type_id === 14));
  }
  return [];
}

export async function showModalSignupPrompt(msg) {
    const selection = await atom.confirm({
        message: msg,
        detailedMessage: '',
        buttons: ['Sign up', 'Cancel'],
    });
    if (selection === 0) {
        initiateSignupFlow();
    }
}

/**
 * Get the slack Oauth from the registered user
 */
 export async function getSlackAuth() {
    await serviceUtil.getUser();
}

export function checkRegistration(showSignup = false) {
    if (!utilMgr.getItem('name')) {
        if (showSignup) {
            atom.confirm(
                {
                    message:
                        'Connecting Slack requires a registered account. Sign up or log in to continue.',
                    detailedMessage: '',
                    buttons: ['Sign up', 'Cancel'],
                },
                (resp) => {
                    if (resp === 0) {
                        initiateSignupFlow();
                    }
                }
            );
        }
        return false;
    }
    return true;
}
