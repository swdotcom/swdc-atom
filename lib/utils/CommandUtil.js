'use babel';

const dashboardMgr = require('../DashboardManager');
const utilMgr = require('../UtilManager');
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
            'Code-Time:log-in': () => {
                userstatusMgr.launchLoginUrl();
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
            'Code-Time:toggle-status-bar-metrics': () => {
                utilMgr.toggleStatusBarMetrics();
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
            'Code-Time:refresh-session-summary': () => {
                dashboardMgr.getSessionSummaryStatus(true);
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
};

module.exports = commandUtil;
