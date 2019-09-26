/** @babel */

const expandRange = (range) => {
  if (range.start.column > 0)
    range.start.column -= 1
  return range
}

export default {
  toggles: [
    ['single.quote', 'double.quote'],
  ],
  rules: [{
    name: "single.quote",
    scope: "string.quoted.single",
    wrap: text => text.validate(/^[^\n]{1,3}$/).escape('\'').surround('\'', '\''),
    unwrap: text => text.trim('\'', '\'').unEscape('\'')
  },{
    name: "unicode",
    scope: "string.quoted.double",
    contains: ["double.quote"],
    expandRange,
    wrap: text => text.surround('L', ''),
    unwrap: text => text.trim('L', '', false),
  },{
    name: "raw",
    scope: "string.quoted.double",
    contains: ["double.quote"],
    expandRange,
    wrap: text => text.surround('R', ''),
    unwrap: text => text.trim('R', '', false),
  }]
}
