import {commands, Disposable, window} from 'vscode';
import {TrackerManager} from './TrackerManager';
import {EditorFlow, EditorType, FlowEventType, } from '@swdotcom/editor-flow';
import {configureSettings, showingConfigureSettingsPanel} from './ConfigManager';
import {getWorkspaceName, isNewDay, setItem} from '../Util';

const changeStateMgr = {};

let disposable;
let tracker;

const subscriptions = [];

const iface = {
  disposable: {},
  window: window,
  workspace: atom.workspace,
};

export function init() {
  tracker = TrackerManager.getInstance();
  const emitter = EditorFlow.getInstance(EditorType.VSCODE, iface).getEmitter();

  emitter.on('editor_flow_data', (data) => {
    switch (data.flow_event_type) {
      case FlowEventType.CLOSE:
        fileCloseHandler(data.event);
        break;
      case FlowEventType.OPEN:
        fileOpenHandler(data.event);
        break;
      case FlowEventType.SAVE:
        fileSaveHandler(data.event);
        break;
      case FlowEventType.UNFOCUS:
        windowStateChangeHandler(data.event);
        break;
      case FlowEventType.FOCUS:
        windowStateChangeHandler(data.event);
        break;
      case FlowEventType.THEME:
        themeKindChangeHandler(data.event);
        break;
      case FlowEventType.KPM:
        // get the project_change_info attribute and post it
        kpmHandler(data.project_change_info);
        break;
    }
  });

  disposable = Disposable.from(...subscriptions);
}

function kpmHandler(projectChangeInfo) {
  tracker.trackCodeTimeEvent(projectChangeInfo);
}

function fileCloseHandler(event) {
  tracker.trackEditorAction('file', 'close', event);
}

function fileOpenHandler(event) {
  tracker.trackEditorAction('file', 'open', event);
}

function fileSaveHandler(event) {
  tracker.trackEditorAction('file', 'save', event);
}

function windowStateChangeHandler(event) {
  if (event.focused) {
    this.tracker.trackEditorAction('editor', 'focus');
    setItem('vscode_ct_primary_window', getWorkspaceName());
    setTimeout(() => {
      isNewDay();
    }, 1000);
  } else {
    this.tracker.trackEditorAction('editor', 'unfocus');
  }
}

function themeKindChangeHandler(event) {
  // let the sidebar know the new current color kind
  setTimeout(() => {
    commands.executeCommand('codetime.refreshCodeTimeView');
    if (showingConfigureSettingsPanel()) {
      setTimeout(() => {
        configureSettings();
      }, 500);
    }
  }, 150);
}

export function dispose() {
  if (disposable) {
    disposable.dispose();
  }
}

module.exports = changeStateMgr;
