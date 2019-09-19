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
  SPOTIFY_ICON
} from "../Constants";

const utilMgr = require("../UtilManager");

$(document).on("click", "#spotify-disconnect", async function() {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:disconnectSpotify"
  );
});

$(document).on("click", "#spotify-refresh-playlist", async function() {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:refreshPlaylist"
  );
});

export default class StructureView {
  constructor() {
    this.musicControlMgr = new KpmMusicControlManager();
    // this.musicMgr = new KpmMusicManager()

    this.musicstoreMgr = KpmMusicStoreManager.getInstance();

    const htmlString = fs.readFileSync(
      path.join(__dirname, "../..", "templates", "structure-view.html"),
      {
        encoding: "utf-8"
      }
    );
    this.element = $(htmlString).get(0);
    this.viewType = "structureView";

    // $(document).on("click", ".play-list", function(event) {

    //   event.stopPropagation();

    //   $(this).toggleClass('collapsed');
    // });
    // var handler = function() {
    //   $(this).toggleClass('collapsed');
    // };

    // $( "li.play-list" ).bind( "click", handler );
    // $( "li.play-list" ).unbind( "click", handler );
  }

  initialize(spotifyPlaylists, selectedPlaylistTrackId) {
    if (spotifyPlaylists) {
      this._spotifyPlaylists = spotifyPlaylists;
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
      $("#spotify-status").text("Spotify Premium required");
      $("#spotify-disconnect").hide();
    } else {
      $("#spotify-status").text("Spotify Connected");
      $("#spotify-disconnect").show();
    }

    this.renderTree(this._spotifyPlaylists);
  }

  renderTree(spotifyPlaylists) {
    console.log(spotifyPlaylists);

    let html = this.treeGenerator(spotifyPlaylists);
    $("div.structure-view>div>ol").html(html);
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

        let entry = `<li node-id="${item.id}" class="list-nested-item expanded list-item play-list play-list-angle-right ${isCollapsedClass}" title="${item.name}">
          
          <div class="symbol-mixed-block list-tab">
            <img width='15' height='15' src='${SPOTIFY_ICON}'/>
            <span>${utilMgr.text_truncate(item.name,20)}</span>
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
            entry += `<li node-id="${childItem.id}"  class="list-item playlist-nested-item" title="${childItem.name}">
              
                          <div class=" symbol-mixed-block">
                             
                              <span>${utilMgr.text_truncate(childItem.name,20)}</span>
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
    return "Structure View";
  }
}
