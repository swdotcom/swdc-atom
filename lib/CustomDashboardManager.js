'use babel';

import { TextEditor } from 'atom';
const { exec } = require('child_process');

export default class CustomDashboardManager {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('test-atom2');

    this.miniEditor = new TextEditor({ mini: true });
    this.miniEditor.setPlaceholderText('Enter a date range:');

    this.element.appendChild(this.miniEditor.element);

    this.panel = atom.workspace.addBottomPanel({
      item: this,
      visible: false
    });

    atom.commands.add(this.miniEditor.element, 'core:confirm', () => {
        this.confirm();
    });
    atom.commands.add(this.miniEditor.element, 'core:cancel', () => {
        this.close();
    });

  }

  close() {
    if (!this.panel.isVisible()) return;
    this.miniEditor.setText('');
    this.panel.hide();
  }

  confirm() {
    const text = this.miniEditor.getText();
    console.log(text);
    this.close();
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

}
