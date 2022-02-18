'use babel';

import $ from 'jquery';
import path from 'path';
import SessionSummary from '../model/SessionSummary';
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileMgr = require('../managers/FileManager');
const numeral = require('numeral');
const { getSlackWorkspaces } = require("../managers/SlackManager");
const { isInFlowMode } = require("../managers/FlowManager");

// uncommited
let checkedMap = {
    'editor-time': true,
    'code-time': true,
};

export default class CodeTimeProvider {

    constructor() {
        this.currentKeystrokeStats = new SessionSummary();
        const filename = path.join(__dirname, '../..', 'templates', 'structure-view.html');
        const htmlString = fileMgr.getFileContent(filename);
        this.element = $(htmlString).get(0);
        this.viewType = 'codetimeProvider';
    }

    rebuildFlowNodeItems() {
      this.buildFlowNodes();
    }

    rebuildTree() {
      let html = this.treeGenerator();
      $('div.structure-view>div>ol').html(html);
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    async treeGenerator() {
      this.buildFlowNodes();
      this.buildMenuNodes();
    }

    async buildFlowNodes() {
      if (await isInFlowMode()) {
        $('#enable-flow-mode').hide();
        $('#pause-flow-mode').show();
      } else {
        $('#enable-flow-mode').show();
        $('#pause-flow-mode').hide();
      }
    }

    async buildMenuNodes() {
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

      $('#slack-workspace-node').html(await this.buildSlackWorkspacesNode());
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
      return `<div class="${labelInfo.class}" style="margin-left: -2px;" id="${id}">${labelInfo.label}</div>`
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

    async buildSlackWorkspacesNode() {
      const workspaces = await getSlackWorkspaces();
      const id = "slack-workspaces-folder";
      const label = "Slack workspaces";
      const checkedProp = this.getCheckedPropertyForId(id);
      // build the workspace list
      let workspaceHtml = "";
      if (workspaces.length) {
        workspaces.forEach(workspace => {
          let team_name = workspace.meta.team.name || "Slack"
          workspaceHtml += `<li class="list-node-item">
            <div class="list-node">
              <a href="#" id="${workspace.auth_id}" class="slack-icon">${team_name}</a>
              <div class="remove"><a href="https://app.software.com/data_sources/integration_types/slack" id="${workspace.auth_id}" class="remove-icon"></a></div>
           </div>
          </li>\n`
        });
      }

      return `<li>
          <input type="checkbox" id="${id}" value="${label}" ${checkedProp}/>
          <label for="${id}">${label}</label>
          <ul>
            <li><a href="https://app.software.com/data_sources/integration_types/slack" class="add-icon" id="add-slack-workspace">Add workspace</a></li>
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
