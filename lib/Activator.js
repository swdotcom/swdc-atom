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

    async activate(state, tries = 0) {
      let jwt = utilMgr.getItem("jwt");
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
            setTimeout(() => {this.activate(state, tries);}, 1000 * 6);
            return;
          }
        } else {
          this.initializePlugin(state, true);
        }
      }
      this.initializePlugin(state, false);
    },

    async initializePlugin(state, initializedUser) {
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

      utilMgr.displayReadmeIfNotExists();

      const initializedAtomPlugin = utilMgr.getItem('atom_CtInit');
      if (!initializedAtomPlugin) {
          utilMgr.setItem('atom_CtInit', true);

          // show the tree view
          providerMgr.toggleCodeTimeProvider('on');
      }
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
};
