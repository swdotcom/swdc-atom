'use babel';

import CommitChangeStats from '../model/CommitChangeStats';

const utilMgr = require('../UtilManager');
const moment = require('moment-timezone');

const gitUtil = {};

gitUtil.getCommandResult = async (cmd, projectDir) => {
    let result = await utilMgr.wrapExecPromise(cmd, projectDir);
    if (!result) {
        // something went wrong, but don't try to parse a null or undefined str
        return null;
    }
    result = result.trim();
    let resultList = result
        .replace(/\r\n/g, '\r')
        .replace(/\n/g, '\r')
        .replace(/^\s+/g, ' ')
        .replace(/</g, '')
        .replace(/>/g, '')
        .split(/\r/);
    return resultList;
};

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
            if (line.includes('insertion') && line.includes('deletion')) {
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

    if (!projectDir) {
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
    const resultList = await utilMgr.getCommandResult(cmd, projectDir);

    if (!resultList) {
        // something went wrong, but don't try to parse a null or undefined str
        return changeStats;
    }

    // just look for the line with "insertions" and "deletions"
    changeStats = gitUtil.accumulateStatChanges(resultList);

    return changeStats;
};

gitUtil.getUncommitedChanges = async projectDir => {
    const cmd = `git diff --stat`;
    return gitUtil.getChangeStats(projectDir, cmd);
};

gitUtil.getTodaysCommits = async projectDir => {
    const startOfDay = moment()
        .startOf('day')
        .unix();
    const resourceInfo = await gitUtil.getResourceInfo(projectDir);
    const authorOption =
        resourceInfo && resourceInfo.email
            ? ` --author=${resourceInfo.email}`
            : ``;
    const cmd = `git log --stat --pretty="COMMIT:%H,%ct,%cI,%s" --since=${startOfDay}${authorOption}`;
    return gitUtil.getChangeStats(projectDir, cmd);
};

gitUtil.getResourceInfo = async projectDir => {
    let branch = await utilMgr.wrapExecPromise(
        'git symbolic-ref --short HEAD',
        projectDir
    );
    let identifier = await utilMgr.wrapExecPromise(
        'git config --get remote.origin.url',
        projectDir
    );
    let email = await utilMgr.wrapExecPromise(
        'git config user.email',
        projectDir
    );
    let tag = await utilMgr.wrapExecPromise('git describe --all', projectDir);

    // both should be valid to return the resource info
    if (branch && identifier && email) {
        return { branch, identifier, email, tag };
    }
    // we don't have git info, return an empty object
    return {};
};

module.exports = gitUtil;
