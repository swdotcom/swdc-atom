'use babel';

export default class FileChangeInfo {
    constructor() {
        this.name = '';
        this.fsPath = '';
        this.projectDir = '';
        this.kpm = 0;
        this.keystrokes = 0;
        this.add = 0;
        this.netkeys = 0;
        this.paste = 0;
        this.open = 0;
        this.close = 0;
        this.delete = 0;
        this.length = 0;
        this.lines = 0;
        this.linesAdded = 0;
        this.linesRemoved = 0;
        this.syntax = '';
        this.fileAgeDays = 0;
        this.repoFileContributorCount = 0;
        this.start = 0;
        this.end = 0;
        this.local_start = 0;
        this.local_end = 0;
        this.update_count = 0;
        this.duration_seconds = 0;
    }
}
