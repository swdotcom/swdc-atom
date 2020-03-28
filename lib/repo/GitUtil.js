'use babel';

import CommitChangeStats from '../model/CommitChangeStats';
import RepoContributor from '../model/RepoContributor';

const utilMgr = require('../UtilManager');
const moment = require('moment-timezone');
const execUtil = require('../utils/ExecUtil');
const serviceUtil = require('../utils/ServiceUtil');

const gitUtil = {};

const ONE_HOUR_IN_SEC = 60 * 60;
const ONE_DAY_SEC = ONE_HOUR_IN_SEC * 24;
const ONE_WEEK_SEC = ONE_DAY_SEC * 7;

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
    const resultList = await execUtil.getCommandResultList(cmd, projectDir);

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

gitUtil.getResourceInfo = async projectDir => {
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
        return { branch, identifier, email, tag };
    }
    // we don't have git info, return an empty object
    return {};
};

gitUtil.getRepoContributors = async (
    projectDir,
    filterOutNonEmails = false
) => {
    const contributors = [];

    if (!projectDir) {
        return contributors;
    }

    const repoContributorInfo = await gitUtil.getRepoUsers(
        projectDir,
        filterOutNonEmails
    );

    if (repoContributorInfo && repoContributorInfo.members) {
        for (let i = 0; i < repoContributorInfo.members.length; i++) {
            const member = repoContributorInfo.members[i];
            const contributor = new RepoContributor();
            contributor.name = member.name;
            contributor.email = member.email;
            contributor.identifier = repoContributorInfo.identifier;
            contributors.push(contributor);
        }
    }
    return contributors;
};

gitUtil.processRepoContributors = async projectDir => {
    if (!projectDir) {
        return;
    }

    const repoContributorInfo = await gitUtil.getRepoUsers(projectDir);

    if (repoContributorInfo) {
        // send this to the backend
        serviceUtil
            .softwarePost(
                '/repo/contributors',
                repoContributorInfo,
                utilMgr.getItem('jwt')
            )
            .then(resp => {
                if (serviceUtil.isResponseOk(resp)) {
                    // everything is fine, delete the offline data file
                    console.log('Code Time: repo contributor updated');
                }
            });
    }
};

gitUtil.getRepoUsers = async (projectDir, filterOutNonEmails = false) => {
    if (!projectDir) {
        return;
    }

    // get the repo url, branch, and tag
    let resourceInfo = await gitUtil.getResourceInfo(projectDir);

    if (resourceInfo && resourceInfo.identifier) {
        let identifier = resourceInfo.identifier;
        let tag = resourceInfo.tag;
        let branch = resourceInfo.branch;

        let members = [];
        // windows doesn't support the "uniq" command, so
        // we'll just go through all of them if it's windows
        let cmd = `git log --pretty="%an,%ae" | sort`;
        if (!utilMgr.isWindows()) {
            cmd += ' | uniq';
        }
        // get the author name and email
        let devOutput = await execUtil.wrapExecPromise(cmd, projectDir);
        // will look like this...
        // <name1>, <email1>
        // <name2>, <email2>
        let devList = devOutput
            .replace(/\r\n/g, '\r')
            .replace(/\n/g, '\r')
            .split(/\r/);

        let map = {};
        if (devList && devList.length > 0) {
            for (let i = 0; i < devList.length; i++) {
                let devInfo = devList[i];
                let devInfos = devInfo.split(',');
                if (devInfos && devInfos.length > 1) {
                    let devInfoObj = {
                        name: devInfos[0].trim(),
                        email: devInfos[1].trim(),
                    };
                    const email = utilMgr.normalizeGithubEmail(
                        devInfoObj.email,
                        filterOutNonEmails
                    );
                    if (email) {
                        if (!map[devInfoObj.email]) {
                            members.push(devInfoObj);
                        }
                        map[devInfoObj.email] = devInfoObj;
                    }
                }
            }
            return (repoData = {
                members,
                identifier,
                tag,
                branch,
            });
        }
    }
    return null;
};

gitUtil.getTodaysCommits = async (projectDir, useAuthor = true) => {
    const { start, end } = gitUtil.getToday();
    return gitUtil.getCommitsInRange(projectDir, start, end, useAuthor);
};

gitUtil.getYesterdaysCommits = async (projectDir, useAuthor = true) => {
    const { start, end } = gitUtil.getYesterday();
    return gitUtil.getCommitsInRange(projectDir, start, end, useAuthor);
};

gitUtil.getThisWeeksCommits = async (projectDir, useAuthor = true) => {
    const { start, end } = gitUtil.getThisWeek();
    return gitUtil.getCommitsInRange(projectDir, start, end, useAuthor);
};

gitUtil.getCommitsInRange = async (
    projectDir,
    start,
    end,
    useAuthor = true
) => {
    const resourceInfo = await gitUtil.getResourceInfo(projectDir);
    const authorOption =
        useAuthor && resourceInfo && resourceInfo.email
            ? ` --author=${resourceInfo.email}`
            : ``;
    const cmd = `git log --stat --pretty="COMMIT:%H,%ct,%cI,%s" --since=${start} --until=${end}${authorOption}`;
    return gitUtil.getChangeStats(projectDir, cmd);
};

gitUtil.getLastCommitId = async (projectDir, email) => {
    const authorOption = email ? ` --author=${email}` : '';
    const cmd = `git log --pretty="%H,%s"${authorOption} | head -n 1`;
    const list = await execUtil.getCommandResultList(cmd, projectDir);
    if (list && list.length) {
        const parts = list[0].split(',');
        if (parts && parts.length === 2) {
            return {
                commitId: parts[0],
                comment: parts[1],
            };
        }
    }
    return {};
};

gitUtil.getRepoConfigUserEmail = async projectDir => {
    const cmd = `git config --get --global user.email`;
    return await execUtil.getCommandResultLine(cmd, projectDir);
};

gitUtil.getRepoUrlLink = async projectDir => {
    const cmd = `git config --get remote.origin.url`;
    let str = await execUtil.getCommandResultLine(cmd, projectDir);

    if (str && str.endsWith('.git')) {
        str = str.substring(0, str.lastIndexOf('.git'));
    }
    return str;
};

/**
 * Returns the user's today's start and end in UTC time
 * @param {Object} user
 */
gitUtil.getToday = () => {
    const start =
        moment()
            .startOf('day')
            .unix() -
        moment().utcOffset() * 60;
    const end = start + ONE_DAY_SEC;
    return { start, end };
};

/**
 * Returns the user's yesterday start and end in UTC time
 */
gitUtil.getYesterday = () => {
    const start =
        moment()
            .subtract(1, 'day')
            .startOf('day')
            .unix() -
        moment().utcOffset() * 60;
    const end = start + ONE_DAY_SEC;
    return { start, end };
};

/**
 * Returns the user's this week's start and end in UTC time
 */
gitUtil.getThisWeek = () => {
    const start =
        moment()
            .startOf('week')
            .unix() -
        moment().utcOffset() * 60;
    const end = start + ONE_WEEK_SEC;
    return { start, end };
};

module.exports = gitUtil;
