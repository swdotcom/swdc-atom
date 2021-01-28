'use babel';

import { websockets_url } from './Constants';
import { handleFlowScoreMessage } from './message_handlers/flow_score';

const Websocket = require('ws');
const utilMgr = require('./UtilManager');

let intervalId = undefined;

export function initializeWebsockets() {
  const options = {
    headers: {
      "Authorization": utilMgr.getItem("jwt")
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

    switch(message.type) {
      case "info":
        console.info(`[CodeTime] ${message.body}`);
        break;
      case "flow_score":
        handleFlowScoreMessage(message);
        break;
      default:
        console.warn("[CodeTime] received unhandled websocket message type", data);
    }
  } catch(e) {
    console.error("[CodeTime] Unable to handle incoming message", data);
  }
}