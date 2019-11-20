"use babel";
import { api_endpoint } from "./Constants";
// import { getItem, launchWebUrl } from "../Util";
const utilMgr = require("./UtilManager");
// import { refetchSlackConnectStatusLazily } from "../DataController";
const { WebClient } = require("@slack/web-api");
// import { showQuickPick } from "../MenuManager";
const CONNECT_SLACK_MENU_LABEL = 'Connect slack';
const DISCONNECT_SLACK_MENU_LABEL = 'Disconnect slack';
const DISCONNECT_SLACK_COMMAND_KEY = 'Music-Time:disconnectSlack';
export async function connectSlack() {
    // authorize the user for slack
    const endpoint = `${api_endpoint}/auth/slack?integrate=slack&plugin=musictime&token=${utilMgr.getItem(
        "jwt"
    )}`;
    utilMgr.launchWebUrl(endpoint);
    utilMgr.refetchSlackConnectStatusLazily();
    utilMgr.removeMusicMenuItem(CONNECT_SLACK_MENU_LABEL);
    utilMgr.addMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL, DISCONNECT_SLACK_COMMAND_KEY);
    utilMgr.notify(
        "Music Time",
        `Successfully connected to Slack`
      );
}

export async function showSlackChannelMenu() {
    let menuOptions = {
        items: [],
        placeholder: "Select a channel"
    };

    // get the available channels
    const channelNames = await getChannelNames();
    channelNames.sort();

    channelNames.forEach(channelName => {
        menuOptions.items.push({
            label: channelName
        });
    });

    const pick = await showQuickPick(menuOptions);
    if (pick && pick.label) {
        return pick.label;
    }
    return null;
}

async function getChannels() {
    const slackAccessToken = utilMgr.getItem("slack_access_token");
    const web = new WebClient(slackAccessToken);
    const result = await web.channels
        .list({ exclude_archived: true, exclude_members: true })
        .catch(err => {
            console.log("Unable to retrieve slack channels: ", err.message);
            return [];
        });
    if (result && result.ok) {
        return result.channels;
    }
    return [];
}

async function getChannelNames() {
    const channels = await getChannels();
    if (channels && channels.length > 0) {
        return channels.map(channel => {
            return channel.name;
        });
    }
    return [];
}

export async function initializeSlack() {
    const serverIsOnline = await serverIsAvailable();
    if (serverIsOnline) {
        const spotifyOauth = await utilMgr.getSlackOauth(serverIsOnline);
        if (spotifyOauth) {
            // update the CodyMusic credentials
            updateSlackAccessInfo(spotifyOauth);
        } else {
            utilMgr.setItem("slack_access_token", null);
        }
    }
}

export async function updateSlackAccessInfo(slackOauth) {
    /**
     * {access_token, refresh_token}
     */
    if (slackOauth) {
        utilMgr.setItem("slack_access_token", slackOauth.access_token);
    } else {
        utilMgr.setItem("slack_access_token", null);
    }
}
