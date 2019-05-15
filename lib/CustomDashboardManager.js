"use babel";

import { TextEditor } from "atom";
const utilMgr = require("./UtilManager");
const { exec } = require("child_process");

export default class CustomDashboardManager {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement("div");

    this.miniEditor = new TextEditor({ mini: true });
    this.miniEditor.setPlaceholderText(
      "Enter comma separated start and end dates: (format: MM/DD/YYYY)");

    this.element.appendChild(this.miniEditor.element);

    this.panel = atom.workspace.addBottomPanel({
      item: this,
      visible: false
    });

    atom.commands.add(this.miniEditor.element, "core:confirm", () => {
        this.confirm();
    });
    atom.commands.add(this.miniEditor.element, "core:cancel", () => {
        this.close();
    });

  }

  // Hides the text box for entering custom dates
  close() {
    if (!this.panel.isVisible()) return;
    this.miniEditor.setText('');
    this.panel.hide();
  }

  async confirm() {
    const dateRange = this.miniEditor.getText();

    let start
    let end

    try {
      // Sanitize the date input
      let splitDate = dateRange.split(/[ ,-]+/);
      const offsetSeconds = utilMgr.getOffsetSeconds();

      start = Date.parse(splitDate[0].trim()) / 1000 - offsetSeconds;
      end = Date.parse(splitDate[1].trim()) / 1000 - offsetSeconds;
    } catch (e) {
      atom.notifications.addError("Error parsing dates")
      this.close();
      return;
    }


    if (isNaN(start) || isNaN(end)) {
      atom.notifications.addError("Error parsing dates")
      return;
    }
    if (start > end) {
      atom.notifications.addError("Start date must come before end date")
    }

    let online = await utilMgr.serverIsAvailable();

    if (online) {
        utilMgr.launchCodeTimeDashboard([start, end], true);
    } else {
        atom.notifications.addError("Code Time: could not fetch custom dashboard");
    }

    this.close();
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

}
