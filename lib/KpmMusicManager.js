"use babel";

import AppConstants from "./AppConstants";
import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";

let appConstants = null;
let trackInfo = {};

//
// SessionManager - handles software session management
//
export default class KpmMusicManager {
  constructor(serializedState) {
    if (!appConstants) {
      appConstants = new AppConstants();
    }

    this.init();
  }

  async init() {
    //
  }

  async gatherMusicInfo() {
    if (appConstants.isWindows()) {
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

        if (trackInfoId) {
          // check if we have this track already in "trackInfo"
          if (trackInfoId !== previousTrackId) {
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
          } else if (!trackInfoId) {
            // no previous track played, send this one to start it
            trackInfo = { ...trackInfoData };
            trackInfo["start"] = nowInSec;
            trackInfo["local_start"] = localNowInSec;
            await this.sendMusicData(trackInfo);
          } else if (
            trackInfoId &&
            previousTrackId &&
            trackInfo["state"] !== trackInfoData["state"]
          ) {
            // update the track info state
            trackInfo["state"] = trackInfoData["state"];
            await this.sendMusicData(trackInfo);
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
        if (!trackInfo && isItunesRunning) {
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
  getSpotifyTrackPromise() {
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
            state: "playing",
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
  getItunesTrackPromise() {
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
            state: "playing",
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
    console.log("sending track data: ", trackData);
    // add the "local_start", "start", and "end"
    // POST the kpm to the PluginManager
    appConstants.getApi().defaults.headers.common[
      "Authorization"
    ] = appConstants.getItem("jwt");
    return appConstants
      .getApi()
      .post("/data/music", trackData)
      .then(response => {
        // everything is fine
        // reset the count and other attributes
        return { status: "ok" };
      })
      .catch(err => {
        // store the payload offline
        console.log("Software.com: Error sending music track data: ", err);
        return { status: "fail" };
      });
  }
}
