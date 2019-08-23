"use babel";

import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";
const utilMgr = require("./UtilManager");
import KpmMusicStoreManager from "./KpmMusicStoreManager";
import {
  getRunningTrack,
  PlayerType,
  TrackStatus,
  PlayerName,
  Track,
  requiresSpotifyAccessInfo,
  PlaylistItem,
  isSpotifyRunning,
  isPlayerRunning
} from "cody-music";
const WINDOWS_SPOTIFY_TRACK_FIND =
  'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

let trackInfo = {};

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicManager {
  constructor(serializedState) {
    //
    this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
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
        this.KpmMusicStoreManagerObj.currentPlayerName = PlayerName.ItunesDesktop;
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
      // this.KpmMusicStoreManagerObj.getServerTrack(playingTrack);

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

    // const needsRefresh =
    //     changeStatus.isNewTrack || changeStatus.trackStateChanged;

    // if (changeStatus.playerNameChanged) {
    //     // refresh the entire tree view
    //     commands.executeCommand("musictime.refreshPlaylist");
    // } else if (needsRefresh) {
    //     MusicManager.getInstance().refreshPlaylists();
    // }
    if (utilMgr.isMusicTime()) {
      let msg = '🎧';
      utilMgr.showStatus(msg, null, playingTrack);
    }
    this.processingSong = false;
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
        getItem("jwt")
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

}
