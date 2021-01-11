'use babel';

import $ from "jquery";
const userstatusMgr = require("../UserStatusManager");

export const CLOSE_BOX =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=';

let slackStatusSelectCallback = null;
let slackChannelSelectCallback = null;
let slackWorkspaceSelectCallback = null;
let slackMessageInputPromptCallback = null;
let textInputPane = null;
let listInputPane = null;

export function initiateLoginFlow() {
  initiateAuthFlow("Log in", "Log in using...");
}

export function initiateSignupFlow() {
  initiateAuthFlow("Sign up", "Sign up using...");
}

export function initiateSwitchAccountFlow() {
  initiateAuthFlow("Switch account", "Switch to a different account?");
}

function initiateAuthFlow(title, message) {
  const items = [
    {value: "google", text: "Google"},
    {value: "github", text: "GitHub"},
    {value: "email", text: "Email"}];
  showListSelector(items, title, message, "authSelectId");
}

export function showSlackStatusUpdateOptions(callback) {
  const items = [
    {value: "clear", text: "Clear your status"},
    {value: "update", text: "Set a new status"}
  ];
  slackStatusSelectCallback = callback;
  showListSelector(items, "Slack status", "Select clear or update to continue", "slackStatusUpdateId");
}

export function showSlackChannelMenuOptions(callback, channels) {
  slackChannelSelectCallback = callback;
  showListSelector(channels, "Slack channel", "Select a channel", "slackChannelSelectId");
}

export function showSlackWorkspaceMenuOptions(callback, workspaces) {
  slackWorkspaceSelectCallback = callback;
  showListSelector(workspaces, "Slack workspace", "Select a Slack workspace", "selectWorkspaceSelectId");
}

export function showSlackMessageInputPrompt(callback, defaultInput = "") {
  slackMessageInputPromptCallback = callback;
  showTextInputPrompt("Slack message", "Enter a message to appear in your profile status", "slackMessageInputId", defaultInput);
}

export function showTextInputPrompt(title, textContent, listenerId, defaultInput) {
  console.log("showing text input prompt");
  // Create root element
  const inputPrompt = document.createElement('div');
  inputPrompt.classList.add("popup");

  const closeButton = document.createElement('span');
  closeButton.setAttribute("style", "float: right; margin-bottom: 10px; cursor: pointer;");
  closeButton.setAttribute("id", "input_popupCloseButton");
  closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';

  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.textContent = textContent;
  messageDiv.setAttribute("style", "font-size: 14px; font-weight: 600;")

  const inputDiv = document.createElement("div");
  const inputEl = document.createElement("input");
  inputEl.setAttribute("id", "textInputElement");
  inputEl.setAttribute("class", "native-key-bindings");
  inputEl.setAttribute("type", "text");
  inputEl.setAttribute("style", "width: 100%; padding: 4px;");
  inputEl.value = defaultInput;
  inputDiv.appendChild(inputEl);

  const okButton = document.createElement("span");
  okButton.setAttribute("style", "float: right; margin-top: 10px; cursor: pointer;");
  okButton.setAttribute("id", listenerId);
  okButton.innerHTML = '<button id="' + listenerId + '" class="prompt-input-button">Submit</button>';

  inputPrompt.appendChild(closeButton);
  inputPrompt.appendChild(messageDiv);
  inputPrompt.appendChild(inputDiv);
  inputPrompt.appendChild(okButton);

  textInputPane = atom.workspace.addModalPanel({
      item: inputPrompt,
      visible: true
  });
}

export function showListSelector(items, title, textContent, listenerId) {
  const listSelector = document.createElement('div');

  const closeButton = document.createElement('span');
  closeButton.setAttribute("style", "float: right; margin-bottom: 10px; cursor: pointer;");
  closeButton.setAttribute("id", "list_popupCloseButton");
  closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
  const selectListEl = document.createElement("select");
  selectListEl.setAttribute("id", listenerId);
  selectListEl.setAttribute("style", "width: 100%; display: flex; color: black; height: 30px; margin-bottom: 10px;");

  listSelector.appendChild(closeButton);
  listSelector.appendChild(selectListEl);

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.text = textContent;
  selectListEl.appendChild(defaultOption);
  items.forEach(item => {
    try {
      const option = document.createElement('option');
      option.value = JSON.stringify(item);
      option.text = item.text;
      selectListEl.appendChild(option);
    } catch (e) {
      console.log("error adding an item to the selection list: ", e.message);
    }
  });

  listInputPane = atom.workspace.addModalPanel({
      item: listSelector,
      visible: true
  });
}

///////////////////////////////////////////////////
// event change handlers
///////////////////////////////////////////////////

// slackStatusUpdateId: handle what status option was selected
$(document).on('change', '#slackStatusUpdateId', function() {
  const data = getSelectedData($(this).val());
  if (data) {
    slackStatusSelectCallback(data.value);
  }
  closeListSelector();
});

// slackChannelSelectId: handle which channel was selected
$(document).on('change', '#slackChannelSelectId', function() {
  const data = getSelectedData($(this).val());
  if (data) {
    slackChannelSelectCallback(data.value, data.token);
  }
  closeListSelector();
});

// selectWorkspaceSelectId: handle which workspace was selected
$(document).on('change', '#selectWorkspaceSelectId', function() {
  const data = getSelectedData($(this).val());
  if (data) {
    slackWorkspaceSelectCallback(data.value);
  }
  closeListSelector();
});

$(document).on('keypress', '#textInputElement', function(event) {
  let keycode = (event.keyCode ? event.keyCode : event.which);
  if (keycode == '13') {
    let data = $(this).val();
    if (data) {
      slackMessageInputPromptCallback(data);
    }
    closeInputSelector();
    return false;
  }
});

$(document).on('click', '#slackMessageInputId', function() {
  let data = $('#textInputElement').val();
  if (data) {
    slackMessageInputPromptCallback(data);
  }
  closeInputSelector();
  return false;
});

$(document).on('click', '#list_popupCloseButton', function() {
  closeListSelector();
});

$(document).on('click', '#input_popupCloseButton', function() {
  closeInputSelector();
});

// authSelectId: login, signup, or switch account list selection listener
$(document).on('change', '#authSelectId', function() {
  const data = getSelectedData($(this).val());
  if (data) {
    userstatusMgr.launchLoginUrl(data.value, true);
  }
  closeListSelector();
});


function getSelectedData(data) {
  if (data) {
    try {
      data = JSON.parse(data);
      return data;
    } catch (e) {
      console.log("error parsing the selected item value: ", e.message);
    }
  }
  return null;
}

function closeListSelector() {
  if (listInputPane) {
    listInputPane.hide();
  }
}

function closeInputSelector() {
  if (textInputPane) {
    textInputPane.hide();
  }
}
