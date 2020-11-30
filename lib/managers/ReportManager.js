'use babel';

import fileIt from 'file-it';

const utilMgr = require('../UtilManager');
const gitUtil = require('../repo/GitUtil');
const moment = require('moment-timezone');

export const DASHBOARD_LABEL_WIDTH = 28;
export const DASHBOARD_VALUE_WIDTH = 36;
export const DASHBOARD_COL_WIDTH = 21;
export const DASHBOARD_LRG_COL_WIDTH = 38;
export const TABLE_WIDTH = 80;
export const MARKER_WIDTH = 4;

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
