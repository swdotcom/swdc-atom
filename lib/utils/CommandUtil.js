'use babel';

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

                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: interactionType === "click" ? "ct_summary_btn" : "ct_summary_cmd",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "View summary",
                    color: interactionType === "click" ? "purple" : null,
                    icon_name: interactionType === "click" ? "guage" : null
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

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:switch-accounts': () => {
                userstatusMgr.switchAccounts();
            },
        })
    );

    // Code-Time:google-signup
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:google-signup': (interactionType) => {
                userstatusMgr.launchLoginUrl('google');
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: "ct_sign_up_google_btn",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "Sign up with Google",
                    color: "gray",
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
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: "ct_sign_up_github_btn",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "Sign up with GitHub",
                    color: "gray",
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
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: "ct_sign_up_email_btn",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "Sign up with email",
                    color: "gray",
                    icon_name: "envelope"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:see-advanced-metrics': (interactionType) => {
                utilMgr.launchWebDashboardUrl();
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: interactionType === "click" ? "ct_web_metrics_btn" : "ct_web_metrics_cmd",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "See advanced metrics",
                    color: interactionType === "click" ? "blue" : null,
                    icon_name: interactionType === "click" ? "paw" : null
                };
                tracker.trackUIInteraction(interactionType, uiElement);
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
            'Code-Time:open-code-time-metrics': (interactionType) => {
                providerMgr.toggleCodeTimeProvider('on');
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
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
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: "ct_submit_feedback_btn",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "Submit feedback",
                    color: "green",
                    icon_name: "text-bubble"
                };
                tracker.trackUIInteraction(interactionType, uiElement);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:learn-more': (interactionType) => {
                utilMgr.displayReadmeIfNotExists(true /*override*/);
                interactionType = (interactionType && interactionType.detail) ? interactionType.detail : "keyboard";
                const uiElement = {
                    element_name: interactionType === "click" ? "ct_learn_more_btn" : "ct_learn_more_cmd",
                    element_location: interactionType === "click" ? "ct_menu_tree" : "ct_command_palette",
                    cta_text: "Learn more",
                    color: interactionType === "click" ? "yellow" : null,
                    icon_name: interactionType === "click" ? "document" : null
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
        atom.commands.add("atom-workspace", {
            "Code-Time:process-keystrokes-data": event => {
                kpmMgr.sendKeystrokesDataNow();
            },
        })
    );
};

module.exports = commandUtil;
