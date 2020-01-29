'use babel';

import CodeTimeProvider from './CodeTimeProvider';
import $ from 'jquery';

const providerManager = {};

let codetimeProvider = null;

providerManager.init = () => {
    if (!codetimeProvider) {
        codetimeProvider = new CodeTimeProvider();
    }
};

providerManager.getTreeProvider = () => {
    return codetimeProvider;
};

providerManager.toggleCodeTimeProvider = state => {
    const rightDock = atom.workspace.getLeftDock();
    try {
        // Whatever do these first for performance
        rightDock.getPanes()[0].addItem(codetimeProvider);
        rightDock.getPanes()[0].activateItem(codetimeProvider);
    } catch (e) {
        if (e.message.includes('can only contain one instance of item')) {
            logger.error(e.message);
        }
        return;
    }

    // Sometimes dock title is hidden for somehow,
    // so force recalculate here to redraw
    $('ul.list-inline.tab-bar.inset-panel').height();

    if (!state) {
        rightDock.toggle();
    } else if ('on' === state) {
        rightDock.show();
    } else if ('off' === state) {
        rightDock.hide();
    }
    if (rightDock.isVisible()) {
        codetimeProvider.initialize();
    }
};

module.exports = providerManager;
