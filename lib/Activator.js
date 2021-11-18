'use babel';

import { CompositeDisposable } from 'atom';
import defaulConfig from './config';
import {
    clearWebsocketConnectionRetryInterval,
    initializeWebsockets,
} from './websockets';
import { initializeFlowModeState } from './managers/FlowManager';

const utilMgr = require('./UtilManager');
const commandUtil = require('./utils/CommandUtil');
const eventMgr = require('./managers/EventManager');
const wallClockMgr = require('./managers/WallClockManager');
const providerMgr = require('./tree/ProviderManager');
const kpmMgr = require('./managers/KpmManager');
const serviceUtil = require('./utils/ServiceUtil');
const pluginDataMgr = require('./managers/PluginDataManager');
const tracker = require('./managers/TrackerManager');
const sessionAppMgr = require('./managers/SessionAppManager');

let packageVersion = null;

export default {
    config: defaulConfig,
    subscriptions: null,

    async activate(state, tries = 0) {
        let jwt = utilMgr.getItem('jwt');
        if (!jwt) {
            // create an anon user
            jwt = await serviceUtil.createAnonymousUser();
            if (!jwt) {
                if (tries === 0) {
                    const isOnline = await serviceUtil.serverIsAvailable();
                    if (!isOnline) {
                        utilMgr.showOfflinePrompt();
                    }
                }
                if (tries < 5) {
                    setTimeout(() => {
                        this.activate(state, tries);
                    }, 1000 * 6);
                    return;
                }
            } else {
                this.initializePlugin(state, true);
            }
        }
        this.initializePlugin(state, false);
    },

    async initializePlugin() {
        packageVersion = atom.packages.getLoadedPackage('code-time').metadata
            .version;
        console.log(`Code Time: Loaded v${packageVersion}`);

        try {
            initializeWebsockets();
        } catch (e) {
            console.error('[CodeTime] failed to initialize websockets', e);
        }

        // activate the plugin data manager
        pluginDataMgr.initializePluginDataMgr();

        // initialize singletons
        providerMgr.init();

        // initialize the tracker manager
        await tracker.init();

        // store the activate event
        tracker.trackEditorAction('editor', 'activate');

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        // start the wall clock timer
        wallClockMgr.init();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);

        // intialize the editor event handling
        kpmMgr.activeTextEditorHandler();

        // initialize the status bar text
        eventMgr.initializeStatus();

        utilMgr.displayReadmeIfNotExists();

        const initializedAtomPlugin = utilMgr.getItem('atom_CtInit');
        if (!initializedAtomPlugin) {
            utilMgr.setItem('atom_CtInit', true);

            // show the tree view
            providerMgr.toggleCodeTimeProvider('on');

            // activate the plugin
            serviceUtil.softwarePost(
                '/plugins/activate',
                {}
            );
        }

        sessionAppMgr.updateSessionSummaryFromServer();
        initializeFlowModeState();
    },

    deactivate() {

        tracker.trackEditorAction('editor', 'deactivate');

        clearWebsocketConnectionRetryInterval();

        if (utilMgr.getStatusView()) {
            utilMgr.getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },
};
