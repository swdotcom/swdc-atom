'use babel';

const { exec } = require('child_process');
const os = require('os');
const cp = require('child_process');

const execUtil = {};

execUtil.execPromise = (command, opts) => {
    return new Promise((resolve, reject) => {
        exec(command, opts, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            return resolve(stdout.trim());
        });
    });
};

execUtil.getCommandResultLine = async (cmd, projectDir = null) => {
    const resultList = await execUtil.getCommandResultList(cmd, projectDir);

    let resultLine = '';
    if (resultList && resultList.length) {
        for (let i = 0; i < resultList.length; i++) {
            let line = resultList[i];
            if (line && line.trim().length > 0) {
                resultLine = line.trim();
                break;
            }
        }
    }
    return resultLine;
};

execUtil.getCommandResultList = async (cmd, projectDir = null) => {
    let result = await execUtil.wrapExecPromise(cmd, projectDir);
    if (!result) {
        // something went wrong, but don't try to parse a null or undefined str
        return [];
    }
    result = result.trim();
    const resultList = result
        .replace(/\r\n/g, '\r')
        .replace(/\n/g, '\r')
        .replace(/^\s+/g, ' ')
        .split(/\r/);

    return resultList;
};

execUtil.wrapExecPromise = async (cmd, projectDir = null) => {
    let prop = null;
    try {
        if (projectDir) {
            prop = await execUtil.execPromise(cmd, {
                cwd: projectDir,
            });
        } else {
            prop = await execUtil.execPromise(cmd, {});
        }
    } catch (e) {
        // console.error(e.message);
        prop = null;
    }
    return prop;
};

execUtil.getHostname = async () => {
    const hostname = await execUtil.getCommandResultLine('hostname');
    return hostname;
};

execUtil.getOsUsername = async () => {
    let username = os.userInfo().username;
    if (!username || username.trim() === '') {
        username = await execUtil.getCommandResultLine('whoami');
    }
    return username;
};

module.exports = execUtil;
