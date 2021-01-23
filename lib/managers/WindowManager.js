'use babel';

import { checkToDisableFlow } from './FlowManager';
import { FULL_SCREEN_MODE_ID, NORMAL_SCREEN_MODE, updateScreenMode } from './ScreenManager';
const tracker = require("./TrackerManager");

const windowMgr = {};

let _isFocused = true;
let _resizeTimer = null;

window.onresize = function () {
  if (_resizeTimer) {
    clearTimeout(_resizeTimer);
    _resizeTimer = null;
  }
  // 2 second timeout as we don't really need to be
  // too aggresive in deciding to disable flow
  _resizeTimer = setTimeout(() => {
    if (atom.isFullScreen() || atom.isMaximized()) {
      updateScreenMode(FULL_SCREEN_MODE_ID);
    } else {
      updateScreenMode(NORMAL_SCREEN_MODE);
    }
    // check to see if flow mode should change
    checkToDisableFlow();
  }, 2000);
};

window.onfocus = function () {
    _isFocused = true;

    // send the "focus" editor action
    tracker.trackEditorAction("editor", "focus");
};

window.onblur = function () {
    _isFocused = false;

    // send the "unfocus" editor action
    tracker.trackEditorAction("editor", "unfocus");

    // Process this window's keystroke data since the window has become unfocused
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:process-keystrokes-data'
    );
};

windowMgr.isFocused = () => {
    return _isFocused;
};

module.exports = windowMgr;
