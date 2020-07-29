'use babel';

import { CompositeDisposable } from 'atom';
import { NO_PROJ_NAME, UNTITLED } from './Constants';

const utilMgr = require('./UtilManager');
const menuUtil = require('./utils/MenuUtil');
const commandUtil = require('./utils/CommandUtil');
const gitUtil = require('./repo/GitUtil');
const eventMgr = require('./managers/EventManager');
const wallClockMgr = require('./managers/WallClockManager');
const userstatusMgr = require('./UserStatusManager');
const kpmRepoMgr = require('./KpmRepoManager');
const providerMgr = require('./tree/ProviderManager');
const kpmMgr = require('./managers/KpmManager');
const projectMgr = require('./managers/ProjectManager');
const serviceUtil = require('./utils/ServiceUtil');
const payloadMgr = require('./managers/PayloadManager');
const sessionAppMgr = require('./managers/SessionAppManager');
const pluginDataMgr = require("./managers/PluginDataManager");
const tracker = require("./managers/TrackerManager");

const POST_DELAY_IN_SEC = 60;

let packageVersion = null;
let activated = false;
let retry_counter = 0;

const check_online_interval_ms = 1000 * 60 * 10;

let token_check_interval = null;

export default {
    subscriptions: null,

    async activate(state) {
        this.checkAnonCreation(state);
    },

    async checkAnonCreation(state, tries = 4) {
        if (!utilMgr.jwtExists()) {
            if (tries === 0) {
                // create the anon user
                result = await serviceUtil.createAnonymousUser();
                if (!result) {
                    const serverAvail = await serviceUtil.serverIsAvailable();
                    if (!serverAvail) {
                        utilMgr.showOfflinePrompt();
                    }
                }
                this.initializePlugin(state, true);
            } else {
                // check to see if the anon user exists in case
                // in case another window has created it
                tries--;
                setTimeout(() => {
                    this.checkAnonCreation(state, tries);
                }, 1000);
            }
        } else {
            this.initializePlugin(state, false);
        }
    },

    async initializePlugin(state, initializedUser) {
        if (activated) {
            return;
        }

        packageVersion = atom.packages.getLoadedPackage('code-time').metadata
            .version;
        console.log(`Code Time: Loaded v${packageVersion}`);

        // activate the plugin data manager
        pluginDataMgr.initializePluginDataMgr();

        // initialize the tracker manager
        await tracker.init();

        // store the activate event
        tracker.trackEditorAction("editor", "activate");

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        // initialize singletons
        providerMgr.init();
        // start the wall clock timer
        wallClockMgr.init();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);
        // add the palette menu items
        menuUtil.addCommandPaletteItems();

        // intialize the editor event handling
        kpmMgr.activeTextEditorHandler();

        // update the last saved keystrokes in memory
        payloadMgr.getLastSavedKeystrokeStats();

        let one_min = 1000 * 60;

        // INTERVAL TASKS

        // send any offline data every 15 minutes
        setInterval(() => {
            payloadMgr.sendOfflineData();
        }, one_min * 15);

        // heatbeat once an hour
        setInterval(() => {
            serviceUtil.sendHeartbeat('HOURLY');
        }, one_min * 60);

        // offline events every 60 min
        setInterval(() => {
            payloadMgr.sendOfflineEvents();
        }, one_min * 60);

        // repo commits every 30 min
        setInterval(() => {
            const projectDir = projectMgr.getProjectDirectory();
            if (projectDir) {
                const secondDelay = utilMgr.getRandomArbitrary(2, 15);
                setTimeout(() => {
                    kpmRepoMgr.getHistoricalCommits(projectDir);
                }, 1000 * secondDelay);
            }
        }, one_min * 30);

        // repo member every 35 min
        setInterval(() => {
            const projectDir = projectMgr.getProjectDirectory();
            if (projectDir) {
                gitUtil.processRepoContributors(projectDir);
            }
        }, one_min * 35);

        activated = true;

        atom.config.onDidChange(utilMgr.geGitConfigKey(), [], event =>
            this.gitConfigChanged(event)
        );
        atom.config.onDidChange(utilMgr.getRankingConfigKey(), [], event =>
            this.rankingConfigChanged(event)
        );

        // initialize the status bar text
        eventMgr.initializeStatus();

        // initializes the user's status and initiates showing statusbar info
        this.initializeUserInfo(initializedUser);

        // in 1 min TASKS
        setTimeout(() => {
            payloadMgr.sendOfflineData();
        }, one_min);

        // in 2 min TASKS
        setTimeout(() => {
            const projectDir = projectMgr.getProjectDirectory();
            if (projectDir) {
                const secondDelay = utilMgr.getRandomArbitrary(2, 15);
                setTimeout(() => {
                    kpmRepoMgr.getHistoricalCommits(projectDir);
                }, 1000 * secondDelay);
            }
        }, one_min * 2);

        // in 3 min TASKS
        setTimeout(() => {
            const projectDir = projectMgr.getProjectDirectory();
            if (projectDir) {
                gitUtil.processRepoContributors(projectDir);
            }
        }, one_min * 3);

        // in 4 min TASKS
        setTimeout(() => {
            payloadMgr.sendOfflineEvents();
        }, one_min * 4);

        // refresh the tree
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:refresh-code-time-metrics'
        );
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

        tracker.trackEditorAction("editor", "deactivate");

        if (token_check_interval) {
            clearInterval(token_check_interval);
        }
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

            // send a bootstrap payload
            kpmMgr.sendBootstrapKpmPayload();

            // send a heartbeat that the plugin as been installed
            // (or the user has deleted the session.json and restarted the IDE)
            serviceUtil.sendHeartbeat('INSTALLED');
        }
        sessionAppMgr.updateSessionSummaryFromServer();
    },

    rankingConfigChanged(event) {
        serviceUtil.updatePreferences();
    },

    gitConfigChanged(event) {
        serviceUtil.updatePreferences();
    },
};
