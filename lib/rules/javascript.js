/** @babel */

export default function javascript () {
  return [{
    scope: "source.js.embedded.source",
    embedded: true,
    wrap: text => text.surround('${', '}'),
    unwrap: text => text.trim('${', '}')
  },{
    scope: "string.quoted.template.js",
    embeds: ["source.js.embedded.source"],
    wrap: text => text.escape('\`').surround('\`'),
    unwrap: text => text.trim('\`').unEscape('\`'),
  }]
}
