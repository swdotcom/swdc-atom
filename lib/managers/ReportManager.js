'use babel';

import fs from 'fs';

const utilMgr = require('../UtilManager');
const gitUtil = require('../repo/GitUtil');
const moment = require('moment-timezone');

export const DASHBOARD_LABEL_WIDTH = 28;
export const DASHBOARD_VALUE_WIDTH = 36;
export const DASHBOARD_COL_WIDTH = 21;
export const DASHBOARD_LRG_COL_WIDTH = 38;
export const TABLE_WIDTH = 80;
export const MARKER_WIDTH = 4;

export function getProjectContributorCodeSummaryFile() {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\ProjectContributorCodeSummary.txt';
    } else {
        file += '/ProjectContributorCodeSummary.txt';
    }
    return file;
}

export async function generateContributorSummary(projectDir) {
    await writeProjectContributorCommitDashboardFromGitLogs(projectDir);

    const file = getProjectContributorCodeSummaryFile();

    // display it
    atom.workspace.open(file, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
}

export async function writeProjectContributorCommitDashboardFromGitLogs(
    projectDir
) {
    const userTodaysChangeStatsP = gitUtil.getTodaysCommits(projectDir);
    const userYesterdaysChangeStatsP = gitUtil.getYesterdaysCommits(projectDir);
    const userWeeksChangeStatsP = gitUtil.getThisWeeksCommits(projectDir);
    const contributorsTodaysChangeStatsP = gitUtil.getTodaysCommits(
        projectDir,
        false
    );
    const contributorsYesterdaysChangeStatsP = gitUtil.getYesterdaysCommits(
        projectDir,
        false
    );
    const contributorsWeeksChangeStatsP = gitUtil.getThisWeeksCommits(
        projectDir,
        false
    );

    let dashboardContent = '';

    const now = moment().unix();
    const formattedDate = moment.unix(now).format('ddd, MMM Do h:mma');
    dashboardContent = getTableHeader(
        'PROJECT SUMMARY',
        ` (Last updated on ${formattedDate})`
    );
    dashboardContent += '\n\n';
    dashboardContent += `Project: ${projectDir}`;
    dashboardContent += '\n\n';

    let projectDate = moment.unix(now).format('MMM Do, YYYY');
    dashboardContent += getRightAlignedTableHeader(`Today (${projectDate})`);
    dashboardContent += getColumnHeaders(['Metric', 'You', 'All Contributors']);

    let summary = {
        activity: await userTodaysChangeStatsP,
        contributorActivity: await contributorsTodaysChangeStatsP,
    };
    dashboardContent += getRowNumberData(summary, 'Commits', 'commitCount');

    // files changed
    dashboardContent += getRowNumberData(summary, 'Files changed', 'fileCount');

    // insertions
    dashboardContent += getRowNumberData(summary, 'Insertions', 'insertions');

    // deletions
    dashboardContent += getRowNumberData(summary, 'Deletions', 'deletions');

    dashboardContent += '\n';

    // YESTERDAY
    projectDate = moment.unix(now).format('MMM Do, YYYY');
    let startDate = moment
        .unix(now)
        .subtract(1, 'day')
        .startOf('day')
        .format('MMM Do, YYYY');
    dashboardContent += getRightAlignedTableHeader(`Yesterday (${startDate})`);
    dashboardContent += getColumnHeaders(['Metric', 'You', 'All Contributors']);
    summary = {
        activity: await userYesterdaysChangeStatsP,
        contributorActivity: await contributorsYesterdaysChangeStatsP,
    };
    dashboardContent += getRowNumberData(summary, 'Commits', 'commitCount');

    // files changed
    dashboardContent += getRowNumberData(summary, 'Files changed', 'fileCount');

    // insertions
    dashboardContent += getRowNumberData(summary, 'Insertions', 'insertions');

    // deletions
    dashboardContent += getRowNumberData(summary, 'Deletions', 'deletions');

    dashboardContent += '\n';

    projectDate = moment.unix(now).format('MMM Do, YYYY');
    startDate = moment
        .unix(now)
        .startOf('week')
        .format('MMM Do, YYYY');
    dashboardContent += getRightAlignedTableHeader(
        `This week (${startDate} to ${projectDate})`
    );
    dashboardContent += getColumnHeaders(['Metric', 'You', 'All Contributors']);

    // THIS WEEK
    summary = {
        activity: await userWeeksChangeStatsP,
        contributorActivity: await contributorsWeeksChangeStatsP,
    };
    dashboardContent += getRowNumberData(summary, 'Commits', 'commitCount');

    // files changed
    dashboardContent += getRowNumberData(summary, 'Files changed', 'fileCount');

    // insertions
    dashboardContent += getRowNumberData(summary, 'Insertions', 'insertions');

    // deletions
    dashboardContent += getRowNumberData(summary, 'Deletions', 'deletions');

    dashboardContent += '\n';

    const file = getProjectContributorCodeSummaryFile();
    fs.writeFileSync(file, dashboardContent, err => {
        if (err) {
            logIt(
                `Error writing to the code time summary content file: ${err.message}`
            );
        }
    });
}

function getRowNumberData(summary, title, attribute) {
    // files changed
    const userFilesChanged = summary.activity[attribute]
        ? utilMgr.formatNumber(summary.activity[attribute])
        : utilMgr.formatNumber(0);
    const contribFilesChanged = summary.contributorActivity[attribute]
        ? utilMgr.formatNumber(summary.contributorActivity[attribute])
        : utilMgr.formatNumber(0);
    return getRowLabels([title, userFilesChanged, contribFilesChanged]);
}

export function getDashboardBottomBorder() {
    let content = '';
    const len = DASHBOARD_LABEL_WIDTH + DASHBOARD_VALUE_WIDTH;
    for (let i = 0; i < len; i++) {
        content += '-';
    }
    content += '\n\n';
    return content;
}

export function getSectionHeader(label) {
    let content = `${label}\n`;
    // add 3 to account for the " : " between the columns
    let dashLen = DASHBOARD_LABEL_WIDTH + DASHBOARD_VALUE_WIDTH;
    for (let i = 0; i < dashLen; i++) {
        content += '-';
    }
    content += '\n';
    return content;
}

function formatRightAlignedTableLabel(label, col_width) {
    const spacesRequired = col_width - label.length;
    let spaces = '';
    if (spacesRequired > 0) {
        for (let i = 0; i < spacesRequired; i++) {
            spaces += ' ';
        }
    }
    return `${spaces}${label}`;
}

export function getTableHeader(leftLabel, rightLabel, isFullTable = true) {
    // get the space between the two labels
    const fullLen = !isFullTable
        ? TABLE_WIDTH - DASHBOARD_COL_WIDTH
        : TABLE_WIDTH;
    const spacesRequired = fullLen - leftLabel.length - rightLabel.length;
    let spaces = '';
    if (spacesRequired > 0) {
        let str = '';
        for (let i = 0; i < spacesRequired; i++) {
            spaces += ' ';
        }
    }
    return `${leftLabel}${spaces}${rightLabel}`;
}

export function getRightAlignedTableHeader(label) {
    let content = `${formatRightAlignedTableLabel(label, TABLE_WIDTH)}\n`;
    for (let i = 0; i < TABLE_WIDTH; i++) {
        content += '-';
    }
    content += '\n';
    return content;
}

function getSpaces(spacesRequired) {
    let spaces = '';
    if (spacesRequired > 0) {
        let str = '';
        for (let i = 0; i < spacesRequired; i++) {
            spaces += ' ';
        }
    }
    return spaces;
}

export function getRowLabels(labels) {
    // for now 3 columns
    let content = '';
    let spacesRequired = 0;
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (i === 0) {
            content += label;
            // show a colon at the end of this column
            spacesRequired = DASHBOARD_COL_WIDTH - content.length - 1;
            content += getSpaces(spacesRequired);
            content += ':';
        } else if (i === 1) {
            // middle column
            spacesRequired =
                DASHBOARD_LRG_COL_WIDTH +
                DASHBOARD_COL_WIDTH -
                content.length -
                label.length -
                1;
            content += getSpaces(spacesRequired);
            content += `${label} `;
        } else {
            // last column, get spaces until the end
            spacesRequired = DASHBOARD_COL_WIDTH - label.length - 2;
            content += `| `;
            content += getSpaces(spacesRequired);
            content += label;
        }
    }
    content += '\n';
    return content;
}

export function getColumnHeaders(labels) {
    // for now 3 columns
    let content = '';
    let spacesRequired = 0;
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (i === 0) {
            content += label;
        } else if (i === 1) {
            // middle column
            spacesRequired =
                DASHBOARD_LRG_COL_WIDTH +
                DASHBOARD_COL_WIDTH -
                content.length -
                label.length -
                1;
            content += getSpaces(spacesRequired);
            content += `${label} `;
        } else {
            // last column, get spaces until the end
            spacesRequired = DASHBOARD_COL_WIDTH - label.length - 2;
            content += `| `;
            content += getSpaces(spacesRequired);
            content += label;
        }
    }
    content += '\n';
    for (let i = 0; i < TABLE_WIDTH; i++) {
        content += '-';
    }
    content += '\n';
    return content;
}
