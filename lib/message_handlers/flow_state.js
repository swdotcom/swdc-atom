'use babel';

import { pauseFlowInitiate } from "../managers/FlowManager";

export async function handleFlowStateMessage(body) {
  const { enable_flow } = body;

  try {
    // enable flow mode
    if (!enable_flow) {
      pauseFlowInitiate();
    }
  } catch(e) {
    console.error("[CodeTime] unable to handle flow state message", e)
  }
}
