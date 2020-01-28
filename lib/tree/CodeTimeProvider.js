'use babel';

import $ from 'jquery';
import fs from 'fs';
import path from 'path';
import _find from 'lodash/find';
import _forEach from 'lodash/forEach';
const utilMgr = require('../UtilManager');

export default class CodeTimeProvider {
    constructor() {
        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'structure-view.html'),
            {
                encoding: 'utf-8',
            }
        );
        this.element = $(htmlString).get(0);
        this.viewType = 'codetimeProvider';
    }
    showLoader() {
        $('#tree-content').hide();
        $('#loader').show();
    }

    hideLoader() {
        $('#tree-content').show();
        $('#loader').hide();
    }

    initialize() {
        this.showLoader();
        this.renderTree();
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
        }
    }

    renderTree() {
        let html = this.treeGenerator();
        $('div.structure-view>div>ol').html(html);
        this.hideLoader();
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    treeGenerator() {
        const self = this;

        if (utilMgr.showingStatusBarText()) {
            $('#toggle-status-metrics').html('Hide status bar metrics');
        } else {
            $('#toggle-status-metrics').html('Show status bar metrics');
        }

        const array = [];
        return array.join('');
    }

    serialize() {}

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Code Time';
    }
}

$(document).on('click', '#advanced-metrics', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:web-dashboard'
    );
});

$(document).on('click', '#generate-dashboard', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:dashboard'
    );
});

$(document).on('click', '#toggle-status-metrics', async function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:toggle-status-bar-metrics'
    );
});
