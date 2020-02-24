'use babel';

import $ from 'jquery';
import fs from 'fs';
import path from 'path';
import SessionSummary from '../model/SessionSummary';

const sessionSummaryDataMgr = require('../storage/SessionSummaryDataManager');
const fileChangeInfoSummaryDataMgr = require('../storage/FileChangeInfoSummaryDataManager');
const wallClockMgr = require('../managers/WallClockManager');
const statusMgr = require('../managers/StatusManager');
const utilMgr = require('../UtilManager');
const fileDataMgr = require('../storage/FileDataManager');
const eventMgr = require('../managers/EventManager');
const gitUtil = require('../repo/GitUtil');
const numeral = require('numeral');
const moment = require('moment-timezone');

let checkedMap = {
    'editor-time': true,
    'code-time': true,
};

export default class CodeTimeProvider {
    constructor() {
        this.currentKeystrokeStats = new SessionSummary();
        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'structure-view.html'),
            {
                encoding: 'utf-8',
            }
        );
        this.element = $(htmlString).get(0);
        this.viewType = 'codetimeProvider';
    }

    showLoader() {
        $('#tree-content').hide();
        $('#loader').show();
    }

    hideLoader() {
        $('#tree-content').show();
        $('#loader').hide();
    }

    initialize() {
        this.showLoader();
        this.renderTree();
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
        }
    }

    renderTree() {
        let html = this.treeGenerator();
        $('div.structure-view>div>ol').html(html);
        this.hideLoader();
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    async treeGenerator() {
        if (statusMgr.showingStatusBarText()) {
            $('#toggle-status-metrics').html('Hide status bar metrics');
        } else {
            $('#toggle-status-metrics').html('Show status bar metrics');
        }

        const data = fileDataMgr.getSessionSummaryData();

        const metricNodesHtml = this.buildMetricsNodes(data);

        const projectMetricNodesHtml = await this.buildCommitTreeNodes();

        $('#code-time-metrics').html(metricNodesHtml);
        $('#code-project-metrics').html(projectMetricNodesHtml);
    }

    setCurrentKeystrokeStats(keystrokeStats) {
        if (!keystrokeStats) {
            this.currentKeystrokeStats = new SessionSummary();
        } else {
            // update the current stats
            Object.keys(keystrokeStats.source).forEach(key => {
                const fileInfo: FileChangeInfo = keystrokeStats.source[key];
                this.currentKeystrokeStats.currentDayKeystrokes =
                    fileInfo.keystrokes;
                this.currentKeystrokeStats.currentDayLinesAdded =
                    fileInfo.linesAdded;
                this.currentKeystrokeStats.currentDayLinesRemoved =
                    fileInfo.linesRemoved;
            });
        }
    }

    buildMetricsNodes(data) {
        const liItems = [];

        const fileChangeInfoMap = fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson();

        // EDITOR-TIME metric
        const editorMinutes = wallClockMgr.getHumanizedWcTime();
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'editor-time',
                'Editor time',
                editorMinutes
            )
        );

        // CODE-TIME node
        const codeTimeMinutes = utilMgr.humanizeMinutes(data.currentDayMinutes);
        const avgDailyMinutes = utilMgr.humanizeMinutes(
            data.averageDailyMinutes
        );
        const globalAvgMinutes = utilMgr.humanizeMinutes(
            data.globalAverageSeconds / 60
        );
        let boltIcon =
            data.currentDayMinutes > data.averageDailyMinutes
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'code-time',
                'Code time',
                codeTimeMinutes,
                avgDailyMinutes,
                globalAvgMinutes,
                boltIcon
            )
        );

        const currLinesAdded =
            this.currentKeystrokeStats.currentDayLinesAdded +
            data.currentDayLinesAdded;
        const linesAdded = numeral(currLinesAdded).format('0 a');
        const avgLinesAdded = numeral(data.averageLinesAdded).format('0 a');
        const globalLinesAdded = numeral(data.globalAverageLinesAdded).format(
            '0 a'
        );
        boltIcon =
            data.currentDayLinesAdded > data.averageLinesAdded
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-added',
                'Lines added',
                linesAdded,
                avgLinesAdded,
                globalLinesAdded,
                boltIcon
            )
        );

        const currLinesRemoved =
            this.currentKeystrokeStats.currentDayLinesRemoved +
            data.currentDayLinesRemoved;
        const linesRemoved = numeral(currLinesRemoved).format('0 a');
        const avgLinesRemoved = numeral(data.averageLinesRemoved).format('0 a');
        const globalLinesRemoved = numeral(
            data.globalAverageLinesRemoved
        ).format('0 a');
        boltIcon =
            data.currentDayLinesRemoved > data.averageLinesRemoved
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'lines-removed',
                'Lines removed',
                linesRemoved,
                avgLinesRemoved,
                globalLinesRemoved,
                boltIcon
            )
        );

        const currKeystrokes =
            this.currentKeystrokeStats.currentDayKeystrokes +
            data.currentDayKeystrokes;
        const keystrokes = numeral(currKeystrokes).format('0 a');
        const avgKeystrokes = numeral(data.averageDailyKeystrokes).format(
            '0 a'
        );
        const globalKeystrokes = numeral(
            data.globalAverageDailyKeystrokes
        ).format('0 a');
        boltIcon =
            data.currentDayKeystrokes > data.averageDailyKeystrokes
                ? 'bolt-icon'
                : 'bolt-grey-icon';
        liItems.push(
            this.buildCodeTimeMetricsLiItem(
                'keystrokes',
                'Keystrokes',
                keystrokes,
                avgKeystrokes,
                globalKeystrokes,
                boltIcon
            )
        );

        // get the top file nodes and add it to the liItems
        const topFileNodes = this.buildTopFileNodes(fileChangeInfoMap);
        liItems.push(...topFileNodes);

        const fileChangeInfos = Object.keys(fileChangeInfoMap).map(key => {
            return fileChangeInfoMap[key];
        });
        const topKpmFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by KPM',
            'kpm',
            'top-kpm-files'
        );
        liItems.push(topKpmFileNodes);

        const topKeystrokeFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by keystrokes',
            'keystrokes',
            'top-keystrokes-files'
        );
        liItems.push(topKeystrokeFileNodes);

        const topCodetimeFileNodes = this.topFilesMetricNode(
            fileChangeInfos,
            'Top files by code time',
            'codetime',
            'top-codetime-files'
        );
        liItems.push(topCodetimeFileNodes);

        // build the editor time li
        return `<ul>${liItems.join('\n')}</ul>`;
    }

    async buildCommitTreeNodes() {
        const commitTreeNodes = [];

        const folders = utilMgr.getOpenProjects();
        if (folders && folders.length > 0) {
            const openChangesDirNodes = [];
            const committedChangesDirNodes = [];
            for (let i = 0; i < folders.length; i++) {
                const dir = folders[i];
                // get uncommitted change info
                const currentChangesummary = await gitUtil.getUncommitedChanges(
                    dir
                );

                const basename = path.basename(dir);
                const openChangesNodeHtml = this.buildOpenChangesDirNodeItem(
                    `uncommitted-${i}`,
                    basename,
                    currentChangesummary.insertions,
                    currentChangesummary.deletions
                );
                openChangesDirNodes.push(openChangesNodeHtml);

                // get the completed commits of today
                const todaysChangeSummary = await gitUtil.getTodaysCommits(dir);

                const committedChangesNodeHtml = this.buildOpenChangesDirNodeItem(
                    `commited-${i}`,
                    basename,
                    todaysChangeSummary.insertions,
                    todaysChangeSummary.deletions,
                    todaysChangeSummary.commitCount,
                    todaysChangeSummary.fileCount
                );
                committedChangesDirNodes.push(committedChangesNodeHtml);
            }
            const openChangesNodeHtml = this.buildMetricNodeItem(
                'open-changes',
                'Open changes',
                openChangesDirNodes
            );
            const committedChangesNodeHtml = this.buildMetricNodeItem(
                'commited-changes',
                'Committed today',
                committedChangesDirNodes
            );
            commitTreeNodes.push(openChangesNodeHtml);
            commitTreeNodes.push(committedChangesNodeHtml);
        }

        // build the editor time li
        return `${commitTreeNodes.join('\n')}`;
    }

    buildTopFileNodes(fileChangeInfoMap) {
        const topFileTreeNodes = [];

        const filesChanged = fileChangeInfoMap
            ? Object.keys(fileChangeInfoMap).length
            : 0;

        if (filesChanged > 0) {
            topFileTreeNodes.push(
                this.buildSingleNodeLiItem(
                    'files-changed',
                    'Files changed today',
                    `Today: ${filesChanged}`
                )
            );
        }

        return topFileTreeNodes;
    }

    buildSingleNodeLiItem(id, label, value) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today">${value}</a></li>
                </ul>
            </li>`;
    }

    buildSingleValueLiItem(id, value, fileName) {
        return `<li><a href="#" id="${id}-view-file" class="view-file" data-file="${fileName}">${value}</a></li>`;
    }

    buildCodeTimeMetricsLiItem(
        id,
        label,
        todayValue,
        avgValue = null,
        globalAvgValue = null,
        boltIcon = null
    ) {
        const checkedProp = this.getCheckedPropertyForId(id);
        const dayStr = moment().format('ddd');
        if (avgValue && globalAvgValue) {
            boltIcon = boltIcon ? boltIcon : 'bolt-grey';
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                        <li>
                            <a href="#" id="${id}-avg" class="${boltIcon}">Your average (${dayStr}): ${avgValue}</a>
                        </li>
                        <li>
                            <a href="#" id="${id}-global" class="global-grey-icon">Global average (${dayStr}): ${globalAvgValue}</a>
                        </li>
                    </ul>
                </li>`;
        }

        return `
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    <li><a href="#" id="${id}-today" class="rocket-icon">Today: ${todayValue}</a></li>
                </ul>
            </li>`;
    }

    buildOpenChangesDirNodeItem(
        id,
        label,
        insertions,
        deletions,
        commitCount = null,
        fileCount = null
    ) {
        const checkedProp = this.getCheckedPropertyForId(id);
        if (commitCount === null) {
            return `
                <li>
                    <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                    <label for="${id}">${label}</label>
                    <ul>
                        <li><a href="#" id="${id}-insertions" class="insertion-icon">Insertion(s): ${insertions}</a></li>
                        <li>
                            <a href="#" id="${id}-deletions" class="deletion-icon">Deletion(s): ${deletions}</a>
                        </li>
                    </ul>
                </li>`;
        } else {
            return `
                    <li>
                        <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                        <label for="${id}">${label}</label>
                        <ul>
                            <li><a href="#" id="${id}-insertions" class="insertion-icon">Insertion(s): ${insertions}</a></li>
                            <li>
                                <a href="#" id="${id}-deletions" class="deletion-icon">Deletion(s): ${deletions}</a>
                            </li>
                            <li><a href="#" id="${id}-commit-count" class="commit-icon">Commit(s): ${commitCount}</a></li>
                            <li>
                                <a href="#" id="${id}-file-count" class="files-icon">Files changed: ${fileCount}</a>
                            </li>
                        </ul>
                    </li>`;
        }
    }

    buildMetricNodeItem(id, label, nodes) {
        const checkedProp = this.getCheckedPropertyForId(id);
        return `
        <ul>
            <li>
                <input type="checkbox" id="${id}" value="${label}"${checkedProp}/>
                <label for="${id}">${label}</label>
                <ul>
                    ${nodes.join('\n')}
                </ul>
            </li>
        </ul>`;
    }

    getCheckedPropertyForId(id) {
        if (checkedMap[id]) {
            return checkedMap[id] === true ? ' checked' : '';
        }
        return '';
    }

    serialize() {}

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Code Time';
    }

    topFilesMetricNode(fileChangeInfos, name, sortBy, id) {
        if (!fileChangeInfos || fileChangeInfos.length === 0) {
            return null;
        }
        // Highest KPM
        let sortedArray = [];
        if (sortBy === 'kpm') {
            sortedArray = fileChangeInfos.sort((a, b) => b.kpm - a.kpm);
        } else if (sortBy === 'keystrokes') {
            sortedArray = fileChangeInfos.sort(
                (a, b) => b.keystrokes - a.keystrokes
            );
        } else if (sortBy === 'codetime') {
            // duration_seconds
            sortedArray = fileChangeInfos.sort(
                (a, b) => b.duration_seconds - a.duration_seconds
            );
        }
        const childrenNodes = [];
        const len = Math.min(3, sortedArray.length);
        for (let i = 0; i < len; i++) {
            const sortedObj = sortedArray[i];
            const fileName = sortedObj.name;
            let val = 0;
            if (sortBy === 'kpm') {
                const kpmVal = sortedObj.kpm || 0;
                val = numeral(kpmVal).format('0 a');
            } else if (sortBy === 'keystrokes') {
                const keystrokesVal = sortedObj.kpm || 0;
                val = numeral(keystrokesVal).format('0 a');
            } else if (sortBy === 'codetime') {
                const durSecondsVal = sortedObj.duration_seconds || 0;
                val = utilMgr.humanizeMinutes(durSecondsVal);
            }
            const fsPath = sortedObj.fsPath;
            const label = `${fileName} | ${val}`;

            const valueItem = this.buildSingleValueLiItem(
                sortBy,
                label,
                fsPath
            );
            childrenNodes.push(valueItem);
        }
        const parentMetricsNode = this.buildMetricNodeItem(
            id,
            name,
            childrenNodes
        );

        return parentMetricsNode;
    }
}

$(document).on('click', '#advanced-metrics', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:web-dashboard'
    );
});

$(document).on('click', '#generate-dashboard', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:dashboard'
    );
});

$(document).on('click', '#toggle-status-metrics', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:toggle-status-bar-metrics'
    );
});

$(document).on('click', '#submit-feedback', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:submit-feedback'
    );
});

$(document).on('click', '#learn-more', async () => {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:learn-more'
    );
});

$(document).on('click', '.view-file', async el => {
    const val = $(`#${el.currentTarget.id}`).attr('data-file');
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Code-Time:open-file',
        val
    );
});

$(document).on('click', 'input[type=checkbox]', async el => {
    if (!el.currentTarget) {
        return;
    }

    const checked =
        el.currentTarget.checked !== null &&
        el.currentTarget.checked !== undefined
            ? el.currentTarget.checked
            : false;
    if (checked) {
        // create the code time event
        let label = el.currentTarget.value;
        label = label ? label.replace(/\s/g, '') : label;
        eventMgr.createCodeTimeEvent(
            'mouse',
            'click',
            `TreeViewItemExpand_${label}`
        );
    }
    checkedMap[el.currentTarget.id] = checked;
});
