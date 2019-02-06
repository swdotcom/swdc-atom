"use babel";

const utilMgr = require("./UtilManager");

let $ = require("jquery");

let readyMsg = "";
let hasToken = false;
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
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          "Code-Time:go-to-software.com"
        );
        // commented out until a popup menu is available to display choices
        // if (hasToken) {
        //   atom.commands.dispatch(
        //     atom.views.getView(atom.workspace),
        //     "Code-Time:go-to-software.com"
        //   );
        // } else {
        //   // open the command palette
        //   // atom.commands.findCommands({ target: "Code-Time" });
        //   // show custom commands palette
        // }
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
    if (!tooltip) {
      tooltip = "Click to see more from Code Time";
    }

    hasToken = href.indexOf("token=") !== -1 ? true : false;
    if (hasToken && !icon) {
      icon = "alert";
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
