"use babel";

const utilMgr = require("./UtilManager");
const httpMgr = require("./HttpManager");

let repoMgr = {};

repoMgr.getResourceInfo = async projectDir => {
  let branch = await utilMgr.wrapExecPromise(
    "git symbolic-ref --short HEAD",
    projectDir
  );
  let identifier = await utilMgr.wrapExecPromise(
    "git config --get remote.origin.url",
    projectDir
  );
  let email = await utilMgr.wrapExecPromise(
    "git config user.email",
    projectDir
  );
  let tag = await utilMgr.wrapExecPromise("git describe --all", projectDir);

  // both should be valid to return the resource info
  if (branch && identifier && email) {
    return { branch, identifier, email, tag };
  }
  // we don't have git info, return an empty object
  return {};
};

repoMgr.getRepoUsers = async projectDir => {
  if (!projectDir || projectDir === "") {
    return;
  }

  // get the repo url, branch, and tag
  let resourceInfo = await repoMgr.getResourceInfo(projectDir);
  if (resourceInfo && resourceInfo.identifier) {
    let identifier = resourceInfo.identifier;
    let tag = resourceInfo.tag;
    let branch = resourceInfo.branch;

    let members = [];
    // windows doesn't support the "uniq" command, so
    // we'll just go through all of them if it's windows
    let cmd = `git log --pretty="%an,%ae" | sort`;
    if (!utilMgr.isWindows()) {
      cmd += " | uniq";
    }
    // get the author name and email
    let devOutput = await utilMgr.wrapExecPromise(cmd, projectDir);
    // will look like this...
    // <name1>, <email1>
    // <name2>, <email2>
    let devList = devOutput
      .replace(/\r\n/g, "\r")
      .replace(/\n/g, "\r")
      .split(/\r/);

    let map = {};
    if (devList && devList.length > 0) {
      for (let i = 0; i < devList.length; i++) {
        let devInfo = devList[i];
        let devInfos = devInfo.split(",");
        if (devInfos && devInfos.length > 1) {
          let devInfoObj = {
            name: devInfos[0].trim(),
            email: devInfos[1].trim()
          };
          if (!map[devInfoObj.email]) {
            members.push(devInfoObj);
          }
          map[devInfoObj.email] = devInfoObj;
        }
      }
      let repoData = {
        members,
        identifier,
        tag,
        branch
      };

      // send this to the backend
      httpMgr
        .softwarePost("/repo/members", repoData, utilMgr.getItem("jwt"))
        .then(resp => {
          if (httpMgr.isResponseOk(resp)) {
            // everything is fine, delete the offline data file
            console.log("Software.com: repo membership updated");
          }
        });
    }
  }
};

module.exports = repoMgr;
