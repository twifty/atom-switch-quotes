/** @babel */

export class Text {
  constructor (value) {
    this.value = value
  }

  extract (regex, index = 0) {
    const matches = this.value.match(regex)
    if (matches && matches[index] != null) {
      this.value = matches[index]
      return this
    }
    return false
  }

  escape (char, escapeChar = '\\') {
    let result = ''
    let escaped = false

    for (let i = 0; i < this.value.length; i++) {
      const c = this.value[i]
      if (c === escapeChar) {
        escaped = !escaped
      } else if (c === char && !escaped){
        result += escapeChar
        escaped = false
      }
      result += c
    }

    this.value = result

    return this
  }

  unEscape (char, escapeChar = '\\') {
    let result = ''
    let escaped = false

    for (let i = 0; i < this.value.length; i++) {
      const c = this.value[i]

      if (c === escapeChar && !escaped) {
        escaped = true
        continue
      }

      if (escaped && c !== char) {
        result += escapeChar
      }

      result += c
      escaped = false
    }

    this.value = result

    return this
  }

  surround (pre, post) {
    if (post == null)
      post = pre

    this.value = pre + this.value + post

    return this
  }

  trim (pre, post) {
    if (post == null)
      post = pre

    if (pre === this.value.substr(0, pre.length) && post === this.value.slice(-post.length)) {
      this.value = this.value.slice(pre.length, -post.length)
      return this
    }

    return false
  }

  toString () {
    return this.value
  }
}

export const T = function (t) {
  return new Text(t)
}
