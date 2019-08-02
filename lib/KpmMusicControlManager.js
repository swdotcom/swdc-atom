"use babel";

import * as spotify from "spotify-node-applescript";
import * as itunes from "itunes-node-applescript";
const utilMgr = require("./UtilManager");
import {
    PlayerType,
    getRunningTrack,
    play,
    pause,
    playPause,
    previous,
    next,
    PlayerName,
    CodyConfig,
    Track,
    setItunesLoved,
    launchPlayer,
    PlaylistItem,
    PlayerDevice,
    getSpotifyDevices,
    quitMacPlayer
} from "cody-music";
import {
    api_endpoint
} from "./Constants";
import  KpmMusicStoreManager from "./KpmMusicStoreManager";
import { SpotifyUser } from "cody-music/dist/lib/profile";

const WINDOWS_SPOTIFY_TRACK_FIND =
  'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

let trackInfo = {};

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicControlManager {
    constructor() {
        this.KpmMusicStoreManagerObj = new KpmMusicStoreManager();
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
            const playerType = await this.getPlayer();
            if (playerType) {
                if (playerType === PlayerType.WebSpotify) {
                    await next(PlayerName.SpotifyWeb);
                } else if (playerType === PlayerType.MacItunesDesktop) {
                    await next(PlayerName.ItunesDesktop);
                } else if (playerType === PlayerType.MacSpotifyDesktop) {
                    await next(PlayerName.SpotifyDesktop);
                }
            }
        } else {
            await next(playerName);
        }

        KpmMusicStoreManager.getInstance().refreshPlaylists();
    }

    async previous(playerName = null) {
        if (!playerName) {
            const playerType = await this.getPlayer();
            if (playerType) {
                if (playerType === PlayerType.WebSpotify) {
                    await previous(PlayerName.SpotifyWeb);
                } else if (playerType === PlayerType.MacItunesDesktop) {
                    await previous(PlayerName.ItunesDesktop);
                } else if (playerType === PlayerType.MacSpotifyDesktop) {
                    await previous(PlayerName.SpotifyDesktop);
                }
            }
        } else {
            await previous(playerName);
        }
        KpmMusicStoreManager.getInstance().refreshPlaylists();
    }

    async play(playerName = null) {
        if (!playerName) {
            const playerType = await this.getPlayer();
            if (playerType) {
                if (playerType === PlayerType.WebSpotify) {
                    await play(PlayerName.SpotifyWeb);
                } else if (playerType === PlayerType.MacItunesDesktop) {
                    await play(PlayerName.ItunesDesktop);
                } else if (playerType === PlayerType.MacSpotifyDesktop) {
                    await play(PlayerName.SpotifyDesktop);
                }
            }
        } else {
            await play(playerName);
        }
        KpmMusicStoreManager.getInstance().refreshPlaylists();
    }

    async pause(playerName = null) {
        if (!playerName) {
            const playerType = await this.getPlayer();
            if (playerType) {
                if (playerType === PlayerType.WebSpotify) {
                    await playPause(PlayerName.SpotifyWeb);
                } else if (playerType === PlayerType.MacItunesDesktop) {
                    await playPause(PlayerName.ItunesDesktop);
                } else if (playerType === PlayerType.MacSpotifyDesktop) {
                    await playPause(PlayerName.SpotifyDesktop);
                }
            }
        } else {
            await playPause(playerName);
        }
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
                    logIt(`Error updating itunes loved state: ${err.message}`);
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
        const endpoint = `${api_endpoint}/auth/spotify?integrate=spotify&token=${utilMgr.getItem(
            "jwt"
        )}`;
        utilMgr.launchWebUrl(endpoint);
        utilMgr.refetchSpotifyConnectStatusLazily();
    }

    async disconnectSpotify() {
        let serverIsOnline = await utilMgr.serverIsAvailable();
        if (serverIsOnline) {
            let result = await utilMgr.softwarePut(
                "/disconnect/spotify",
                {},
                utilMgr.getItem("jwt")
            );

            if (isResponseOk(result)) {
                const musicstoreMgr = KpmMusicStoreManager.getInstance();
                // oauth is not null, initialize spotify
                musicstoreMgr.clearSpotifyAccessInfo();

                musicstoreMgr.refreshPlaylists();
            }
        } else {
            window.showInformationMessage(
                `Our service is temporarily unavailable.\n\nPlease try again later.\n`
            );
        }
    }

    
    async launchTrackPlayer(playerName = null) {
        const musicstoreMgr = KpmMusicStoreManager.getInstance();

        const currentlyRunningType = musicstoreMgr.currentPlayerType;
        if (playerName === PlayerName.ItunesDesktop) {
            musicstoreMgr.currentPlayerType = PlayerType.MacItunesDesktop;
        } else {
            musicstoreMgr.currentPlayerType = PlayerType.WebSpotify;
        }
       
        const currentTrack = new Track();
        if (!playerName) {
            getRunningTrack().then((track) => {
                if (track && track.id) {
                    let options = {
                        trackId: track.id
                    };
                    let playerType = track.playerType;
                    let devices = KpmMusicStoreManager.getInstance()
                        .spotifyPlayerDevices;

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

}