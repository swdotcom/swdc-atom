'use babel';

const utilMgr = require("../UtilManager");
const cp = require("child_process");

export async function toggleDarkMode() {
  utilMgr.setItem("checked_atom_sys_events", true);
  const darkModeCmd = `osascript -e \'
        tell application "System Events"
          tell appearance preferences
            set dark mode to not dark mode
          end tell
        end tell \'`;

  await cp.exec(darkModeCmd);
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

export async function isDarkMode() {
  let isDarkMode = false;

  // first check to see if the user has "System Events" authorized
  const checked_sys_events = utilMgr.getItem("checked_atom_sys_events");

  if (checked_sys_events) {
    const getDarkModeFlag = `osascript -e \'
      try
        tell application "System Events"
          tell appearance preferences
            set t_info to dark mode
          end tell
        end tell
      on error
        return false
      end try\'`;
    const isDarkModeStr = await execPromise(getDarkModeFlag);
    // convert it to a string
    if (isDarkModeStr !== undefined && isDarkModeStr !== null) {
      try {
        isDarkMode = JSON.parse(`${isDarkModeStr}`);
      } catch (e) {}
    } else {
      // it's not defined, set it
      isDarkMode = false;
    }
  }
  return isDarkMode;
}

// hide and unhide the dock
export async function toggleDock() {
  utilMgr.setItem("checked_atom_sys_events", true);
  let toggleDockCmd = `osascript -e \'
    tell application "System Events"
      tell dock preferences
        set x to autohide
        if x is false then
          set properties to {autohide:true}
        else
          set properties to {autohide:false}
        end if
      end tell
    end tell \'`;

  cp.exec(toggleDockCmd);
}

async function execPromise(command: string, opts: {} = {}) {
  return new Promise((resolve, reject) => {
    cp.exec(command, opts, (error: any, stdout: string, stderr: any) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}
