'use babel';

import { initiateFlow, enabledFlow, enablingFlow } from "../managers/FlowManager";
import { getConfigSettings } from "../managers/ConfigManager";

export async function handleFlowScoreMessage(message) {
  console.debug("[CodeTime] received flow score message", message);

  try {
    const remindersEnabled = getConfigSettings().flowModeReminders

    if(remindersEnabled && !enabledFlow && !enablingFlow) {
      const { notificationText, cta } = message.body;

      if (notificationText) {
        const notification = atom.notifications.addInfo(
          notificationText,
          {
            buttons: [{
              className: "btn btn-info",
              onDidClick: function() {
                initiateFlow()
                return notification.dismiss();
              },
              text: cta
            }],
            dismissable: true
          }
        )
      }
    }
  } catch(e) {
    console.error("[CodeTime] unable to handle flow score message", e)
  }
}