"use babel";

import $ from "jquery";
import fs from "fs";
import path from "path";
import _find from "lodash/find";
import _forEach from "lodash/forEach";

import KpmMusicStoreManager from "./KpmMusicStoreManager";
import KpmMusicControlManager from "./KpmMusicControlManager";

import {
  PLAY_CONTROL_ICON,
  PAUSE_CONTROL_ICON,
  SPOTIFY_ICON,
  GENERATE_CUSTOM_PLAYLIST_TITLE
} from "../Constants";

const utilMgr = require("../UtilManager");

$(document).on("click", "#spotify-refresh-playlist", async function() {
  let text = $(this).text();

  if (text == GENERATE_CUSTOM_PLAYLIST_TITLE) {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      "Music-Time:generateUsersWeeklyTopSongs"
    );
  } else {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      "Music-Time:refreshPlaylist"
    );
  }
});
$(document).on("click", "#spotify-connect", async function() {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:connectSpotify"
  );
});

export default class StructureView {
  constructor() {
    this.musicControlMgr = new KpmMusicControlManager();
    this.musicstoreMgr = KpmMusicStoreManager.getInstance();

    const htmlString = fs.readFileSync(
      path.join(__dirname, "../..", "templates", "structure-view.html"),
      {
        encoding: "utf-8"
      }
    );
    this.element = $(htmlString).get(0);
    this.viewType = "structureView";
  }
  showLoader() {
    $("#tree-content").hide();
    $("#loader").show();
  }

  hideLoader() {
    $("#tree-content").show();
    $("#loader").hide();
  }
  getUnique(arr, comp) {

    const unique = arr
         .map(e => e[comp])
  
       // store the keys of the unique objects
      .map((e, i, final) => final.indexOf(e) === i && i)
  
      // eliminate the dead keys & store unique objects
      .filter(e => arr[e]).map(e => arr[e]);
  
     return unique;
  }
  
  initialize(
    spotifyPlaylists,
    selectedPlaylistTrackId,
    devicesFound = [],
    generatePLaylistButton = {}
  ) {
    this.showLoader();
    if (spotifyPlaylists) {
      // let uniqueSpotifyPlaylist = {};
      // let res = spotifyPlaylists.filter((playlist, index) => {
      //   if(!uniqueSpotifyPlaylist[playlist.id]) {

      //   } else {
      //     uniqueSpotifyPlaylist[playlist.id] = 
      //   } 
      // });

      this._spotifyPlaylists = this.getUnique(spotifyPlaylists,'id');
    }
    this._selectedPlaylistTrackId = selectedPlaylistTrackId;
    let needsSpotifyAccess = this.musicstoreMgr.requiresSpotifyAccess();

    // there's nothing to get if it's windows and they don't have
    // a premium spotify account
    let premiumAccountRequired =
      !utilMgr.isMac() && !this.musicstoreMgr.hasSpotifyPlaybackAccess()
        ? true
        : false;

    if (needsSpotifyAccess || premiumAccountRequired) {
      $("#spotify-player-device").hide();
      $("#tree-content").show();
      if (utilMgr.getItem("spotify_access_token")) {
        $("#spotify-status").show();
        $("#spotify-status").text("Spotify Premium required");
      }
      $("#spotify-connect").show();
      // $("#spotify-disconnect").hide();
      $("#spotify-refresh-playlist").hide();
      this.hideLoader();
    } else {
      //show connected spotify device
      $("#spotify-player-device").show();
      $("#spotify-player-device").text(devicesFound.title);
      $("#spotify-player-device").prop("title", devicesFound.tooltip);

      $("#spotify-status").show();
      $("#spotify-connect").hide();
      $("#spotify-status").text("Spotify Connected");
      // $("#spotify-disconnect").show();
      $("#spotify-refresh-playlist").text(generatePLaylistButton.label);
      $("#spotify-refresh-playlist").show();
      this.renderTree(this._spotifyPlaylists);
    }
  }

  renderTree(spotifyPlaylists) {
    let html = this.treeGenerator(spotifyPlaylists);
    $("div.structure-view>div>ol").html(html);
    this.hideLoader();
  }

  clearTree() {
    $("div.structure-view>div>ol").html("");
  }

  // getPLaylistItem(playlistId) {
  //   const playlist = this.musicMgr.getPlaylistItemTracksForPlaylistId(playlistId);
  // }

  treeGenerator(data) {
    const self = this;
    let array = [],
      letter;

    _forEach(data, item => {
      if (item.id) {
        // let iconTpl = `<span class="icon icon-code"></span>`;
        let isChildAvailable =
          item.child && item.child.length > 0 ? true : false;
        // let playlistClass = "";
        // if(!isChildAvailable) {
        //   playlistClass = "play-list";
        // }
        let playTooltip = "Click to play/pause song";
        let isCollapsedClass = "collapsed";
        if (item.isPlaying) {
          isCollapsedClass = "";
        }

        let entry = `<li node-id="${
          item.id
        }" class="list-nested-item expanded list-item play-list play-list-angle-right ${isCollapsedClass}" title="${
          item.name
        }">
          
          <div class="symbol-mixed-block list-tab">
            <img width='15' height='15' src='${SPOTIFY_ICON}'/>
            <span>${utilMgr.text_truncate(item.name, 35)}</span>
          </div>
        `;

        if (isChildAvailable) {
          //let childContent = self.treeGenerator(item.child);
          entry += `<ol class="list-tree">`;
          _forEach(item.child, childItem => {
            // if(this._selectedPlaylistTrackId == childItem.id) {

            // }
            let innerHTML = `<span class='playlist-control' title='
              ${playTooltip}
             '><img width='11' height='11' id='play-image-${childItem.id}' src='${PLAY_CONTROL_ICON}'/>
             </span>`;
            //if (childContent.length != 0) {
            entry += `<li node-id="${
              childItem.id
            }"  class="list-item playlist-nested-item" title="${
              childItem.name
            }">
              
                          <div class=" symbol-mixed-block">
                             
                              <span>${utilMgr.text_truncate(
                                childItem.name,
                                20
                              )}</span>
                              ${innerHTML}
                          </div>
                      </li>`;
          });
          entry += `</ol>`;
        }
        entry += `</li>`;
        array.push(entry);
      }
    });

    return array.join("");
  }

  serialize() {}

  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  getTitle() {
    return "Music Time";
  }
}
