"use babel";

let $ = require("jquery");

let readyMsg = "";
let requireAuth = false;
let isReady = false;

export default class KpmStatusView {
  constructor() {
    var that = this;

    this.element = document.createElement("div");
    this.element.classList.add("msg-status");
    this.element.classList.add("inline-block");
    this.element.setAttribute("id", "code-time-status");

    $(document).ready(function() {
      isReady = true;
      $(document).on("click", "#code-time-href", function() {
        // Code-Time:dashboard -> opens dashboard fileName
        // Code-Time:go-to-software.com -> opens browser

        // commented out until a popup menu is available to display choices
        if (requireAuth) {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            "Code-Time:go-to-software.com"
          );
        } else {
          atom.confirm({
            message: "Code Time",
            detailedMessage:
              "Click to view your Code Time dashboard or visit the app.",
            buttons: {
              "Software.com": () => {
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  "Code-Time:go-to-software.com"
                );
              },
              Dashboard: () => {
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  "Code-Time:dashboard"
                );
              }
            }
          });
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

  /**
   * Display the message in the status bar
   **/
  display(msg, href, icon, tooltip) {
    requireAuth = href.indexOf("token=") !== -1 ? true : false;
    if (requireAuth && !icon) {
      icon = "alert";
      if (!tooltip) {
        tooltip =
          "To see your coding data in Code Time, please log in to your account";
      }
    }

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

    // this.element.innerHTML =
    //   "<span class='" +
    //   iconClass +
    //   "' title='" +
    //   tooltip +
    //   "'><a id='code-time-href' href='" +
    //   href +
    //   "'>" +
    //   msg +
    //   "</a></span>";

    let footerBars = atom.workspace.getFooterPanels();
    if (footerBars && footerBars.length > 0) {
      footerBars[0].getItem().leftPanel.appendChild(this.element);
    }
  }
}
