"use babel";

export default class KeystrokeManager {
  constructor(projectName, projectDirectory, version) {
    this.keystrokeCount = new KeystrokeCount(
      projectName,
      projectDirectory,
      version
    );
  }

  // Returns an object that can be retrieved
  // when package is activated.
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.keystrokeCount.remove();
  }

  getKeystrokeCount() {
    return this.keystrokeCount;
  }

  updateFileInfoData(fileName, count, propertyToUpdate) {
    const keystrokeCount = this.keystrokeCount;
    if (!keystrokeCount) {
      return;
    }

    // add it, it's not in the current set
    let fileInfo = this.findFileInfoInSource(keystrokeCount.source, fileName);
    if (!fileInfo) {
      // "add" = additive keystrokes
      // "netkeys" = add - delete
      // "keys" = add + delete
      // "delete" = delete keystrokes
      // initialize and add it
      fileInfo = {
        keys: 0,
        paste: 0,
        open: 0,
        close: 0,
        length: 0,
        delete: 0,
        lines: 0,
        add: 0,
        netkeys: 0,
        linesAdded: 0,
        linesRemoved: 0,
        syntax: ""
      };
      keystrokeCount.source[fileName] = fileInfo;
    }
    // update the data for this fileInfo keys count....
    fileInfo[propertyToUpdate] = fileInfo[propertyToUpdate] + count;

    if (propertyToUpdate === "add" || propertyToUpdate === "delete") {
      // increment the top level data property as well
      this.keystrokeCount.data = this.keystrokeCount.data + count;

      // update the netkeys and the keys
      // "netkeys" = add - delete
      // "keys" = add + delete
      fileInfo["netkeys"] = fileInfo["add"] - fileInfo["delete"];
      fileInfo["keys"] = fileInfo["add"] + fileInfo["delete"];
    }
  }

  reset() {
    this.keystrokeCount.reset();
  }

  hasData() {
    if (this.keystrokeCount && this.keystrokeCount.source) {
      for (const fileName of Object.keys(this.keystrokeCount.source)) {
        const fileInfoData = this.keystrokeCount.source[fileName];
        // check if any of the metric values has data,
        // but don't check the 'length' attribute
        if (
          fileInfoData &&
          (fileInfoData.add > 0 ||
            fileInfoData.paste > 0 ||
            fileInfoData.open > 0 ||
            fileInfoData.close > 0 ||
            fileInfoData.delete > 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find source objects matching the fileName
   **/
  findFileInfoInSource(source, filenameToMatch) {
    if (
      source[filenameToMatch] !== undefined &&
      source[filenameToMatch] !== null
    ) {
      return source[filenameToMatch];
    }
    return null;
  }
}

export class KeystrokeCount {
  constructor(projectName, projectDirectory, version) {
    // project object containing project name and directory
    this.project = new Project(projectName, projectDirectory);
    this.version = version;
    this.reset();
  }

  /**
   * The reset ensures every variable has a defined non-null value
   **/
  reset() {
    // sublime = 1, vscode = 2, eclipse = 3, intelliJ = 4,
    // visual studio = 6, atom = 7
    this.pluginId = 7;
    // the event type of this keystroke count
    this.type = "Events";
    // the value that goes with this object, which is a Number
    // but kept as a String
    this.data = 0;
    // unique set of file names
    this.source = {};
    // start time in seconds
    this.start = Math.round(Date.now() / 1000);
    // end time in seconds
    this.end = 0;
    // setting a default, but this will be set within the constructor
    this.version = "0.2.25";
  }
}

export class Project {
  constructor(projectName, projectDirectory) {
    this.name = projectName;
    this.directory = projectDirectory;
  }
}
