'use babel';

import Resource from './Resource';

export default class Project {
    constructor() {
        this.directory = '';
        this.name = '';
        this.identifier = '';
        this.resource = new Resource();
    }
}
