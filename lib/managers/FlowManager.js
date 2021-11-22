'use babel';

import {
  checkRegistration,
  showModalSignupPrompt
} from "./SlackManager";
const serviceUtil = require('../utils/ServiceUtil');
const utilMgr = require('../UtilManager');
const statusMgr = require('./StatusManager');

export let enablingFlow = false;
export let enabledFlow = false;

export async function initializeFlowModeState() {
  await determineFlowModeFromApi();
  updateFlowStatus();
}

export async function initiateFlow(automated = false) {
  const isRegistered = checkRegistration(false);
  if (!isRegistered) {
    // show the flow mode prompt
    showModalSignupPrompt("To use Flow Mode, please first sign up or login.");
    return;
  }
  enablingFlow = true;

  if (!utilMgr.isInFlow()) {
    // only update flow change here
    utilMgr.updateInFlow(true);
    utilMgr.logIt('Entering Flow Mode');
    await serviceUtil.appPost('/plugin/flow_sessions', {automated});
  }

  enabledFlow = true;
  enablingFlow = false;

  updateFlowStatus();
}

export async function pauseFlowInitiate() {
  if (utilMgr.isInFlow()) {
    // only update flow change in here
    utilMgr.updateInFlow(false);
    utilMgr.logIt('Exiting Flow Mode');

    await serviceUtil.appDelete('/plugin/flow_sessions');
  }

  enabledFlow = false;
  enablingFlow = false;

  updateFlowStatus();
}

function updateFlowStatus() {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );
  statusMgr.updateStatusBarWithSummaryData();
}

export async function determineFlowModeFromApi() {
  const flowSessionsReponse = utilMgr.getItem('jwt')
    ? await serviceUtil.appGet('/plugin/flow_sessions')
    : {data: {flow_sessions: []}};
  const openFlowSessions =
    flowSessionsReponse && flowSessionsReponse.data ? flowSessionsReponse.data.flow_sessions : [];
  // make sure "enabledFlow" is set as it's used as a getter outside this export
  const enabledFlow = !!(openFlowSessions.length);
  // initialize the file value
  utilMgr.updateInFlow(enabledFlow);
}

export function isInFlowMode() {
  return !!(utilMgr.isInFlow() || enablingFlow || enabledFlow);
}
