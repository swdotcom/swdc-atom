"use babel";

import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";
const utilMgr = require("./UtilManager");

let trackInfo = {};

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicManager {
  constructor(serializedState) {
    //
  }

  async isItunesRunning() {
    // String[] args = { "osascript", "-e", "get running of application \"Spotify\"" };
    let command = "ps -ef | grep iTunes";
    let result = await utilMgr.wrapExecPromise(command, null);
    return result != null && result.indexOf("iTunes.app") != -1 ? true : false;
  }

  async getItunesTrackState() {
    let command = `osascript -e \'tell application "iTunes" to get player state\'`;
    let result = await utilMgr.wrapExecPromise(command, null);
    return result;
  }

  async isSpotifyRunning() {
    // String[] args = { "osascript", "-e", "get running of application \"Spotify\"" };
    let command = "ps -ef | grep Spotify";
    let result = await utilMgr.wrapExecPromise(command, null);
    return result != null && result.indexOf("Spotify.app") != -1 ? true : false;
  }

  async getSpotifyTrackState() {
    let command = `osascript -e \'tell application "Spotify" to get player state\'`;
    let result = await utilMgr.wrapExecPromise(command, null);
    return result;
  }

  async gatherMusicInfo() {
    if (utilMgr.isWindows()) {
      // music tracking on windows is currently not supported
      return;
    }

    this.getTrackInfo()
      .then(async trackInfoData => {
        let d = new Date();
        // offset is the minutes from GMT. it's positive if it's before, and negative after
        const offset = d.getTimezoneOffset();
        const offset_sec = offset * 60;
        let nowInSec = Math.round(d.getTime() / 1000);
        // subtract the offset_sec (it'll be positive before utc and negative after utc)
        let localNowInSec = nowInSec - offset_sec;

        let hasPreviousTrack = trackInfo && trackInfo.id ? true : false;
        let previousTrackId = hasPreviousTrack ? trackInfo.id : null;
        let trackInfoId =
          trackInfoData && trackInfoData.id ? trackInfoData.id : null;

        let state = "stopped";
        if (trackInfoData) {
          state = trackInfoData["state"] || "playing";
        }
        let isPaused =
          state.toLowerCase().indexOf("playing") !== -1 ? false : true;

        if (trackInfoId) {
          // check if we have this track already in "trackInfo"
          if (!isPaused && trackInfoId !== previousTrackId) {
            // this means a new song has started, send a payload to complete
            // the 1st one and another to start the next one
            trackInfo["end"] = nowInSec - 1;
            await this.sendMusicData(trackInfo);

            // send the next payload starting the next song
            trackInfo = {};
            trackInfo = { ...trackInfoData };
            trackInfo["start"] = nowInSec;
            trackInfo["local_start"] = localNowInSec;
            await this.sendMusicData(trackInfo);
          } else if (!trackInfoId && !isPaused) {
            // no previous track played, send this one to start it
            trackInfo = { ...trackInfoData };
            trackInfo["start"] = nowInSec;
            trackInfo["local_start"] = localNowInSec;
            await this.sendMusicData(trackInfo);
          } else if (isPaused && trackInfoId === previousTrackId) {
            trackInfo["end"] = nowInSec;
            await this.sendMusicData(trackInfo);
            trackInfo = {};
          }
        } else if (previousTrackId) {
          // end this song since we're not getting a current track
          // and the trackInfo is not empty
          trackInfo["end"] = nowInSec;
          await this.sendMusicData(trackInfo);
          trackInfo = {};
        }
      })
      .catch(err => {
        console.log("error sending music data: ", err);
      });
  }

  async getTrackInfo() {
    let trackInfo = {};

    try {
      let isSpotifyRunning = await this.getSpotifyRunningPromise();
      let isItunesRunning = await this.isItunesRunningPromise();

      if (isSpotifyRunning) {
        trackInfo = await this.getSpotifyTrackPromise();
        let spotifyStopped =
          !trackInfo || (trackInfo && trackInfo["state"] !== "playing")
            ? true
            : false;
        if ((!trackInfo || spotifyStopped) && isItunesRunning) {
          // get that track data.
          trackInfo = await this.getItunesTrackPromise();
        }
      } else if (isItunesRunning) {
        trackInfo = await this.getItunesTrackPromise();
      }
    } catch (e) {
      console.log("unable to retieve music track info");
    }

    return trackInfo || {};
  }

  /**
   * returns true or an error.
   */
  getSpotifyRunningPromise() {
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
    let state = await this.getSpotifyTrackState();
    return new Promise((resolve, reject) => {
      spotify.getTrack((err, track) => {
        if (err || !track) {
          resolve(null);
        } else {
          let trackInfo = {
            id: track.id,
            name: track.name,
            artist: track.artist,
            genre: "", // spotify doesn't provide genre from their app.
            start: 0,
            end: 0,
            state,
            duration: track.duration,
            type: "spotify"
          };
          resolve(trackInfo);
        }
      });
    });
  }

  isItunesRunningPromise() {
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
}
