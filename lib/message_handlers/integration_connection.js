'use babel';

import { getSlackAuth } from "../managers/SlackManager";

const utilMgr = require('../UtilManager');

export async function handleIntegrationConnectionSocketEvent(body) {
  // integration_type_id = 14 (slack)
  // action = add, update, remove
  const { integration_type_id, integration_type, action } = body;

  if (integration_type_id === 14) {
    // this will add or remove integrations
    await getSlackAuth();

    if (action === "add") {
      // refresh the slack integrations
      // clear the auth callback state
      utilMgr.setAuthCallbackState(null);
      atom.notifications.addInfo("Slack connect", { detail: "Successfully connected to Slack", dismissable: true });
    }

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-flow-nodes'
    );
  }
}
