'use babel';

import { FULL_SCREEN_MODE_ID, NORMAL_SCREEN_MODE, updateScreenMode } from './ScreenManager';
const tracker = require("./TrackerManager");

const windowMgr = {};

let _isFocused = true;
let _resizeTimer = null;

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
