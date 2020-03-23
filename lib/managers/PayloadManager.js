'use babel';

const utilMgr = require('../UtilManager');
const eventMgr = require('./EventManager');
const sessionAppMgr = require('./SessionAppManager');
const fs = require('fs');

// batch offline payloads in 50. backend has a 100k body limit
const batch_limit = 50;

const payloadMgr = {};

/**
 * send the offline TimeData payloads
 */
payloadMgr.sendOfflineTimeData = async () => {
    payloadMgr.batchSendArrayData(
        '/data/time',
        utilMgr.getTimeDataSummaryFile()
    );
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
payloadMgr.sendOfflineData = async () => {
    payloadMgr.batchSendData('/data/batch', utilMgr.getSoftwareDataStoreFile());

    sessionAppMgr.updateSessionSummaryFromServer();
};

/**
 * batch send array data
 * @param api
 * @param file
 */
payloadMgr.batchSendArrayData = async (api, file) => {
    let isonline = await utilMgr.serverIsAvailable();
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
    let isonline = await utilMgr.serverIsAvailable();
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
    // we're online so just delete the file
    utilMgr.deleteFile(file);
    if (payloads && payloads.length > 0) {
        console.log(`sending batch payloads: ${JSON.stringify(payloads)}`);

        // send 50 at a time
        let batch = [];
        for (let i = 0; i < payloads.length; i++) {
            if (batch.length >= batch_limit) {
                await eventMgr.sendBatchPayload(api, batch);
                batch = [];
            }
            batch.push(payloads[i]);
        }
        // send the remaining
        if (batch.length > 0) {
            await eventMgr.sendBatchPayload(api, batch);
        }
    }
};

payloadMgr.postBootstrapPayload = async payload => {
    const batch = [payload];
    await eventMgr.sendBatchPayload('/data/batch', batch);
};

module.exports = payloadMgr;
