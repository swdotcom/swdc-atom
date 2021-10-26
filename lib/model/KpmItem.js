'use babel';

// keystroke per minue metadata
export default class KpmItem {
    constructor() {
        this.id = '';
        this.label = '';
        this.description = '';
        this.tooltip = '';
        this.command = '';
        this.commandArgs = [];
        this.type = '';
        this.contextValue = '';
        this.callback = null;
        this.icon = null;
        this.children = [];
        this.eventDescription = null;
    }
}
