'use babel';

const utilMgr = require('../UtilManager');

// example: {type: "window", name: "close", timestamp: 1234,
// timestamp_local: 1233, description: "OnboardPrompt"}
export default class CodeTimeEvent {
    constructor() {
        this.type = '';
        this.name = '';
        this.timestamp = 0;
        this.timestamp_local = 0;
        this.description = '';
        this.pluginId = utilMgr.getPluginId();
        this.os = utilMgr.getOs();
        this.version = utilMgr.getVersion();
        this.hostname = ''; // this is gathered using an await
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
}
