'use babel';

import { websockets_url } from './Constants';
import { handleFlowScoreMessage } from './message_handlers/flow_score';
import { handleFlowStateMessage } from './message_handlers/flow_state';
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";
import { handleCurrentDayStatsUpdateSocketEvent } from "./message_handlers/current_day_stats_update";

const utilMgr = require('./UtilManager');

const Websocket = require('ws');

const ONE_MIN_MILLIS = 1000 * 60;
const LONG_RECONNECT_DELAY = ONE_MIN_MILLIS * 5;

let intervalId = undefined;

let ws = undefined;

export function initializeWebsockets() {
  clearWebsocketConnectionRetryInterval();
  if (ws) {
    // 1000 indicates a normal closure, meaning that the purpose for
    // which the connection was established has been fulfilled
    ws.close(1000, 're-initializing websocket');
  }

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
    },
    perMessageDeflate: false
  };

  ws = new Websocket(websockets_url, options)

  ws.on('open', () => {
    console.debug("[CodeTime] websockets connection open");
    clearWebsocketConnectionRetryInterval();
  });

  ws.on('message', (data) =>  {
    console.debug("[CodeTime] received websocket message: ", data);
    handleIncomingMessage(data);
  });

  ws.on('close', (code, reason) => {
    if (code !== 1000) {
      // clear this client side timeout
      console.debug("[Codetime] websockets connection closed - will retry in 15 seconds");
      if (!intervalId) {
        intervalId = setInterval(() => {
          initializeWebsockets();
        }, ONE_MIN_MILLIS);
      }
    }
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    console.debug("[Codetime] unexpected websocket response:", response.statusCode);

    if (response.statusCode === 426) {
      console.error("[Codetime] websocket request had invalid headers. Are you behind a proxy?");
    } else if (response.statusCode >= 500) {
      if (!intervalId) {
        // longer timeout
        intervalId = setInterval(() => {
          initializeWebsockets();
        }, LONG_RECONNECT_DELAY);
      }
    }
  });

  ws.on('error', (e) => {
    console.error("[CodeTime] error connecting to websockets", e);
  });
}

export function clearWebsocketConnectionRetryInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
}

const handleIncomingMessage = (data) => {
  try {
    const message = JSON.parse(data);

    switch(message.type) {
      case "flow_score":
        handleFlowScoreMessage(message);
        break;
      case "flow_state":
        handleFlowStateMessage(message.body);
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
    }
  } catch(e) {
    if (data) {
      let dataStr: string = '';
      try {
        dataStr = JSON.stringify(data);
      } catch (e) {
        dataStr = data.toString();
      }
      console.error(`Unable to handle incoming message: ${dataStr}`);
    }
  }
}
