"use babel";

let $ = require("jquery");

let readyMsg = "";
let isReady = false;
let userStatus = null;

export default class KpmStatusView {
  constructor() {
    var that = this;

    this.element = document.createElement("div");
    this.element.classList.add("msg-status");
    this.element.classList.add("inline-block");
    this.element.setAttribute("id", "code-time-status");

    $(document).ready(function() {
      isReady = true;
      $(document).on("click", "#code-time-href", async function() {
        // {loggedIn: true|false, hasUserAccounts: true|false}

        if (!userStatus || !userStatus.hasUserAccounts) {
          // no user accounts at all, redirect to signup
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Code-Time:sign-up"
          );
        } else {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Code-Time:dashboard"
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
  display(msg, icon, tooltip, userStatusInfo) {
    if (!tooltip) {
      tooltip = "Click to see more from Code Time";
    }

    let iconClass = icon ? "icon icon-" + icon : "";

    this.element.innerHTML =
      "<span id='code-time-href' class='" +
      iconClass +
      "' style=\"cursor: pointer;\" title='" +
      tooltip +
      "'>" +
      msg +
      "</span>";

    let footerBars = atom.workspace.getFooterPanels();
    if (footerBars && footerBars.length > 0) {
      footerBars[0].getItem().leftPanel.appendChild(this.element);
    }
  }
}
