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
    const dock = atom.workspace.getLeftDock();
    try {
        // add these first for performance
        dock.getPanes()[0].addItem(codetimeProvider);
        dock.getPanes()[0].activateItem(codetimeProvider);
    } catch (e) {
        if (
            e.message.includes('can only contain one instance of the tree view')
        ) {
            logger.error(e.message);
        }
    }

    // Sometimes dock title is hidden for somehow,
    // so force recalculate here to redraw
    $('ul.list-inline.tab-bar.inset-panel').height();

    if (!state) {
        dock.toggle();
    } else if ('on' === state) {
        dock.show();
    } else if ('off' === state) {
        dock.hide();
    }
    if (dock.isVisible()) {
        codetimeProvider.initialize();
    }
};

module.exports = providerManager;
