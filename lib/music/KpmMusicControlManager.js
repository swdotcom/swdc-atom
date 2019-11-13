"use babel";


const utilMgr = require("../UtilManager");
import KpmMusicManager from "./KpmMusicManager";
import $ from "jquery";
import {
  PlayerType,
  getRunningTrack,
  play,
  pause,
  previous,
  next,
  PlayerName,
  Track,
  setItunesLoved,
  launchPlayer,
  PlaylistItem,
  PlayerDevice,
  getSpotifyDevices,
  playSpotifyTrack,
  playTrackInContext,
  playSpotifyPlaylist,
  TrackStatus,
  playTrack,
  quitMacPlayer,

} from "cody-music";
import {
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
  api_endpoint,
  LOGIN_LABEL,
  REFRESH_CUSTOM_PLAYLIST_TITLE,
  GENERATE_CUSTOM_PLAYLIST_TITLE,
  REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
  GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
  PERSONAL_TOP_SONGS_PLID,
  NOT_NOW_LABEL,
  YES_LABEL
} from "../Constants";
import KpmMusicStoreManager from "./KpmMusicStoreManager";

import { SpotifyUser } from "cody-music/dist/lib/profile";

$(document).on("click", "#spotify-disconnect", async function() {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:disconnectSpotify"
  );
});

const CONNECT_SPOTIFY_MENU_LABEL = "Connect spotify";
const DISCONNECT_SPOTIFY_MENU_LABEL = "Disconnect spotify";
const CONNECT_SPOTIFY_COMMAND_KEY = "Music-Time:connectSpotify";

const CONNECT_SLACK_MENU_LABEL = "Connect slack";
const DISCONNECT_SLACK_MENU_LABEL = "Disconnect slack";
const CONNECT_SLACK_COMMAND_KEY = "Music-Time:connect-slack";
//
// KpmMusicManager - handles software session management
//
export default class KpmMusicControlManager {
  constructor() {
    this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
    this.KpmMusicStoreManagerObj.currentPlayerName = PlayerName.SpotifyWeb;
  }

  async getPlayer() {
    const track = KpmMusicStoreManager.getInstance().runningTrack;
    if (track) {
      return track.playerType;
    }
    return null;
  }

  async next(playerName = null) {
    if (!playerName) {
      playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
    }
    await next(playerName);

    await this.refreshPlayer();    
    //KpmMusicStoreManager.getInstance().refreshPlaylists();
  }

  async refreshPlayer() {
    setTimeout(async () => {
      await getRunningTrack().then(track => {
        let msg = "🎧";
        utilMgr.showStatus(msg, null, track);
      });
    }, 1000);
  }

  async previous(playerName = null) {
    if (!playerName) {
      playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
    }
    await previous(playerName);

    await this.refreshPlayer(); 
    //KpmMusicStoreManager.getInstance().refreshPlaylists();
  }

  async play(playerName = null) {
    if (!playerName) {
      playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
    }
    await play(playerName);
    await this.refreshPlayer(); 
    //KpmMusicStoreManager.getInstance().refreshPlaylists();
  }

  async pause(playerName = null) {
    // this.KpmMusicStoreManagerObj.currentPlayerName = playerName;
    if (!playerName) {
      playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
    }
    await pause(playerName).then(result => {
    });

    //KpmMusicStoreManager.getInstance().refreshPlaylists();
  }

  async setLiked(liked) {
    const musicstoreMgr = KpmMusicStoreManager.getInstance();
    let track = musicstoreMgr.runningTrack;
    if (track) {
      if (track.playerType === PlayerType.MacItunesDesktop) {
        // await so that the stateCheckHandler fetches
        // the latest version of the itunes track
        await setItunesLoved(liked).catch(err => {
          utilMgr.logIt(`Error updating itunes loved state: ${err.message}`);
        });
      }

      // set the server track to liked to keep it cached
      // until the song session is sent from the MusicStateManager
      let serverTrack = musicstoreMgr.serverTrack;
      if (!serverTrack) {
        serverTrack = { ...track };
      }
      serverTrack.loved = liked;
      musicstoreMgr.serverTrack = serverTrack;

      // update the music store running track liked state
      track.loved = liked;
      musicstoreMgr.runningTrack = track;

      // get the current track state
      MusicCommandManager.syncControls(track);
    }
  }

  async connectSpotify() {

    let jwt = utilMgr.getItem("jwt");
    if (!jwt) {
        jwt = await utilMgr.getAppJwt(true);
        await utilMgr.setItem("jwt", jwt);
    }
    const encodedJwt = encodeURIComponent(jwt);
    const qryStr = `token=${encodedJwt}&mac=${utilMgr.isMac()}`;
    const endpoint = `${api_endpoint}/auth/spotify?${qryStr}`;


    // const endpoint = `${api_endpoint}/auth/spotify?integrate=spotify&token=${utilMgr.getItem(
    //   "jwt"
    // )}`;
    utilMgr.launchWebUrl(endpoint);
    utilMgr.refetchSpotifyConnectStatusLazily();
    
  }

  async launchTrackPlayer(playerName = null) {
    const musicstoreMgr = KpmMusicStoreManager.getInstance();

    const currentlyRunningType = musicstoreMgr.currentPlayerName;
    if (playerName === PlayerName.ItunesDesktop) {
      musicstoreMgr.currentPlayerName = PlayerType.MacItunesDesktop;
    } else {
      musicstoreMgr.currentPlayerName = PlayerType.WebSpotify;
    }

    const currentTrack = new Track();
    if (!playerName) {
      getRunningTrack().then(track => {
        if (track && track.id) {
          let options = {
            trackId: track.id
          };
          let playerType = track.playerType;
          let devices = KpmMusicStoreManager.getInstance().spotifyPlayerDevices;

          if (
            playerType === PlayerType.WebSpotify &&
            devices &&
            devices.length === 1 &&
            !devices[0].name.includes("Web Player")
          ) {
            // launch the spotify desktop only if we have
            //
            playerType = PlayerType.MacSpotifyDesktop;
          }
          if (playerType === PlayerType.NotAssigned) {
            playerType = PlayerType.WebSpotify;
          }

          if (playerType === PlayerType.WebSpotify) {
            launchPlayer(PlayerName.SpotifyWeb, options);
          } else if (playerType === PlayerType.MacItunesDesktop) {
            launchPlayer(PlayerName.ItunesDesktop, options);
          } else {
            launchPlayer(PlayerName.SpotifyDesktop, options);
          }
        }
      });
    } else if (playerName === PlayerName.ItunesDesktop) {
      if (
        currentTrack &&
        currentTrack.playerType !== PlayerType.MacItunesDesktop
      ) {
        // end the spotify web track
        if (currentlyRunningType !== PlayerType.MacSpotifyDesktop) {
          musicCtrlMgr.pause(PlayerName.SpotifyWeb);
        } else {
          await quitMacPlayer(PlayerName.SpotifyDesktop);
        }
      }
      launchPlayer(PlayerName.ItunesDesktop);
    } else {
      // end the itunes track
      // musicCtrlMgr.pause(PlayerName.ItunesDesktop);
      // quit the app
      await quitMacPlayer(PlayerName.ItunesDesktop);
      const spotifyDevices = await getSpotifyDevices();
     if (!spotifyDevices || spotifyDevices.length === 0) {
        this.launchSpotifyPlayer();
      }
    }
  }

  launchSpotifyPlayer() {
  
    utilMgr.notify(
      "Music Time",
      `After you select and play your first song in Spotify, standard controls (play, pause, next, etc.) will appear in your status bar`
    );
    setTimeout(() => {
      launchPlayer(PlayerName.SpotifyWeb);
    }, 3200);
  }

  async disconnectSpotify() {
    this.disconnectOauth("Spotify");
  }

  async disconnectSlack() {
    this.disconnectOauth("Slack");
  }

  async disconnectOauth(type) {
    // const selection = await window.showInformationMessage(
    //     `Are you sure you would like to disconnect ${type}?`,
    //     ...[NOT_NOW_LABEL, YES_LABEL]
    // );
    const musicMgr = new KpmMusicManager();
    let confirm = window.confirm(
      "Are you sure you want to disconnect spotify?"
    );

    if (confirm) {
      let serverIsOnline = await utilMgr.serverIsAvailable();
      if (serverIsOnline) {
        const type_lc = type.toLowerCase();
        let result = await utilMgr.softwarePut(
          `/auth/${type_lc}/disconnect`,
          {},
          utilMgr.getItem("jwt")
        );

        if (utilMgr.isResponseOk(result)) {
          // oauth is not null, initialize spotify
          if (type_lc === "slack") {
            await musicMgr.updateSlackAccessInfo(null);
            utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
            utilMgr.addMusicMenuItem(CONNECT_SLACK_MENU_LABEL, CONNECT_SLACK_COMMAND_KEY);
          } else if (type_lc === "spotify") {
            this.KpmMusicStoreManagerObj.clearSpotifyAccessInfo();
         
            $("#spotify-status").text("Spotify Premium required");
            $("#spotify-disconnect").hide();
            
            $("#spotify-connect").show();
            $("#spotify-status").hide();
            $('#spotify-refresh-playlist').hide();

            atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              "Music-Time:clearTreeView"
            );
            atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              "Music-Time:clearFooterStatus"
            );
            if(utilMgr.isMusicTime()) {
              utilMgr.removeMusicMenuItem(DISCONNECT_SPOTIFY_MENU_LABEL);
              utilMgr.addMusicMenuItem(CONNECT_SPOTIFY_MENU_LABEL, CONNECT_SPOTIFY_COMMAND_KEY);
            }
          }
        }
      } else {
        window.showInformationMessage(
          `Our service is temporarily unavailable.\n\nPlease try again later.\n`
        );
      }
    } else {
      return false;
    }
  }

  async playSpotifyTrackFromPlaylist(
    spotifyUser,
    playlistId,
    playlistItem,
    spotifyDevices,
    selectedTrackItem,
    selectedPlaylist,
    checkTrackStateAndTryAgainCount = 0
  ) {
    if (playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
      playlistId = null;
    }
    const deviceId = spotifyDevices.length > 0 ? spotifyDevices[0].id : "";
    let options = {};
    if (deviceId) {
      options["device_id"] = deviceId;
    }
    const trackId = playlistItem ? playlistItem.id : "";
    if (trackId) {
      options["track_ids"] = [trackId];
    } else {
      options["offset"] = { position: 0 };
    }
    if (playlistId) {
      const playlistUri = `${spotifyUser.uri}:playlist:${playlistId}`;
      options["context_uri"] = playlistUri;
    }

    if (trackId && selectedTrackItem) {
      // check against the currently selected track
      if (trackId !== selectedTrackItem.id) {
        return;
      }
    } else if (playlistId && selectedPlaylist) {
      // check against the currently selected playlist
      if (playlistId !== selectedPlaylist.id) {
        return;
      }
    }

    /**
     * to play a track without the play list id
     * curl -X "PUT" "https://api.spotify.com/v1/me/player/play?device_id=4f38ae14f61b3a2e4ed97d537a5cb3d09cf34ea1"
     * --data "{\"uris\":[\"spotify:track:2j5hsQvApottzvTn4pFJWF\"]}"
     */

    if (!playlistId) {
      // just play by track id
      await playSpotifyTrack(playlistItem.id, deviceId);
    } else {
      // we have playlist id within the options, use that
      await playSpotifyPlaylist(playlistId, trackId, deviceId);
    }

    if (checkTrackStateAndTryAgainCount > 0) {
      const track = await getRunningTrack();
      if (playlistItem && track.id === playlistItem.id) {
        await MusicStateManager.getInstance().musicStateCheck();
      } else if (!playlistItem && track.id) {
        await MusicStateManager.getInstance().musicStateCheck();
      } else {
        checkTrackStateAndTryAgainCount--;
        spotifyDevices = await getSpotifyDevices();

        setTimeout(() => {
          this.playSpotifyTrackFromPlaylist(
            spotifyUser,
            playlistId,
            playlistItem,
            spotifyDevices,
            checkTrackStateAndTryAgainCount
          );
        }, 1000);
      }
    }
    //  else {
    //     await MusicStateManager.getInstance().musicStateCheck();
    // }
  }
}
