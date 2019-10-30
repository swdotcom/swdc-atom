"use babel";

import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";
const utilMgr = require("../UtilManager");
// import * as utilMgr from '../UtilManager.js'
import $ from "jquery";
import StructureView from "./structure-view";
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
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  LOGIN_LABEL,
  SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
  PLAY_CONTROL_ICON,
  PAUSE_CONTROL_ICON
} from "../Constants";
import {
  isResponseOk,
  softwareGet,
  softwarePost,
  softwareDelete,
  softwarePut
} from "../HttpClient";
import KpmMusicStoreManager from "./KpmMusicStoreManager";
import KpmMusicControlManager from "./KpmMusicControlManager";
import {
  PlaylistItem,
  getSpotifyDevices,
  PlayerType,
  PlayerName,
  getPlaylists,
  TrackStatus,
  Track,
  CodyResponse,
  getPlaylistTracks,
  PaginationItem,
  CodyResponseType,
  getSpotifyLikedSongs,
  PlaylistTrackInfo,
  getRunningTrack,
  createPlaylist,
  addTracksToPlaylist,
  replacePlaylistTracks,
  CodyConfig,
  setConfig,
  getUserProfile,
  launchPlayer,
  quitMacPlayer,
  isPlayerRunning,
  playItunesTrackNumberInPlaylist,
  launchAndPlaySpotifyTrack,
  playSpotifyMacDesktopTrack
} from "cody-music";
const WINDOWS_SPOTIFY_TRACK_FIND =
  'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

let trackInfo = {};
const userstatusMgr = require("../UserStatusManager");
import { SpotifyUser } from "cody-music/dist/lib/profile";
const fs = require("fs");
//
// KpmMusicManager - handles software session management
//
export default class KpmMusicManager {
  constructor(serializedState) {
    this.structureViewObj = new StructureView();
    this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
    this._savedPlaylists = [];
    this._playlistMap = {};
    this._itunesPlaylists = [];
    this._spotifyPlaylists = [];
    this._musictimePlaylists = [];
    this._softwareTopSongs = [];
    this._userTopSongs = [];
    this._playlistTrackMap = {};
    this._runningTrack = null;
    // default to starting with spotify
    this._currentPlayerName = PlayerName.SpotifyWeb;
    this._selectedTrackItem = null;
    this._selectedPlaylist = [];
    this._selectedPlaylistId = null;
    this._selectedPlaylistTrackId = null;
    this._spotifyUser = null;
    this._buildingPlaylists = false;
    this._serverTrack = null;
    this._initialized = false;
    this._buildingCustomPlaylist = false;
    var _this = this;

    $(document).on("click", ".playlist-nested-item", async function(e) {
      e.stopPropagation();
      var _self = this;
      let playlistId = $(_self).attr("node-id");
      _this._selectedPlaylistTrackId = playlistId;
      _this.selectedTrackItem = _this._selectedPlaylist.filter(element => {
        return element.id == playlistId;
      })[0];
      await _this.playSelectedItem(_this.selectedTrackItem);

      await getRunningTrack().then(track => {
        if (track.state == "playing") {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:pause"
          );
        }
      });
    });

    $(document).on("click", "li.play-list", async function(e) {
      var _self = this;
      let playlistId = $(_self).attr("node-id");
      _this._selectedPlaylistId = playlistId;
      let isCollapsed = $("[node-id=" + playlistId + "]").hasClass("collapsed");
      if (isCollapsed) {
        await _this.showPlaylistItems(playlistId);
        $("[node-id=" + playlistId + "]").removeClass("collapsed");
        $("[node-id=" + playlistId + "]").addClass("play-list-angle-down");
        $("[node-id=" + playlistId + "]").removeClass("play-list-angle-right");
      } else {
        $("[node-id=" + playlistId + "]").addClass("collapsed");
        $("[node-id=" + playlistId + "]").removeClass("play-list-angle-down");
        $("[node-id=" + playlistId + "]").addClass("play-list-angle-right");
      }
      return;
    });
  }

  async isMacMusicPlayerActive(player) {
    const command = `pgrep -x ${player}`;
    const result = await utilMgr.getCommandResult(command, 1);
    if (result) {
      return true;
    }
    return false;
  }

  async getItunesTrackState() {
    let command = `osascript -e \'tell application "iTunes" to get player state\'`;
    let result = await utilMgr.wrapExecPromise(command, null);
    return result;
  }

  async getSpotifyTrackState() {
    let command = `osascript -e \'tell application "Spotify" to get player state\'`;
    let result = await utilMgr.wrapExecPromise(command, null);
    return result;
  }

  get spotifyUser() {
    return this._spotifyUser;
  }

  set spotifyUser(user) {
    this._spotifyUser = user;
  }

  getChangeStatus(playingTrack) {
    const existingTrackId = this.existingTrack
      ? this.existingTrack.id || null
      : null;
    const playingTrackId = playingTrack.id || null;
    const existingTrackState = this.existingTrack
      ? this.existingTrack.state || TrackStatus.NotAssigned
      : TrackStatus.NotAssigned;
    const playingTrackState = playingTrack.state || "stopped";

    // return obj attributes
    const stopped = playingTrackState === "stopped";
    const paused = playingTrackState === TrackStatus.Paused;
    const isNewTrack = existingTrackId !== playingTrackId;
    const trackStateChanged = existingTrackState !== playingTrackState;
    const playing = playingTrackState === TrackStatus.Playing;

    const isValidTrack = playingTrack.id ? true : false;

    // to determine if we should end the previous track, the
    // existing track should be existing and playing
    let endPrevTrack = false;
    if (existingTrackId && existingTrackId !== playingTrackId) {
      endPrevTrack = true;
    } else if (
      existingTrackId === playingTrackId &&
      existingTrackState === TrackStatus.Playing &&
      playingTrackState !== TrackStatus.Playing
    ) {
      endPrevTrack = true;
    }

    let playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
    let playerNameChanged = false;
    // only update the currentPlayerName if the current track running
    // is "playing" AND the playerType doesn't match the current player type

    const isSpotifyPlayer =
      playerName === PlayerName.SpotifyDesktop ||
      playerName === PlayerName.SpotifyWeb
        ? true
        : false;

    if (playing) {
      if (
        isSpotifyPlayer &&
        playingTrack.playerType === PlayerType.MacItunesDesktop
      ) {
        this.KpmMusicStoreManagerObj.currentPlayerName =
          PlayerName.ItunesDesktop;
        playerNameChanged = true;
      } else if (
        playerName === PlayerName.ItunesDesktop &&
        playingTrack.playerType !== PlayerType.MacItunesDesktop
      ) {
        this.KpmMusicStoreManagerObj.currentPlayerName = PlayerName.SpotifyWeb;
        playerNameChanged = true;
      }
    }

    return {
      isNewTrack,
      endPrevTrack,
      trackStateChanged,
      playing,
      paused,
      stopped,
      isValidTrack,
      playerNameChanged
    };
  }

  async gatherMusicInfo() {
    if (this.processingSong) {
      return this.existingTrack || new Track();
    }

    this.processingSong = true;
    let playingTrack = await getRunningTrack();

    const changeStatus = this.getChangeStatus(playingTrack);

    const now = utilMgr.nowInSecs();

    // has the existing track ended?
    if (changeStatus.endPrevTrack) {
      let d = new Date();
      // offset is the minutes from GMT. it's positive if it's before, and negative after
      const offset = d.getTimezoneOffset();
      const offset_sec = offset * 60;

      // subtract a couple of seconds since our timer is every 5 seconds
      let end = now - 2;
      this.existingTrack["end"] = end;
      this.existingTrack["local_end"] = end - offset_sec;
      this.existingTrack["coding"] = false;
      // set the spotify playlistId
      if (
        this.existingTrack.playerType === PlayerType.WebSpotify &&
        this.KpmMusicStoreManagerObj.selectedPlaylist &&
        this.KpmMusicStoreManagerObj.selectedPlaylist.id
      ) {
        this.existingTrack[
          "playlistId"
        ] = this.KpmMusicStoreManagerObj.selectedPlaylist.id;
      }

      // if this track doesn't have album json data null it out
      if (this.existingTrack.album) {
        // check if it's a valid json
        if (!utilMgr.isValidJson(this.existingTrack.album)) {
          // null these out. the backend will populate these
          this.existingTrack.album = null;
          this.existingTrack.artists = null;
          this.existingTrack.features = null;
        }
      }

      // gather the coding metrics
      // but first end the kpm data collecting
      if (this.kpmControllerInstance) {
        await this.kpmControllerInstance.sendKeystrokeDataIntervalHandler(
          false /*sendLazy*/
        );
      }

      let songSession = {
        ...this.existingTrack
      };
      setTimeout(() => {
        songSession = {
          ...songSession,
          ...this.getMusicCodingData()
        };

        // update the loved state
        if (songSession.serverTrack) {
          songSession.loved = this.KpmMusicStoreManagerObj.serverTrack.loved;
        }

        // send off the ended song session
        this.sendMusicData(songSession);
      }, 1000);

      // clear the track.
      this.existingTrack = {};
    }

    // do we have a new song or was it paused?
    // if it was paused we'll create a new start time anyway, so recreate.
    if (
      changeStatus.isNewTrack &&
      (changeStatus.playing || changeStatus.paused) &&
      changeStatus.isValidTrack
    ) {
      this.KpmMusicStoreManagerObj.getServerTrack(playingTrack);
      this.syncControls(playingTrack);

      let d = new Date();
      // offset is the minutes from GMT. it's positive if it's before, and negative after
      const offset = d.getTimezoneOffset();
      const offset_sec = offset * 60;

      playingTrack["start"] = now;
      playingTrack["local_start"] = now - offset_sec;
      playingTrack["end"] = 0;

      this.existingTrack = { ...playingTrack };
    }

    if (changeStatus.trackStateChanged) {
      // update the state so the requester gets this value
      this.existingTrack.state = playingTrack.state;
    }

    getUserProfile().then(user => {
      this.spotifyUser = user;
    });

    const needsRefresh =
      changeStatus.isNewTrack || changeStatus.trackStateChanged;

   

    if (changeStatus.playerNameChanged) {
      // refresh the entire tree view
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "Music-Time:refreshPlaylist"
      );
    } else if (needsRefresh) {
      this.refreshPlaylists();
    }
    if (utilMgr.isMusicTime()) {
      let msg = "🎧";
      utilMgr.showStatus(msg, null, playingTrack);
    }
    this.processingSong = false;
    if(!utilMgr.getItem('isSpotifyConnected')) {
      utilMgr.refetchSpotifyConnectStatusLazily();
    }
    return this.existingTrack || new Track();
  }

  async getTrackInfo() {
    let trackInfo = {};

    try {
      let spotifyRunning = await isSpotifyRunning();
      let itunesRunning = await this.isItunesRunning();

      if (spotifyRunning) {
        trackInfo = await getRunningTrack();
        let spotifyStopped =
          !trackInfo || (trackInfo && trackInfo["state"] !== "playing")
            ? true
            : false;
        if ((!trackInfo || spotifyStopped) && itunesRunning) {
          // get that track data.
          trackInfo = await this.getItunesTrackPromise();
        }
      } else if (itunesRunning) {
        trackInfo = await this.getItunesTrackPromise();
      }
    } catch (e) {
      console.log("error checking track info: ", e.message);
    }

    return trackInfo || {};
  }

  async isSpotifyRunning() {
    if (utilMgr.isWindows()) {
      return new Promise((resolve, reject) => {
        utilMgr
          .wrapExecPromise(WINDOWS_SPOTIFY_TRACK_FIND, null)
          .then(result => {
            if (result && result.toLowerCase().includes("title")) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
      });
    } else {
      let isActive = await this.isMacMusicPlayerActive("Spotify");
      if (!isActive) {
        return false;
      }
      return new Promise((resolve, reject) => {
        spotify.isRunning((err, isRunning) => {
          if (err) {
            resolve(false);
          } else {
            resolve(isRunning);
          }
        });
      });
    }
  }

  /**
 * returns i.e.
 * track = {
        artist: 'Bob Dylan',
        album: 'Highway 61 Revisited',
        disc_number: 1,
        duration: 370,
        played count: 0,
        track_number: 1,
        starred: false,
        popularity: 71,
        id: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc',
        name: 'Like A Rolling Stone',
        album_artist: 'Bob Dylan',
        artwork_url: 'http://images.spotify.com/image/e3d720410b4a0770c1fc84bc8eb0f0b76758a358',
        spotify_url: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc' }
    }
 */
  async getSpotifyTrackPromise() {
    if (utilMgr.isWindows()) {
      let windowTitleStr = "Window Title:";
      // get the artist - song name from the command result, then get the rest of the info from spotify
      let songInfo = await utilMgr.wrapExecPromise(
        WINDOWS_SPOTIFY_TRACK_FIND,
        null
      );
      if (!songInfo || !songInfo.includes(windowTitleStr)) {
        // it must have paused, or an ad, or it was closed
        return null;
      }
      // fetch it from spotify
      // result will be something like: "Window Title: Dexys Midnight Runners - Come On Eileen"
      songInfo = songInfo.substring(windowTitleStr.length);
      let artistSong = songInfo.split("-");
      let artist = artistSong[0].trim();
      let song = artistSong[1].trim();
      let resp = await utilMgr.softwareGet(
        `/music/track?artist=${artist}&name=${song}`,
        utilMgr.getItem("jwt")
      );
      let trackInfo = null;
      if (utilMgr.isResponseOk(resp) && resp.data && resp.data.id) {
        trackInfo = resp.data;
        // set the other attributes like start and type
        trackInfo["type"] = "spotify";
        trackInfo["state"] = "playing";
        trackInfo["start"] = 0;
        trackInfo["end"] = 0;
        trackInfo["genre"] = "";
      }
      return trackInfo;
    } else {
      let state = await this.getSpotifyTrackState();
      return new Promise((resolve, reject) => {
        spotify.getTrack((err, track) => {
          if (err || !track) {
            resolve(null);
          } else {
            // convert the duration to seconds
            let duration = Math.round(track.duration / 1000);
            let trackInfo = {
              id: track.id,
              name: track.name,
              artist: track.artist,
              genre: "", // spotify doesn't provide genre from their app.
              start: 0,
              end: 0,
              state,
              duration,
              type: "spotify"
            };
            resolve(trackInfo);
          }
        });
      });
    }
  }

  async isItunesRunning() {
    if (utilMgr.isWindows()) {
      return false;
    }
    let isActive = await this.isMacMusicPlayerActive("iTunes");
    if (!isActive) {
      return false;
    }
    return new Promise((resolve, reject) => {
      itunes.isRunning((err, isRunning) => {
        if (err) {
          resolve(false);
        } else {
          resolve(isRunning);
        }
      });
    });
  }

  /**
 * returns an array of data, i.e.
 * 0:"Dance"
    1:"Martin Garrix"
    2:"High on Life (feat. Bonn) - Single"
    3:4938 <- is this the track ID?
    4:375
    5:"High on Life (feat. Bonn)"
    6:"3:50"
 */
  async getItunesTrackPromise() {
    let state = await this.getItunesTrackState();
    return new Promise((resolve, reject) => {
      itunes.track((err, track) => {
        if (err || !track) {
          resolve(null);
        } else {
          let trackInfo = {
            id: "",
            name: "",
            artist: "",
            genre: "", // spotify doesn't provide genre from their app.
            start: 0,
            end: 0,
            state,
            duration: 0,
            type: "itunes"
          };
          if (track.length > 0) {
            trackInfo["genre"] = track[0];
          }
          if (track.length >= 1) {
            trackInfo["artist"] = track[1];
          }
          if (track.length >= 3) {
            trackInfo["id"] = `itunes:track:${track[3]}`;
          }
          if (track.length >= 5) {
            trackInfo["name"] = track[5];
          }
          if (track.length >= 6) {
            // get the duration "4:41"
            let durationParts = track[6].split(":");
            if (durationParts && durationParts.length === 2) {
              let durationInMin =
                parseInt(durationParts[0], 10) * 60 +
                parseInt(durationParts[1]);
              trackInfo["duration"] = durationInMin;
            }
          }
          resolve(trackInfo);
        }
      });
    });
  }

  async sendMusicData(trackData) {
    if (!trackData || !trackData.id) {
      return;
    }

    // add the "local_start", "start", and "end"
    // POST the kpm to the PluginManager
    utilMgr
      .softwarePost("/data/music", trackData, utilMgr.getItem("jwt"))
      .then(resp => {
        if (utilMgr.isResponseOk(resp)) {
          // everything is fine, delete the offline data file
          return { status: "ok" };
        } else {
          return { status: "fail" };
        }
      });
  }

  tryRefreshAgain() {
    this.refreshPlaylists();
  }

  async refreshPlaylists() {
      if (this._buildingPlaylists) {
        // try again in a second
        setTimeout(() => {
          this.tryRefreshAgain();
        }, 1000);
      }
      this._buildingPlaylists = true;

      let serverIsOnline = await utilMgr.serverIsAvailable();
      this._runningTrack = await getRunningTrack();
      if (
        !this._initialized &&
        this._runningTrack.playerType === PlayerType.MacItunesDesktop
      ) {
        this._currentPlayerName = PlayerName.ItunesDesktop;
      }
      this._initialized = true;

      if (this._currentPlayerName === PlayerName.ItunesDesktop) {
        await this.showItunesPlaylists(serverIsOnline);
      } else {
        await this.showSpotifyPlaylists(serverIsOnline);
      }
      this.syncControls(this._runningTrack);

      this._buildingPlaylists = false;
  }

  async showItunesPlaylists(serverIsOnline) {
    let foundPlaylist = this._itunesPlaylists.find(element => {
      return element.type === "playlist";
    });
    // if no playlists are found for itunes, then fetch
    if (!foundPlaylist) {
      await this.refreshPlaylistForPlayer(
        PlayerName.ItunesDesktop,
        serverIsOnline
      );
    }
  }

  async showSpotifyPlaylists(serverIsOnline) {
    // if no playlists are found for spotify, then fetch
    let foundPlaylist = this._spotifyPlaylists
      ? this._spotifyPlaylists.find(element => {
          return element.type === "playlist";
        })
      : null;
    if (!foundPlaylist) {
      await this.refreshPlaylistForPlayer(
        PlayerName.SpotifyWeb,
        serverIsOnline
      );
    }
    if (this._spotifyPlaylists.length > 0) {
      let filteredSpotifyPlaylists = this._spotifyPlaylists.filter(element => {
        return element.type && element.type === "playlist";
      });
      filteredSpotifyPlaylists = filteredSpotifyPlaylists.map(element => {
        element["isPlaying"] =
          this._selectedPlaylistId == element.id ? true : false;
        return element;
      });
      // this.KpmMusicStoreManagerObj.selectedPlaylist = filteredSpotifyPlaylists[0]
      //   ? filteredSpotifyPlaylists[0]
      //   : null;
      this.structureViewObj.initialize(
        filteredSpotifyPlaylists,
        this._selectedPlaylistTrackId
      );
    }

    await getRunningTrack().then(track => {
      if (track.state == "paused") {
        $("#play-image-" + this._selectedPlaylistTrackId).attr(
          "src",
          PLAY_CONTROL_ICON
        );
      } else if (track.state == "playing") {
        $("#play-image-" + this._selectedPlaylistTrackId).attr(
          "src",
          PAUSE_CONTROL_ICON
        );
      }
    });

    // setInterval(() => {
    //   let filteredSpotifyPlaylists = this._spotifyPlaylists.filter(element => {
    //     return element.type && element.type === "playlist";
    //   });
    //   this.structureViewObj.initialize(filteredSpotifyPlaylists);
    // }, 10000);
  }

  requiresSpotifyAccess() {
    let spotifyAccessToken = utilMgr.getItem("spotify_access_token");
    return spotifyAccessToken ? false : true;
  }

  //
  // Fetch the playlist names for a specific player
  //
  async refreshPlaylistForPlayer(playerName, serverIsOnline) {
    // this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
    let items = [];

    let needsSpotifyAccess = this.requiresSpotifyAccess();

    let playlists = [];
    let type = "spotify";
    if (playerName === PlayerName.ItunesDesktop) {
      type = "itunes";
    }
    // there's nothing to get if it's windows and they don't have
    // a premium spotify account
    let premiumAccountRequired =
      !utilMgr.isMac() &&
      !this.KpmMusicStoreManagerObj.hasSpotifyPlaybackAccess()
        ? true
        : false;

    let allowSpotifyPlaylistFetch = true;
    if (needsSpotifyAccess || premiumAccountRequired) {
      allowSpotifyPlaylistFetch = false;
    }

    if (allowSpotifyPlaylistFetch) {
      playlists = await getPlaylists(playerName);
    }

    if (this._savedPlaylists.length === 0) {
      // fetch and reconcile the saved playlists against the spotify list
      await this.fetchSavedPlaylists(serverIsOnline);
    }

    // sort
    this.sortPlaylists(playlists);

    // go through each playlist and find out it's state
    if (playlists && playlists.length > 0) {
      for (let i = 0; i < playlists.length; i++) {
        let playlist = playlists[i];
        this._playlistMap[playlist.id] = playlist;
        let playlistItemTracks = this._playlistTrackMap[playlist.id];

        if (playlistItemTracks && playlistItemTracks.length > 0) {
          let playlistState = await this.getPlaylistState(playlist.id);
          playlist.state = playlistState;
        }
        playlist.itemType = "playlist";
        playlist.tag = type;
      }
    }

    // filter out the music time playlists into it's own list if we have any
    this.retrieveMusicTimePlaylist(playlists);

    // add the buttons to the playlist
    await this.addSoftwareLoginButtonIfRequired(serverIsOnline, items);

    // add the no music time connection button if we're not online
    if (!serverIsOnline) {
      items.push(this.getNoMusicTimeConnectionButton());
    }

    if (premiumAccountRequired) {
      // show the spotify premium account required button
      items.push(this.getSlackPremiumAccountRequiredButton());
    }

    // add the connect to spotify if they still need to connect
    if (needsSpotifyAccess) {
      items.push(this.getConnectToSpotifyButton());
    }

    if (utilMgr.getItem("slack_access_token")) {
      // show the disconnect slack button
      items.push(this.getSlackDisconnectButton());
    }

    if (playerName === PlayerName.ItunesDesktop) {
      // add the action items specific to itunes
      items.push(this.getItunesConnectedButton());
      items.push(this.getSwitchToSpotifyButton());

      if (playlists.length > 0) {
        items.push(this.getLineBreakButton());
      }

      playlists.forEach(item => {
        items.push(item);
      });

      this._itunesPlaylists = items;
    } else {
      if (utilMgr.getItem("spotify_access_token")) {
        // show the disconnect spotify button
        items.push(this.getSpotifyDisconnectButton());
      }

      // add the action items specific to spotify
      if (allowSpotifyPlaylistFetch) {
        playlists.push(this.getSpotifyLikedPlaylistFolder());
        this._playlistMap[
          SPOTIFY_LIKED_SONGS_PLAYLIST_ID
        ] = this.getSpotifyLikedPlaylistFolder();
        items.push(this.getSpotifyConnectedButton());
      }

      if (utilMgr.isMac()) {
        items.push(this.getSwitchToItunesButton());
      }

      // get the custom playlist button
      if (serverIsOnline && allowSpotifyPlaylistFetch) {
        items.push(this.getLineBreakButton());

        if (!this.globalPlaylistIdExists()) {
          // server is online, we have spotify access, and no global playlist exists.
          // auto-create the global top 40
          setTimeout(() => {
            atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              "musictime.generateGlobalPlaylist"
            );
          }, 1000);
        }

        const customPlaylistButton = this.getCustomPlaylistButton();
        if (customPlaylistButton) {
          items.push(customPlaylistButton);
        }
      }

      // add the music time playlists that were found
      if (this._musictimePlaylists && this._musictimePlaylists.length > 0) {
        for (let i = 0; i < this._musictimePlaylists.length; i++) {
          const musicTimePlaylist = this._musictimePlaylists[i];
          musicTimePlaylist.tag = "paw";
          items.push(musicTimePlaylist);
        }
      }

      if (playlists.length > 0) {
        items.push(this.getLineBreakButton());
      }

      playlists.forEach(item => {
        items.push(item);
      });

      this._spotifyPlaylists = items;
    }
  }

  sortPlaylists(playlists) {
    if (playlists && playlists.length > 0) {
      playlists.sort((a, b) => {
        const nameA = a.name.toLowerCase(),
          nameB = b.name.toLowerCase();
        if (nameA < nameB)
          //sort string ascending
          return -1;
        if (nameA > nameB) return 1;
        return 0; //default return value (no sorting)
      });
    }
  }

  async showPlaylistItems(playlist_id) {
    if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
      let tracks = await getSpotifyLikedSongs();
      this._selectedPlaylist = this.getPlaylistItemTracksFromTracks(tracks);
    } else {
      this.KpmMusicStoreManagerObj.selectedPlaylist = this._playlistMap[
        playlist_id
      ];
      this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
        playlist_id
      );
    }
    let _self = this;
    this.structureViewObj._spotifyPlaylists.map(function(item) {
      if (item.id === playlist_id) {
        item.child = _self._selectedPlaylist;
      }
    });

    this.structureViewObj.initialize(this.structureViewObj._spotifyPlaylists);
  }

  async syncControls(track) {
    // this.KpmMusicStoreManagerObj.selectedPlaylist = "6Cc3nRsIGyk6HQUPXpRBom";
    this.KpmMusicStoreManagerObj.runningTrack = track;
    // update the playlist
    const selectedPlaylist = this.KpmMusicStoreManagerObj.selectedPlaylist;
    if (selectedPlaylist) {
      await this.KpmMusicStoreManagerObj.clearPlaylistTracksForId(
        selectedPlaylist.id
      );
      // this will get the updated state of the track
      const playerlist = await this.getPlaylistItemTracksForPlaylistId(
        selectedPlaylist.id
      );

      // this.structureViewObj._spotifyPlaylists[0]['child'] = playerlist;
      await this.KpmMusicStoreManagerObj.refreshPlaylistState();

      // if (this._treeProvider) {
      //     this._treeProvider.refreshParent(selectedPlaylist);
      // }
    }

    if (this._hideSongTimeout) {
      clearTimeout(this._hideSongTimeout);
    }

    const trackStatus = track ? track.state : TrackStatus.NotAssigned;

    if (
      trackStatus === TrackStatus.Paused ||
      trackStatus === TrackStatus.Playing
    ) {
      // if (track.state === TrackStatus.Playing) {
      //    // this.showPauseControls(track);
      // } else {
      //     //this.showPlayControls(track);
      // }
    }
    // else {
    //     //this.showLaunchPlayerControls();
    // }
  }

  //
  // Fetch the tracks for a given playlist ID
  //
  async getPlaylistItemTracksForPlaylistId(playlist_id) {
    let playlistItemTracks = this._playlistTrackMap[playlist_id];

    if (!playlistItemTracks || playlistItemTracks.length === 0) {
      if (this._currentPlayerName === PlayerName.ItunesDesktop) {
        // get the itunes tracks based on this playlist id name
        const codyResp = await getPlaylistTracks(
          PlayerName.ItunesDesktop,
          playlist_id
        );
        playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
          codyResp
        );
      } else {
        // fetch from spotify web
        if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
          let tracks = await getSpotifyLikedSongs();
          playlistItemTracks = this.getPlaylistItemTracksFromTracks(tracks);
        } else {
          // get the playlist tracks from the spotify api
          const codyResp = await getPlaylistTracks(
            PlayerName.SpotifyWeb,
            playlist_id
          );
          playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
            codyResp
          );
        }
      }

      // update the map
      this._playlistTrackMap[playlist_id] = playlistItemTracks;
    }

    if (playlistItemTracks && playlistItemTracks.length > 0) {
      for (let i = 0; i < playlistItemTracks.length; i++) {
        playlistItemTracks[i]["playlist_id"] = playlist_id;
      }
    }

    return playlistItemTracks;
  }

  getPlaylistItemTracksFromCodyResponse(codyResponse) {
    let playlistItems = [];
    if (codyResponse && codyResponse.state === CodyResponseType.Success) {
      let paginationItem = codyResponse.data;

      if (paginationItem && paginationItem.items) {
        playlistItems = paginationItem.items.map((track, idx) => {
          const position = idx + 1;
          let playlistItem = this.createPlaylistItemFromTrack(track, position);

          return playlistItem;
        });
      }
    }

    return playlistItems;
  }

  //
  // Build the playlist items from the list of tracks
  //
  getPlaylistItemTracksFromTracks(tracks) {
    let playlistItems = [];
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i++) {
        let track = tracks[i];
        const position = i + 1;
        let playlistItem = this.createPlaylistItemFromTrack(track, position);
        playlistItems.push(playlistItem);
      }
    }
    return playlistItems;
  }

  createPlaylistItemFromTrack(track, position) {
    let playlistItem = new PlaylistItem();
    playlistItem.type = "track";
    playlistItem.name = track.name;
    playlistItem.id = track.id;
    playlistItem.popularity = track.popularity;
    playlistItem.played_count = track.played_count;
    playlistItem.position = position;
    playlistItem.artist = track.artist;
    playlistItem.playerType = track.playerType;
    playlistItem.itemType = "track";
    delete playlistItem.tracks;

    if (track.id === this._runningTrack.id) {
      playlistItem.state = this._runningTrack.state;
      this._selectedTrackItem = playlistItem;
    } else {
      playlistItem.state = TrackStatus.NotAssigned;
    }
    return playlistItem;
  }

  async fetchSavedPlaylists(serverIsOnline) {
    let playlists = [];
    if (serverIsOnline) {
      const response = await softwareGet(
        "/music/generatedPlaylist",
        utilMgr.getItem("jwt")
      );

      if (isResponseOk(response)) {
        // only return the non-deleted playlists
        for (let i = 0; i < response.data.total; i++) {
          const savedPlaylist = response.data.items[i];
          if (savedPlaylist && savedPlaylist["deleted"] !== 1) {
            savedPlaylist.id = savedPlaylist.playlist_id;
            savedPlaylist.playlistTypeId = savedPlaylist.playlistTypeId;
            delete savedPlaylist.playlist_id;
            playlists.push(savedPlaylist);
          }
        }
      }
    }
    this._savedPlaylists = playlists;
  }
  /**
   * Checks if the user's spotify playlists contains either
   * the global top 40 or the user's coding favorites playlist.
   * The playlistTypeId is used to match the set ID from music time
   * app. 1 = user's coding favorites, 2 = global top 40
   */
  retrieveMusicTimePlaylist(playlists) {
    if (this._savedPlaylists.length > 0 && playlists.length > 0) {
      for (let i = 0; i < this._savedPlaylists.length; i++) {
        let savedPlaylist = this._savedPlaylists[i];
        let savedPlaylistTypeId = savedPlaylist.playlistTypeId;

        for (let x = playlists.length - 1; x >= 0; x--) {
          let playlist = playlists[x];
          if (playlist.id === savedPlaylist.id) {
            playlist.playlistTypeId = savedPlaylistTypeId;
            playlist.tag = "paw";
            playlists.splice(x, 1);
            this._musictimePlaylists.push(playlist);
            break;
          }
        }
      }
    } else {
      this._musictimePlaylists = [];
    }
  }

  /**
   * Returns whether we've created the global playlist or not.
   */
  globalPlaylistIdExists() {
    if (this._savedPlaylists.length > 0) {
      for (let i = 0; i < this._savedPlaylists.length; i++) {
        let savedPlaylist = this._savedPlaylists[i];
        let savedPlaylistTypeId = savedPlaylist.playlistTypeId;
        if (savedPlaylistTypeId === SOFTWARE_TOP_SONGS_PLID) {
          return true;
        }
      }
    }
    return false;
  }

  //
  // Fetch the playlist overall state
  //
  async getPlaylistState(playlist_id) {
    let playlistState = TrackStatus.NotAssigned;

    const playlistTrackItems = await this.getPlaylistItemTracksForPlaylistId(
      playlist_id
    );

    if (playlistTrackItems && playlistTrackItems.length > 0) {
      for (let i = 0; i < playlistTrackItems.length; i++) {
        const playlistItem = playlistTrackItems[i];
        if (playlistItem.id === this._runningTrack.id) {
          return this._runningTrack.state;
        } else {
          // update theis track status to not assigned to ensure it's also updated
          playlistItem.state = TrackStatus.NotAssigned;
        }
      }
    }

    return playlistState;
  }

  clearPlaylistTracksForId(playlist_id) {
    this._playlistTrackMap[playlist_id] = null;
  }

  async addSoftwareLoginButtonIfRequired(serverIsOnline, items) {
    let loggedInCacheState = userstatusMgr.getLoggedInCacheState();
    let userStatus = {
      loggedIn: loggedInCacheState
    };
    if (loggedInCacheState === null) {
      // update it since it's null
      // {loggedIn: true|false}
      userStatus = await userstatusMgr.getUserStatus(serverIsOnline);
    }

    // if (!userStatus.loggedIn) {
    //   items.push(this.getSoftwareLoginButton());
    // }
  }

  async addSoftwareLoginButtonIfRequired(serverIsOnline, items) {
    let loggedInCacheState = userstatusMgr.getLoggedInCacheState();
    let userStatus = {
      loggedIn: loggedInCacheState
    };
    if (loggedInCacheState === null) {
      // update it since it's null
      // {loggedIn: true|false}
      userStatus = await userstatusMgr.getUserStatus(serverIsOnline);
    }

    if (!userStatus.loggedIn) {
      items.push(this.getSoftwareLoginButton());
    }
  }

  getSpotifyLikedPlaylistFolder() {
    const item = new PlaylistItem();
    item.type = "playlist";
    item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
    item.tracks = new PlaylistTrackInfo();
    // set set a number so it shows up
    item.tracks.total = 1;
    item.playerType = PlayerType.WebSpotify;
    item.tag = "spotify";
    item.itemType = "playlist";
    item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
    return item;
  }

  getNoMusicTimeConnectionButton() {
    return this.buildActionItem(
      "offline",
      "offline",
      null,
      PlayerType.NotAssigned,
      "Music Time Offline",
      "Unable to connect to Music Time"
    );
  }

  getSpotifyConnectedButton() {
    return this.buildActionItem(
      "spotifyconnected",
      "connected",
      null,
      PlayerType.WebSpotify,
      "Spotify Connected",
      "You've connected Spotify"
    );
  }

  getSpotifyDisconnectButton() {
    return this.buildActionItem(
      "spotifydisconnect",
      "action",
      "musictime.disconnectSpotify",
      PlayerType.NotAssigned,
      "Disconnect Spotify",
      "Disconnect your Spotify oauth integration"
    );
  }

  getSlackDisconnectButton() {
    return this.buildActionItem(
      "slackdisconnect",
      "action",
      "musictime.disconnectSlack",
      PlayerType.NotAssigned,
      "Disconnect Slack",
      "Disconnect your Slack oauth integration"
    );
  }

  getSlackPremiumAccountRequiredButton() {
    return this.buildActionItem(
      "spotifypremium",
      "action",
      "musictime.spotifyPremiumRequired",
      PlayerType.NotAssigned,
      "Spotify Premium Required",
      "Connect to your premium Spotify account to use the play, pause, next, and previous controls"
    );
  }

  getItunesConnectedButton() {
    return this.buildActionItem(
      "itunesconnected",
      "connected",
      null,
      PlayerType.MacItunesDesktop,
      "iTunes Connected",
      "You've connected iTunes"
    );
  }

  getConnectToSpotifyButton() {
    return this.buildActionItem(
      "connectspotify",
      "spotify",
      "musictime.connectSpotify",
      PlayerType.WebSpotify,
      "Connect Spotify",
      "Connect Spotify to view your playlists"
    );
  }

  getSoftwareLoginButton() {
    return this.buildActionItem(
      "login",
      "login",
      null,
      PlayerType.NotAssigned,
      LOGIN_LABEL,
      "To see your music data in Music Time, please log in to your account",
      null,
      utilMgr.launchLogin
    );
  }

  getSwitchToSpotifyButton() {
    return this.buildActionItem(
      "title",
      "spotify",
      "musictime.launchSpotify",
      PlayerType.WebSpotify,
      "Switch to Spotify"
    );
  }

  getSwitchToItunesButton() {
    return this.buildActionItem(
      "title",
      "itunes",
      "musictime.launchItunes",
      PlayerType.MacItunesDesktop,
      "Switch to iTunes"
    );
  }

  getLineBreakButton() {
    return this.buildActionItem(
      "title",
      "divider",
      null,
      PlayerType.NotAssigned,
      "",
      ""
    );
  }

  buildActionItem(
    id,
    type,
    command,
    playerType,
    name,
    tooltip = "",
    itemType = "",
    callback = null
  ) {
    let item = new PlaylistItem();
    item.tracks = new PlaylistTrackInfo();
    item.type = type;
    item.id = id;
    item.command = command;
    item["cb"] = callback;
    item.playerType = playerType;
    item.name = name;
    item.tooltip = tooltip;
    item.itemType = itemType;

    return item;
  }

  async createOrRefreshGlobalTopSongsPlaylist() {
    const serverIsOnline = utilMgr.serverIsAvailable();

    if (!serverIsOnline) {
      window.showInformationMessage(
        "Our service is temporarily unavailable, please try again later."
      );
      return;
    }

    if (this.requiresSpotifyAccess()) {
      // don't create or refresh, no spotify access provided
      return;
    }

    // get the global top songs
    await this.syncUsersWeeklyTopSongs();

    let globalPlaylist = this.getMusicTimePlaylistByTypeId(
      SOFTWARE_TOP_SONGS_PLID
    );

    let playlistId = null;
    if (!globalPlaylist) {
      // 1st create the empty playlist
      const playlistResult = await createPlaylist(
        SOFTWARE_TOP_SONGS_NAME,
        true
      );

      if (playlistResult.state === CodyResponseType.Failed) {
        window.showErrorMessage(
          `There was an unexpected error adding tracks to the playlist. ${playlistResult.message}`,
          ...["OK"]
        );
        return;
      }

      playlistId = playlistResult.data.id;

      if (playlistId) {
        await this.updateSavedPlaylists(
          playlistId,
          2,
          SOFTWARE_TOP_SONGS_NAME
        ).catch(err => {
          utilMgr.logIt("Error updating music time global playlist ID");
        });
      }
    } else {
      // global playlist exists, get the id to refresh
      playlistId = globalPlaylist.id;
    }

    if (this._softwareTopSongs && this._softwareTopSongs.length > 0) {
      let tracksToAdd = this._softwareTopSongs.map(item => {
        return item.trackId;
      });
      if (tracksToAdd && tracksToAdd.length > 0) {
        if (!globalPlaylist) {
          // no global playlist, add the tracks for the 1st time
          await this.addTracks(
            playlistId,
            SOFTWARE_TOP_SONGS_NAME,
            tracksToAdd
          );
        } else {
          // it exists, refresh it with new tracks
          await replacePlaylistTracks(playlistId, tracksToAdd).catch(err => {
            utilMgr.logIt(`Error replacing tracks, error: ${err.message}`);
          });
        }
      }
    }

    // setTimeout(() => {
    //   this.clearSpotify();
    //   commands.executeCommand("musictime.refreshPlaylist");
    // }, 500);

    await this.fetchSavedPlaylists(serverIsOnline);
  }

  async generateUsersWeeklyTopSongs() {
    if (this._buildingCustomPlaylist) {
      return;
    }
    const serverIsOnline = serverIsAvailable();

    if (!serverIsOnline) {
      window.showInformationMessage(
        "Our service is temporarily unavailable, please try again later."
      );
      return;
    }

    if (this.requiresSpotifyAccess()) {
      // don't create or refresh, no spotify access provided
      return;
    }

    this._buildingCustomPlaylist = true;

    let customPlaylist = this.getMusicTimePlaylistByTypeId(
      PERSONAL_TOP_SONGS_PLID
    );

    // sync the user's weekly top songs
    await this.syncUsersWeeklyTopSongs();

    let playlistId = null;
    if (!customPlaylist) {
      let playlistResult = await createPlaylist(PERSONAL_TOP_SONGS_NAME, true);

      if (playlistResult.state === CodyResponseType.Failed) {
        window.showErrorMessage(
          `There was an unexpected error adding tracks to the playlist. ${playlistResult.message}`,
          ...["OK"]
        );
        this._buildingCustomPlaylist = false;
        return;
      }

      playlistId = playlistResult.data.id;

      await this.updateSavedPlaylists(
        playlistId,
        1,
        PERSONAL_TOP_SONGS_NAME
      ).catch(err => {
        utilMgr.logIt("Error updating music time global playlist ID");
      });
    } else {
      // get the spotify playlist id from the app's existing playlist info
      playlistId = customPlaylist.id;
    }

    // get the spotify track ids and create the playlist
    if (playlistId) {
      // add the tracks
      // list of [{trackId, artist, name}...]
      if (this._userTopSongs && this._userTopSongs.length > 0) {
        let tracksToAdd = this._userTopSongs.map(item => {
          return item.trackId;
        });

        if (!customPlaylist) {
          await this.addTracks(
            playlistId,
            PERSONAL_TOP_SONGS_NAME,
            tracksToAdd
          );
        } else {
          await replacePlaylistTracks(playlistId, tracksToAdd).catch(err => {
            utilMgr.logIt(`Error replacing tracks, error: ${err.message}`);
          });

          window.showInformationMessage(
            `Successfully refreshed ${PERSONAL_TOP_SONGS_NAME}.`,
            ...["OK"]
          );
        }
      } else {
        window.showInformationMessage(
          `Successfully created ${PERSONAL_TOP_SONGS_NAME}, but we're unable to add any songs at the moment.`,
          ...["OK"]
        );
      }
    }

    setTimeout(() => {
      this.clearSpotify();
      commands.executeCommand("musictime.refreshPlaylist");
    }, 500);

    await this.fetchSavedPlaylists(serverIsOnline);

    // update building custom playlist to false
    this._buildingCustomPlaylist = false;
  }

  async addTracks(playlist_id, name, tracksToAdd) {
    if (playlist_id) {
      // create the playlist_id in software
      const addTracksResult = await addTracksToPlaylist(
        playlist_id,
        tracksToAdd
      );

      if (addTracksResult.state === CodyResponseType.Success) {
        utilMgr.notify(
          "Music Time",
          `Successfully created ${name} and added tracks.`
        );
      } else {
        utilMgr.notify(
          "Music Time",
          `There was an unexpected error adding tracks to the playlist. ${addTracksResult.message}`
        );
      }
    }
  }

  async syncUsersWeeklyTopSongs() {
    const response = await softwareGet(
      "/music/playlist/favorites",
      utilMgr.getItem("jwt")
    );

    if (isResponseOk(response) && response.data.length > 0) {
      this._softwareTopSongs = response.data;
    } else {
      // clear the favorites
      this._softwareTopSongs = [];
    }
  }

  /**
   * Checks if the user's spotify playlists contains either
   * the global top 40 or the user's coding favorites playlist.
   * The playlistTypeId is used to match the set ID from music time
   * app. 1 = user's coding favorites, 2 = global top 40
   */
  getMusicTimePlaylistByTypeId(playlistTypeId) {
    if (this._musictimePlaylists.length > 0) {
      for (let i = 0; i < this._musictimePlaylists.length; i++) {
        const playlist = this._musictimePlaylists[i];
        const typeId = playlist.playlistTypeId;
        if (typeId === playlistTypeId) {
          return playlist;
        }
      }
    }
    return null;
  }

  async updateSavedPlaylists(playlist_id, playlistTypeId, name) {
    // i.e. playlistTypeId 1 = TOP_PRODUCIVITY_TRACKS
    // playlistTypeId 2 = SOFTWARE_TOP_SONGS_NAME
    const payload = {
      playlist_id,
      playlistTypeId,
      name
    };
    let jwt = utilMgr.getItem("jwt");
    let createResult = await softwarePost(
      "/music/generatedPlaylist",
      payload,
      jwt
    );

    return createResult;
  }

  // get the custom playlist button by checkinf if the custom playlist
  // exists or not. if it doesn't exist then it will show the create label,
  // otherwise, it will show the refresh label
  getCustomPlaylistButton() {
    // update the existing playlist that matches the personal playlist with a paw if found
    const customPlaylist = this.getMusicTimePlaylistByTypeId(
      PERSONAL_TOP_SONGS_PLID
    );

    const personalPlaylistLabel = !customPlaylist
      ? GENERATE_CUSTOM_PLAYLIST_TITLE
      : REFRESH_CUSTOM_PLAYLIST_TITLE;
    const personalPlaylistTooltip = !customPlaylist
      ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
      : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

    if (
      this._currentPlayerName !== PlayerName.ItunesDesktop &&
      !this.requiresSpotifyAccess()
    ) {
      // add the connect spotify link
      let listItem = new PlaylistItem();
      listItem.tracks = new PlaylistTrackInfo();
      listItem.type = "action";
      listItem.tag = "action";
      listItem.id = "codingfavorites";
      listItem.command = "musictime.generateWeeklyPlaylist";
      listItem.playerType = PlayerType.WebSpotify;
      listItem.name = personalPlaylistLabel;
      listItem.tooltip = personalPlaylistTooltip;
      return listItem;
    }
    return null;
  }

  getMusicCodingData() {
    const file = utilMgr.getMusicSessionDataStoreFile();
    const initialValue = {
      add: 0,
      paste: 0,
      delete: 0,
      netkeys: 0,
      linesAdded: 0,
      linesRemoved: 0,
      open: 0,
      close: 0,
      keystrokes: 0,
      syntax: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: utilMgr.getOffsetSecends() / 60,
      pluginId: utilMgr.getPluginId(),
      os: utilMgr.getOs(),
      version: utilMgr.getVersion(),
      source: {}
    };
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString();
        // we're online so just delete the datastore file
        utilMgr.deleteFile(file);
        if (content) {
          const payloads = content
            .split(/\r?\n/)
            .map(item => {
              let obj = null;
              if (item) {
                try {
                  obj = JSON.parse(item);
                } catch (e) {
                  //
                }
              }
              if (obj) {
                return obj;
              }
            })
            .filter(item => item);

          // build the aggregated payload
          const musicCodingData = this.buildAggregateData(
            payloads,
            initialValue
          );
          return musicCodingData;
        }
      } else {
        console.log("No keystroke data to send with the song session");
      }
    } catch (e) {
      console.log(`Unable to aggregate music session data: ${e.message}`);
    }
    return initialValue;
  }

  buildBootstrapSongSession() {
    const now = utilMgr.nowInSecs();
    let d = new Date();
    // offset is the minutes from GMT. it's positive if it's before, and negative after
    const offset = d.getTimezoneOffset();
    const offset_sec = offset * 60;
    // send the music time bootstrap payload
    let track = new Track();
    track.id = "music-time-init";
    track.name = "music-time-init";
    track.artist = "music-time-init";
    track.type = "init";
    track["start"] = now;
    track["local_start"] = now - offset_sec;
    track["end"] = now + 1;
    track = {
      ...track,
      ...this.getMusicCodingData()
    };

    this.sendMusicData(track);
  }

  buildAggregateData(payloads, initialValue) {
    const numerics = [
      "add",
      "paste",
      "delete",
      "netkeys",
      "linesAdded",
      "linesRemoved",
      "open",
      "close",
      "keystrokes"
    ];
    if (payloads && payloads.length > 0) {
      payloads.forEach(element => {
        initialValue.keystrokes += element.keystrokes;
        if (element.source) {
          // go through the source object
          initialValue.source = element.source;
          const keys = Object.keys(element.source);
          if (keys && keys.length > 0) {
            keys.forEach(key => {
              let sourceObj = element.source[key];
              const sourceObjKeys = Object.keys(sourceObj);
              if (sourceObjKeys && sourceObjKeys.length > 0) {
                sourceObjKeys.forEach(sourceObjKey => {
                  const val = sourceObj[sourceObjKey];
                  if (numerics.includes(sourceObjKey)) {
                    // aggregate
                    initialValue[sourceObjKey] += val;
                  }
                });
              }

              if (!initialValue.syntax && sourceObj.syntax) {
                initialValue.syntax = sourceObj.syntax;
              }

              if (!sourceObj.timezone) {
                sourceObj[
                  "timezone"
                ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
              }
              if (!sourceObj.offset) {
                sourceObj["offset"] = getOffsetSecends() / 60;
              }
              if (!sourceObj.pluginId) {
                sourceObj["pluginId"] = getPluginId();
              }
              if (!sourceObj.os) {
                sourceObj["os"] = getOs();
              }
              if (!sourceObj.version) {
                sourceObj["version"] = getVersion();
              }
            });
          }
        }
      });
    }
    return initialValue;
  }

  async refreshPlaylistState() {
    if (this._spotifyPlaylists.length > 0) {
      // build the spotify playlist
      this._spotifyPlaylists.forEach(async playlist => {
        let playlistItemTracks = this._playlistTrackMap[playlist.id];

        if (playlistItemTracks && playlistItemTracks.length > 0) {
          let playlistState = await this.getPlaylistState(playlist.id);
          playlist.state = playlistState;
        }
      });
    }

    if (isMac()) {
      // build the itunes playlist
      if (this._itunesPlaylists.length > 0) {
        this._itunesPlaylists.forEach(async playlist => {
          let playlistItemTracks = this._playlistTrackMap[playlist.id];

          if (playlistItemTracks && playlistItemTracks.length > 0) {
            let playlistState = await this.getPlaylistState(playlist.id);
            playlist.state = playlistState;
          }
        });
      }
    }
  }

  getPlaylistById(playlist_id) {
    return this._playlistMap[playlist_id];
  }

  // async playSelectedItem(playlistItem, isExpand = true) {
  //   const musicCtrlMgr = new KpmMusicControlManager();
  //   if (playlistItem.type === "track") {
  //     let currentPlaylistId = playlistItem["playlist_id"]
  //       ? playlistItem["playlist_id"]
  //       : playlistItem["id"];

  //     this.selectedTrackItem = playlistItem;
  //     if (!this.selectedPlaylist) {
  //       const playlist = await this.getPlaylistById(currentPlaylistId);
  //       this.selectedPlaylist = playlist;
  //     }

  //     const notPlaying =
  //       playlistItem.state !== TrackStatus.Playing ? true : false;

  //     const isLikedSongsPlaylist =
  //       this.selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
  //         ? true
  //         : false;

  //     if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
  //       if (notPlaying) {
  //         const pos = playlistItem.position || 1;
  //         await playItunesTrackNumberInPlaylist(
  //           this.selectedPlaylist.name,
  //           pos
  //         );
  //       } else {
  //         musicCtrlMgr.pauseSong(PlayerName.ItunesDesktop);
  //       }
  //     } else if (this._currentPlayerName === PlayerName.SpotifyDesktop) {
  //       // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
  //       // make sure the track has spotify:track and the playlist has spotify:playlist
  //       if (isLikedSongsPlaylist) {
  //         this.playSpotifySongById(playlistItem);
  //       } else {
  //         this.playSpotifySongInPlaylist(this.selectedPlaylist, playlistItem);
  //       }
  //     } else {
  //       if (notPlaying) {
  //         await this.launchAndPlayTrack(playlistItem, this.spotifyUser);
  //       } else {
  //         musicCtrlMgr.pauseSong(this._currentPlayerName);
  //       }
  //     }
  //   } else {
  //     // to play a playlist
  //     // {device_id: <spotify_device_id>,
  //     //   uris: ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"],
  //     //   context_uri: <playlist_uri, album_uri>}
  //     this.selectedPlaylist = playlistItem;

  //     if (!isExpand) {
  //       // get the tracks
  //       const tracks = await this.getPlaylistItemTracksForPlaylistId(
  //         playlistItem.id
  //       );

  //       // get the tracks
  //       const selectedTrack = tracks && tracks.length > 0 ? tracks[0] : null;

  //       const isLikedSongsPlaylist =
  //         playlistItem.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
  //           ? true
  //           : false;

  //       if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
  //         const pos = 1;
  //         await playItunesTrackNumberInPlaylist(
  //           this.selectedPlaylist.name,
  //           pos
  //         );
  //       } else {
  //         const spotifyDevices = await getSpotifyDevices();
  //         let checkTrackStateAndTryAgainCount = 3;
  //         if (!spotifyDevices || spotifyDevices.length === 0) {
  //           // no spotify devices found, lets launch the web player with the track

  //           // launch it
  //           await this.launchPlayer(PlayerName.SpotifyWeb);
  //           checkTrackStateAndTryAgainCount = 8;
  //         }

  //         if (!selectedTrack) {
  //           return;
  //         }

  //         if (this._currentPlayerName === PlayerName.SpotifyDesktop) {
  //           if (isLikedSongsPlaylist) {
  //             // just play the 1st track
  //             this.playSpotifySongById(selectedTrack);
  //           } else {
  //             // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
  //             // make sure the track has spotify:track and the playlist has spotify:playlist
  //             this.playSpotifySongInPlaylist(playlistItem, selectedTrack);
  //           }
  //         } else {
  //           if (isLikedSongsPlaylist) {
  //             // play the 1st track in the non-playlist liked songs folder
  //             if (selectedTrack) {
  //               musicCtrlMgr.playSpotifyTrackFromPlaylist(
  //                 this.spotifyUser,
  //                 playlistItem.id,
  //                 selectedTrack /* track */,
  //                 spotifyDevices,
  //                 this.selectedTrackItem,
  //                 this.selectedPlaylist,
  //                 checkTrackStateAndTryAgainCount
  //               );
  //             }
  //           } else {
  //             // use the normal play playlist by offset 0 call
  //             musicCtrlMgr.playSpotifyTrackFromPlaylist(
  //               this.spotifyUser,
  //               playlistItem.id,
  //               null /* track */,
  //               spotifyDevices,
  //               this.selectedTrackItem,
  //               this.selectedPlaylist,
  //               checkTrackStateAndTryAgainCount
  //             );
  //           }

  //           if (selectedTrack) {
  //             this.selectedTrackItem = selectedTrack;
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

  async playSelectedItem(playlistItem, isExpand = true) {
    const musicCtrlMgr = new KpmMusicControlManager();

    const isTrackOrPlaylist =
      playlistItem.type === "track" || playlistItem.type === "playlist";
    let isLikedSongs =
      this._selectedPlaylistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
    // is this a track or playlist item?
    if (playlistItem.type === "track") {
      let currentPlaylistId = playlistItem["playlist_id"];

      // !important! set the selected track
      this.selectedTrackItem = playlistItem;

      if (currentPlaylistId) {
        // make sure we have a selected playlist
        const playlist = await this.getPlaylistById(currentPlaylistId);
        this.selectedPlaylist = playlist;
      } else if (isLikedSongs) {
        this.selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
      }

      const notPlaying =
        playlistItem.state !== TrackStatus.Playing ? true : false;

      if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
        if (notPlaying) {
          const pos = playlistItem.position || 1;
          await playItunesTrackNumberInPlaylist(
            this.selectedPlaylist.name,
            pos
          );
        } else {
          musicCtrlMgr.pauseSong(PlayerName.ItunesDesktop);
        }
      } else if (this.currentPlayerName === PlayerName.SpotifyDesktop) {
        // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
        // make sure the track has spotify:track and the playlist has spotify:playlist
        this.playSpotifyDesktopPlaylistTrack();
      } else {
        this.launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
      }
    } else {
      // !important! set the selected playlist
      this.selectedPlaylist = playlistItem;

      if (!isExpand) {
        // it's a play request, not just an expand. get the tracks
        const tracks = await this.getPlaylistItemTracksForPlaylistId(
          playlistItem.id
        );

        // get the tracks
        const selectedTrack = tracks && tracks.length > 0 ? tracks[0] : null;

        if (!selectedTrack) {
          // no tracks in this playlist, return out
          return;
        }

        // !important! set the selected track now since it's not null
        this.selectedTrackItem = selectedTrack;

        if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
          const pos = 1;
          await playItunesTrackNumberInPlaylist(
            this.selectedPlaylist.name,
            pos
          );
        } else {
          if (this.currentPlayerName === PlayerName.SpotifyDesktop) {
            this.playSpotifyDesktopPlaylistTrack();
          } else {
            this.launchAndPlaySpotifyWebPlaylistTrack(false /*isTrack*/);
          }
        }
      }
    }

    // check spotify song state if the device list is empty. this will
    // alert the user they may need to log on to spotify if we're unable to
    // play a track
    if (
      !isExpand &&
      isTrackOrPlaylist &&
      playlistItem.playerType !== PlayerType.MacItunesDesktop
    ) {
      const devices = await getSpotifyDevices();
      if (!devices || devices.length === 0) {
        this.checkSpotifySongState(true /*missingDevices*/);
      }
    }
  }

  /**
   * Launch and play a spotify track via the web player.
   * @param isTrack boolean
   */
  launchAndPlaySpotifyWebPlaylistTrack = async isTrack => {
    // get the selected playlist
    const selectedPlaylist = this.selectedPlaylist;
    // get the selected track
    const selectedTrack = this.selectedTrackItem;

    const notPlaying =
      selectedTrack.state !== TrackStatus.Playing ? true : false;
    const progressLabel = notPlaying
      ? `Playing ${selectedTrack.name}`
      : `Pausing ${selectedTrack.name}`;

    // MusicCommandManager.initiateProgress(progressLabel);

    const isLikedSongsPlaylist =
      selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
        ? true
        : false;

    if (isTrack) {
      // a track was selected, check if we should play or pause it
      const musicCtrlMgr = new KpmMusicControlManager();

      if (notPlaying) {
        if (isLikedSongsPlaylist) {
          await launchAndPlaySpotifyTrack(selectedTrack.id);
        } else {
          await launchAndPlaySpotifyTrack(
            selectedTrack.id,
            selectedPlaylist.id
          );
        }
      } else {
        musicCtrlMgr.pauseSong(this.currentPlayerName);
      }
    } else {
      if (isLikedSongsPlaylist) {
        // play the 1st track in the non-playlist liked songs folder
        await launchAndPlaySpotifyTrack(selectedTrack.id, selectedPlaylist.id);
      } else {
        // use the normal play playlist by offset 0 call
        await launchAndPlaySpotifyTrack("", selectedPlaylist.id);
      }
    }
  };

  /**
   * Helper function to play a track or playlist if we've determined to play
   * against the mac spotify desktop app.
   */
  playSpotifyDesktopPlaylistTrack = () => {
    // get the selected playlist
    const selectedPlaylist = this.selectedPlaylist;
    // get the selected track
    const selectedTrack = this.selectedTrackItem;
    const isLikedSongsPlaylist =
      selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
        ? true
        : false;
    if (isLikedSongsPlaylist) {
      // just play the 1st track
      playSpotifyMacDesktopTrack(selectedTrack.id);
    } else {
      // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
      // make sure the track has spotify:track and the playlist has spotify:playlist
      playSpotifyMacDesktopTrack(selectedTrack.id, selectedPlaylist.id);
    }
  };

  async launchAndPlayTrack(track, spotifyUser) {
    const musicCtrlMgr = new KpmMusicControlManager();
    const currentPlaylist = this.selectedPlaylist;
    // check if there's any spotify devices
    const spotifyDevices = await getSpotifyDevices();
    if (!spotifyDevices || spotifyDevices.length === 0) {
      // no spotify devices found, lets launch the web player with the track

      // launch it
      await launchPlayer(PlayerName.SpotifyWeb);
      // now select it from within the playlist
      setTimeout(() => {
        musicCtrlMgr.playSpotifyTrackFromPlaylist(
          spotifyUser,
          currentPlaylist.id,
          track,
          spotifyDevices,
          this.selectedTrackItem,
          this.selectedPlaylist,
          5 /* checkTrackStateAndTryAgain */
        );
      }, 1000);
    } else {
      // a device is found, play using the device
      await musicCtrlMgr.playSpotifyTrackFromPlaylist(
        spotifyUser,
        currentPlaylist.id,
        track,
        spotifyDevices,
        this.selectedTrackItem,
        this.selectedPlaylist
      );
    }
  }
  playSpotifySongById(track) {
    const musicCtrlMgr = new KpmMusicControlManager();
    let track_uri = track.id.includes("spotify:track")
      ? track.id
      : `spotify:track:${track.id}`;
    musicCtrlMgr.playSongById(PlayerName.SpotifyDesktop, track_uri);
    this.checkSpotifySongState(track_uri);
  }

  checkSpotifySongState(track_uri) {
    if (checkSpotifyStateTimeout) {
      clearTimeout(checkSpotifyStateTimeout);
    }
    checkSpotifyStateTimeout = setTimeout(async () => {
      // make sure we get that song, if not then they may not be logged in
      let playingTrack = await getRunningTrack();

      let playingTrackUri = "";
      if (playingTrack) {
        if (playingTrack["spotify_url"]) {
          playingTrackUri = playingTrack["spotify_url"];
        } else if (playingTrack.uri) {
          playingTrackUri = playingTrack.uri;
        } else if (playingTrack.id) {
          playingTrackUri = playingTrack.id;
        }
      }

      if (playingTrackUri !== track_uri) {
        // they're not logged in
        // window.showInformationMessage(
        //     "We're unable to play the selected Spotify track. Please make sure you are logged in to your account. You will need the Spotify desktop app if you have a non-premium Spotify account.",
        //     ...["Ok"]
        // );
      }
    }, 3000);
  }

  async playSpotifySongInPlaylist(playlist, track) {
    const musicCtrlMgr = new KpmMusicControlManager();
    let track_uri = track.id.includes("spotify:track")
      ? track.id
      : `spotify:track:${track.id}`;
    let playlist_uri = playlist.id.includes("spotify:playlist")
      ? playlist.id
      : `spotify:playlist:${playlist.id}`;
    let params = [track_uri, playlist_uri];
    await musicCtrlMgr.playSongInContext(params);
    this.checkSpotifySongState(track_uri);
  }

  async initializeSpotify() {
    if (
      !utilMgr.getItem("spotify_access_token") ||
      !utilMgr.getItem("spotify_refresh_token")
    ) {
      const serverIsOnline = await utilMgr.serverIsAvailable();
      const oauthResult = await utilMgr.getSpotifyOauth(serverIsOnline);
      if (oauthResult && oauthResult.auth) {
        // update the CodyMusic credentials
        this.KpmMusicStoreManagerObj.updateSpotifyAccessInfo(oauthResult.auth);
      } else {
        utilMgr.setItem("spotify_access_token", null);
        utilMgr.setItem("spotify_refresh_token", null);
      }
    } else {
      const spotifyOauth = {
        access_token: utilMgr.getItem("spotify_access_token"),
        refresh_token: utilMgr.getItem("spotify_refresh_token")
      };
      this.KpmMusicStoreManagerObj.updateSpotifyAccessInfo(spotifyOauth);
    }
  }
}
