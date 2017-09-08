/** @babel */
/* global atom console */

import { Range, CompositeDisposable } from 'atom'

export default class QuoteSwitcher {
  static languageRules = {
    PHP: [{
      scope: "string.unquoted.heredoc.php",
      adjust: {row: 1},
      apply: text => `<<<END\n${text}\nEND`,
      remove: text => text.match(/<<<\s*("?)([a-z_\x7f-\xff][a-z0-9_\x7f-\xff]*)(\1)\s*\n\r?((?:[\s\S]*)?)\n\r?\2/i)[4]
    },{
      scope: "string.unquoted.nowdoc.php",
      adjust: {row: 1},
      apply: text => `<<<'END'\n${text}\nEND`,
      remove: text => text.match(/<<<\s*'([a-zA-Z_]+[a-zA-Z0-9_]*)'\s*\n\r?((?:[\s\S]*)?)\n\r?\1/)[2]
    }]
  }

  static languageGeneric = [{
    scope: "string.quoted.double",
    adjust: {column: 1},
    apply: text => `"${text}"`,
    remove: text => text.slice(1, -1)
  },{
    scope: "string.quoted.single",
    adjust: {column: 1},
    apply: text => `'${text}'`,
    remove: text => text.slice(1, -1)
  },{
    scope: "string.quoted.template",
    adjust: {column: 1},
    apply: text => `\`${text}\``,
    remove: text => text.slice(1, -1)
  }]

  static toggleScopes = [
    "string.quoted.double",
    "string.quoted.single",
    "string.quoted.template",
  ]

  ruleCache = {}
  toggleCache = {}

  constructor () {
    this.subscriptions = new CompositeDisposable()
    this.editor = null

    this.subscriptions.add(atom.workspace.getCenter().observeActivePaneItem(paneItem => {
      this.editor = null
      if (paneItem && paneItem.getBuffer())
        this.editor = paneItem
    }))
  }

  destroy () {
    this.subscriptions.dispose()
    this.editor = null
  }

  setGrammarRules (language, rules) {
    /*
    * Language specific settings extend the default scopes. For example the default
    * double quoted string scope would be 'string.quoted.double', the php language
    * can override this by specifying 'string.quoted.double.php'.
    */
    this.ruleCache[language] = rules || []
    this.toggleCache[language] = []

    const scopes = []
    for (const rule in this.ruleCache[language]) {
      scopes.push(rule.scope)
    }

    const mergeRules = (extended) => {
      for (const rule of extended) {
        if (!this.scopesIntersect(rule.scope, scopes)) {
          this.ruleCache[language].push(rule)
          scopes.push(rule.scope)
        }
      }
    }

    if (QuoteSwitcher.languageRules[language])
      mergeRules(QuoteSwitcher.languageRules[language])

    mergeRules(QuoteSwitcher.languageGeneric)

    for (const rule of this.ruleCache[language]) {
      if (-1 !== QuoteSwitcher.toggleScopes.indexOf(rule.scope))
        this.toggleCache[language].push(rule)
    }
  }

  getGrammarRules (language) {
    if (!this.ruleCache[language])
      this.setGrammarRules(language)

    return this.ruleCache[language]
  }

  getToggleRules (language) {
    if (!this.toggleCache[language])
      this.setGrammarRules(language)

    return this.toggleCache[language]
  }

  toggle () {
    // Switch between single and double quotes
    if (this.editor) {
      const rules = this.getToggleRules(this.editor.getGrammar().name)
      if (rules)
        this.rotateSelections(rules)
    }
  }

  cycle () {
    // Cycle through each quote available to the language
    if (this.editor) {
      const rules = this.getGrammarRules(this.editor.getGrammar().name)
      if (rules)
        this.rotateSelections(rules)
    }
  }

  logScopes () {
    if (this.editor) {
      const cursor = this.editor.getCursorBufferPosition()
      console.log(`Grammar: ${this.editor.getGrammar().name}`)
      console.log(`Scopes: ${this.editor.scopeDescriptorForBufferPosition(cursor).scopes.join(' ')}`)
    }
  }

  // Private methods

  findScopeBegin (selector, point) {
    let begin = null //point.copy()
    let range = this.editor.bufferRangeForScopeAtPosition(selector, point)

    while (range) {
      let iter = range.start.copy()
      begin = iter.copy()

      if (0 < iter.column) {
        iter.column -= 1
      } else if (0 < iter.row) {
        iter.row -= 1
        iter.column = this.editor.lineTextForBufferRow(iter.row).length
      } else {
        break
      }

      range = this.editor.bufferRangeForScopeAtPosition(selector, iter)
    }

    return begin
  }

  findScopeEnd (selector, point) {
    const numRows = this.editor.getLineCount()
    let range = this.editor.bufferRangeForScopeAtPosition(selector, point)
    let line = this.editor.lineTextForBufferRow(point.row)
    let end = point.copy()

    while (range) {
      let iter = range.end.copy()
      end = iter.copy()

      if (iter.column < line.length) {
        iter.column += 1
      } else if (iter.row < numRows) {
        iter.row += 1
        iter.column = 0
        line = this.editor.lineTextForBufferRow(iter.row)
      } else {
        break
      }

      range = this.editor.bufferRangeForScopeAtPosition(selector, iter)
    }

    return end
  }

  expandRange (selector, point) {
    const start = this.findScopeBegin(selector, point)
    const end = this.findScopeEnd(selector, point)

    if (start && end)
      return new Range(start, end)
  }

  scopesIntersect (selector, scopes) {
    if (scopes && scopes.length) {
      for (const scope of scopes) {
        if (0 === scope.indexOf(selector))
        return true
      }
    }
    return false
  }

  changeScope (range, cursor, oldRule, newRule) {
    let point = cursor.copy()
    let text = this.editor.getTextInBufferRange(range)

    if (oldRule.adjust) {
      if (oldRule.adjust.column) {
        point.column -= oldRule.adjust.column
      }
      if (oldRule.adjust.row) {
        point.row -= oldRule.adjust.row
        if (point.row === range.start.row) {
          point.column += range.start.column
        }
      }
    }

    if (newRule.adjust) {
      if (newRule.adjust.column) {
        point.column += newRule.adjust.column
      }
      if (newRule.adjust.row) {
        if (point.row === range.start.row) {
          point.column -= range.start.column
        }
        point.row += newRule.adjust.row
      }
    }

    text = oldRule.remove(text)
    if (text) {
      text = newRule.apply(text)
      if (text) {
        this.editor.setTextInBufferRange(range, text)
        return point
      }
    }
  }

  rotateSelections (rules) {
    const cursors = this.editor.getCursorsOrderedByBufferPosition()

    for (let c = cursors.length - 1; c >= 0; --c) {
      const cursor = cursors[c]
      const point = cursor.getBufferPosition()

      /*
       * There is a disparity between `scopeDescriptorForBufferPosition` and `bufferRangeForScopeAtPosition`,
       * When the cursor is placed directly before an opening quote `scopeDescriptorForBufferPosition`, will
       * list the 'string.xxx' scope, but `bufferRangeForScopeAtPosition` will return null. Likewise, if the
       * cursor is positioned after the closing quote, a sting scope will not be available but a range will.
       */
      const range = this.editor.bufferRangeForScopeAtPosition(".string", point)
      const scopes = this.editor.scopeDescriptorForBufferPosition(point).scopes;

      if (range && this.scopesIntersect('string', scopes)) {
        for (let index = 0; index < rules.length; ++index) {
          const rule = rules[index]
          if (this.scopesIntersect(rule.scope, scopes)) {
            const range = this.expandRange(rule.scope, point)
            let nextIndex = index + 1
            if (nextIndex >= rules.length)
              nextIndex = 0

            const movedCursorPoint = this.changeScope(range, point, rule, rules[nextIndex])
            if (movedCursorPoint) {
              cursor.setBufferPosition(movedCursorPoint, {
                autoscroll: false
              })
            }

            break
          }
        }
      } else {
        // console.log(`Scopes `, this.editor.scopeDescriptorForBufferPosition(point).scopes)
        // When the cursor is outside a string we can try interpolating. This will only work if we can find
        // the opening and closing tags of the same rule on both sides of the cursor.

      }
    }
  }
}
