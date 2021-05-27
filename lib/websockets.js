'use babel';

import { websockets_url } from './Constants';
import { handleFlowScoreMessage } from './message_handlers/flow_score';
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";
import { handleCurrentDayStatsUpdateSocketEvent } from "./message_handlers/current_day_stats_update";

const utilMgr = require('./UtilManager');

const Websocket = require('ws');

let intervalId = undefined;

export function initializeWebsockets() {
  const options = {
    headers: {
      "Authorization": utilMgr.getItem("jwt"),
      "X-SWDC-Plugin-Id": utilMgr.getPluginId(),
      "X-SWDC-Plugin-Name": utilMgr.getPluginName(),
      "X-SWDC-Plugin-Version": utilMgr.getVersion(),
      "X-SWDC-Plugin-OS": utilMgr.getOs(),
      "X-SWDC-Plugin-TZ": Intl.DateTimeFormat().resolvedOptions().timeZone,
      "X-SWDC-Plugin-Offset": utilMgr.getOffsetSeconds() / 60,
      "X-SWDC-Plugin-UUID": utilMgr.getPluginUuid(),
    }
  };

  const ws = new Websocket(websockets_url, options)

  ws.on('open', () => {
    console.debug("[CodeTime] websockets connection open");
    clearInterval(intervalId);
  });

  ws.on('message', (data) =>  {
    console.debug("[CodeTime] received websocket message: ", data);
    handleIncomingMessage(data);
  });

  ws.on('close', () => {
    console.debug("[Codetime] websockets connection closed - will retry in 10 seconds");
    clearWebsocketConnectionRetryInterval();
    intervalId = setInterval(() => {
      console.log("[CodeTime] attempting to reinitialize websockets connection");
      initializeWebsockets();
    }, 10000);
  });

  ws.on('error', (e) => {
    console.error("[CodeTime] error connecting to websockets", e);
  });
}

export function clearWebsocketConnectionRetryInterval() {
  clearInterval(intervalId);
}

const handleIncomingMessage = (data) => {
  try {
    const message = JSON.parse(data);

    console.info(`[CodeTime] received '${message.type}' websocket event`);

    switch(message.type) {
      case "info":
        console.info(`[CodeTime] ${message.body}`);
        break;
      case "flow_score":
        handleFlowScoreMessage(message);
        break;
      case "authenticated_plugin_user":
        handleAuthenticatedPluginUser(message.body);
        break;
      case "user_integration_connection":
        handleIntegrationConnectionSocketEvent(message.body);
        break;
      case "current_day_stats_update":
        handleCurrentDayStatsUpdateSocketEvent(message.body);
        break;
      default:
        console.warn("[CodeTime] received unhandled websocket message type", data);
    }
  } catch(e) {
    console.error("[CodeTime] Unable to handle incoming message", data);
  }
}
