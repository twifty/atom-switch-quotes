/** @babel */

/**
 * A simple expression for interpolated string. Matches:
 *    $foo
 *    $foo->bar
 *    $foo->bar[0]->baz
 *    $foo[0][-2]
 *    $foo[$bar]
 *    $foo['bar']
 * Due to RegExp limitations, anything more complicated will need a dedicated parser.
 * @type {RegExp}
 */
const interpolated = /\$\w+(?:->\w+|\[(?:(["'])(?:(?=(\\?))\2.)*?\1|-?\d+|\$\w+)\])*/g

export default {
  rules: [{
    scope: /{.*}/g,
    embedded: true,
    wrap: text => text.surround('{', '}'),
    unwrap: text => text.trim('{', '}')
  },{
    scope: interpolated,
    embedded: true,
    wrap: text => text,
    unwrap: text => text,
  },{
    name: "double.quote",
    scope: "string.quoted.double.php",
    toggle: true,
    embeds: [/{.*}/g, interpolated],
    wrap: text => text.escape('\"').surround('\"'),
    unwrap: text => text.trim('\"').unEscape('\"'),
  },{
    scope: "string.unquoted.heredoc.php",
    embeds: [/{.*}/g, interpolated],
    wrap: text => text.surround('<<<END\n', '\nEND'),
    unwrap: text => text.extract(/<<<\s*("?)([a-z_\x7f-\xff][a-z0-9_\x7f-\xff]*)(\1)\s*\n\r?((?:[\s\S]*)?)\n\r?\2/i, 4)
  },{
    scope: "string.unquoted.nowdoc.php",
    wrap: text => text.surround('<<<\'END\'\n', '\nEND'),
    unwrap: text => text.extract(/<<<\s*'([a-zA-Z_]+[a-zA-Z0-9_]*)'\s*\n\r?((?:[\s\S]*)?)\n\r?\1/, 2)
  },{
    scope: "string.interpolated.php",
    wrap: text => text.escape('\`').surround('\`'),
    unwrap: text => text.trim('\`').unEscape('\`'),
  }]
}
