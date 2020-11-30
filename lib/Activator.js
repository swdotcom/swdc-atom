'use babel';

import { CompositeDisposable } from 'atom';

const utilMgr = require('./UtilManager');
const menuUtil = require('./utils/MenuUtil');
const commandUtil = require('./utils/CommandUtil');
const gitUtil = require('./repo/GitUtil');
const eventMgr = require('./managers/EventManager');
const wallClockMgr = require('./managers/WallClockManager');
const userstatusMgr = require('./UserStatusManager');
const providerMgr = require('./tree/ProviderManager');
const kpmMgr = require('./managers/KpmManager');
const serviceUtil = require('./utils/ServiceUtil');
const sessionAppMgr = require('./managers/SessionAppManager');
const pluginDataMgr = require('./managers/PluginDataManager');
const tracker = require('./managers/TrackerManager');

let packageVersion = null;
let activated = false;

export default {
    subscriptions: null,

    async activate(state) {
        this.checkAnonCreation(state);
    },
    
    async checkAnonCreation(state, tries = 0) {
      const jwt = utilMgr.getItem("jwt");
      if (!jwt) {
        // create the anon user
        result = await serviceUtil.createAnonymousUser();
        if (!result) {
          if (tries === 0) {
            // show the offline message only once
            utilMgr.showOfflinePrompt();
          }
          if (tries < 5) {
            tries++;

            setTimeout(() => {this.checkAnonCreation(state, tries);}, 5000);
            return;
          } else {
            // tried enough times, initialize with what we have
            this.initializePlugin(state, false);
          }
        } else if (result) {
          this.initializePlugin(state, true);
        }
      } else {
        this.initializePlugin(state, false);
      }
    },

    async initializePlugin(state, initializedUser) {
        if (activated) {
            return;
        }

        activated = true;

        packageVersion = atom.packages.getLoadedPackage('code-time').metadata.version;
        console.log(`Code Time: Loaded v${packageVersion}`);

        // activate the plugin data manager
        pluginDataMgr.initializePluginDataMgr();

        // initialize the tracker manager
        await tracker.init();

        // store the activate event
        tracker.trackEditorAction('editor', 'activate');

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        // initialize singletons
        providerMgr.init();

        // start the wall clock timer
        wallClockMgr.init();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);
        // add the palette menu items
        // menuUtil.addCommandPaletteItems();

        // intialize the editor event handling
        kpmMgr.activeTextEditorHandler();

        // initialize the status bar text
        eventMgr.initializeStatus();

        // initializes the user's status and initiates showing statusbar info
        this.initializeUserInfo(initializedUser);
    },

    deactivate() {
        // utilMgr
        //   .softwareDelete(
        //     `/integrations/${utilMgr.getPluginId()}`,
        //     utilMgr.getItem("jwt")
        //   )
        //   .then(resp => {
        //     if (utilMgr.isResponseOk(resp)) {
        //       if (resp.data) {
        //         console.log("Code Time: Uninstalled plugin");
        //       } else {
        //         console.log(
        //           "Code Time: Failed to update Code  about the uninstall event"
        //         );
        //       }
        //     }
        //   });

        tracker.trackEditorAction('editor', 'deactivate');

        if (utilMgr.getStatusView()) {
            utilMgr.getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },

    async initializeUserInfo(initializedUser) {
        await userstatusMgr.getUserStatus();

        utilMgr.displayReadmeIfNotExists();

        const initializedAtomPlugin = utilMgr.getItem('atom_CtInit');
        if (!initializedAtomPlugin) {
            utilMgr.setItem('atom_CtInit', true);

            // show the tree view
            providerMgr.toggleCodeTimeProvider('on');
        }

        if (utilMgr.isNewDay()) {
          sessionAppMgr.updateSessionSummaryFromServer();
        }
    },
};
