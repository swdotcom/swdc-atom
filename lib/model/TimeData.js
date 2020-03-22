'use babel';

import Project from './Project';

export default class TimeData {
    constructor() {
        this.timestamp = 0;
        this.timestamp_local = 0;
        this.editor_seconds = 0;
        this.session_seconds = 0;
        this.file_seconds = 0;
        this.day = '';
        this.project = new Project();
    }
}
