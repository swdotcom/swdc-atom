"use babel";


import {
    PlaylistItem,
    PlayerName,
    PlayerType,
    TrackStatus,
    getSpotifyDevices,
    PlayerDevice,
    launchPlayer,
    playItunesTrackNumberInPlaylist,
    getRunningTrack
} from "cody-music";
import { KpmMusicControlManager } from "../KpmMusicControlManager";
import { SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { KpmMusicManager } from "../KpmMusicManager";

/**
 * Create the playlist tree item (root or leaf)
 * @param p
 * @param cstate
 */
const createPlaylistTreeItem = (
    p,
    cstate
) => {
    return new PlaylistTreeItem(p, cstate);
};

/**
 * Launch the Spotify player if it's not already launched, then play the track
 * @param track
 * @param spotifyUser
 */
export const launchAndPlayTrack = async (
    track,
    spotifyUser
) => {
    const musicMgr = KpmMusicManager.getInstance();
    const musicCtrlMgr = new MusicControlManager();
    const currentPlaylist = musicMgr.selectedPlaylist;
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
                5 /* checkTrackStateAndTryAgain */
            );
        }, 1000);
    } else {
        // a device is found, play using the device
        await musicCtrlMgr.playSpotifyTrackFromPlaylist(
            spotifyUser,
            currentPlaylist.id,
            track,
            spotifyDevices
        );
    }
};

export const checkSpotifySongState = (track_uri) => {
    setTimeout(async () => {
        // make sure we get that song, if not then they may not be logged in
        let playingTrack = await getRunningTrack();
        if (!playingTrack || playingTrack.uri !== track_uri) {
            // they're not logged in
            window.showInformationMessage(
                "We're unable to play the Spotify track. Please make sure you are logged in to your account.",
                ...["Ok"]
            );
        }
    }, 2000);
};

export const playSpotifySongInPlaylist = async (
    playlist,
    track
) => {
    const musicCtrlMgr = new MusicControlManager();
    let track_uri = track.id.includes("spotify:track")
        ? track.id
        : `spotify:track:${track.id}`;
    let playlist_uri = playlist.id.includes("spotify:playlist")
        ? playlist.id
        : `spotify:playlist:${playlist.id}`;
    let params = [track_uri, playlist_uri];
    await musicCtrlMgr.playSongInContext(params);
    checkSpotifySongState(track_uri);
};

export const playSpotifySongById = (track) => {
    const musicCtrlMgr = new MusicControlManager();
    let track_uri = track.id.includes("spotify:track")
        ? track.id
        : `spotify:track:${track.id}`;
    musicCtrlMgr.playSongById(PlayerName.SpotifyDesktop, track_uri);
    checkSpotifySongState(track_uri);
};

export const playSelectedItem = async (
    playlistItem,
    isExpand = true
) => {
    const musicCtrlMgr = new KpmMusicControlManager();
    const musicMgr = new KpmMusicManager();
    if (playlistItem.type === "track") {
        let currentPlaylistId = playlistItem["playlist_id"];

        musicMgr.selectedTrackItem = playlistItem;
        if (!musicMgr.selectedPlaylist) {
            const playlist = await musicMgr.getPlaylistById(
                currentPlaylistId
            );
            musicMgr.selectedPlaylist = playlist;
        }

        const notPlaying =
            playlistItem.state !== TrackStatus.Playing ? true : false;

        const isLikedSongsPlaylist =
            musicMgr.selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
                ? true
                : false;

        if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
            if (notPlaying) {
                const pos = playlistItem.position || 1;
                await playItunesTrackNumberInPlaylist(
                    musicMgr.selectedPlaylist.name,
                    pos
                );
            } else {
                musicCtrlMgr.pauseSong(PlayerName.ItunesDesktop);
            }
        } else if (musicMgr.currentPlayerName === PlayerName.SpotifyDesktop) {
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            if (isLikedSongsPlaylist) {
                playSpotifySongById(playlistItem);
            } else {
                playSpotifySongInPlaylist(
                    musicMgr.selectedPlaylist,
                    playlistItem
                );
            }
        } else {
            if (notPlaying) {
                await launchAndPlayTrack(playlistItem, musicMgr.spotifyUser);
            } else {
                musicCtrlMgr.pauseSong(musicMgr.currentPlayerName);
            }
        }
    } else {
        // to play a playlist
        // {device_id: <spotify_device_id>,
        //   uris: ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"],
        //   context_uri: <playlist_uri, album_uri>}
        musicMgr.selectedPlaylist = playlistItem;

        if (!isExpand) {
            // get the tracks
            const tracks =  await musicMgr.getPlaylistItemTracksForPlaylistId(
                playlistItem.id
            );

            // get the tracks
            const selectedTrack =
                tracks && tracks.length > 0 ? tracks[0] : null;

            const isLikedSongsPlaylist =
                playlistItem.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
                    ? true
                    : false;

            if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
                const pos = 1;
                await playItunesTrackNumberInPlaylist(
                    musicMgr.selectedPlaylist.name,
                    pos
                );
            } else {
                const spotifyDevices = await getSpotifyDevices();
                let checkTrackStateAndTryAgainCount = 3;
                if (!spotifyDevices || spotifyDevices.length === 0) {
                    // no spotify devices found, lets launch the web player with the track

                    // launch it
                    await launchPlayer(PlayerName.SpotifyWeb);
                    checkTrackStateAndTryAgainCount = 8;
                }

                if (!selectedTrack) {
                    return;
                }

                if (musicMgr.currentPlayerName === PlayerName.SpotifyDesktop) {
                    if (isLikedSongsPlaylist) {
                        // just play the 1st track
                        playSpotifySongById(selectedTrack);
                    } else {
                        // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
                        // make sure the track has spotify:track and the playlist has spotify:playlist
                        playSpotifySongInPlaylist(playlistItem, selectedTrack);
                    }
                } else {
                    if (isLikedSongsPlaylist) {
                        // play the 1st track in the non-playlist liked songs folder
                        if (selectedTrack) {
                            musicCtrlMgr.playSpotifyTrackFromPlaylist(
                                musicMgr.spotifyUser,
                                playlistItem.id,
                                selectedTrack /* track */,
                                spotifyDevices,
                                checkTrackStateAndTryAgainCount
                            );
                        }
                    } else {
                        // use the normal play playlist by offset 0 call
                        musicCtrlMgr.playSpotifyTrackFromPlaylist(
                            musicMgr.spotifyUser,
                            playlistItem.id,
                            null /* track */,
                            spotifyDevices,
                            checkTrackStateAndTryAgainCount
                        );
                    }

                    if (selectedTrack) {
                        musicMgr.selectedTrackItem = selectedTrack;
                    }
                }
            }
        }
    }
};

/**
 * Handles the playlist onDidChangeSelection event
 */
export const connectPlaylistTreeView = (view) => {
    return Disposable.from(
        view.onDidChangeSelection(async e => {
            if (!e.selection || e.selection.length === 0) {
                return;
            }
            let playlistItem = e.selection[0];

            if (playlistItem.command) {
                // run the command
                commands.executeCommand(playlistItem.command);
                return;
            } else if (playlistItem["cb"]) {
                const cbFunc = playlistItem["cb"];
                cbFunc();
                return;
            }

            // play it
            playSelectedItem(playlistItem);
        }),
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                //
            }
        })
    );
};
export class MusicPlaylistProvider  {

  

    constructor() {
        //
    }

    bindView(view) {
        this.view = view;
    }

    getParent(_p) {
        return void 0; // all playlists are in root
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    refreshParent(parent) {
        this._onDidChangeTreeData.fire(parent);
    }

    isTrackInPlaylistRunning(p) {
        return (
            p.state === TrackStatus.Playing || p.state === TrackStatus.Paused
        );
    }

    getTreeItem(p) {
        let treeItem = null;
        if (p.type === "playlist") {
            // it's a track parent (playlist)
            if (p && p.tracks && p.tracks["total"] && p.tracks["total"] > 0) {
                const folderState = this.isTrackInPlaylistRunning(
                    p
                );
                return createPlaylistTreeItem(p, folderState);
            }
            treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);
        } else {
            // it's a track or a title
            treeItem = createPlaylistTreeItem(p, TreeItemCollapsibleState.None);

            // reveal the track state if it's playing or paused
            if (this.isTrackInPlaylistRunning(p)) {
                // don't "select" it thought. that will invoke the pause/play action
                this.view.reveal(p, {
                    focus: true,
                    select: false
                });
            }
        }

        return treeItem;
    }

    async getChildren(element) {
        const musicMgr = KpmMusicManager.getInstance();

        if (element) {
            // return track of the playlist parent
            let tracks = await musicMgr.getPlaylistItemTracksForPlaylistId(
                element.id
            );
            return tracks;
        } else {
            // get the top level playlist parents
            return musicMgr.currentPlaylists;
        }
    }
}

