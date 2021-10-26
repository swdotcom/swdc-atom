'use babel';

import { initiateFlow } from "../managers/FlowManager";

export async function handleFlowScoreMessage(message) {
  console.debug("[CodeTime] received flow score message", message);

  try {
    // enable flow mode
    initiateFlow(true)
  } catch(e) {
    console.error("[CodeTime] unable to handle flow score message", e)
  }
}
