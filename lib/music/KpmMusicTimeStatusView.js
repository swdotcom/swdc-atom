"use babel";

let $ = require("jquery");
import { PLAY_CONTROL_ICON, PAUSE_CONTROL_ICON } from "../Constants";
let readyMsg = "";
let isReady = false;
let userStatus = null;
// import '../node_modules/font-awesome/css/font-awesome.min.css';
import KpmMusicStoreManager from "./KpmMusicStoreManager";
import {
  getRunningTrack,
  isSpotifyRunning,
  Track,
  PlayerType,
  TrackStatus,
  setConfig
} from "cody-music";


export default class KpmMusicTimeStatusView {
  constructor() {
    var that = this;
    
    
    
    this.element = document.createElement("div");
    this.element.classList.add("msg-status");
    this.element.classList.add("inline-block");
    this.element.setAttribute("id", "music-time-status");

    this.playElement = document.createElement("div");
    this.playElement.classList.add("msg-status");
    this.playElement.classList.add("inline-block");
    this.playElement.setAttribute("id", "music-play-control-status");

    this.nextElement = document.createElement("div");
    this.nextElement.classList.add("msg-status");
    this.nextElement.classList.add("inline-block");
    this.nextElement.setAttribute("id", "music-next-control-status");

    this.prevElement = document.createElement("div");
    this.prevElement.classList.add("msg-status");
    this.prevElement.classList.add("inline-block");
    this.prevElement.setAttribute("id", "music-prev-control-status");

    this.stopElement = document.createElement("div");
    this.stopElement.classList.add("msg-status");
    this.stopElement.classList.add("inline-block");
    this.stopElement.setAttribute("id", "music-stop-control-status");

    this.currentTrack = document.createElement("div");
    this.currentTrack.classList.add("msg-status");
    this.currentTrack.classList.add("inline-block");
    this.currentTrack.setAttribute("id", "current-track-status");

    $(document).ready(function() {
      isReady = true;
      $(document).on("click", "#music-play-control-href", async function() {
        if (!userStatus || !userStatus.loggedIn) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:log-in"
          );
        } else {
          await getRunningTrack().then(track => {
            this.trackData = track;
            if (track.state == "paused") {
              $("#play-image").attr("src", PLAY_CONTROL_ICON);
              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                "Music-Time:play"
              );
            } else if (track.state == "playing") {
              $("#play-image").attr("src", PAUSE_CONTROL_ICON);

              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                "Music-Time:pause"
              );
            }
          });
        }
      });

      $(document).on("click", "#music-time-href", async function() {
        // {loggedIn: true|false}
        let spotifyRunning = await isSpotifyRunning();
        if (!userStatus || !userStatus.loggedIn) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:login"
          );
        } else if (!spotifyRunning) {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:log-in"
          );
        }
      });
      $(document).on("click", "#music-next-control-href", async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:log-in"
          );
        } else {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:next"
          );
        }
      });
      $(document).on("click", "#music-prev-control-href", async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:log-in"
          );
        } else {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:previous"
          );
        }
      });

      $(document).on("click", "#music-current-control-href", async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:log-in"
          );
        } else {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Music-Time:launchTrackPlayer"
          );
        }
      });
    });
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  updateCurrentStatus(status) {
    userStatus = status;
  }

  /**
   * Display the message in the status bar
   **/
  async display(msg, icon, tooltip, track) {

    const utilMgr = require("../UtilManager");
    this.trackData = track;

    if (!tooltip) {
      tooltip = " Click to see more from Music Time";
    }
    let playTooltip = "Click to play/pause song";
    let nextTooltip = "Click to play next song";
    let previousTooltip = "Click to play previous song";

    if (userStatus && userStatus.name && userStatus.name !== "") {
      tooltip += " (" + userStatus.name + ")";
    }

    let currentTrackName = this.trackData ? this.trackData.name : "";

    let iconClass = icon ? "icon icon-" + icon : "";
    this.element.innerHTML =
      "<span id='music-time-href' class='" +
      iconClass +
      "' style=\"cursor: pointer;\" title='" +
      tooltip +
      "'>" +
      msg +
      "</span>";

    this.playElement.innerHTML =
      "<span id='music-play-control-href' class='" +
      iconClass +
      "' style=\"cursor: pointer;\" title='" +
      playTooltip +
      "'><img width='11' height='11' id='play-image' src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAlklEQVQ4T52SsQ3CMBRE7yFQKpZAomMKFkmblWhZJFPQIbEDokhB9JEdR0LB4ce5xoXv+eR/HyWZmUnaAOF0RXCY2VPSPrnfwM4jc+DIHIH73AP/wMgA0TOVCybgAjTf8FLwJ70ITIktcF4D9sC2FDwAjzi0TI+5Ib6Asefhvx64po4rUBctwFxKrsdKUifpBNy8PQ33H0yTQg9Xr1OeAAAAAElFTkSuQmCC'/></span>";

    this.nextElement.innerHTML =
      "<span id='music-next-control-href' class='" +
      iconClass +
      "' style=\"cursor: pointer;\" title='" +
      nextTooltip +
      "'><img width='11' height='11' src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAlUlEQVQ4T52SsQ1CMQxE79HQMAMzsBQtBRSsQAFC9CzFDIgRaCg4lC8soS+SYNJEkfXuzo7RnwfblmRg0tOwvZJ0knQLMJgLsKgJ2N5L2pT6GAxmDRzHAr+AwcyAezwy4MAAlDsNvh2fkkr8Zo+1+Ryy4BlYZqJegXlqODGQz8xNx29Az3EKPFprZ3snaTt8UW8/a/UXYyJixKvlzbMAAAAASUVORK5CYII='/></span>";

    this.prevElement.innerHTML =
      "<span id='music-prev-control-href' class='" +
      iconClass +
      "' style=\"cursor: pointer;\" title='" +
      previousTooltip +
      "'><img width='11' height='11' src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAgklEQVQ4T62SwQ3CMBAE50ogZdAFXaQZPmkmXdAFHeQLFUQaFCmWwMTYifB7Z2/3fMHBF6oLGxHR4rHqp2YwDUjmVVB9AF2epgiqI9CX4n+B6gW41fp+gHmPX/B/wGWCOgDXXVHfxeodODcvJxeWelf/MRntPoAs/gl4AnPTfW71fAF3+2G/L1w6ogAAAABJRU5ErkJggg=='/></span>";

    if (currentTrackName) {
      this.currentTrack.innerHTML =
        "<span id='music-current-control-href' class='" +
        iconClass +
        "' style=\"cursor: pointer;\" title='" +
        tooltip +
        "'>" +
        currentTrackName +
        "</span>";
    }
    if (KpmMusicStoreManager) {
      this.musicstoreMgr = KpmMusicStoreManager.getInstance();
    }
    let footerBars = atom.workspace.getFooterPanels();
    let needsSpotifyAccess = this.musicstoreMgr
      ? this.musicstoreMgr.requiresSpotifyAccess()
      : true;

    // there's nothing to get if it's windows and they don't have
    // a premium spotify account
    let premiumAccountRequired = this.musicstoreMgr
      ? !utilMgr.isMac() && !this.musicstoreMgr.hasSpotifyPlaybackAccess()
        ? true
        : false
      : true;

    if (footerBars && footerBars.length > 0) {
      footerBars[0].getItem().leftPanel.appendChild(this.element);
    }
    await getRunningTrack().then(track => {
      if (track.state == "paused") {
        $("#play-image").attr("src", PLAY_CONTROL_ICON);
      } else if (track.state == "playing") {
        $("#play-image").attr("src", PAUSE_CONTROL_ICON);
      }

      if (
        track.state !== "notassigned" &&
        !needsSpotifyAccess &&
        !premiumAccountRequired
      ) {
        footerBars[0].getItem().leftPanel.appendChild(this.prevElement);
        footerBars[0].getItem().leftPanel.appendChild(this.playElement);
        footerBars[0].getItem().leftPanel.appendChild(this.nextElement);
        footerBars[0].getItem().leftPanel.appendChild(this.currentTrack);
      }
    });
  }
}
