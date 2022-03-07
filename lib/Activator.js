'use babel';

import { CompositeDisposable } from 'atom';
import defaulConfig from './config';
import {
    clearWebsocketConnectionRetryInterval,
    initializeWebsockets,
} from './websockets';
import { initializeFlowModeState } from './managers/FlowManager';
import { ChangeStateManager } from './managers/ChangeStateManager';

const utilMgr = require('./UtilManager');
const commandUtil = require('./utils/CommandUtil');
const eventMgr = require('./managers/EventManager');
const providerMgr = require('./tree/ProviderManager');
const serviceUtil = require('./utils/ServiceUtil');
const tracker = require('./managers/TrackerManager');
const sessionAppMgr = require('./managers/SessionAppManager');

let packageVersion = null;

export default {
    config: defaulConfig,
    subscriptions: null,
    changeStateMgr: null,

    async activate(state, tries = 0) {
        let jwt = utilMgr.getItem('jwt');
        if (!jwt) {
            // create an anon user
            await serviceUtil.createAnonymousUser();
            this.initializePlugin(state, true);
        }
        this.initializePlugin(state, false);
    },

    async initializePlugin() {
        packageVersion = atom.packages.getLoadedPackage('code-time').metadata.version;
        console.log(`Code Time: Loaded v${packageVersion}`);

        try {
            initializeWebsockets();
        } catch (e) {
            console.error('[CodeTime] failed to initialize websockets', e);
        }

        serviceUtil.getUser();

        // initialize singletons
        providerMgr.init();

        // initialize the tracker manager
        await tracker.init();

        // store the activate event
        tracker.trackEditorAction('editor', 'activate');

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);

        // INIT doc change events
        if (!this.changeStateMgr) {
          this.changeStateMgr = new ChangeStateManager();
        }

        // initialize the status bar text
        eventMgr.initializeStatus();

        const displayedReadme = utilMgr.displayReadmeIfNotExists();
        if (displayedReadme) {
            // show the tree view
            providerMgr.toggleCodeTimeProvider('on');
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
