'use babel';

import $ from 'jquery';
import path from 'path';
import SessionSummary from '../model/SessionSummary';
import { getCodeTimeSummary } from '../managers/TimeDataManager';
import { getConfigSettings } from '../managers/ConfigManager';
import fileIt from 'file-it';
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const numeral = require('numeral');
const moment = require('moment-timezone');
const { getSlackStatus, getSlackPresence, getSlackDnDInfo, getSlackWorkspaces } = require("../managers/SlackManager");
const { isInFlowMode } = require("../managers/FlowManager");
const { isDarkMode } = require("../managers/OsaScriptManager");

// uncommited
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

    rebuildTree() {
      let html = this.treeGenerator();
      $('div.structure-view>div>ol').html(html);
    }

    rebuildFlowNodeItems() {
      this.buildFlowNodes();
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    async treeGenerator() {
      this.buildFlowNodes();

      this.buildMenuNodes();
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
      return `<span class="${labelInfo.class}" id="${id}">${labelInfo.label}</span>`
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

      const configSettings = getConfigSettings();

      const [slackStatus, slackPresence, slackDnDInfo] = await Promise.all([getSlackStatus(), getSlackPresence(), getSlackDnDInfo()]);

      // update the settings buttons
      const notificationsVal = configSettings.pauseSlackNotifications ? "on" : "off";
      $('#pause-notifications-val').html(notificationsVal);

      const slackAwayStatus = configSettings.slackAwayStatus ? "on" : "off";
      $('#slack-away-status-val').html(slackAwayStatus);

      $('#slack-status-away-text-val').html(configSettings.slackAwayStatusText);

      $('#screen-mode-val').html(configSettings.screenMode);

      const flowModeRemindersVal = configSettings.flowModeReminders ? "on" : "off"
      $('#flow-mode-reminders-val').html(flowModeRemindersVal);

      if (isInFlowMode(slackStatus, slackPresence, slackDnDInfo)) {
        $('#enable-flow-mode').hide();
        $('#pause-flow-mode').show();
      } else {
        $('#enable-flow-mode').show();
        $('#pause-flow-mode').hide();
      }

      // update the slack-status-desc
      let description = utilMgr.text_truncate(slackStatus);
      if (description) {
        description = ` (${description})`;
      }
      $("#slack-status-desc").html(utilMgr.text_truncate(description));

      // update the full screen button
      if (atom.isFullScreen()) {
        $('#enter-fullscreen').hide();
        $('#exit-fullscreen').show();
      } else {
        $('#enter-fullscreen').show();
        $('#exit-fullscreen').hide();
      }

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

      // expand the automations folder
      const automationsExpanded = this.getCheckedPropertyForId('automations-folder');
      if (automationsExpanded) {
        $("#automations-folder").prop("checked", true);
      }
      // expand the settings folder
      const settingsExpanded = this.getCheckedPropertyForId('settings-folder');
      if (settingsExpanded) {
        $("#settings-folder").prop("checked", true);
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
          workspaceHtml += `<li class="list-node-item">
            <div class="list-node">
              <a href="#" id="${workspace.authId}" class="slack-icon">${workspace.team_domain} (${workspace.team_name})</a>
              <div class="remove"><a href="#" id="${workspace.authId}" class="remove-icon"></a></div>
           </div>
          </li>\n`
        });
      }

      return `<li>
          <input type="checkbox" id="${id}" value="${label}" ${checkedProp}/>
          <label for="${id}">${label}</label>
          <ul>
            <li><a href="#" class="add-icon" id="add-slack-workspace">Add workspace</a></li>
            ${workspaceHtml}
          </ul>
        </li>`;
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
        'Code-Time:dashboard',
        "click"
    );
});

$(document).on('click', '#edit-preferences', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:preferences',
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
        'Code-Time:submit-an-issue',
        "click"
    );
});

$(document).on('click', '#learn-more', () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:documentation',
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

$(document).on('click', '#enter-fullscreen', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:enter-fullscreen',
      "click"
  );
});

$(document).on('click', '#exit-fullscreen', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:exit-fullscreen',
      "click"
  );
});

$(document).on('click', '#enable-flow-mode', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:enable-flow-mode',
      "click"
  );
});

$(document).on('click', '#pause-flow-mode', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:pause-flow-mode',
      "click"
  );
});

$(document).on('click', '#edit-pause-notifications', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:edit-pause-notifications',
      "click"
  );
});

$(document).on('click', '#edit-slack-away-status', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:edit-slack-away-status',
      "click"
  );
});

$(document).on('click', '#edit-slack-away-text', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:edit-slack-away-text',
      "click"
  );
});

$(document).on('click', '#edit-screen-mode', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:edit-screen-mode',
      "click"
  );
});

$(document).on('click', '#edit-flow-mode-reminders', () => {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:edit-flow-mode-reminders',
    'click'
  );
});

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
