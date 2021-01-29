'use babel';

import { api_endpoint } from '../Constants';
const utilMgr = require('../UtilManager');
const queryString = require("query-string");
const serviceUtil = require("../utils/ServiceUtil");
const {
  initiateSignupFlow,
  showListSelector,
  showSlackMessageInputPrompt,
  showSlackStatusUpdateOptions,
  showSlackChannelMenuOptions,
  showSlackWorkspaceMenuOptions } = require("../utils/PopupUtil");
const userstatusMgr = require("../UserStatusManager");
const { WebClient } = require("@slack/web-api");

let current_slack_status = null;
let current_slack_presence = null;
let current_dnd_info = null;
let shareMessage = "";
let shareLink = "";
let selectedToken = "";

// -------------------------------------------
// - public methods
// -------------------------------------------

export function clearSlackInfoCache() {
  current_slack_presence = null;
  current_slack_status = null;
  current_dnd_info = null;
}

// get saved slack integrations
export function getSlackWorkspaces() {
  const integrations = utilMgr.getIntegrations();
  if (!integrations) {
    return [];
  }
  return utilMgr.getIntegrations().filter((n) => n.name.toLowerCase() === "slack" && n.status.toLowerCase() === "active");
}

export function hasSlackWorkspaces() {
  return !!getSlackWorkspaces().length;
}

export function slackWorkspaceSelectCallback(selectedTeamDomain) {
  if (selectedTeamDomain) {
    return getWorkspaceAccessToken(selectedTeamDomain);
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
  });

  const url = `${api_endpoint}/auth/slack?${qryStr}`;

  // authorize the user for slack
  utilMgr.launchWebUrl(url);
  // lazily check if the user has completed the slack authentication
  setTimeout(() => {
    (40);
  }, 13000);
}

export async function disconectAllSlackIntegrations() {
  const workspaces = getSlackWorkspaces();
  if (workspaces) {
    // atom doesn't like "for await". It complains its an unexpected token
    // using normal for loop
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      await disconnectSlackAuth(workspace.authId);
    }
  }
}

export function disconnectSlackWorkspace(authId = "") {
  if (!authId) {
    showSlackWorkspaceSelection(disconnectSlackWorkspaceCallback);
  } else {
    disconnectSlackAuth(authId);
  }
}

function disconnectSlackWorkspaceCallback(selectedWorkspace) {
  if (!selectedWorkspace) {
    return;
  } else if (selectedWorkspace.value === "Code-Time:connect-slack") {
    // call the connect slack workflow
    connectSlackWorkspace();
    return;
  }

  disconnectSlackAuth(selectedWorkspace.authId);
}

// disconnect slack flow
export function disconnectSlackAuth(authId) {
  // get the domain
  const integration = getSlackWorkspaces().find((n) => n.authId === authId);
  if (!integration) {
    atom.notifications.addInfo("Disconnect Slack", { detail: "Unable to find selected workspace to disconnect", dismissable: true });
    return;
  }

  atom.confirm({
      message: `Are you sure you would like to disconnect the '${integration.team_domain}' Slack workspace?`,
      detailedMessage: "",
      buttons: ["Disconnect", "Cancel"]
  }, async (resp) => {
      if (resp === 0) {
        await serviceUtil.softwarePut(`/auth/slack/disconnect`, { authId }, utilMgr.getItem("jwt"));
        // disconnected, remove it from the integrations
        removeSlackIntegration(authId);
      }
  });
}

// pause notification on all slack integrations
export async function pauseSlackNotifications(showSuccessNotification = true, initiateFlowRefresh = true, isFlowRequest = false) {
  if (!isFlowRequest && (!checkRegistration(true) || !checkSlackConnection(true))) {
    return;
  }

  let updated = false;
  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    const result = await web.dnd.setSnooze({ num_minutes: 120 }).catch((err) => {
      console.log("unable to activate do not disturb: ", err.message);
      return [];
    });
    if (result && result.ok) {
      updated = true;
    }
  }

  if (updated) {
    // null out the slack dnd info cache
    current_dnd_info = null;
    if (showSuccessNotification) {
      atom.notifications.addInfo("Pause notifications", { detail: "Slack notifications are paused for 2 hours", dismissable: true });
    }

    if (initiateFlowRefresh) {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-flow-nodes'
      );
    }
  }
}

// enable notifications on all slack integrations
export async function enableSlackNotifications(showSuccessNotification = true, initiateFlowRefresh = true, isFlowRequest = false) {
  if (!isFlowRequest && (!checkRegistration(true) || !checkSlackConnection(true))) {
    return;
  }

  let updated = false;
  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    const result = await web.dnd.endSnooze().catch((err) => {
      console.log("error ending slack snooze: ", err.message);
      return [];
    });
    if (result && result.ok) {
      updated = true;
    }
  }

  if (updated) {
    current_dnd_info = null;
    if (showSuccessNotification) {
      atom.notifications.addInfo("Enable notifications", { detail: "Turned on Slack notifications", dismissable: true });
    }
    if (initiateFlowRefresh) {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-flow-nodes'
      );
    }
  }

}

/**
 * check if snooze is enabled for a slack workspace
 * @param domain
 * @returns {dnd_enabled (bool), next_dnd_end_ts (unix), next_dnd_start_ts (unix), snooze_endtime (unix), ok (bool), snooze_enabled (bool)}
 * ts is in unix seconds
 */
export async function getSlackDnDInfo() {
  if (!checkRegistration() || !checkSlackConnection()) {
    current_dnd_info = null;
    return current_dnd_info;
  }

  if (current_dnd_info) {
    return current_dnd_info;
  }

  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    current_dnd_info = await getSlackDnDInfoPerDomain(workspace.team_domain);
    if (current_dnd_info) {
      break;
    }
  }
  return current_dnd_info;
}

export async function setFlowModeStatus(statusData) {
  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    await web.users.profile
      .set({ profile: statusData })
      .then(() => {
        updatedStatus = true;
      })
      .catch((e) => {
        console.error("error setting profile status: ", e.message);
      });
  }
}

// set the slack profile status
export function setProfileStatus() {
  if (!checkRegistration(true) || !checkSlackConnection(true)) {
    current_slack_status = null;
    return;
  }

  // if there's a status already set, show the "clear" or "update" list selector
  if (current_slack_status) {
    showStatusUpdateOptions();
  } else {
    setProfileStatusCallback("update");
  }
}

export function setProfileStatusCallback(decision) {
  if (!decision) {
    return;
  }

  let status = {
    status_text: "",
    status_emoji: "",
  };
  if (decision === "update") {
    setTimeout(() => {
      showMessageInputPrompt();
    }, 1000);
  } else {
    updateSlackStatusProfileCallback(status);
  }
}

// Get the users slack status
export async function getSlackStatus() {
  const registered = checkRegistration(false);
  if (!registered) {
    current_slack_status = null;
    return current_slack_status;
  }

  if (current_slack_status) {
    return current_slack_status;
  }

  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    // {profile: {avatar_hash, display_name, display_name_normalized, email, first_name,
    //  image_1024, image_192, etc., last_name, is_custom_image, phone, real_name, real_name_normalized,
    //  status_text, status_emoji, skype, status_expireation, status_text_canonical, title } }
    const data = await web.users.profile.get().catch((e) => {
      console.error("error fetching slack profile: ", e.message);
    });
    // set the cached var and return it
    current_slack_status = data && data.profile ? data.profile.status_text : "";
    break;
  }
  return current_slack_status;
}

/**
 * Return the users presence:
 * {auto_away (bool), connection_count (int), last_activity (unix), manual_away (bool), ok (bool), online (bool), presence: ['active'|'away']}
 */
export async function getSlackPresence() {
  const registered = checkRegistration(false);
  if (!registered) {
    current_slack_presence = null;
    return current_slack_presence;
  }

  if (current_slack_presence) {
    return current_slack_presence;
  }

  // return the 1st one
  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    // ok: true, presence: "active", online: true, auto_away: false, manual_away: false, connection_count: 1, last_activity: 1609959319
    const data = await web.users.getPresence().catch((e) => {
      console.error("error fetching slack presence: ", e.message);
    });
    // set the cached var and return it
    current_slack_presence = data && data.presence ? data.presence : "active";
    break;
  }
  return current_slack_presence;
}

export async function toggleSlackPresence() {
  if (!checkRegistration(true) || !checkSlackConnection(true)) {
    return;
  }

  // presence val can be either: auto or away
  const presenceVal = current_slack_presence === "active" ? "away" : "auto";
  updateSlackPresence(presenceVal);
}

export async function updateSlackPresence(presenceVal, showSuccessNotification = true, initiateFlowRefresh = true) {
  let updated = false;
  const workspaces = getSlackWorkspaces();
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    const presenceUpdate = { presence: presenceVal };
    await web.users
      .setPresence(presenceUpdate)
      .then(() => {
        updated = true;
      })
      .catch((e) => {
        console.error("error updating slack presence: ", e.message);
      });
  }
  if (updated) {
    current_slack_presence = presenceVal;
    if (showSuccessNotification) {
      atom.notifications.addInfo("Presence update", { detail: "Slack presence updated", dismissable: true });
    }

    if (initiateFlowRefresh) {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-flow-nodes'
      );
    }
  }
}

export function shareSlackMessage(message) {
  if (!checkRegistration(true) || !checkSlackConnection(true)) {
    return;
  }

  shareMessage = message;
  showSlackWorkspaceSelection(showChannelsToPostShareCallback);
}

export async function showChannelsToPostShareCallback(selectedWorkspace) {
  if (!selectedWorkspace) {
    return;
  } else if (selectedWorkspace === "Code-Time:connect-slack") {
    // call the connect slack workflow
    connectSlackWorkspace();
    return;
  }
  // show the channel to select
  let channels = await getChannels(selectedWorkspace);
  showSlackChannelMenuOptions(shareSlackMessageCallback, channels);
}

export function shareSlackMessageCallback(selected_channel, access_token) {
  if (!selected_channel) {
    return;
  }
  selectedToken = access_token;
  selectedChannel = selected_channel;
  showSlackMessageInputPrompt(shareSlackMessageCompletionCallback, shareMessage);
}

export function shareSlackMessageCompletionCallback(text) {
  if (!text) {
    return;
  }
  let messagePost = text
  if (shareLink) {
    messagePost += `\n${shareLink}`;
  }
  postMessage(selectedChannel, selectedToken, messagePost);
}

export async function checkSlackConnectionForFlowMode() {
  if (!hasSlackWorkspaces()) {
    const selection = await atom.confirm({
        message: "Slack isn't connected",
        detailedMessage: "",
        buttons: ["Continue anyway", "Connect Slack"]
    });
    if (selection == -1) {
      // the user selected "cancel"
      return { connected: false, usingAllSettingsForFlow: true };
    } else if (selection === 0) {
      return { connected: true, usingAllSettingsForFlow: false };
    } else {
      // connect was selected
      connectSlackWorkspace();
      return { connected: false, usingAllSettingsForFlow: true };
    }
  }
  return { connected: true, usingAllSettingsForFlow: true };
}

export async function showModalSignupPrompt(msg: string) {
  const selection = await atom.confirm({
      message: msg,
      detailedMessage: "",
      buttons: ["Sign up", "Cancel"]
  });
  if (selection === 0) {
    initiateSignupFlow();
  }
}

// -------------------------------------------
// - private methods
// -------------------------------------------

async function updateSlackStatusProfileCallback(statusObject) {
  const workspaces = getSlackWorkspaces();
  // example:
  // { status_text: message, status_emoji: ":mountain_railway:", status_expiration: 0 }
  let updated = false;
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const web = new WebClient(workspace.access_token);
    delete web["axios"].defaults.headers["User-Agent"];
    await web.users.profile
      .set({ profile: statusObject })
      .then(() => {
        updated = true;
      })
      .catch((e) => {
        console.error("error setting profile status: ", e.message);
      });
  }
  if (updated) {
    atom.notifications.addInfo("Status update", { detail: "Slack profile status updated", dismissable: true });
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}

async function showSlackWorkspaceSelection(callback) {
  let items = [];

  const workspaces = getSlackWorkspaces();
  if (workspaces) {
    items = workspaces.map((workspace) => {
      return {
        text: workspace.team_domain,
        value: workspace,
      };
    });
  }

  items.push({
    text: "Connect a Slack workspace",
    value: "Code-Time:connect-slack",
  });

  showSlackWorkspaceMenuOptions(callback, items);
}

function showMessageInputPrompt() {
  showSlackMessageInputPrompt(showMessageInputPromptCallback);
}

function showMessageInputPromptCallback(text) {
  if (!text) {
    return "Please enter a valid message to continue.";
  }
  if (text.length > 100) {
    return "The Slack status must be 100 characters or less.";
  }
  let status = {
    status_text: text,
    status_expiration: 0
  }
  updateSlackStatusProfileCallback(status);
}

/**
 * Show the list of channels in the command palette
 */
export async function showSlackChannelMenu(callback) {
  let channels = await getChannels();
  showSlackChannelMenuOptions(channels, callback);
}

function getWorkspaceAccessToken(team_domain) {
  const integration = getSlackWorkspaces().find((n) => n.team_domain === team_domain);
  if (integration) {
    return integration.access_token;
  }
  return null;
}

function getChannels() {
  showSlackWorkspaceSelection(getChannelsCallback);
}

async function getChannelsCallback(selectedWorkspace) {
  if (!selectedWorkspace) {
    return;
  } else if (selectedWorkspace.value === "musictime.connectSlack") {
    // call the connect slack workflow
    connectSlackWorkspace();
    return;
  }
  const access_token = selectedWorkspace.access_token;

  const web = new WebClient(access_token);
  delete web["axios"].defaults.headers["User-Agent"];
  const result = await web.conversations.list({ exclude_archived: true }).catch((err) => {
    console.log("unable to retrieve slack channels: ", err.message);
    return [];
  });
  if (result && result.ok) {
    /**
    created:1493157509
    creator:'U54G1N6LC'
    id:'C53QCUUKS'
    is_archived:false
    is_channel:true
    is_ext_shared:false
    is_general:true
    is_group:false
    is_im:false
    is_member:true
    is_mpim:false
    is_org_shared:false
    is_pending_ext_shared:false
    is_private:false
    is_shared:false
    name:'company-announcements'
    name_normalized:'company-announcements'
    num_members:20
    */
    // update the channel objects to contain value and text
    const channels = result.channels.map(n => {
        return {
          ...n,
          value: n.id,
          text: n.name_normalized,
          token: access_token
        };
    });

    channels.sort(compareLabels);
    return channels;
  }
  return [];
}

/**
 * Recursive function to determine slack connection
 * @param tryCountUntilFoundUser
 */
async function refetchSlackConnectStatusLazily(tryCountUntilFoundUser) {
  const slackAuth = await getSlackAuth();
  if (!slackAuth) {
    // try again if the count is not zero
    if (tryCountUntilFoundUser > 0) {
      tryCountUntilFoundUser -= 1;
      setTimeout(() => {
        refetchSlackConnectStatusLazily(tryCountUntilFoundUser);
      }, 10000);
    } else {
      // clear the auth callback state
      utilMgr.setAuthCallbackState(null);
    }
  } else {
    // clear the auth callback state
    utilMgr.setAuthCallbackState(null);

    atom.notifications.addInfo("Slack connect", { detail: "Successfully connected to Slack", dismissable: true });

    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-flow-nodes'
    );
  }
}

/**
 * Get the slack Oauth from the registered user
 */
async function getSlackAuth() {
  const { user } = await userstatusMgr.getUserRegistrationState(true /*isIntegration*/);
  return updateSlackIntegrations(user);
}

export async function updateSlackIntegrations(user) {
  let foundNewIntegration = false;
  let currentIntegrations = utilMgr.getIntegrations();
  if (user && user.registered === 1 && user.integrations) {

    // find the slack auth
    for (const integration of user.integrations) {
      // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
      if (integration.name.toLowerCase() === "slack" && integration.status.toLowerCase() === "active"
          && integration.access_token) {
        // check if it exists
        const foundIntegration = currentIntegrations.find((n) => n.authId === integration.authId);
        if (!foundIntegration) {
          // get the workspace domain using the authId
          const web = new WebClient(integration.access_token);
          delete web["axios"].defaults.headers["User-Agent"];
          const usersIdentify = await web.users.identity().catch((e) => {
            console.log("error fetching slack team info: ", e.message);
            return null;
          });
          if (usersIdentify) {
            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            integration["team_domain"] = usersIdentify.team ? usersIdentify.team.domain : "";
            integration["team_name"] = usersIdentify.team ? usersIdentify.team.name : "";
            integration["integration_id"] = usersIdentify.user ? usersIdentify.user.id : "";
            // add it
            currentIntegrations.push(integration);

            foundNewIntegration = true;
          }
        }
      }
    }
  } else {
    // no user or they are not registered
    currentIntegrations = [];
  }
  utilMgr.syncIntegrations(currentIntegrations);
  return foundNewIntegration;
}

/**
 * Post the message to the slack channel
 * @param selectedChannel
 * @param message
 */
async function postMessage(selectedChannel, access_token, message) {
  message = "```" + message + "```";
  const web = new WebClient(access_token);
  delete web["axios"].defaults.headers["User-Agent"];
  web.chat.postMessage({
      text: message,
      channel: selectedChannel,
      as_user: true,
    })
    .catch((err) => {
      if (err.message) {
        console.log("error posting slack message: ", err.message);
      }
    });
}

/**
 * Remove an integration from the local copy
 * @param authId
 */
function removeSlackIntegration(authId) {
  const currentIntegrations = utilMgr.getIntegrations();

  const newIntegrations = currentIntegrations.filter((n) => n.authId !== authId);
  utilMgr.syncIntegrations(newIntegrations);
}

export function checkRegistration(showSignup = false) {
  if (!utilMgr.getItem("name")) {
    if (showSignup) {
      atom.confirm({
          message: "Connecting Slack requires a registered account. Sign up or log in to continue.",
          detailedMessage: "",
          buttons: ["Sign up", "Cancel"]
      }, (resp) => {
          if (resp === 0) {
            initiateSignupFlow();
          }
      });
    }
    return false;
  }
  return true;
}

export function checkSlackConnection(showConnect = false) {
  if (!hasSlackWorkspaces()) {
    if (showConnect) {
      atom.confirm({
          message: "Connect a Slack workspace to continue.",
          detailedMessage: "",
          buttons: ["Connect", "Cancel"]
      }, (resp) => {
          if (resp === 0) {
            connectSlackWorkspace();
          }
      });
    }
    return false;
  }
  return true;
}

/**
 * Show the list of channels in the command palette
 */
async function showStatusUpdateOptions() {
  showSlackStatusUpdateOptions(setProfileStatusCallback);
}

// get the slack do not disturb info
async function getSlackDnDInfoPerDomain(team_domain) {
  let dndInfo = null;
  const accessToken = getWorkspaceAccessToken(team_domain);
  if (accessToken) {
    const web = new WebClient(accessToken);
    delete web["axios"].defaults.headers["User-Agent"];
    dndInfo = await web.dnd.info().catch((e) => {
      console.error("Error fetching slack do not disturb info: ", e.message);
      return null;
    });
  }
  return dndInfo;
}

function compareLabels(a, b) {
  if (a.name > b.name) return 1;
  if (b.name > a.name) return -1;

  return 0;
}
