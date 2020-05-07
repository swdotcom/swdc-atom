'use babel';

const $ = require('jquery');

let isReady = false;

export default class KpmStatusView {
    constructor() {
        var that = this;

        this.element = document.createElement('div');
        this.element.classList.add('msg-status');
        this.element.classList.add('inline-block');
        this.element.setAttribute('id', 'code-time-status');

        $(document).ready(function () {
            isReady = true;
            $(document).on('click', '#code-time-href', async function () {
                atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'Code-Time:open-code-time-metrics'
                );
            });
        });
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    /**
     * Display the message in the status bar.
     * Will show the paw if the rocket isn't provided or it's not toggled off
     **/
    display(msg, icon, userName = null) {
        let tooltip =
            'Active code time today vs. your daily average. Click to see more from Code Time';

        if (userName) {
            tooltip += '. Logged in as ' + userName;
        }

        const iconClass = icon ? 'icon icon-' + icon : 'paw-icon-grey';

        if (msg) {
            this.element.innerHTML = `<span id='code-time-href' class="${iconClass}"
                style="cursor: pointer;" title="${tooltip}">${msg}</span>`;
        } else {
            this.element.innerHTML = `<span id='code-time-href' class="${iconClass}"
                style="cursor: pointer;" title="${tooltip}"></span>`;
        }

        let footerBars = atom.workspace.getFooterPanels();
        if (footerBars && footerBars.length > 0) {
            footerBars[0].getItem().leftPanel.appendChild(this.element);
        }
    }
}
