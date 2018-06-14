"use babel";

let $ = require("jquery");

let readyMsg = "";
let isReady = false;

export default class KpmStatusView {
  constructor() {
    var that = this;

    this.element = document.createElement("div");
    this.element.classList.add("msg-status");
    this.element.classList.add("inline-block");
    this.element.setAttribute("id", "swdc-status-msg");

    $(document).ready(function() {
      isReady = true;
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
  display(msg, href) {
    if (!href) {
      href = appConstants.getLaunchUrl();
    }
    this.element.innerHTML =
      "<span class='icon icon-info'><a href='" +
      href +
      "'>" +
      msg +
      "</a></span>";
    let footerBar = atom.workspace.getFooterPanels();
    footerBar[0].getItem().leftPanel.appendChild(this.element);
  }
}
