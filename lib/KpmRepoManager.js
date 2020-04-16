'use babel';

const utilMgr = require('./UtilManager');
const gitUtil = require('./repo/GitUtil');
const execUtil = require('./utils/ExecUtil');
const serviceUtil = require('./utils/ServiceUtil');

let repoMgr = {};

function buildRepoKey(identifier, branch, tag) {
    return `${identifier}_${branch}_${tag}`;
}

repoMgr.getLastCommit = async projectDir => {
    // get the repo info to get the last commit from the app
    if (!projectDir || !utilMgr.isGitProject(projectDir)) {
        return null;
    }

    // get the repo url, branch, and tag
    let resourceInfo = await gitUtil.getResourceInfo(projectDir);
    let key = null;
    let commit = null;
    if (resourceInfo && resourceInfo.identifier) {
        let identifier = resourceInfo.identifier;
        let tag = resourceInfo.tag;
        let branch = resourceInfo.branch;
        key = buildRepoKey(identifier, branch, tag);

        let encodedIdentifier = encodeURIComponent(identifier);
        let encodedTag = encodeURIComponent(tag);
        let encodedBranch = encodeURIComponent(branch);
        // call the app
        commit = await serviceUtil
            .softwareGet(
                `/commits/latest?identifier=${encodedIdentifier}&tag=${encodedTag}&branch=${encodedBranch}`,
                utilMgr.getItem('jwt')
            )
            .then(resp => {
                if (serviceUtil.isResponseOk(resp)) {
                    // will get a single commit object back with the following attributes
                    // commitId, message, changes, email, timestamp
                    let commit =
                        resp.data && resp.data.commit ? resp.data.commit : null;
                    return commit;
                }
            });
    }

    return commit;
};

repoMgr.getHistoricalCommits = async projectDir => {
    if (!projectDir || !utilMgr.isGitProject(projectDir)) {
        return;
    }

    // get the repo url, branch, and tag
    let resourceInfo = await gitUtil.getResourceInfo(projectDir);
    if (resourceInfo && resourceInfo.identifier) {
        let identifier = resourceInfo.identifier;
        let tag = resourceInfo.tag;
        let branch = resourceInfo.branch;
        let key = buildRepoKey(identifier, branch, tag);

        let latestCommit = await repoMgr.getLastCommit(projectDir);
        let sinceOption = latestCommit
            ? ` --since=${parseInt(latestCommit.timestamp, 10)}`
            : ` --max-count=100`;

        // git log --stat --pretty="COMMIT:%H, %ct, %cI, %s, %ae"
        let commitHistory = await execUtil.wrapExecPromise(
            `git log --stat --pretty="COMMIT:%H,%ct,%cI,%s" --author=${resourceInfo.email}${sinceOption}`,
            projectDir
        );

        if (!commitHistory) {
            // something went wrong, but don't try to parse a null or undefined str
            return;
        }

        let commitHistoryList = commitHistory
            .replace(/\r\n/g, '\r')
            .replace(/\n/g, '\r')
            .split(/\r/);

        if (commitHistoryList && commitHistoryList.length > 0) {
            let commits = [];
            let commit = null;
            for (let i = 0; i < commitHistoryList.length; i++) {
                let line = commitHistoryList[i].trim();
                if (line && line.length > 0) {
                    if (line.indexOf('COMMIT:') === 0) {
                        line = line.substring('COMMIT:'.length);
                        if (commit) {
                            // add it to the commits
                            commits.push(commit);
                        }
                        // split by comma
                        let commitInfos = line.split(',');
                        if (commitInfos && commitInfos.length > 3) {
                            let commitId = commitInfos[0].trim();
                            if (
                                latestCommit &&
                                commitId === latestCommit.commitId
                            ) {
                                commit = null;
                                // go to the next one
                                continue;
                            }
                            let timestamp = parseInt(commitInfos[1].trim(), 10);
                            let date = commitInfos[2].trim();
                            let message = commitInfos[3].trim();
                            commit = {
                                commitId,
                                timestamp,
                                date,
                                message,
                                changes: {
                                    __sftwTotal__: {
                                        insertions: 0,
                                        deletions: 0,
                                    },
                                },
                            };
                        }
                    } else if (commit && line.indexOf('|') !== -1) {
                        // get the file and changes
                        // i.e. backend/app.js                | 20 +++++++++-----------
                        line = line.replace(/ +/g, ' ');
                        let lineInfos = line.split('|');
                        if (lineInfos && lineInfos.length > 1) {
                            let file = lineInfos[0].trim();
                            let metricsLine = lineInfos[1].trim();
                            let metricsInfos = metricsLine.split(' ');
                            if (metricsInfos && metricsInfos.length > 1) {
                                let addAndDeletes = metricsInfos[1].trim();
                                // count the number of plus signs and negative signs to find
                                // out how many additions and deletions per file
                                let len = addAndDeletes.length;
                                let lastPlusIdx = addAndDeletes.lastIndexOf(
                                    '+'
                                );
                                let insertions = 0;
                                let deletions = 0;
                                if (lastPlusIdx !== -1) {
                                    insertions = lastPlusIdx + 1;
                                    deletions = len - insertions;
                                } else if (len > 0) {
                                    // all deletions
                                    deletions = len;
                                }
                                commit.changes[file] = {
                                    insertions,
                                    deletions,
                                };
                                commit.changes.__sftwTotal__.insertions += insertions;
                                commit.changes.__sftwTotal__.deletions += deletions;
                            }
                        }
                    }
                }
            }

            if (commit) {
                // add it to the commits
                commits.push(commit);
            }

            // batch the commits and send them
            if (commits && commits.length > 0) {
                let batchCommits = [];
                for (let i = 0; i < commits.length; i++) {
                    batchCommits.push(commits[i]);
                    if (i > 0 && i % 25 === 0) {
                        let commitData = {
                            commits: batchCommits,
                            identifier,
                            tag,
                            branch,
                        };
                        await sendCommits(commitData);
                        batchCommits = [];
                    }
                }

                if (batchCommits.length > 0) {
                    let commitData = {
                        commits: batchCommits,
                        identifier,
                        tag,
                        branch,
                    };
                    await sendCommits(commitData);
                    batchCommits = [];
                }
            }
        }

        /**
         * We'll get commitId, unixTimestamp, unixDate, commitMessage, authorEmail
         * then we'll gather the files
         * COMMIT:52d0ac19236ac69cae951b2a2a0b4700c0c525db, 1545507646, 2018-12-22T11:40:46-08:00, updated wlb to use local_start, xavluiz@gmail.com

            backend/app.js                  | 20 +++++++++-----------
            backend/app/lib/audio.js        |  5 -----
            backend/app/lib/feed_helpers.js | 13 +------------
            backend/app/lib/sessions.js     | 25 +++++++++++++++----------
            4 files changed, 25 insertions(+), 38 deletions(-)
        */
    }
};

function sendCommits(commitData) {
    // send this to the backend
    serviceUtil
        .softwarePost('/commits', commitData, utilMgr.getItem('jwt'))
        .then(resp => {
            if (serviceUtil.isResponseOk(resp)) {
                if (resp.data) {
                    console.log(`Code Time: ${resp.data.message}`);
                } else {
                    // everything is fine, delete the offline data file
                    console.log('Code Time: repo commits updated');
                }
            }
        });
}

module.exports = repoMgr;
