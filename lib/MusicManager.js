import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";
import AppConstants from "./AppConstants";

export default class MusicManager {
  async getCurrentMusicTrackId() {
    // const spotifyState = await getSpotifyStatePromise();
    //
    let trackInfo = {};

    if (appConstants.isWindows()) {
      // no support for windows yet
      return trackInfo;
    }

    if (await getSpotifyRunningPromise()) {
      const spotifyTrack = await getSpotifyTrackPromise();
      if (spotifyTrack) {
        trackInfo = {
          id: spotifyTrack.id,
          name: spotifyTrack.name,
          artist: spotifyTrack.artist,
          genre: "" // spotify doesn't provide genre from their app
        };
      }
    } else if (await isItunesRunningPromise()) {
      const itunesTrackInfo = await getItunesTrackPromise();
      if (itunesTrackInfo) {
        trackInfo = {
          id: itunesTrackInfo.id,
          name: itunesTrackInfo.name,
          artist: itunesTrackInfo.artist,
          genre: itunesTrackInfo.genre
        };
      }
    }

    return trackInfo;
  }

  /**
   * returns true or an error
   */
  getSpotifyRunningPromise() {
    return (
      new Promise() <
      boolean >
      ((resolve, reject) => {
        spotify.isRunning((err, isRunning) => {
          if (err) {
            reject(err);
          } else {
            resolve(isRunning);
          }
        });
      })
    );
  }

  /**
   * returns i.e. {position:75, state:"playing", track_id:"spotify:track:4dHuU8wSvtek4sxRGoDLpf", volume:100}
   */
  getSpotifyStatePromise() {
    return (
      new Promise() <
      spotify.State >
      ((resolve, reject) => {
        spotify.getState((err, state) => {
          if (err) {
            reject(err);
          } else {
            resolve(state);
          }
        });
      })
    );
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
    return (
      new Promise() <
      spotify.State >
      ((resolve, reject) => {
        spotify.getTrack((err, track) => {
          if (err) {
            reject(err);
          } else {
            resolve(track);
          }
        });
      })
    );
  }

  isItunesRunningPromise() {
    return new Promise((resolve, reject) => {
      itunes.isRunning((err, isRunning) => {
        if (err) {
          reject(err);
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
    return (
      new Promise() <
      itunes.any >
      ((resolve, reject) => {
        itunes.track((err, track) => {
          if (err) {
            reject(err);
          } else {
            let trackInfo = {};
            if (track) {
              if (track.length > 0) {
                trackInfo["genre"] = track[0];
              }
              if (track.length >= 1) {
                trackInfo["artist"] = track[1];
              }
              if (track.length >= 3) {
                trackInfo["id"] = track[3];
              }
              if (track.length >= 5) {
                trackInfo["name"] = track[5];
              }
            }
            resolve(trackInfo);
          }
        });
      })
    );
  }
}
