'use babel';

import { generateContributorSummary } from '../managers/ReportManager';

const dashboardMgr = require('../DashboardManager');
const utilMgr = require('../UtilManager');
const statusMgr = require('../managers/StatusManager');
const userstatusMgr = require('../UserStatusManager');
const providerMgr = require('../tree/ProviderManager');
const eventMgr = require('../managers/EventManager');
const projectMgr = require('../managers/ProjectManager');
const kpmMgr = require("../managers/KpmManager");
const tracker = require("../managers/TrackerManager");

const commandUtil = {};

// add the commmands
commandUtil.addCommands = subscriptions => {
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:dashboard': (interactionType) => {
                dashboardMgr.launchCodeTimeDashboard();
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_summary_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "View summary",
                  color: "purple",
                  icon_name: "guage"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
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
    // Code-Time:google-signup
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:google-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('google');
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_sign_up_google_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Sign up with Google",
                  color: "grey",
                  icon_name: "google"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:github-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('github');
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_sign_up_github_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Sign up with GitHub",
                  color: "grey",
                  icon_name: "github"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:email-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('software');
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_sign_up_email_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Sign up with email",
                  color: "grey",
                  icon_name: "envelope"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:web-dashboard': (interactionType) => {
                utilMgr.launchWebDashboardUrl();
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_web_metrics_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "View web analytics",
                  color: "blue",
                  icon_name: "paw"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:toggle-status-bar-metrics': (interactionType) => {
                statusMgr.toggleStatusBarMetrics();
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_toggle_status_bar_metrics_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Toggle status bar metrics",
                  color: "blue",
                  icon_name: "slash-eye"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:refresh-code-time-metrics': () => {
                providerMgr.getTreeProvider().initialize();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:open-code-time-metrics': (interactionType) => {
                providerMgr.toggleCodeTimeProvider('on');
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_status_bar_metrics_btn",
                  element_location: interactionType === "click" ? "ct_status_bar" : "ct_command_palette",
                  cta_text: "status bar metrics",
                  color: null,
                  icon_name: "clock"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:submit-feedback': (interactionType) => {
                utilMgr.launchSubmitFeedback();
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_submit_feedback_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Submit feedback",
                  color: null,
                  icon_name: "envelope"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:learn-more': (interactionType) => {
                utilMgr.displayReadmeIfNotExists(true /*override*/);
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_learn_more_btn",
                  element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                  cta_text: "Learn more",
                  color: "yellow",
                  icon_name: "document"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
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
        atom.commands.add('atom-workspace', {
            'Code-Time:generate-contributor-summary': (interactionType) => {
                const projectDir = projectMgr.getProjectDirectory();
                generateContributorSummary(projectDir);
                interactionType = (interactionType) ? interactionType.detail : "keyboard";
                const uiElement = {
                  element_name: "ct_contributor_repo_identifier_btn",
                  element_location: interactionType === "click" ? "ct_contributors_tree" : "ct_command_palette",
                  cta_text: "redacted",
                  color: "white",
                  icon_name: "repo"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );

    subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Code-Time:process-keystrokes-data": event => {
          kpmMgr.sendKeystrokesDataNow();
        },
      })
    )
};

module.exports = commandUtil;
