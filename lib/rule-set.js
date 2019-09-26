/** @babel */

export default class RuleSet
{
  constructor () {
    this.collection = []
    this.rotatables = []
    this.toggleables = {}
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

      if (parent.contains) {
        let index = parent.contains.indexOf(rule.name)
        if (index + 1 == parent.contains.length) {
          rule = rules.pop()
        } else {
          next = this.get(parent.contains[index + 1])
          break
        }
      } else {
        break
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
    }
  }

  nextToggle (rules) {
    let name = []

    for (let rule of rules) {
      name.push(rule.name || rule.scope.toString())
    }

    name = name.join('/')

    if (!(name in this.toggleables)) {
      console.log(`rule ${name} is not toggleable`)
      console.log(this.toggleables)
      return false
    }

    let next = this.toggleables[this.toggleables[name].next].rules
    rules.splice(0, rules.length, ...next)

    return true
  }

  addToggle (rules) {
    let toggles = {}

    if (rules.length < 2) {
      console.log(`Toggles require 2 or more rules, got ${rules.length}`)
      return
    }

    for (let toggle_name of rules) {
      if (toggle_name in this.toggleables || toggle_name in toggles) {
        console.log(`rule "${toggle_name}" is already associated with a toggle`)
        return
      }

      let toggle = {
        rules: []
      }

      for (let name of toggle_name.split('/')) {
        let parent = null
        let child = this.get(name)

        if (!child) {
          console.log(`rule "${name}" not found`)
          return
        }

        if (parent) {
          if (!(parent.contains && -1 !== parent.contains.indexOf(name))) {
            console.log(`${parent.name || parent.scope.toString()} doesn't contain ${name}`)
            return
          }
        }

        toggle.rules.push(child)
        parent = child
      }

      toggles[toggle_name] = toggle
    }

    // Loop again, this time add and link toggles
    let next_name = rules[0]
    for (let toggle_name of rules.reverse()) {
      toggles[toggle_name].next = next_name
      this.toggleables[toggle_name] = toggles[toggle_name]

      next_name = toggle_name
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
