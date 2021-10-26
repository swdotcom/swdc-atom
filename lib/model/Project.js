'use babel';

import Resource from './Resource';

// the project metadata
export default class Project {
    constructor() {
        this.directory = '';
        this.name = '';
        this.identifier = '';
        this.resource = new Resource();
    }
}
