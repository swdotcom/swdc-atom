'use babel';

const utilMgr = require('../UtilManager');

const menuUtil = {};

menuUtil.addCommandPaletteItems = subscriptions => {
    let submenu = utilMgr.getCodeTimeSubmenu();
    let menu = utilMgr.getCodeTimeMenu();

    submenu.push({
        label: 'View summary',
        command: 'Code-Time:dashboard',
    });
    submenu.push({
        label: 'Software top 40',
        command: 'Code-Time:software-top-40',
    });
    submenu.push({
        label: 'Web dashboard',
        command: 'Code-Time:web-dashboard',
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
