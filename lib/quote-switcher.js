/** @babel */
/* global atom console require */

import { Range, CompositeDisposable } from 'atom'
import { T } from './text'
import RuleSet from './rule-set'

export class QuoteSwitcher {
  static languageGeneric = [{
    scope: "string.quoted.double",
    adjust: {column: 1},
    wrap: text => text.escape('\"').surround('\"'),
    unwrap: text => text.trim('\"').unEscape('\"'),
  },{
    scope: "string.quoted.single",
    adjust: {column: 1},
    wrap: text => text.escape('\'').surround('\''),
    unwrap: text => text.trim('\'').unEscape('\''),
  }]

  static toggleScopes = [
    "string.quoted.double",
    "string.quoted.single",
  ]

  ruleCache = {}

  constructor () {
    this.debug = true
    this.subscriptions = new CompositeDisposable()
    this.editor = null

    if (this.debug) {
      this.markers = []
      this.layer = null
      this.decoration = null
    }

    this.subscriptions.add(atom.workspace.getCenter().observeActivePaneItem(paneItem => {
      this.editor = atom.workspace.isTextEditor(paneItem) ? paneItem : null

      if (this.debug && this.editor) {
        this.markers = []
        this.layer = this.editor.addMarkerLayer({maintainHistory: false})
        this.decoration = this.editor.decorateMarkerLayer(this.layer, {type: 'highlight', class: 'find-result'})
      }
    }))
  }

  destroy () {
    this.subscriptions.dispose()
    this.editor = null

    if (this.decoration) {
      this.markers = null
      this.layer.clear()
      this.decoration.destroy()
    }
  }

  setGrammarRules (language, rules) {
    /*
    * Language specific settings extend the default scopes. For example the default
    * double quoted string scope would be 'string.quoted.double', the php language
    * can override this by specifying 'string.quoted.double.php'.
    */
    const set = new RuleSet()

    const canToggle = rule => {
      for (const selector of QuoteSwitcher.toggleScopes) {
        if (typeof rule.scope === 'string' && selector === rule.scope.substr(0, selector.length)) {
          return true
        }
      }
      return false
    }

    const mergeRules = (extended) => {
      for (const rule of extended) {
        set.add(rule, canToggle(rule))
      }
    }

    if (rules) {
      for (const rule of rules) {
        set.add(rule, canToggle(rule))
      }
    }

    try {
      const languageRules = require(`./rules/${language.replace(/ /g, '-').toLowerCase()}`)
      if (languageRules)
        mergeRules(languageRules())
    } catch (_) {
      this.log(`Language rule for "${language}" are not available!`)
    }

    mergeRules(QuoteSwitcher.languageGeneric)

    this.ruleCache[language] = set
  }

  getGrammarRules (language) {
    if (!language && this.editor)
      language = this.editor.getGrammar().name

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
      this.rotateSelections('toggle')
    }
  }

  cycle () {
    // Cycle through each quote available to the language
    if (this.editor) {
      this.rotateSelections('rotate')
    }
  }

  logScopes () {
    if (this.editor) {
      const cursor = this.editor.getCursorBufferPosition()
      const grammar = this.editor.getGrammar()
      console.log(`Grammar: "${grammar.name}", Scopes: ${this.editor.scopeDescriptorForBufferPosition(cursor).scopes.join(' ')}`)
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
    try {
      const start = this.findScopeBegin(selector, point)
      const end = this.findScopeEnd(selector, point)

      if (start && end) {
        return new Range(start, end)
      }
    } catch (_) {
      // Malformed source, especially with unmatched tags, will cause atom
      // to act like a little boy with a dish of broccoli in front of him :/
      this.log('The editor contents appears to be malformed!')
    }
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

  adjustPoint (point, initial, adjust) {
    if (adjust.row) {
      point = point.copy()
      if (point.row === initial.row) {
        point.column -= initial.column
      }
      point.row += adjust.row
      if (point.row === initial.row) {
        point.column += initial.column
      }
    }
    if (adjust.column) {
      point = point.copy()
      point.column += adjust.column
    }
    return point
  }

  unwrapRange (rule, options = {}) {
    let {range, text, adjust = {row: 0, column: 0}} = options

    if (rule.adjust) {
      adjust.column -= rule.adjust.column || 0
      adjust.row -= rule.adjust.row || 0
    }

    if (!text) {
      if (range) {
        text = rule.unwrap(T(this.editor.getTextInBufferRange(range)))
      }
    } else {
      text = rule.unwrap(text)
    }

    return {range, text, adjust}
  }

  wrapRange (rule, options = {}) {
    let {range, text, adjust = {row: 0, column: 0}} = options

    if (rule.adjust) {
      adjust.column += rule.adjust.column || 0
      adjust.row += rule.adjust.row || 0
    }

    if (!text) {
      if (range) {
        text = rule.wrap(T(this.editor.getTextInBufferRange(range)))
      }
    } else {
      text = rule.wrap(text)
    }

    return {range, text, adjust}
  }

  mutateRange (range, {wrapRule, unwrapRule, cursor, selection}) {
    var mutated = null
    const adjust = {row: 0, column: 0}

    if (unwrapRule) {
      mutated = this.unwrapRange(unwrapRule, {range, adjust})
      if (!mutated) {
        this.log(`Failed to unwrap "${unwrapRule.scope.toString()}"`)
      }
    }

    if (wrapRule) {
      mutated = this.wrapRange(wrapRule, mutated || {range, adjust})
      if (!mutated) {
        this.log(`Failed to wrap "${wrapRule.scope.toString()}"`)
      }
    }

    if (mutated) {
      let selectedRange = selection && selection.getBufferRange()
      let cursorPosition = cursor && cursor.getBufferPosition()

      const newRange = this.editor.setTextInBufferRange(range, mutated.text.toString())

      if (selectedRange) {
        if (selectedRange.start.isGreaterThanOrEqual(range.start)) {
          const start = this.adjustPoint(selectedRange.start, range.start, mutated.adjust)
          const end = this.adjustPoint(selectedRange.end, range.start, mutated.adjust)
          selection.setBufferRange([start, end], {autoscroll: false})
        }
      } else if (cursorPosition) {
        if (cursorPosition.isGreaterThanOrEqual(range.start)) {
          cursorPosition = this.adjustPoint(cursorPosition, range.start, mutated.adjust)
          cursor.setBufferPosition(cursorPosition, {autoscroll: false})
        }
      }

      return newRange
    }
  }

  rotatePoint (method, cursor) {
    const rules = this.getGrammarRules()
    const point = cursor.getBufferPosition()

    /*
     * There is a disparity between `scopeDescriptorForBufferPosition` and `bufferRangeForScopeAtPosition`,
     * When the cursor is placed directly before an opening quote `scopeDescriptorForBufferPosition` will
     * list the 'string.xxx' scope, but `bufferRangeForScopeAtPosition` will return null. Likewise, if the
     * cursor is positioned after the closing quote, a string scope will not be available but a range will.
     */
    const range = this.editor.bufferRangeForScopeAtPosition(".string", point)
    const scopes = this.editor.scopeDescriptorForBufferPosition(point).scopes
    if (range && this.scopesIntersect('string', scopes)) {
      const outer = this.findRuleForScope(point, method, range)
      if (outer) {
        const next = rules.rotate(outer.rule, method)
        if (next && next !== outer.rule) {
          this.mutateRange(outer.range, {
            unwrapRule: outer.rule,
            wrapRule: next,
            cursor
          })
        }
      }
    }
  }

  rotateRange (method, selection) {
    let {start, end} = selection.getBufferRange()

    const rules = this.getGrammarRules()
    const outer = this.findRuleForScope(start, 'rotate')

    if (!outer || !outer.range.containsRange([start, end])) {
      console.log(outer)
      this.log('The selection extends the outer string')
      return
    }

    const checkpoint = this.editor.createCheckpoint()
    // let skipUndo = false
    if (!outer.rule.embeds) {
      // Rotate the outer rule to the first embeddable while keeping the selection range
      const embedRule = rules.rotate(outer.rule, 'embeds')
      if (!embedRule) {
        this.log('No embeddable rules exist for the current language')
        return
      }

      const mutatedRange = this.mutateRange(outer.range, {
        unwrapRule: outer.rule,
        wrapRule: embedRule,
        selection
      })
      if (!mutatedRange) {
        return
      }
      outer.rule = embedRule
      outer.range = mutatedRange
      // skipUndo = true
    }

    // Check if selection is already wrapped
    let wrapRule = null
    let unwrapRule = null
    let inner = this.findRuleForScope(start, outer.rule.embeds, outer.range)

    if (inner) {
      // Try rotating the rule
      wrapRule = rules.rotate(inner.rule, outer.rule.embeds)
      if (!wrapRule || wrapRule === inner.rule) {
        this.editor.revertToCheckpoint(checkpoint)
        this.log('Selection is already wrapped')
        return
      }

      unwrapRule = inner.rule
      start = inner.range.start
      end = inner.range.end
    } else {
      // Use the first rule found
      // wrapRule = {rule: rules.get(outer.rule.embeds[0]), range: new Range(start, end)}
      wrapRule = rules.get(outer.rule.embeds[0])
      if (!wrapRule) {
        this.editor.revertToCheckpoint(checkpoint)
        this.log(`An embeddable rule could not be found for the outer "${outer.rule.scope}" rule`)
        return
      }
    }

    const mutatedRange = this.mutateRange(new Range(start, end), {
      wrapRule,
      unwrapRule,
      selection
    })

    if (!mutatedRange) {
      this.editor.revertToCheckpoint(checkpoint)
      this.log(`Failed to wrap the selection`)
      return
    }

    this.editor.groupChangesSinceCheckpoint(checkpoint)
  }

  rotateSelections (method) {
    const selections = this.editor.getSelectionsOrderedByBufferPosition()

    if (this.debug) {
      this.layer.clear()
      this.markers = []
    }

    for (let c = selections.length - 1; c >= 0; --c) {
      const selected = selections[c].getBufferRange()

      if (selected.start.isEqual(selected.end)) {
        this.rotatePoint(method, selections[c].cursor)
      } else {
        this.rotateRange(method, selections[c])
      }
    }
  }

  findRuleForScope (point, selectors, range) {
    const rules = this.getGrammarRules()
    const scopes = this.editor.scopeDescriptorForBufferPosition(point).scopes

    selectors = rules.filterScopes(selectors)

    for (const selector of selectors) {
      if (typeof selector === 'string') {
        if (this.scopesIntersect(selector, scopes)) {
          const expanded = this.expandRange(selector, point)
          const rule = rules.get(selector)
          if (expanded && rule) {
            return {range: expanded, rule}
          }
        }
      } else {
        if (!range) {
          range = new Range([0, 0], point)
        }

        let found = null
        this.editor.backwardsScanInBufferRange(selector, range, (iter) => {
          if (iter.range.containsPoint(point)) {
            found = {range: iter.range}
            iter.stop()
          }
        })

        if (found) {
          found.rule = rules.get(selector)
          if (found.rule) {
            return found
          }
        }
      }
    }
  }

  log (...args) {
    if (this.debug)
      console.log(...args)
  }

  /**
   * Highlights the given range, useful for debugging
   *
   * @param  {[Range]} range The range to highlight
   */
  highlightRange (range) {
    if (this.debug) {
      const marker = this.layer.markBufferRange(range, {invalidate: 'inside'})
      this.markers.push(marker)
    }
  }
}
