/** @babel */

export default {
  toggles: [
    ['string.quoted.template', 'single.quote', 'double.quote'],
  ],
  rules: [{
    scope: "source.js.embedded.source",
    embedded: true,
    wrap: text => text.surround('${', '}'),
    unwrap: text => text.trim('${', '}')
  },{
    scope: "string.quoted.template",
    embeds: ["source.js.embedded.source"],
    wrap: text => text.escape('\`').surround('\`'),
    unwrap: text => text.trim('\`').unEscape('\`'),
  }]
}
