/** @babel */

export default class RuleSet
{
  constructor (debug) {
    this.rotatables = []
    this.interpolations = []
    this.toggleables = {}
    this.rules = {}
    this.debug = debug
  }

  nextRotation (rules) {
    let child = rules.pop()

    // Keep removing rules from the end until contains cannot be rotated
    while (rules.length) {
      let parent = rules[rules.length - 1]

      if (parent.contains) {
        let name = child.name || child.scope.toString()
        let index = parent.contains.indexOf(name)
        if (index + 1 !== parent.contains.length) {
          // Add the next rule
          this.log('adding next contained rule')
          rules.push(this.get(parent.contains[index + 1]))
          break
        } else {
          // Remove the parent
          this.log('contained rules complete, removing parent')
          child = rules.pop()
        }
      } else {
        break
      }
    }

    // Add the next rule from global list
    if (0 === rules.length) {
      let index = this.rotatables.indexOf(child)
      rules.push(this.rotatables[index + 1] || this.rotatables[0])
      this.log('adding next global: ', rules[rules.length - 1].name)
    }

    // Append the first contained rules
    while (rules[rules.length - 1].contains) {
      child = this.get(rules[rules.length - 1].contains[0])
      this.log('adding contained: ', child.name)
      rules.push(child)
    }
  }

  nextInterpolation (rules) {
    let rule = rules[0]
    let index = this.interpolations.indexOf(rule)

    if (index + 1 === this.interpolations.length)
      index = -1

    rule = this.interpolations[index + 1]
    rules.splice(0, rules.length, rule)

    // Append the first contained rules
    while (rules[rules.length - 1].contains) {
      const child = this.get(rules[rules.length - 1].contains[0])
      this.log('adding contained: ', child.name)
      rules.push(child)
    }
  }

  get (selector) {
    return this.rules[selector.toString()]
  }

  add (rule) {
    const selector = rule.name || rule.scope.toString()

    if (!(selector in this.rules)) {
      this.rules[selector] = rule

      if (!rule.embedded) {
        this.rotatables.push(rule)
      }

      if (rule.embeds) {
        this.interpolations.push(rule)
      }
    }
  }

  allRotatables () {
    return this.rotatables
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

  static getName (rules) {
    let names = []

    if (!Array.isArray(rules))
      rules = [rules]

    for (rule of rules)
      names.push(rule.name || rule.scope.toString())

    return names.join('/')
  }

  log (...args) {
    if (this.debug)
      console.log(...args)
  }
}
