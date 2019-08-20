"use babel";

import {
    Track,
    setConfig,
    getPlaylistTracks,
    PaginationItem,
    PlaylistItem,
    PlayerName,
    CodyResponse,
    CodyResponseType,
    getPlaylists,
    getRunningTrack,
    PlayerType,
    PlaylistTrackInfo,
    PlayerDevice,
    CodyConfig,
    TrackStatus,
    addTracksToPlaylist,
    createPlaylist,
    getUserProfile,
    replacePlaylistTracks,
    getSavedTracks
} from "cody-music";

import {
    PERSONAL_TOP_SONGS_NAME,
    SOFTWARE_TOP_SONGS_NAME,
    PERSONAL_TOP_SONGS_PLID,
    SOFTWARE_TOP_SONGS_PLID,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    REFRESH_GLOBAL_PLAYLIST_TITLE,
    REFRESH_GLOBAL_PLAYLIST_TOOLTIP,
    GENERATE_GLOBAL_PLAYLIST_TITLE,
    GENERATE_GLOBAL_PLAYLIST_TOOLTIP
} from "./Constants";
import { SpotifyUser } from "cody-music/dist/lib/profile";
import {
    isResponseOk,
    softwareGet,
    softwarePost,
    softwareDelete,
    softwarePut
} from "./HttpClient";

export  default class KpmMusicStoreManager {


    constructor() {
        //
        this._spotifyPlaylist =  [];
        this._runningPlaylist =  [];
        this._musicTimePlaylist =  [];
        this._runningTrack = new Track();
        this._savedPlaylist =  [];
        this._setting =  [];
        this._userFavorite = [];
        this._globalFavorite = [];
        this._playlistTracks = {};
        this._currentPlayerType = PlayerType.NotAssigned;
        this._selectedPlaylist = null;
        this._selectedTrackItem = null;
        this._spotifyPlayerDevices = [];
        this._initializedSpotifyPlaylist = false;
        this._refreshing = false;
        this._spotifyUser = null;
        this._serverTrack = null;
        this._playlistTrackMap = {};
        this._spotifyPlaylists = {};
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new KpmMusicStoreManager();
        }

        return this.instance;
    }

    clearPlaylistTracksForId(playlist_id) {
        this._playlistTrackMap[playlist_id] = null;
    }

    //
    // getters
    //

    get spotifyUser() {
        return this._spotifyUser;
    }

    set spotifyUser(user) {
        this._spotifyUser = user;
    }

    get savedPlaylists() {
        return this._savedPlaylists;
    }

    set savedPlaylists(lists) {
        this._savedPlaylists = lists;
    }

    get refreshing() {
        return this._refreshing;
    }

    set refreshing(value) {
        this._refreshing = value;
    }

    get initializedSpotifyPlaylist() {
        return this._initializedSpotifyPlaylist;
    }

    set initializedSpotifyPlaylist(value) {
        this._initializedSpotifyPlaylist = value;
    }

    get runningTrack() {
        return this._runningTrack;
    }

    set runningTrack(track) {
        this._runningTrack = track;
    }

    get settings(){
        return this._settings;
    }

    set settings(lists) {
        this._settings = lists;
    }

    get spotifyPlaylists() {
        return this._spotifyPlaylists;
    }

    set spotifyPlaylists(lists) {
        this._spotifyPlaylists = lists;
    }

    get hasSpotifyPlaylists() {
        return this._spotifyPlaylists && this._spotifyPlaylists.length > 0;
    }

    get userFavorites() {
        return this._userFavorites;
    }

    get globalFavorites() {
        return this._globalFavorites;
    }

    get hasGlobalFavorites() {
        return this._globalFavorites && this._globalFavorites.length > 0;
    }

    get runningPlaylists() {
        return this._runningPlaylists;
    }

    set runningPlaylists(list) {
        this._runningPlaylists = list;
    }

    get musicTimePlaylists() {
        return this._musicTimePlaylists;
    }

    set musicTimePlaylists(list) {
        this._musicTimePlaylists = list;
    }

    get selectedPlaylist() {
        return this._selectedPlaylist;
    }

    set selectedPlaylist(item) {
        this._selectedPlaylist = item;
    }

    get selectedTrackItem() {
        return this._selectedTrackItem;
    }

    set selectedTrackItem(item) {
        this._selectedTrackItem = item;
    }

    get spotifyPlayerDevices() {
        return this._spotifyPlayerDevices;
    }

    set spotifyPlayerDevices(devices) {
        this._spotifyPlayerDevices = devices;
    }

    get serverTrack() {
        return this._serverTrack;
    }

    set serverTrack(track) {
        this._serverTrack = track;
    }

    get currentPlayerType() {
        return this._currentPlayerType;
    }

    set currentPlayerType(type) {
        this._currentPlayerType = type;
    }

    //
    // store functions
    //

    async refreshPlaylists() {
        const utilMgr = require("./UtilManager");
        if (this.refreshing) {
            return;
        }
        this.refreshing = true;
        let serverIsOnline = await utilMgr.serverIsAvailable();
        // refresh the playlists
        this.runningTrack = await getRunningTrack();
        await this.syncRunningPlaylists(serverIsOnline);
        //MusicCommandManager.syncControls(this.runningTrack);
        this.refreshing = false;
    }

    async updateSpotifyAccessInfo(spotifyOauth) {
        const utilMgr = require("./UtilManager");
        if (spotifyOauth) {
            // update the CodyMusic credentials
            let codyConfig = new CodyConfig();
            codyConfig.spotifyClientId = SPOTIFY_CLIENT_ID;
            codyConfig.spotifyAccessToken = spotifyOauth.spotify_access_token;
            codyConfig.spotifyRefreshToken = spotifyOauth.spotify_refresh_token;
            codyConfig.spotifyClientSecret = SPOTIFY_CLIENT_SECRET;
            codyConfig.enableItunesDesktop = utilMgr.isMac() ? true : false;
            codyConfig.enableSpotifyDesktop = utilMgr.isMac() ? true : false;
            setConfig(codyConfig);
    
            utilMgr.setItem("spotify_access_token", spotifyOauth.spotify_access_token);
            utilMgr.setItem(
                "spotify_refresh_token",
                spotifyOauth.spotify_refresh_token
            );
    
            // get the user
            getUserProfile().then(user => {
                this._spotifyUser = user;
            });
    
        
        } else {
            this.clearSpotifyAccessInfo();
        }
    }
  
    clearSpotifyAccessInfo = async () => {
        const utilMgr = require("./UtilManager");
        utilMgr.setItem("spotify_access_token", null);
        utilMgr.setItem("spotify_refresh_token", null);
        let codyConfig = new CodyConfig();
        codyConfig.spotifyClientId = SPOTIFY_CLIENT_ID;
        codyConfig.spotifyAccessToken = null;
        codyConfig.spotifyRefreshToken = null;
        codyConfig.spotifyClientSecret = SPOTIFY_CLIENT_SECRET;
        codyConfig.enableItunesDesktop = utilMgr.isMac() ? true : false;
        codyConfig.enableSpotifyDesktop = utilMgr.isMac() ? true : false;
        setConfig(codyConfig);
        _spotifyUser = null;
    }

    requiresSpotifyAccess() {
        let spotifyAccessToken = utilMgr.getItem("spotify_access_token");
        return spotifyAccessToken ? false : true;
    }
    
    /**
     * fetch the playlists (playlist names)
     * @param serverIsOnline
     */
    async syncRunningPlaylists(serverIsOnline) {
        let playlists = [];

        const needsSpotifyAccess = this.requiresSpotifyAccess();

        if (serverIsOnline) {
            // get the cody playlists
            await this.syncSavedAndSpotifyPlaylists(serverIsOnline);

            // check if the global favorites are available
            if (!this.hasGlobalFavorites) {
                await this.syncGlobalTopSongs();
            }
        }

        if (
            this.runningTrack.playerType &&
            this.currentPlayerType === PlayerType.NotAssigned &&
            this.runningTrack.playerType !== PlayerType.NotAssigned
        ) {
            this.currentPlayerType = this.runningTrack.playerType;
        }

        // get the current running playlist
        if (this.currentPlayerType === PlayerType.MacItunesDesktop) {
            playlists = await getPlaylists(PlayerName.ItunesDesktop);
            // update so the playlist header shows the spotify related icons
            commands.executeCommand("setContext", "treeview-type", "itunes");
            // go through each playlist and find out it's state
            playlists.forEach(playlist => {
                playlist.tag = "itunes";
            });
        } else {
            playlists = this.spotifyPlaylists;
            if (
                (!playlists || playlists.length === 0) &&
                this.currentPlayerType === PlayerType.MacSpotifyDesktop
            ) {
                // create a playlist folder for the desktop spotify track that is playing
                const desktopTrackPlaylist = new PlaylistItem();
                desktopTrackPlaylist.type = "playlist";
                desktopTrackPlaylist.id = "";
                desktopTrackPlaylist.tracks = new PlaylistTrackInfo();
                desktopTrackPlaylist.tracks.total = 1;
                desktopTrackPlaylist.playerType = PlayerType.MacSpotifyDesktop;
                desktopTrackPlaylist.tag = "spotify";
                desktopTrackPlaylist.name = "Spotify Desktop";

                playlists.push(desktopTrackPlaylist);
            } else {
                this.currentPlayerType = PlayerType.WebSpotify;

                // add the all playlist folder
                const likedSongsPlaylist = new PlaylistItem();
                likedSongsPlaylist.type = "playlist";
                likedSongsPlaylist.id = "";
                likedSongsPlaylist.tracks = new PlaylistTrackInfo();
                // set set a number so it shows up
                likedSongsPlaylist.tracks.total = 1;
                likedSongsPlaylist.playerType = PlayerType.WebSpotify;
                likedSongsPlaylist.tag = "spotify";
                likedSongsPlaylist.name = "Liked Songs";

                playlists.push(likedSongsPlaylist);

                // go through each playlist and find out it's state
                playlists.forEach(async playlist => {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                    if (playlist.tag !== "paw") {
                        playlist.tag = "spotify";
                    }
                });
            }
            // update so the playlist header shows the spotify related icons
            commands.executeCommand("setContext", "treeview-type", "spotify");
        }

        const noPlaylistsFound = !playlists || playlists.length === 0;
        if (noPlaylistsFound) {
            // no player or track
            let noPlayerFoundItem = new PlaylistItem();
            noPlayerFoundItem.tracks = new PlaylistTrackInfo();
            noPlayerFoundItem.type = "title";
            noPlayerFoundItem.id = "title";
            noPlayerFoundItem.playerType = PlayerType.NotAssigned;
            noPlayerFoundItem.name = "No active music player found";
            playlists.push(noPlayerFoundItem);

            this.currentPlayerType = PlayerType.NotAssigned;
        }

        // filter out the music time playlists
        let musicTimePlaylistItems = [];

        // take out the music time playlists out so they can show
        // in the music time playlist panel
        playlists = playlists
            .map((item) => {
                let foundSavedPlaylist = this.savedPlaylists.find(element => {
                    return element.id === item.id;
                });
                if (foundSavedPlaylist) {
                    // add it to the music time playlists
                    musicTimePlaylistItems.push(item);
                    return null;
                }
                return item;
            })
            .filter(item => item);

        // set the music time playlists
        this.musicTimePlaylists = musicTimePlaylistItems;

        // get the custom playlist button
        if (serverIsOnline && !needsSpotifyAccess) {
            const globalPlaylistButton = this.getGlobalPlaylistButton();
            if (globalPlaylistButton) {
                musicTimePlaylistItems.push(globalPlaylistButton);
            }
            const customPlaylistButton = this.getCustomPlaylistButton();
            if (customPlaylistButton) {
                musicTimePlaylistItems.push(customPlaylistButton);
            }
        }

        this.runningPlaylists = playlists;

        // update the items for the settings panel
        this.updateSettingsItems(serverIsOnline, this.currentPlayerType);

        commands.executeCommand("musictime.refreshPlaylist");
        commands.executeCommand("musictime.refreshSettings");
    }


    async syncSavedAndSpotifyPlaylists(serverIsOnline) {
        // get the cody playlists
        await this.fetchSavedPlaylists(serverIsOnline);

        // sync up the spotify playlists
        await this.syncSpotifyWebPlaylists(serverIsOnline);
    }

     async fetchSavedPlaylists(serverIsOnline) {
        let playlists = [];
        if (serverIsOnline) {
            const response = await softwareGet(
                "/music/playlist",
                utilMgr.getItem("jwt")
            );
            if (isResponseOk(response)) {
                playlists = response.data.map(item => {
                    // transform the playlist_id to id
                    item["id"] = item.playlist_id;
                    item["playlistTypeId"] = item.playlistTypeId;
                    delete item.playlist_id;
                    return item;
                });
            }
        }
        this.savedPlaylists = playlists;
    }

    async getServerTrack(track) {
        const utilMgr = require("./UtilManager");
        if (track) {
            let trackId = track.id;
            if (trackId.indexOf(":") !== -1) {
                // strip it down to just the last id part
                trackId = trackId.substring(trackId.lastIndexOf(":") + 1);
            }
            let type = "spotify";
            if (track.playerType === PlayerType.MacItunesDesktop) {
                type = "itunes";
            }
            // use the name and artist as well since we have it
            let trackName = track.name;
            let trackArtist = track.artist;

            // check if it's cached before hitting the server
            if (this.serverTrack) {
                if (this.serverTrack.id === track.id) {
                    return this.serverTrack;
                } else if (
                    this.serverTrack.name === trackName &&
                    this.serverTrack.artist === trackArtist
                ) {
                    return this.serverTrack;
                }
                // it doesn't match, might as well nullify it
                this.serverTrack = null;
            }

            if (!this.serverTrack) {
                // get the last server track
                const api = `/music/lastTrack/${trackId}/type/${type}`;
                const resp = await softwareGet(api, utilMgr.getItem("jwt"));
                if (isResponseOk(resp) && resp.data) {
                    let trackData = resp.data;
                    // set the server track to this one
                    this.serverTrack = { ...track };
                    // update the loved state
                    if (
                        trackData.liked !== null &&
                        trackData.liked !== undefined
                    ) {
                        // set the boolean value
                        if (isNaN(trackData.liked)) {
                            // it's not 0 or 1, use the bool
                            this.serverTrack.loved = trackData.liked;
                        } else {
                            // it's 0 or 1, convert it
                            this.serverTrack.loved =
                                trackData.liked === 0 ? false : true;
                        }

                        track.loved = this.serverTrack.loved;
                    }
                } else {
                    this.serverTrack = { ...track };
                }
            }
        }

        

        return this.serverTrack;
    }
    

    hasSpotifyPlaybackAccess() {
        if (this.spotifyUser && this.spotifyUser.product === "premium") {
            return true;
        }
        return false;
    }
    
     /**
     * Even if the _currentPlayer is set to SpotifyWeb
     * it may return SpotifyDesktop if it's mac and it requires access
     */
    get currentPlayerName() {
        const utilMgr = require("./UtilManager");
        const requiresSpotifyAccess = this.requiresSpotifyAccess();
        const hasSpotifyPlaybackAccess = this.hasSpotifyPlaybackAccess();
        if (
            this._currentPlayerName === PlayerName.SpotifyWeb &&
            utilMgr.isMac() &&
            (!hasSpotifyPlaybackAccess || requiresSpotifyAccess)
        ) {
            this._currentPlayerName = PlayerName.SpotifyDesktop;
        }
        return this._currentPlayerName;
    }

    set currentPlayerName(playerName) {
        this._currentPlayerName = playerName;
    }
    
    requiresSpotifyAccess() {
        const utilMgr = require("./UtilManager");
        let spotifyAccessToken = utilMgr.getItem("spotify_access_token");
        return spotifyAccessToken ? false : true;
    }

    hasSpotifyPlaybackAccess() {
        if (this.spotifyUser && this.spotifyUser.product === "premium") {
            return true;
        }
        return false;
    }

    async refreshPlaylistState() {
        if (this._spotifyPlaylists.length > 0) {
            // build the spotify playlist
            this._spotifyPlaylists.forEach(async playlist => {
                let playlistItemTracks = this._playlistTrackMap[
                    playlist.id
                ];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
            });
        }

        if (utilMgr.isMac()) {
            // build the itunes playlist
            if (this._itunesPlaylists.length > 0) {
                this._itunesPlaylists.forEach(async playlist => {
                    let playlistItemTracks = this
                        ._playlistTrackMap[playlist.id];

                    if (playlistItemTracks && playlistItemTracks.length > 0) {
                        let playlistState = await this.getPlaylistState(
                            playlist.id
                        );
                        playlist.state = playlistState;
                    }
                });
            }
        }
    }
  
}
