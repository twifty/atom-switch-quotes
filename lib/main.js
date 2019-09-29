/** @babel */
/* global atom */

import path from 'path'
import CSON from 'season'
import { CompositeDisposable } from 'atom';
import { QuoteSwitcher } from './quote-switcher'

export default {
  subscriptions: null,
  switcher: null,

  activate () {
    const configBase = path.join(atom.config.getUserConfigPath(), '..', 'switch-quotes')
    let config = null

    for (let ext of ['.json', '.cson']) {
      try {
        config = CSON.readFileSync(configBase + ext)
        if (config)
          break
      } catch (_) {

      }
    }

    this.switcher = new QuoteSwitcher(config)
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'switch-quotes:toggle': () => this.switcher.toggle(),
      'switch-quotes:cycle': () => this.switcher.cycle(),
      'switch-quotes:scopes': () => this.switcher.logScopes(),
      'switch-quotes:highlight': () => this.switcher.highlight()
    }));
  },

  deactivate () {
    this.switcher.destroy()
    this.subscriptions.dispose();
  },
};
