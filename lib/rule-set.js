/** @babel */

export default class RuleSet
{
  constructor () {
    this.scopes = []
    this.rotatables = []
    this.toggleables = []
    this.embeddables = []
    this.rules = {}
  }

  rotate (rule, filter) {
    const scopes = this.filterScopes(filter)
    const search = rule.scope.toString()
    let index = -1 //scopes.indexOf(rule.scope)

    for (let i = 0; i < scopes.length; ++i) {
      if (scopes[i].toString() === search) {
        index = i
        break
      }
    }

    if (-1 === index) {
      index = 0
    } else {
      index += 1
      if (index >= scopes.length) {
        index = 0
      }
    }

    if (scopes[index]) {
      return this.rules[scopes[index].toString()]
    }
  }

  get (selector) {
    return this.rules[selector.toString()]
  }

  add (rule, canToggle) {
    const selector = rule.scope.toString()

    if (selector && -1 === this.search(this.scopes, selector)) {
      this.scopes.push(selector)
      this.rules[selector] = rule

      if (!rule.embedded) {
        this.rotatables.push(selector)
        if (canToggle) {
          this.toggleables.push(selector)
        }
      }

      if (rule.embeds) {
        this.embeddables.push(selector)
      }
    }
  }

  filterScopes (filter) {
    if (Array.isArray(filter)) {
      return filter
    }

    switch (filter) {
      case 'toggleables':
      case 'toggle':
        return this.toggleables
      case 'rotatables':
      case 'rotate':
        return this.rotatables
      case 'embeddables':
      case 'embeds':
        return this.embeddables
      default:
        return this.scopes
    }
  }

  search (subset, selector) {
    for (let index = 0; index < subset.length; ++index) {
      if (selector === subset[index].substr(0, selector.length)) {
        return index
      }
    }
    return -1
  }
}
