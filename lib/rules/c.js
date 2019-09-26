/** @babel */

export default {
  toggles: [
    ['single.quote', 'double.quote'],
  ],
  rules: [{
    name: "single.quote",
    scope: "string.quoted.single",
    wrap: text => text.validate(/^[^\n]{1,3}$/).escape('\'').surround('\'', '\''),
    unwrap: text => text.trim('\'', '\'').unEscape('\'')
  }]
}
