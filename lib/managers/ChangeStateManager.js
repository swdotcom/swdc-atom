'use babel';

import {EditorFlow, EditorType, FlowEventType} from '@swdotcom/editor-flow';
const utilMgr = require('../UtilManager');
const tracker = require('./TrackerManager');

export class ChangeStateManager {

  constructor() {
    const iface = {
      window: window,
      workspace: atom.workspace,
    };

    const editorFlow = EditorFlow.getInstance(EditorType.ATOM, iface);
    const emitter = editorFlow.getEmitter();

    emitter.on('editor_flow_data', (data) => {
      switch (data.flow_event_type) {
        case FlowEventType.CLOSE:
          this.fileCloseHandler(data.event);
          break;
        case FlowEventType.OPEN:
          this.fileOpenHandler(data.event);
          break;
        case FlowEventType.SAVE:
          this.fileSaveHandler(data.event);
          break;
        case FlowEventType.UNFOCUS:
          this.windowUnFocusEventHandler(data.event);
          break;
        case FlowEventType.FOCUS:
          this.windowFocusEventHandler(data.event);
          break;
        case FlowEventType.KPM:
          // get the project_change_info attribute and post it
          this.kpmHandler(data.project_change_info);
          break;
      }
    });
  }

  kpmHandler(projectChangeInfo) {
    tracker.trackCodeTimeEvent(projectChangeInfo);
  }

  fileCloseHandler(event) {
    tracker.trackEditorAction('file', 'close', event);
  }

  fileOpenHandler(event) {
    tracker.trackEditorAction('file', 'open', event);
  }

  fileSaveHandler(event) {
    this.tracker.trackEditorAction('file', 'save', event);
  }

  windowFocusEventHandler(event) {
    tracker.trackEditorAction('editor', 'focus');
    utilMgr.setItem('atom_ct_primary_window', utilMgr.getWorkspaceName());
  }

  windowUnFocusEventHandler(event) {
    tracker.trackEditorAction('editor', 'unfocus');
  }
}
