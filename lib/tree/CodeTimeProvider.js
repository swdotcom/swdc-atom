'use babel';

import $ from 'jquery';
import path from 'path';
import SessionSummary from '../model/SessionSummary';
import { getCodeTimeSummary } from '../managers/TimeDataManager';
import fileIt from 'file-it';
const fileChangeInfoSummaryDataMgr = require('../storage/FileChangeInfoSummaryDataManager');
const projectMgr = require("../managers/ProjectManager");
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const gitUtil = require('../repo/GitUtil');
const numeral = require('numeral');
const moment = require('moment-timezone');
const tracker = require("../managers/TrackerManager");
const {getSlackStatus, getSlackPresence, getSlackDnDInfo, getSlackWorkspaces} = require("../managers/SlackManager");
const {isDarkMode} = require("../managers/OsaScriptManager");

let checkedMap = {
    'editor-time': true,
    'code-time': true,
};

export default class CodeTimeProvider {
    constructor() {
        this.currentKeystrokeStats = new SessionSummary();
        const filename = path.join(__dirname, '../..', 'templates', 'structure-view.html');
        const htmlString = fileIt.readContentFileSync(filename);
        this.element = $(htmlString).get(0);
        this.viewType = 'codetimeProvider';
    }

    initialize() {
        this.renderTree();
    }

    renderTree() {
        let html = this.treeGenerator();
        $('div.structure-view>div>ol').html(html);
    }

    rebuildStateItems() {
      this.buildStatsNodes();
    }

    rebuildMetricItems() {
      let html = this.treeGenerator();
      $('div.structure-view>div>ol').html(html);
    }

    rebuildMenuItems() {
      let html = this.treeGenerator();
      $('div.structure-view>div>ol').html(html);
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    async treeGenerator() {
        this.buildMenuNodes();

        this.buildFlowNodes();

        this.buildStatsNodes();
    }

    buildMenuNodes() {
      if (statusMgr.showingStatusBarText()) {
          $('#toggle-status-metrics').html('Hide status bar metrics');
      } else {
          $('#toggle-status-metrics').html('Show status bar metrics');
      }

      const name = utilMgr.getItem('name');
      if (name) {
        $('#signup-button').hide();
        $('#login-button').hide();
        $('#logged-in-label').html(this.buildLoggedInNode()).show();
        $('#switch-account-button').show();
      } else {
        $('#signup-button').show();
        $('#login-button').show();
        $('#logged-in-label').hide();
        $('#switch-account-button').hide();
      }

      $('#slack-workspace-node').html(this.buildSlackWorkspacesNode());
    }

    getAuthTypeLabelAndClass() {
        const authType = utilMgr.getItem('authType');
        const name = utilMgr.getItem("name");
        const label = `${name}`;
        if (authType === 'google') {
            return { label, class: 'google-icon' };
        } else if (authType === 'github') {
            return { label, class: 'github-icon' };
        } else if (authType === 'software') {
            return { label, class: 'email-icon' };
        }
        return { label, class: 'email-icon' };
    }

    buildLoggedInNode() {
      const labelInfo = this.getAuthTypeLabelAndClass();
      const id = "logged-in-menu-input";
      const checkedProp = this.getCheckedPropertyForId(id);
      return `<span class="${labelInfo.class}" id="${id}">${labelInfo.label}</span>`
    }

    async buildMetricsNodes(data) {
      const refClass = utilMgr.getItem("reference-class") || "user";
      const liItems = [];
      const codeTimeSummary = getCodeTimeSummary();

      // EDITOR-TIME metric
      const editorMinutes = utilMgr.humanizeMinutes(
          codeTimeSummary.codeTimeMinutes
      );

      if (refClass === "user") {
        liItems.push(`<li><a href="#" class="" id="today-avg-title">Today vs. your daily average</a></li>`);
      } else {
        liItems.push(`<li><a href="#" class="" id="today-avg-title">Today vs. the global daily average</a></li>`);
      }

      const iconClass = codeTimeSummary.codeTimeMinutes > data.averageDailyMinutes ? "bolt-icon" : "bolt-grey-icon";
      liItems.push(`<li><a href="#" class="${iconClass}" id="editor-time">Code time: ${editorMinutes}</a></li>`);

      // CODE-TIME node
      liItems.push(this.buildMetricItem(
        "code-time",
        "Active code time",
        codeTimeSummary.activeCodeTimeMinutes,
        data.averageDailyMinutes,
        (data.globalAverageSeconds / 60),
        false,
        refClass));

      // LINES-ADDED node
      const currLinesAdded =
          this.currentKeystrokeStats.currentDayLinesAdded +
          data.currentDayLinesAdded;
      liItems.push(this.buildMetricItem(
        "lines-added",
        "Lines added",
        currLinesAdded,
        data.averageLinesAdded,
        data.globalAverageLinesAdded,
        true,
        refClass));

      // LINES-REMOVED node
      const currLinesRemoved =
          this.currentKeystrokeStats.currentDayLinesRemoved +
          data.currentDayLinesRemoved;
      liItems.push(this.buildMetricItem(
        "lines-removed",
        "Lines removed",
        currLinesRemoved,
        data.averageLinesRemoved,
        data.globalAverageLinesRemoved,
        true,
        refClass));

      // KEYSTROKES node
      const currKeystrokes =
          this.currentKeystrokeStats.currentDayKeystrokes +
          data.currentDayKeystrokes;
      liItems.push(this.buildMetricItem(
        "keystrokes",
        "Keystrokes",
        currKeystrokes,
        data.averageDailyKeystrokes,
        data.globalAverageDailyKeystrokes,
        true,
        refClass));

      liItems.push(`<li><a href="#" id="generate-dashboard" class="dashboard-icon" title="">Dashboard</a></li>`);
      liItems.push(`<li><a href="#" id="advanced-metrics" class="paw-icon" title="">More data at Software.com</a></li>`);

      // build the editor time li
      return `<ul>${liItems.join('\n')}</ul>`;
    }

    buildSingleNodeLiItem(id, label, value) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today">${value}</a></li>
                </ul>
            </li>`;
    }

    buildSingleValueLiItem(id, value, fileName) {
        return `<li><a href="#" id="${id}-view-file" class="view-file" data-file="${fileName}">${value}</a></li>`;
    }

    buildMetricItem(id, label, currVal, userAvg, globalAvg, isNumeral, refClass) {
      let currValStr = "";
      let userAvgStr = "";
      let globalAvgStr = "";
      const avgVal = refClass === "user" ? userAvg : globalAvg;
      let avgValStr = "";
      if (isNumeral) {
        currValStr = numeral(currVal).format('0 a');
        userAvgStr = numeral(userAvg).format('0 a');
        globalAvgStr = numeral(globalAvg).format('0 a');
        avgValStr = numeral(avgVal).format('0 a');
      } else {
        currValStr = utilMgr.humanizeMinutes(currVal);
        userAvgStr = utilMgr.humanizeMinutes(userAvg);
        globalAvgStr = utilMgr.humanizeMinutes(globalAvg);
        avgValStr = utilMgr.humanizeMinutes(avgVal);
      }

      const iconClass = currVal > userAvg ? "bolt-icon" : "bolt-grey-icon";
      const tooltip = this.getPercentOfReferenceAvg(currVal, avgVal, avgValStr);

      return `<li><a href="#" class="${iconClass}" id="${id}">${label}: ${currValStr} (${avgValStr} avg)</a></li>`;
    }

    buildCodeTimeMetricsLiItem(
        id,
        label,
        todayValue,
        avgValue = null,
        globalAvgValue = null,
        boltIcon = null
    ) {
        const checkedProp = this.getCheckedPropertyForId(id);
        const dayStr = moment().format('ddd');
        if (avgValue && globalAvgValue) {
            boltIcon = boltIcon ? boltIcon : 'bolt-grey';
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                        <li>
                            <a href="#" id="${id}-avg" class="${boltIcon}">Your average (${dayStr}): ${avgValue}</a>
                        </li>
                        <li>
                            <a href="#" id="${id}-global" class="global-grey-icon">Global average (${dayStr}): ${globalAvgValue}</a>
                        </li>
                    </ul>
                </li>`;
        }

        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                </ul>
            </li>`;
    }

    buildMetricNodeItem(id, label, nodes) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
        <ul>
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    ${nodes.join('\n')}
                </ul>
            </li>
        </ul>`;
    }

    async buildFlowNodes() {
      const [slackStatus, slackPresence, slackDnDInfo] = await Promise.all([getSlackStatus(), getSlackPresence(), getSlackDnDInfo()]);

      // update the slack-status-desc
      let description = utilMgr.text_truncate(slackStatus);
      if (description) {
        description = ` (${description})`;
      }
      $("#slack-status-desc").html(utilMgr.text_truncate(description));

      // update the full screen button
      const fullScreenInfo = atom.isFullScreen()
        ? {label: "Exit full screen", add_class: "compress-icon", remove_class: "expand-icon"}
        : {label: "Enter full screen", add_class: "expand-icon", remove_class: "compress-icon"};
     $("#toggle-fullscreen").html(fullScreenInfo.label);
     $("#toggle-fullscreen").removeClass(fullScreenInfo.remove_class).addClass(fullScreenInfo.add_class);

      // slack status setter
      if (slackDnDInfo && slackDnDInfo.snooze_enabled) {
        // update the enable-slack-notifications description to...
        let enableSlackNotificationsDesc = ` (${moment.unix(slackDnDInfo.snooze_endtime).format("h:mm a")})`;
        $("#enable-slack-notifications-desc").html(enableSlackNotificationsDesc);
        // show turn on notifications
        $('#pause-slack-notifications').hide();
        $('#enable-slack-notifications').show();
      } else {
        // show turn off notifications
        $('#pause-slack-notifications').show();
        $('#enable-slack-notifications').hide();
      }

      if (!slackPresence || slackPresence === "active") {
        // show set presence to away
        $('#slack-presence-away').show();
        $('#slack-presence-active').hide();
      } else {
        // show set presence to active
        $('#slack-presence-away').hide();
        $('#slack-presence-active').show();
      }

      if (utilMgr.isMac()) {
        const darkmode = await isDarkMode();
        if (darkmode) {
          // show disable dark mode
          $('#dark-mode-disable').show();
          $('#dark-mode-enable').hide();
        } else {
          // show enable dark mode
          $('#dark-mode-disable').hide();
          $('#dark-mode-enable').show();
        }
      }
    }

    buildSlackWorkspacesNode() {
      const workspaces = getSlackWorkspaces();
      const id = "slack-workspaces-folder";
      const label = "Slack workspaces";
      const checkedProp = this.getCheckedPropertyForId(id);
      // build the workspace list
      let workspaceHtml = "";
      if (workspaces.length) {
        workspaces.forEach(workspace => {
          workspaceHtml += `<li class="workspace-node-item">
            <div class="workspace-node">
              <a href="#" id="${workspace.authId}">${workspace.team_domain} (${workspace.team_name})</a>
              <div class="remove"><a href="#" id="${workspace.authId}" class="remove-icon"></a></div>
           </div>
          </li>\n`
        });
      }

      return `<li>
          <input type="checkbox" id="${id}" class="slack-icon" value="${label}" ${checkedProp}/>
          <label for="${id}">${label}</label>
          <ul>
            ${workspaceHtml}
            <li><a href="#" class="add-icon" id="add-slack-workspace">Add workspace</a></li>
          </ul>
        </li>`;
    }

    async buildStatsNodes() {
      const data = fileDataMgr.getSessionSummaryData();
      const metricNodesHtml = await this.buildMetricsNodes(data);
      $('#code-time-metrics').html(metricNodesHtml);
    }

    getCheckedPropertyForId(id) {
        if (checkedMap[id]) {
            return checkedMap[id] === true ? ' checked' : '';
        }
        return '';
    }

    serialize() { }

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Code Time';
    }

    // get the percent string dividing the reference value by the current value
    // this is meant to show the progressing percent of the daily average stats
    getPercentOfReferenceAvg(currentValue, referenceValue, referenceValueDisplay) {
      currentValue = currentValue || 0;
      let quotient = 1;
      if (referenceValue) {
        quotient = currentValue / referenceValue;
        // at least show 1% if the current value is not zero and
        // the quotient is less than 1 percent
        if (currentValue && quotient < 0.01) {
          quotient = 0.01;
        }
      }
      return `${(quotient * 100).toFixed(0)}% of ${referenceValueDisplay}`;
    }
}

$(document).on('click', '.remove-icon', (el) => {
  // the id contains the workspace authId
  const authId = $(el.currentTarget).attr('id');
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:disconnect-slack',
      authId
  );
});

$(document).on('click', '#add-slack-workspace', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:connect-slack',
      "click"
  );
});

$(document).on('click', '#signup-button', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:sign-up',
      "click"
  );
});

$(document).on('click', '#login-button', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:log-in',
      "click"
  );
});

$(document).on('click', '#today-avg-title', () => {
  // change the reference class and update
  let currentReferenceClass = utilMgr.getItem("reference-class") || "user";
  if (!currentReferenceClass || currentReferenceClass === "user") {
      currentReferenceClass = "global";
    } else {
      currentReferenceClass = "user";
    }
    utilMgr.setItem("reference-class", currentReferenceClass);

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:refresh-stat-nodes',
        "click"
    );
});

$(document).on('click', '#switch-account-button', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:switch-accounts',
      "click"
  );
});

$(document).on('click', '#google-signup', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:google-signup',
        "click"
    );
});

$(document).on('click', '#github-signup', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:github-signup',
        "click"
    );
});

$(document).on('click', '#email-signup', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:email-signup',
        "click"
    );
});

$(document).on('click', '#advanced-metrics', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:see-advanced-metrics',
        "click"
    );
});

$(document).on('click', '#generate-dashboard', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:view-summary',
        "click"
    );
});

$(document).on('click', '#toggle-status-metrics', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:toggle-status-bar-metrics',
        "click"
    );
});

$(document).on('click', '#submit-feedback', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:submit-feedback',
        "click"
    );
});

$(document).on('click', '#learn-more', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:learn-more',
        "click"
    );
});

$(document).on('click', '.view-file', el => {
    try {
        const val = $(el.currentTarget).attr('data-file');
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Code-Time:open-file',
            val
        );
    } catch (e) {
        //
    }
});

$(document).on('click', '#slack-dock-change', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:toggle-dock',
      "click"
  );
});

$(document).on('click', '#dark-mode-disable', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:toggle-dark-mode',
      "click"
  );
});

$(document).on('click', '#dark-mode-enable', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:toggle-dark-mode',
      "click"
  );
});

$(document).on('click', '#slack-adjust-change', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:toggle-dark-mode',
      "click"
  );
});

$(document).on('click', '#slack-presence-active', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:slack-presence-active',
      "click"
  );
});

$(document).on('click', '#slack-presence-away', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:slack-presence-away',
      "click"
  );
});

$(document).on('click', '#pause-slack-notifications', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:pause-slack-notifications',
      "click"
  );
});

$(document).on('click', '#enable-slack-notifications', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:enable-slack-notifications',
      "click"
  );
});

$(document).on('click', '#update-slack-status', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:update-slack-status',
      "click"
  );
});

$(document).on('click', '#toggle-fullscreen', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:toggle-fullscreen'
  );
});

const toggleItems = ["ct_codetime_toggle_node",
    "ct_active_codetime_toggle_node",
    "ct_lines_added_toggle_node",
    "ct_lines_removed_toggle_node",
    "ct_keystrokes_toggle_node",
    "ct_files_changed_toggle_node",
    "ct_top_files_by_kpm_toggle_node",
    "ct_top_files_by_keystrokes_toggle_node",
    "ct_top_files_by_codetime_toggle_node"];

function getToggleItem(normalizedLabel) {
    for (let i = 0; i < toggleItems.length; i++) {
        const toggleItem = toggleItems[i];
        // strip off "ct_" and "_toggle_node" and replace the "_" with ""
        const normalizedToggleItem = toggleItem.replace("ct_", "").replace("_toggle_node", "").replace(/_/g, "");
        if (normalizedLabel.toLowerCase().indexOf(normalizedToggleItem) !== -1) {
            return toggleItem;
        }
    }
    return null;
}

$(document).on('click', 'input[type=checkbox]', async el => {
    if (!el.currentTarget) {
        return;
    }

    const checked =
        el.currentTarget.checked !== null &&
            el.currentTarget.checked !== undefined
            ? el.currentTarget.checked
            : false;
    // create the code time event
    const origLabel = el.currentTarget.value;
    const label = origLabel ? origLabel.replace(/\s/g, '') : origLabel;

    checkedMap[el.currentTarget.id] = checked;
});
