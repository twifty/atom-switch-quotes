/** @babel */

// const variable = "(?:[a-zA-Z][\\w.]+)"
// const string = "(?:([\"'])(?:(?=(\\\\?))\\2.)*?\\1)"
// const dictionary = `(?:\\[(?:${variable}|${string})\\])*`
// const call = "(?:\\([^\\)]*\\))?"
// const interpolated = RegExp(`${variable}${dictionary}${call}`)
const interpolated = /(?:[a-zA-Z][\w.]+)(?:\[(?:(?:[a-zA-Z][\w.]+)|(?:(["'])(?:(?=(\\?))\2.)*?\1))\])*(?:\([^\)]*\))?/g

export default function python () {
  return [{
    name: 'single.quote',
    scope: 'string.quoted',
    toggle: true,
    wrap: text => text.escape('\'').surround('\''),
    unwrap: text => text.validate(/^'(?!'')/).trim('\'').unEscape('\''),
  },{
    name: 'double.quote',
    scope: 'string.quoted',
    toggle: true,
    wrap: text => text.escape('\"').surround('\"'),
    unwrap: text => text.validate(/^"(?!"")/).trim('\"').unEscape('\"'),
  },{
    name: 'raw',
    scope: 'string.quoted',
    contains: ['single.quote', 'double.quote'],
    wrap: text => text.surround('r', ''),
    unwrap: text => text.trim('r', ''),
  },{
    name: 'meta.embedded',
    scope: /{.+}/g,
    embedded: true,
    wrap: text => text.surround('{', '}'),
    unwrap: text => text.trim('{', '}')
  },{
    name: 'meta.interpolated',
    scope: interpolated,
    embedded: true,
    wrap: text => text.surround('{', '}'),
    unwrap: text => text,
  },{
    name: 'formatted',
    scope: 'string.quoted',
    embeds: ['meta.interpolated', 'meta.embedded'],
    contains: ['single.quote', 'double.quote', 'raw'],
    wrap: text => text.surround('f', ''),
    unwrap: text => text.trim('f', ''),
  },{
    name: 'unicode',
    scope: 'string.quoted',
    contains: ['single.quote', 'double.quote'],
    wrap: text => text.surround('u', ''),
    unwrap: text => text.trim('u', ''),
  },{
    name: 'multi.single',
    scope: 'string.quoted',
    wrap: text => text.surround('\'\'\'').replace('\\n', '\n'),
    unwrap: text => text.trim('\'\'\'').replace('\n', '\\n'),
  },{
    name: 'multi.double',
    scope: 'string.quoted',
    wrap: text => text.surround('\"\"\"').replace('\\n', '\n'),
    unwrap: text => text.trim('\"\"\"').replace('\n', '\\n'),
  },{
    name: 'multi.raw',
    scope: 'string.quoted',
    contains: ['multi.single', 'multi.double'],
    wrap: text => text.surround('r', ''),
    unwrap: text => text.trim('r', ''),
  },{
    name: 'multi.formatted',
    scope: 'string.quoted',
    contains: ['multi.raw', 'multi.single', 'multi.double'],
    wrap: text => text.surround('f', ''),
    unwrap: text => text.trim('f', ''),
  }]
}
