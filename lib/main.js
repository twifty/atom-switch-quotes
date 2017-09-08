/** @babel */
/* global atom */

import { CompositeDisposable } from 'atom';
import QuoteSwitcher from './quote-switcher'

export default {
  subscriptions: null,
  switcher: null,

  activate () {
    this.switcher = new QuoteSwitcher()
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'switch-quotes:toggle': () => this.switcher.toggle(),
      'switch-quotes:cycle': () => this.switcher.cycle(),
      'switch-quotes:scopes': () => this.switcher.logScopes()
    }));
  },

  deactivate () {
    this.switcher.destroy()
    this.subscriptions.dispose();
  },
};
