'use babel';

const request = require("request");
const fs = require("fs");
const open = require("open");
const path = require("path");
const os = require("os");

const DOWNLOAD_NOW_LABEL = "Download";
const NOT_NOW_LABEL = "Not now";
const NO_PM_INSTALLED_MSG = "We are having trouble sending data to Software.com. The Plugin Manager may not be installed. Would you like to download it now?";
const PM_BUCKET = "https://s3-us-west-1.amazonaws.com/swdc-plugin-manager/";
const PM_NAME = "software-plugin-manager";

let downloadingNow = false;
let previousPercent = 0;

// DownloadManager - handles PluginManager download lifecycle
export default class DownloadManager {

  // Returns an object that can be retrieved
  // when package is activated.
  serialize() {}

  // Tear down any state and detach
  destroy() {
    //
  }

  isDownloading() {
    return downloadingNow;
  }

  /**
   *
   * mac: /Applications/Software.app/Contents/Info.plist
   * example info
   * Bundle version: 0.5.6-staging.2750
   * Bundle version string, short: 0.5.6-staging
   * Bundle display name: Software
   *
   * win: C:\Users\<username>\AppData\Local\Programs\software-plugin-manager\Software.exe
   *
   * Find all files recursively in specific folder with specific extension, e.g:
   * findFilesInDir('./project/src', '.html') ==> ['./project/src/a.html','./project/src/build/index.html']
   * @param  {String} startPath    Path relative to this file or other file which requires this files
   * @param  {String} filter       Extension name, e.g: '.html'
   * @return {Array}               Result files with path string in an array
   */
  hasPluginInstalled() {
      const startPath = this.getPluginManagerInstallDir();
      const dirFiles = fs.readdirSync(startPath);

      for (let i in dirFiles) {
          if (dirFiles[i].toLowerCase().indexOf("software") === 0) {
              return true;
          }
      }

      console.log(`Unable to locate the Plugin Manager installation.`);
      return false;
  }

  // process.platform return the following...
  //   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
  isWindows() {
      return process.platform.indexOf("win32") !== -1;
  }

  isMac() {
      return process.platform.indexOf("darwin") !== -1;
  }

  // buid the directory we'll download the PM into.
  getDownloadDestinationDirectory() {
      let homedir = os.homedir();

      if (this.isWindows()) {
          homedir += "\\Desktop\\";
      } else {
          homedir += "/Desktop/";
      }
      return homedir;
  }

  // get the full path and file name for the saved pm file.
  getDownloadDestinationPathName() {
      let pathName = this.getDownloadDestinationDirectory() + PM_NAME;

      if (this.isWindows()) {
          pathName += ".exe";
      } else if (this.isMac()) {
          pathName += ".dmg";
      } else {
          pathName += ".deb";
      }
      return pathName;
  }

  getPluginManagerFileUrl() {
      let fileUrl = PM_BUCKET + PM_NAME;

      if (this.isWindows()) {
          fileUrl += ".exe";
      } else if (this.isMac()) {
          fileUrl += ".dmg";
      } else {
          fileUrl += ".deb";
      }
      return fileUrl;
  }

  getPluginManagerInstallDir() {
    if (this.isMac()) {
        return "/Applications";
    } else if (this.isWindows()) {
        return os.homedir() + "\\AppData\\Programs";
    } else {
        return "/usr/lib/";
    }
  }

  downloadPM() {
      downloadingNow = true;

      let pmBinary = this.getDownloadDestinationPathName();
      let fileUrl = this.getPluginManagerFileUrl();

      console.log(`Downloading ${fileUrl} to ${pmBinary}`);

      // Save variable to know progress
      var received_bytes = 0;
      var total_bytes = 0;
      let options = { url: fileUrl };
      let req = request.get(options);
      let out = fs.createWriteStream(pmBinary);

      req.pipe(out);
      req.on("response", function(data) {
          if (data && data.statusCode === 200) {
              console.log("Starting Plugin Manager download.");
          } else {
              console.log("Unable to download, request status: ", data.statusCode);
              downloadingNow = false;
          }

          // Change the total bytes value to get progress later.
          total_bytes = parseInt(data.headers["content-length"]);
      });

      req.on("data", function(chunk) {
          // Update the received bytes
          received_bytes += chunk.length;

          const percent = Math.ceil(Math.max(received_bytes * 100 / total_bytes, 2));
          if (percent !== previousPercent && percent % 10 === 0) {
            console.log(`Downloading Plugin Manager: ${percent}%`);
          }
          previousPercent = percent;
      });

      req.on("end", function() {
          downloadingNow = false;
          previousPercent = 0;

          // install the plugin manager
          console.log(`Launching ${pmBinary}`);
          open(pmBinary);
      });
  }

}
