const dashboardMgr = require('./DashboardManager');
const utilMgr = require('./UtilManager');
const userstatusMgr = require('./UserStatusManager');
const providerMgr = require('./tree/ProviderManager');

const commandUtil = {};

commandUtil.addCommands = subscriptions => {
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:dashboard': () => utilMgr.launchCodeTimeDashboard(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:software-top-40': () => utilMgr.launchSoftwareTopForty(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:web-dashboard': () => utilMgr.launchWebDashboardUrl(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:log-in': () => userstatusMgr.launchLoginUrl(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Code-Time:toggle-status-bar-metrics': () =>
                utilMgr.toggleStatusBarMetrics(),
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
