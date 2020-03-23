'use babel';

const dashboardMgr = require('../DashboardManager');
const utilMgr = require('../UtilManager');
const statusMgr = require('../managers/StatusManager');
const userstatusMgr = require('../UserStatusManager');
const providerMgr = require('../tree/ProviderManager');
const eventMgr = require('../managers/EventManager');

const commandUtil = {};

commandUtil.addCommands = subscriptions => {
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:dashboard': () => {
                dashboardMgr.launchCodeTimeDashboard();
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuLaunchDashboard'
                );
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:software-top-40': () => {
                utilMgr.launchSoftwareTopForty();
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuSoftwareTop40'
                );
            },
        })
    );
    // Code-Time:google-signup
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:google-signup': () => {
                userstatusMgr.launchLoginUrl('google');
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuLogin'
                );
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:github-signup': () => {
                userstatusMgr.launchLoginUrl('github');
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuLogin'
                );
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:email-signup': () => {
                userstatusMgr.launchLoginUrl('software');
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuLogin'
                );
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:web-dashboard': () => {
                utilMgr.launchWebDashboardUrl();
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuLaunchWebDashboard'
                );
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:toggle-status-bar-metrics': () => {
                statusMgr.toggleStatusBarMetrics();
                eventMgr.createCodeTimeEvent(
                    'mouse',
                    'click',
                    'PaletteMenuToggleStatusBarMetrics'
                );
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
            'Code-Time:open-code-time-metrics': () => {
                providerMgr.toggleCodeTimeProvider('on');
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:submit-feedback': () => {
                utilMgr.launchSubmitFeedback();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:learn-more': () => {
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
};

module.exports = commandUtil;
