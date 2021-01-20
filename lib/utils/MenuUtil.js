'use babel';

const utilMgr = require('../UtilManager');

const menuUtil = {};

menuUtil.addCommandPaletteItems = subscriptions => {
    let submenu = utilMgr.getCodeTimeSubmenu();
    let menu = utilMgr.getCodeTimeMenu();

    submenu.push({
        label: 'View Dashboard',
        command: 'Code-Time:view-dashboard',
    });
    submenu.push({
        label: 'Software top 40',
        command: 'Code-Time:software-top-40',
    });
    submenu.push({
        label: 'See advanced Metrics',
        command: 'Code-Time:see-advanced-metrics',
    });
    submenu.push({
        label: 'Show/hide status bar metrics',
        command: 'Code-Time:toggle-status-bar-metrics',
    });

    menu.push({
        label: 'Packages',
        submenu: [
            {
                label: 'Code Time',
                submenu: submenu,
            },
        ],
    });

    atom.menu.add(menu);
    atom.menu.update();
};

module.exports = menuUtil;
