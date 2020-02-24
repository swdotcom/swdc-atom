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

const POST_DELAY_IN_SEC = 60;

let packageVersion = null;
let activated = false;
let retry_counter = 0;

const check_online_interval_ms = 1000 * 60 * 10;

let token_check_interval = null;

export default {
    subscriptions: null,
    sendDataInterval: null,

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

        await dashboardMgr.updateSessionSummaryFromServer();

        // add the command palette and general commands
        commandUtil.addCommands(this.subscriptions);
        // add the palette menu items
        menuUtil.addCommandPaletteItems();

        // intialize the editor event handling
        kpmMgr.activeTextEditorHandler();

        this.sendDataInterval = setInterval(() => {
            kpmMgr.sendKeystrokeData;
        }, POST_DELAY_IN_SEC + 1);

        let one_min = 1000 * 60;

        // send any offline data every 30 minutes
        const half_hour_ms = one_min * 30;
        setInterval(() => {
            dashboardMgr.sendOfflineData();
        }, half_hour_ms);

        // call the hourly jobs handler with an hour interval
        setInterval(() => {
            this.processHourlyJobs();
        }, one_min * 60);

        // process the hourly jobs in a minute to get things started
        setTimeout(() => {
            this.processHourlyJobs();
        }, one_min);

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

        clearInterval(this.sendDataInterval);
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

        const initializedVscodePlugin = utilMgr.getItem('atom_CtInit');
        if (!initializedVscodePlugin) {
            utilMgr.setItem('atom_CtInit', true);
            // show the tree view
            providerMgr.toggleCodeTimeProvider('on');
            // send a bootstrap payload
            kpmMgr.sendBootstrapKpmPayload();
            // send a heartbeat that the plugin as been installed
            // (or the user has deleted the session.json and restarted the IDE)
            utilMgr.sendHeartbeat('INSTALLED', serverIsOnline);
        }

        // send the current offline data now
        setTimeout(async () => {
            if (initializedUser) {
                // send a heartbeat
                utilMgr.sendHeartbeat('INITIALIZED', serverIsOnline);
                // launch the login prompt
                userstatusMgr.launchLoginPrompt();
            }
            dashboardMgr.sendOfflineData();
        }, 1000);
    },

    rankingConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    gitConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    processHourlyJobs() {
        utilMgr.sendHeartbeat('HOURLY');

        kpmMgr.initializeKeystrokeMgr();
        const projectDir = kpmMgr.getProjectDirectory();
        if (projectDir) {
            setTimeout(() => {
                kpmRepoMgr.getHistoricalCommits(projectDir);
            }, 1000 * 5);
        }
    },
};
