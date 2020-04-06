'use babel';

export default class CodeTimeSummary {
    constructor() {
        // this is the editor session minutes
        this.activeCodeTimeMinutes = 0;
        // this is the total focused editor minutes
        this.codeTimeMinutes = 0;
        // this is the total time spent coding on files
        this.fileTimeMinutes = 0;
    }
}
