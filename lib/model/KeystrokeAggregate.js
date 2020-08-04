'use babel';

export default class KeystrokeAggregate {
    constructor() {
        this.add = 0;
        this.close = 0;
        this.delete = 0;
        this.linesAdded = 0;
        this.linesRemoved = 0;
        this.open = 0;
        this.paste = 0;
        this.charsPasted = 0;
        this.keystrokes = 0;
        this.directory = '';
    }
}
