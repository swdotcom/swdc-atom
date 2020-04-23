'use babel';

const utilMgr = require('../UtilManager');
const eventMgr = require('./EventManager');
const sessionAppMgr = require('./SessionAppManager');
const serviceUtil = require('../utils/ServiceUtil');
const fs = require('fs');

// batch offline payloads in 50. backend has a 100k body limit
const batch_limit = 50;

let latestPayload = null;
let lastSavedKeystrokeStats = null;

const payloadMgr = {};

/**
 * Update the last keystrokes payload
 **/
payloadMgr.getLastSavedKeystrokeStats = () => {
    const dataFile = utilMgr.getSoftwareDataStoreFile();
    try {
        if (fs.existsSync(dataFile)) {
            const currentPayloads = utilMgr.getFileDataPayloadsAsJson(dataFile);
            if (currentPayloads && currentPayloads.length) {
                // sort in descending order
                currentPayloads.sort((a, b) => b.start - a.start);
                lastSavedKeystrokeStats = currentPayloads[0];
            }
        }
    } catch (e) {
        logIt(`Error updating last saved keystrokes: ${e.message}`);
    }
    return lastSavedKeystrokeStats;
};

/**
 * send the offline Event payloads
 */
payloadMgr.sendOfflineEvents = async () => {
    payloadMgr.batchSendData('/data/event', utilMgr.getPluginEventsFile());
};

/**
 * send the offline data
 */
payloadMgr.sendOfflineData = async (isNewDay = false) => {
    payloadMgr.batchSendData('/data/batch', utilMgr.getSoftwareDataStoreFile());
};

/**
 * batch send array data
 * @param api
 * @param file
 */
payloadMgr.batchSendArrayData = async (api, file) => {
    let isonline = await serviceUtil.serverIsAvailable();
    if (!isonline) {
        return;
    }
    try {
        if (fs.existsSync(file)) {
            const payloads = utilMgr.getFileDataArray(file);
            payloadMgr.batchSendPayloadData(api, file, payloads);
        }
    } catch (e) {
        logIt(`Error batch sending payloads: ${e.message}`);
    }
};

payloadMgr.batchSendData = async (api, file) => {
    let isonline = await serviceUtil.serverIsAvailable();
    if (!isonline) {
        return;
    }
    try {
        if (fs.existsSync(file)) {
            const payloads = utilMgr.getFileDataPayloadsAsJson(file);
            payloadMgr.batchSendPayloadData(api, file, payloads);
        }
    } catch (e) {
        utilMgr.logIt(`Error batch sending payloads: ${e.message}`);
    }
};

payloadMgr.batchSendPayloadData = async (api, file, payloads) => {
    if (payloads && payloads.length > 0) {
        console.log(`sending batch payloads: ${JSON.stringify(payloads)}`);

        // send 50 at a time
        let batch = [];
        for (let i = 0; i < payloads.length; i++) {
            if (batch.length >= batch_limit) {
                const resp = await eventMgr.sendBatchPayload(api, batch);
                if (!serviceUtil.isResponseOk(resp)) {
                    return;
                }
                batch = [];
            }
            batch.push(payloads[i]);
        }
        // send the remaining
        if (batch.length > 0) {
            const resp = await eventMgr.sendBatchPayload(api, batch);
            if (!serviceUtil.isResponseOk(resp)) {
                return;
            }
        }
    }
    // we've made it past the send without errors, delete the file
    utilMgr.deleteFile(file);
};

payloadMgr.postBootstrapPayload = async payload => {
    const batch = [payload];
    await eventMgr.sendBatchPayload('/data/batch', batch);
};

module.exports = payloadMgr;
