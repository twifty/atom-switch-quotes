/** @babel */

export default class RuleSet
{
  constructor () {
    this.collection = []
    this.rotatables = []
    this.toggleables = []
    this.embeddables = []
    this.rules = {}
  }

  rotate (rules, method) {
    const filter = this.filterScopes(method)
    let rule = rules.pop()
    let next = null

    if (filter === this.embeddables) {
      let index = filter.indexOf(rule)
      if (index < 0 || index + 1 === filter.length)
        index = 0

      rules.splice(0, rules.length)
      next = filter[index]
    }

    while (rules.length) {
      let parent = rules[rules.length - 1]

      if (parent) {
        let index = parent.contains.indexOf(rule.name)
        if (index + 1 == parent.contains.length) {
          rule = rules.pop()
        } else {
          next = this.get(parent.contains[index + 1])
          break
        }
      }
    }

    if (!next) {
      let index = filter.indexOf(rule) + 1
      if (index === filter.length)
        index = 0
      next = filter[index]
    }

    while (next.contains) {
      rules.push(next)
      next = this.get(next.contains[0])
    }

    rules.push(next)
  }

  get (selector) {
    return this.rules[selector.toString()]
  }

  add (rule) {
    const selector = rule.name || rule.scope.toString()

    if (!(selector in this.rules)) {
      this.collection.push(rule)
      this.rules[selector] = rule

      if (!rule.embedded) {
        this.rotatables.push(rule)
      }

      if (rule.embeds) {
        this.embeddables.push(rule)
      }

      if (rule.toggle) {
        this.toggleables.push(rule)
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
      case 'all':
      default:
        return this.collection
    }
  }
}
