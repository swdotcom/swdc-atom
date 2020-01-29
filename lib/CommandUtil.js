const dashboardMgr = require('./DashboardManager');
const utilMgr = require('./UtilManager');
const userstatusMgr = require('./UserStatusManager');
const providerMgr = require('./tree/ProviderManager');
const eventMgr = require('./managers/EventManager');

const commandUtil = {};

commandUtil.addCommands = subscriptions => {
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:dashboard': () => {
                utilMgr.launchCodeTimeDashboard();
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
            'Code-Time:refreshCodeTimeTree': () =>
                providerMgr.getTreeProvider().initialize(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:refreshSessionSummary': () =>
                dashboardMgr.getSessionSummaryStatus(true),
        })
    );
};

module.exports = commandUtil;
