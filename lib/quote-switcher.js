/** @babel */
/* global atom console require */

import { Range, CompositeDisposable } from 'atom'
import { T } from './text'
import RuleSet from './rule-set'

const TOGGLE = 0
const CYCLE = 1
const HIGHLIGHT = 2

export class QuoteSwitcher {
  static languageGeneric = [{
    name: 'double.quote',
    scope: /^"((?:\\{2})*|(?:[^\n]*?[^\\](?:\\{2})*))"$/,
    adjust: {column: 1},
    wrap: text => text.escape('\"').surround('\"'),
    unwrap: text => text.trim('\"').unEscape('\"'),
  },{
    name: 'single.quote',
    scope: /^'((?:\\{2})*|(?:[^\n]*?[^\\](?:\\{2})*))'$/,
    adjust: {column: 1},
    wrap: text => text.escape('\'').surround('\''),
    unwrap: text => text.trim('\'').unEscape('\''),
  }]

  ruleCache = {}

  constructor (config) {
    this.debug = false
    this.subscriptions = new CompositeDisposable()
    this.editor = null
    this.config = config || {}

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

  setGrammarRules (language) {
    const set = new RuleSet(this.debug)

    const mergeRules = (extended) => {
      for (const rule of extended) {
        set.add(rule)
      }
    }

    let langToggles = this.config[Object.keys(this.config)
      .find(k => k.toLowerCase() === language.toLowerCase())
    ];

    try {
      const languageRules = require(`./rules/${language.replace(/ /g, '-').toLowerCase()}`)
      if (languageRules) {
        this.log(`Loading language rules for "${language}"`)
        mergeRules(languageRules.rules)
        if (!langToggles)
          langToggles = languageRules.toggles
      } else {
        this.log(`Language rules for "${language}" are not available!`)
      }
    } catch (_) {
      this.log(`Error while loading language rules for "${language}"!`)
    }

    mergeRules(QuoteSwitcher.languageGeneric)

    if (langToggles) {
      this.log(`adding toggle rules for "${language}"`)
      for (rules of langToggles)
        set.addToggle(rules)
    } else {
      set.addToggle(['single.quote', 'double.quote'])
    }

    this.ruleCache[language] = set
    this.log(set)
  }

  getGrammarRules (language) {
    if (!language && this.editor)
      language = this.editor.getGrammar().name

    if (!this.ruleCache[language])
      this.setGrammarRules(language)

    return this.ruleCache[language]
  }

  toggle () {
    // Switch between single and double quotes
    if (this.editor) {
      this.rotateSelections(TOGGLE)
    }
  }

  cycle () {
    // Cycle through each quote available to the language
    if (this.editor) {
      this.rotateSelections(CYCLE)
    }
  }

  highlight () {
    if (this.editor) {
      this.rotateSelections(HIGHLIGHT)
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
    let begin = null
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
      this.log('The editor contents appears to be malformed!', _)
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

  mutateRange (range, text, cursor) {
    let cursorPosition = cursor && cursor.getBufferPosition()
    const newRange = this.editor.setTextInBufferRange(range, text.toString())

    if (cursorPosition) {
      if (cursorPosition.isGreaterThanOrEqual(range.start)) {
        let newCursorPosition = text.getCursorOffset(range.start)
        cursor.setBufferPosition(newCursorPosition, {autoscroll: false})
      }
    }

    return newRange
  }

  rotatePoint (method, cursor) {
    const rules = this.getGrammarRules()
    const point = cursor.getBufferPosition()
    const range = this.editor.bufferRangeForScopeAtPosition(".string", point)
    const mutated = this.convertToRawText(point, range)

    if (mutated) {
      switch (method) {
        case HIGHLIGHT:
          this.highlightRange(mutated.range)
          break;

        case TOGGLE:
          if (!rules.nextToggle(mutated.rules))
            mutated.rules = [rules.get('double.quote')]
          this.applyWrapRules(mutated, cursor)
          break

        case CYCLE:
        default:
          let sanity = 10
          do {
            this.log('pre-rotation', RuleSet.getName(mutated.rules))
            rules.nextRotation(mutated.rules)
            this.log('post-rotation', RuleSet.getName(mutated.rules))
            sanity--
          } while (sanity && !this.applyWrapRules(mutated, cursor));
          break
      }
    } else {
      this.log('failed to convert to raw')
    }
  }

  rotateRange (method, selection) {
    let {start, end} = selection.getBufferRange()
    const cursorPoint = selection.cursor.getBufferPosition()
    const rules = this.getGrammarRules()
    const checkpoint = this.editor.createCheckpoint()

    const mutated = this.convertToRawText(start)
    if (!mutated || !mutated.range.containsRange([start, end])) {
      this.log('The selection extends the outer string')
      return
    }

    // Rotate to either next or first embeddable rule, and apply to editor
    rules.nextInterpolation(mutated.rules)
    const embedRules = mutated.rules[0].embeds
    const newRange = this.applyWrapRules(mutated, selection.cursor)

    if (!newRange) {
      this.editor.revertToCheckpoint(checkpoint)
      return
    }

    // Try matching one of the embed rule
    let found = null
    for (let index = 0; index < embedRules.length; index++) {
      let unwrapRule = rules.get(embedRules[index])

      this.editor.scanInBufferRange(unwrapRule.scope, newRange, (iter) => {
        if (iter.range.containsRange([start, end])) {
          found = {
            range: iter.range,
            unwrapRule,
            text: unwrapRule.unwrap(T(iter.matchText, this.offsetPoint(cursorPoint, iter.range)))
          }
          iter.stop()
        }
      })

      if (found) {
        if (index + 1 === embedRules.length)
          index = 0
        found.wrapRule = rules.get(embedRules[index])
        found.text = found.wrapRule.wrap(found.text)

        break
      }
    }

    // Apply the embed rule
    if (found && this.mutateRange(found.range, found.text, selection.cursor)) {
      this.editor.groupChangesSinceCheckpoint(checkpoint)
    } else {
      this.editor.revertToCheckpoint(checkpoint)
    }
  }

  rotateSelections (method) {
    const selections = this.editor.getSelectionsOrderedByBufferPosition()

    if (this.debug) {
      this.layer.clear()
      this.markers = []
    }

    for (let c = selections.length - 1; c >= 0; --c) {
      const selected = selections[c].getBufferRange()

      if (method === TOGGLE || method === CYCLE || selected.start.isEqual(selected.end)) {
        this.rotatePoint(method, selections[c].cursor)
      } else {
        this.rotateRange(method, selections[c])
      }
    }
  }

  applyUnwrapRules (rule, text, result) {
    let unwrapped = rule.unwrap(text)
    this.log('applied unwrap', RuleSet.getName(rule), text.toString())

    if (unwrapped.isValid()) {
      // this.log(`rule ${rule.name} matched`, unwrapped.value)
      if (rule.contains) {
        for (let contained of rule.contains) {
          if (this.applyUnwrapRules(this.getGrammarRules().get(contained), unwrapped.copy(), result)) {
            result.rules.unshift(rule)
            return true
          }
        }
        return false
      } else {
        result.rules.unshift(rule)
        result.text = unwrapped
        return true
      }
    } else {
      // this.log(`rule ${rule.name} failed`)
    }

    return false
  }

  applyWrapRules (mutated, cursor) {
    let text = mutated.text.copy()

    for (let i = mutated.rules.length - 1; i >= 0; i--) {
      const rule = mutated.rules[i]
      text = rule.wrap(text)
      this.log('applied wrap', RuleSet.getName(rule), text.toString())
    }

    if (text.isValid()) {
      return this.mutateRange(mutated.range, text, cursor)
    } else {
      this.log('failed to wrap: mutated text is invalid')
    }
  }

  offsetPoint (point, range) {
    point = point.copy()

    if (range.containsPoint(point)) {
      if (point.row === range.start.row) {
        point.column -= range.start.column
        point.row = 0
      } else {
        point.row -= range.start.row

      }
    }

    return point
  }

  convertToRawText (point) {
    const rules = this.getGrammarRules()
    const scopes = this.editor.scopeDescriptorForBufferPosition(point).scopes
    let range = null

    if (this.scopesIntersect('string', scopes)) {
      const cache = {}

      for (let rule of rules.allRotatables()) {
        const scope = rule.scope.toString()
        this.log('testing scope', scope)

        if (!(scope in cache)) {
          if (typeof rule.scope === 'string') {
            if (this.scopesIntersect(rule.scope, scopes)) {
              if (range = this.expandRange(rule.scope, point)) {
                if (rule.expandRange)
                  rule.expandRange(range)

                cache[scope] = {
                  range,
                  text: T(this.editor.getTextInBufferRange(range), this.offsetPoint(point, range))
                }
              }
            }
          } else if (range = this.expandRange("string", point)) {
            if (rule.expandRange)
              rule.expandRange(range)

            const text = T(this.editor.getTextInBufferRange(range), this.offsetPoint(point, range))

            rule.scope.lastIndex = 0;
            if (rule.scope.test(text.toString())) {
              cache[scope] = {range, text}
            }
          }
        }

        if (!(scope in cache)) {
          continue
        }

        const mutated = {
          range: cache[scope].range,
          rules: [],
        }

        if (this.applyUnwrapRules(rule, cache[scope].text.copy(), mutated)) {
          return mutated
        }
      }
    } else {
      this.log("point is not in a string")
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
