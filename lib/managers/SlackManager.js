'use babel';

import { api_endpoint } from '../Constants';
const utilMgr = require('../UtilManager');
const queryString = require('query-string');
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

// connect slack flow
export function connectSlackWorkspace() {
  const registered = checkRegistration(true);
  if (!registered) {
    return;
  }

  const qryStr = queryString.stringify({
    plugin: utilMgr.getPluginType(),
    plugin_uuid: utilMgr.getPluginUuid(),
    pluginVersion: utilMgr.getVersion(),
    plugin_id: utilMgr.getPluginId(),
    auth_callback_state: utilMgr.getAuthCallbackState(),
    integrate: "slack",
    plugin_token: utilMgr.getItem("jwt")
  });

  const url = `${api_endpoint}/auth/slack?${qryStr}`;

  // authorize the user for slack
  utilMgr.launchWebUrl(url);
}

export async function disconectAllSlackIntegrations() {
    const workspaces = await getSlackWorkspaces();
    if (workspaces) {
        // atom doesn't like "for await". It complains its an unexpected token
        // using normal for loop
        for (let i = 0; i < workspaces.length; i++) {
            const workspace = workspaces[i];
            await removeSlackIntegration(workspace.authId);
        }
    }
}

export function disconnectSlackWorkspace(authId = '') {
    if (!authId) {
        showSlackWorkspaceSelection(disconnectSlackWorkspaceCallback);
    } else {
        removeSlackIntegration(authId);
    }
}

function disconnectSlackWorkspaceCallback(selectedWorkspace) {
    if (!selectedWorkspace) {
        return;
    } else if (selectedWorkspace.value === 'Code-Time:connect-slack') {
        // call the connect slack workflow
        connectSlackWorkspace();
        return;
    }

    removeSlackIntegration(selectedWorkspace.authId);
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

/**
 * Remove an integration from the local copy
 * @param authId
 */
export async function removeSlackIntegration(authId) {
    await serviceUtil.softwareDelete(`/integrations/${authId}`);
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

// -------------------------------------------
// - private methods
// -------------------------------------------

async function showSlackWorkspaceSelection(callback) {
    let items = [];

    const workspaces = await getSlackWorkspaces();
    if (workspaces) {
        items = workspaces.map((workspace) => {
            return {
                text: workspace.team_domain,
                value: workspace,
            };
        });
    }

    items.push({
        text: 'Connect a Slack workspace',
        value: 'Code-Time:connect-slack',
    });

    showSlackWorkspaceMenuOptions(callback, items);
}
