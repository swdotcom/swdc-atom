'use babel';

import { CompositeDisposable } from 'atom';
import { NO_PROJ_NAME, UNTITLED, UNTITLED_WORKSPACE } from './Constants';

const utilMgr = require('./UtilManager');
const menuUtil = require('./utils/MenuUtil');
const commandUtil = require('./utils/CommandUtil');
const eventMgr = require('./managers/EventManager');
const wallClockMgr = require('./managers/WallClockManager');
const userstatusMgr = require('./UserStatusManager');
const dashboardMgr = require('./DashboardManager');
const kpmRepoMgr = require('./KpmRepoManager');
const providerMgr = require('./tree/ProviderManager');
const kpmMgr = require('./managers/KpmManager');
const payloadMgr = require('./managers/PayloadManager');

const POST_DELAY_IN_SEC = 60;

let packageVersion = null;
let activated = false;
let retry_counter = 0;

const check_online_interval_ms = 1000 * 60 * 10;

let token_check_interval = null;

export default {
    subscriptions: null,

    async activate(state) {
        const serverIsOnline = await utilMgr.serverIsAvailable();
        if (!utilMgr.softwareSessionFileExists() || !utilMgr.jwtExists()) {
            // session file doesn't exist
            // check if the server is online before creating the anon user
            if (!serverIsOnline) {
                if (retry_counter === 0) {
                    utilMgr.showOfflinePrompt();
                }
                // call activate again later
                setTimeout(() => {
                    retry_counter++;
                    activate(state);
                }, check_online_interval_ms);
            } else {
                // create the anon user
                const result = await utilMgr.createAnonymousUser(
                    serverIsOnline
                );
                if (!result) {
                    if (retry_counter === 0) {
                        utilMgr.showOfflinePrompt();
                    }
                    // call activate again later
                    setTimeout(() => {
                        retry_counter++;
                        activate(ctx);
                    }, check_online_interval_ms);
                } else {
                    // continue on with activation
                    this.initializePlugin(state, true, serverIsOnline);
                }
            }
        } else {
            // continue on with activation
            this.initializePlugin(state, false, serverIsOnline);
        }
    },

    async initializePlugin(state, initializedUser, serverIsOnline) {
        if (activated) {
            return;
        }

        packageVersion = atom.packages.getLoadedPackage('code-time').metadata
            .version;
        console.log(`Code Time: Loaded v${packageVersion}`);

        // store the activate event
        eventMgr.createCodeTimeEvent('resource', 'load', 'EditorActivate');

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        // initialize singletons
        providerMgr.init();
        // start the wall clock timer
        wallClockMgr.init();
        // initialize the new day checker
        dashboardMgr.init();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);
        // add the palette menu items
        menuUtil.addCommandPaletteItems();

        // intialize the editor event handling
        kpmMgr.activeTextEditorHandler();

        let one_min = 1000 * 60;

        // INTERVAL TASKS

        // send any offline data every 15 minutes
        setInterval(() => {
            payloadMgr.sendOfflineData();
        }, one_min * 15);

        // heatbeat once an hour
        setInterval(() => {
            utilMgr.sendHeartbeat('HOURLY');
        }, one_min * 60);

        // offline events every 40 min
        setInterval(() => {
            payloadMgr.sendOfflineEvents();
        }, one_min * 40);

        // repo commits every 45 min
        setInterval(() => {
            const projectDir = kpmMgr.getProjectDirectory();
            if (projectDir) {
                kpmRepoMgr.getHistoricalCommits(projectDir);
            }
        }, one_min * 45);

        // repo member every 50 min
        setInterval(() => {
            const projectDir = kpmMgr.getProjectDirectory();
            if (projectDir) {
                kpmRepoMgr.getRepoUsers(projectDir);
            }
        }, one_min * 50);

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
        this.initializeUserInfo(initializedUser, serverIsOnline);

        // in 1 min TASKS
        setTimeout(() => {
            payloadMgr.sendOfflineData();
        }, one_min);

        // in 2 min TASKS
        setTimeout(() => {
            const projectDir = kpmMgr.getProjectDirectory();
            if (projectDir) {
                kpmRepoMgr.getHistoricalCommits(projectDir);
            }
        }, one_min * 2);

        // in 3 min TASKS
        setTimeout(() => {
            const projectDir = kpmMgr.getProjectDirectory();
            if (projectDir) {
                kpmRepoMgr.getRepoUsers(projectDir);
            }
        }, one_min * 3);

        // in 4 min TASKS
        setTimeout(() => {
            payloadMgr.sendOfflineEvents();
        }, one_min * 4);
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

        eventMgr.createCodeTimeEvent('resource', 'unload', 'EditorDeactivate');

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

    async initializeUserInfo(initializedUser, serverIsOnline) {
        await userstatusMgr.getUserStatus(serverIsOnline);

        utilMgr.displayReadmeIfNotExists();

        const initializedAtomPlugin = utilMgr.getItem('atom_CtInit');
        if (!initializedAtomPlugin) {
            utilMgr.setItem('atom_CtInit', true);
            await dashboardMgr.updateSessionSummaryFromServer();

            // show the tree view
            providerMgr.toggleCodeTimeProvider('on');

            // send a bootstrap payload
            kpmMgr.sendBootstrapKpmPayload();

            // send a heartbeat that the plugin as been installed
            // (or the user has deleted the session.json and restarted the IDE)
            utilMgr.sendHeartbeat('INSTALLED', serverIsOnline);

            // launch the login prompt
            userstatusMgr.launchLoginPrompt();
        }
    },

    rankingConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    gitConfigChanged(event) {
        utilMgr.updatePreferences();
    },
};
