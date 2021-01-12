'use babel';

import { toggleZenMode, toggleFullScreen } from "../managers/ScreenManager";
import {
  initiateSwitchAccountFlow,
  initiateSignupFlow,
  initiateLoginFlow} from "../utils/PopupUtil";
import {toggleDock, toggleDarkMode} from "../managers/OsaScriptManager";
import {
  toggleSlackPresence,
  setProfileStatus,
  enableSlackNotifications,
  pauseSlackNotifications,
  connectSlackWorkspace,
  disconnectSlackWorkspace} from "../managers/SlackManager";

const dashboardMgr = require('../DashboardManager');
const utilMgr = require('../UtilManager');
const statusMgr = require('../managers/StatusManager');
const userstatusMgr = require('../UserStatusManager');
const providerMgr = require('../tree/ProviderManager');
const projectMgr = require('../managers/ProjectManager');
const kpmMgr = require("../managers/KpmManager");
const tracker = require("../managers/TrackerManager");

const commandUtil = {};

// add the commmands
commandUtil.addCommands = subscriptions => {

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:view-summary': (interactionType) => {
                dashboardMgr.launchCodeTimeDashboard();
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:software-top-40': () => {
                utilMgr.launchSoftwareTopForty();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:switch-accounts': () => {
                initiateSwitchAccountFlow();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:sign-up': () => {
                initiateSignupFlow();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:log-in': () => {
                initiateLoginFlow();
            },
        })
    );

    // Code-Time:google-signup
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:google-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('google');
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:github-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('github');
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:email-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('software');
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:see-advanced-metrics': (interactionType) => {
                utilMgr.launchWebDashboardUrl();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:toggle-status-bar-metrics': (interactionType) => {
                statusMgr.toggleStatusBarMetrics(interactionType);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:refresh-code-time-metrics': () => {
                providerMgr.getTreeProvider().rebuildMetricItems();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:refresh-stat-nodes': () => {
                providerMgr.getTreeProvider().rebuildStateItems();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:open-code-time-metrics': (interactionType) => {
                providerMgr.toggleCodeTimeProvider('on');
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:submit-feedback': (interactionType) => {
                utilMgr.launchSubmitFeedback();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:learn-more': (interactionType) => {
                utilMgr.displayReadmeIfNotExists(true /*override*/);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:open-file': event => {
                utilMgr.launchFile(event.detail);
            },
        })
    );

    subscriptions.add(
        atom.commands.add("atom-workspace", {
            "Code-Time:process-keystrokes-data": event => {
                kpmMgr.sendKeystrokesDataNow();
            },
        })
    );

    // flow commands'
    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:toggle-dark-mode': event => {
          toggleDarkMode();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:toggle-dock': event => {
          toggleDock();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:slack-presence-away': event => {
          toggleSlackPresence();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:slack-presence-active': event => {
          toggleSlackPresence();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:pause-slack-notifications': event => {
          pauseSlackNotifications();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:enable-slack-notifications': event => {
          enableSlackNotifications();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:update-slack-status': event => {
          setProfileStatus();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:connect-slack': event => {
          connectSlackWorkspace();
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:disconnect-slack': event => {
          const authId = (event && event.detail) ? event.detail : "";
          disconnectSlackWorkspace(authId);
        },
      })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
        'Code-Time:toggle-fullscreen': event => {
          toggleFullScreen();
        },
      })
    );
};

module.exports = commandUtil;
