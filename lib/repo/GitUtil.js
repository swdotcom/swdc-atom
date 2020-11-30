'use babel';

import CommitChangeStats from '../model/CommitChangeStats';
import RepoContributor from '../model/RepoContributor';
import TeamMember from "../model/TeamMember";

const utilMgr = require('../UtilManager');
const moment = require('moment-timezone');
const execUtil = require('../utils/ExecUtil');
const serviceUtil = require('../utils/ServiceUtil');
const fileMgr = require("../managers/FileManager");

const gitUtil = {};

const ONE_HOUR_IN_SEC = 60 * 60;
const ONE_DAY_SEC = ONE_HOUR_IN_SEC * 24;
const ONE_WEEK_SEC = ONE_DAY_SEC * 7;

const resourceInfoMap = {};

/**
 * Looks through all of the lines for
 * files changed, insertions, and deletions and aggregates
 * @param results
 */
gitUtil.accumulateStatChanges = results => {
    const stats = new CommitChangeStats();
    if (results) {
        for (let i = 0; i < results.length; i++) {
            const line = results[i].trim();

            // look for the line with "insertion" and "deletion"
            if (
                line.includes('changed') &&
                (line.includes('insertion') || line.includes('deletion'))
            ) {
                // split by space, then the number before the keyword is our value
                const parts = line.split(' ');
                // the very first element is the number of files changed
                const fileCount = parseInt(parts[0], 10);
                stats.fileCount += fileCount;
                stats.commitCount += 1;
                for (let x = 1; x < parts.length; x++) {
                    const part = parts[x];
                    if (part.includes('insertion')) {
                        const insertions = parseInt(parts[x - 1], 10);
                        if (insertions) {
                            stats.insertions += insertions;
                        }
                    } else if (part.includes('deletion')) {
                        const deletions = parseInt(parts[x - 1], 10);
                        if (deletions) {
                            stats.deletions += deletions;
                        }
                    }
                }
            }
        }
    }

    return stats;
};

gitUtil.getChangeStats = async (projectDir, cmd) => {
    let changeStats = new CommitChangeStats();

    if (!projectDir || !utilMgr.isGitProject(projectDir)) {
        return changeStats;
    }

    /**
     * example:
     * -mbp-2:swdc-vscode xavierluiz$ git diff --stat
        lib/KpmProviderManager.ts | 22 ++++++++++++++++++++--
        1 file changed, 20 insertions(+), 2 deletions(-)

        for multiple files it will look like this...
        7 files changed, 137 insertions(+), 55 deletions(-)
     */
    const resultList = await execUtil.getCommandResultList(cmd, projectDir);

    if (!resultList) {
        // something went wrong, but don't try to parse a null or undefined str
        return changeStats;
    }

    // just look for the line with "insertions" and "deletions"
    changeStats = gitUtil.accumulateStatChanges(resultList);

    return changeStats;
};

gitUtil.getResourceInfo = async projectDir => {
    if (!projectDir || !utilMgr.isGitProject(projectDir)) {
        return {};
    }

    let resourceInfo = resourceInfoMap[projectDir];
    if (resourceInfo) {
      return resourceInfo;
    }

    let branch = await execUtil.wrapExecPromise(
        'git symbolic-ref --short HEAD',
        projectDir
    );
    let identifier = await execUtil.wrapExecPromise(
        'git config --get remote.origin.url',
        projectDir
    );

    let email = await execUtil.wrapExecPromise(
        'git config user.email',
        projectDir
    );
    let tag = await execUtil.wrapExecPromise('git describe --all', projectDir);

    // both should be valid to return the resource info
    if (branch && identifier && email) {
        resourceInfo = { branch, identifier, email, tag };
        resourceInfoMap[projectDir] = resourceInfo;
        return resourceInfo;
    }
    // we don't have git info, return an empty object
    return {};
};

gitUtil.getFileContributorCount = async (fileName) => {
    const fileType = utilMgr.getFileType(fileName);

    if (fileType === "git") {
        return 0;
    }

    const { project_directory } = fileMgr.getDirectoryAndNameForFile(fileName);
    if (!project_directory || !utilMgr.isGitProject(project_directory)) {
        return 0;
    }

    // all we need is the filename of the path
    const cmd = `git log --pretty="%an" ${fileName}`;

    // get the list of users that modified this file
    let resultList = await execUtil.getCommandResultList(cmd, project_directory);
    if (!resultList) {
        // something went wrong, but don't try to parse a null or undefined str
        return 0;
    }

    if (resultList.length) {
        const uniqueItems = Array.from(new Set(resultList));
        return uniqueItems.length;
    }
    return 0;
};

gitUtil.getRepoContributorInfo = async (
    fileName,
    filterOutNonEmails = true
) => {
    const { project_directory } = fileMgr.getDirectoryAndNameForFile(fileName);
    if (!project_directory || !utilMgr.isGitProject(project_directory)) {
        return null;
    }

    let repoContributorInfo = new RepoContributor();

    // get the repo url, branch, and tag
    let resourceInfo = await gitUtil.getResourceInfo(project_directory);
    if (resourceInfo && resourceInfo.identifier) {
        repoContributorInfo.identifier = resourceInfo.identifier;
        repoContributorInfo.tag = resourceInfo.tag;
        repoContributorInfo.branch = resourceInfo.branch;

        // username, email
        let cmd = `git log --format='%an,%ae' | sort -u`;
        // get the author name and email
        let resultList = await execUtil.getCommandResultList(cmd, project_directory);
        if (!resultList) {
            // something went wrong, but don't try to parse a null or undefined str
            return repoContributorInfo;
        }

        let map = {};
        if (resultList && resultList.length > 0) {
            // count name email
            resultList.forEach((listInfo) => {
                const devInfo = listInfo.split(",");
                const name = devInfo[0];
                const email = utilMgr.normalizeGithubEmail(
                    devInfo[1],
                    filterOutNonEmails
                );
                if (email && !map[email]) {
                    const teamMember = new TeamMember();
                    teamMember.name = name;
                    teamMember.email = email;
                    teamMember.identifier = resourceInfo.identifier;
                    repoContributorInfo.members.push(teamMember);
                    map[email] = email;
                }
            });
        }
        repoContributorInfo.count = repoContributorInfo.members.length;
    }

    return repoContributorInfo;
};

gitUtil.getRepoFileCount = async (fileName) => {
    const { project_directory } = fileMgr.getDirectoryAndNameForFile(fileName);
    if (!project_directory || !utilMgr.isGitProject(project_directory)) {
        return 0;
    }

    // windows doesn't support the wc -l so we'll just count the list
    let cmd = `git ls-files`;
    // get the author name and email
    let resultList = await execUtil.getCommandResultList(cmd, project_directory);
    if (!resultList) {
        // something went wrong, but don't try to parse a null or undefined str
        return 0;
    }

    return resultList.length;
};

function stripOutSlashes(str) {
    var parts = str.split("//");
    return parts.length === 2 ? parts[1] : str;
}

function stripOutAtSign(str) {
    var parts = str.split("@");
    return parts.length === 2 ? parts[1] : str;
}

function replaceColonWithSlash(str) {
    return str.replace(":", "/");
}

function normalizeRepoIdentifier(identifier) {
    if (identifier) {
        // repos['standardId'] = repos['identifier']
        // repos['standardId'] = repos['standardId'].str.split('\//').str[-1].str.strip()
        // repos['standardId'] = repos['standardId'].str.split('\@').str[-1].str.strip()
        // repos['standardId'] = repos['standardId'].str.replace(':', "/")
        identifier = stripOutSlashes(identifier);
        identifier = stripOutAtSign(identifier);
        identifier = replaceColonWithSlash(identifier);
    }

    return identifier || "";
}

/**
 * Retrieve the github org name and repo name from the identifier
 * i.e. https://github.com\\swdotcom\\swdc-codemetrics-service.git
 * would return "swdotcom"
 * Returns: {identifier, org_name, repo_name}
 */
gitUtil.getRepoIdentifierInfo = (identifier) => {
    identifier = normalizeRepoIdentifier(identifier);

    if (!identifier) {
        // no identifier to pull out info
        return { identifier: "", org_name: "", repo_name: "" };
    }

    // split the identifier into parts
    const parts = identifier.split(/[\\/]/);

    // it needs to have at least 3 parts
    // for example, this shouldn't return an org "github.com//string.git"
    let owner_id = "";
    const gitMatch = parts[0].match(/.*github.com/i);
    if (parts && parts.length > 2 && gitMatch) {
        // return the 2nd part
        owner_id = parts[1];
    }

    let repo_name = "";
    if (parts && parts.length > 2 && identifier.indexOf(".git") !== -1) {
        // https://github.com/swdotcom/swdc-atom.git
        // this will return "swdc-atom"
        repo_name = identifier.split("/").slice(-1)[0].split(".git")[0];
    }

    return { identifier, owner_id, repo_name };
}

module.exports = gitUtil;
