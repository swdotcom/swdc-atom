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
    await serviceUtil.softwarePost('/v1/flow_sessions', {automated}, utilMgr.getItem('jwt'));
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );

  enabledFlow = true;
  enablingFlow = false;

  statusMgr.updateStatusBarWithSummaryData();
}

export async function pauseFlowInitiate() {
  if (utilMgr.isInFlow()) {
    // only update flow change in here
    utilMgr.updateInFlow(false);
    utilMgr.logIt('Exiting Flow Mode');
    await serviceUtil.softwareDelete('/v1/flow_sessions', utilMgr.getItem('jwt'));
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );

  enabledFlow = false;
  enablingFlow = false;

  statusMgr.updateStatusBarWithSummaryData();
}

export function isInFlowMode() {
  return !!(utilMgr.isInFlow() || enablingFlow || enabledFlow);
}
