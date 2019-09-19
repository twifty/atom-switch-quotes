/** @babel */

export class Text {
  constructor (value, point) {
    if (value instanceof Text) {
      this.value = value.value
      this.valid = value.valid
      this.offset = value.offset
    } else {
      this.value = value
      this.valid = true

      // convert the point to a character offset
      let offset = 0
      for (; offset < value.length && point.row > 0; offset++) {
        if (value[offset] === '\n')
        point.row--
      }
      this.offset = offset + point.column
    }
  }

  getCursorOffset (point) {
    point = point.copy()

    for (let i = 0; i < this.offset; i++) {
      if (this.value[i] === '\n') {
        point.column = 0
        point.row++
      } else {
        point.column++
      }
    }

    return point
  }

  isValid () {
    return this.valid
  }

  validate (regex) {
    this.valid = regex.test(this.value)

    return this
  }

  copy () {
    return new Text(this)
  }

  extract (regex, index = 0) {
    const matches = this.value.match(regex)

    if (matches && matches[index] != null) {
      let offset = this.value.indexOf(matches[index])
      if (offset > this.offset)
        this.offset = 0
      else if (offset < this.offset)
        this.offset -= offset

      this.value = matches[index]
      return this
    } else {
      this.valid = false
    }

    return this
  }

  replace (old, _new) {
    this.value = this.value.split(old).join(_new)

    let delta = old.length - _new.length
    let index = this.value.indexOf(old)

    while (index !== -1) {
      let pre = this.value.substring(0, index)
      let post = this.value.substring(index + old.length)

      if (pre.length < this.offset)
        this.offset += delta

      this.value = pre + _new + post
      index = this.value.indexOf(old, index + _new.length)
    }

    return this
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
        if (i < this.offset)
          this.offset++
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

      if (escaped) {
        if (c !== char)
          result += escapeChar
        else if (i < this.offset)
          this.offset--
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

    this.offset += pre.length
    this.value = pre + this.value + post

    return this
  }

  trim (pre, post, ignoreCase = true) {
    if (post == null)
      post = pre

    const equalStrings = (s1, s2) => {
      if (ignoreCase)
        return s1.toLowerCase() === s2.toLowerCase()
      return s1 === s2
    }

    if (equalStrings(pre, this.value.substr(0, pre.length))) {
      if (post === '')
        this.value = this.value.slice(pre.length)
      else if (equalStrings(post, this.value.slice(-post.length)))
        this.value = this.value.slice(pre.length, -post.length)
      this.offset -= pre.length
      return this
    } else {
      this.valid = false
    }

    return this
  }

  toString () {
    return this.value
  }
}

export const T = function (t, p) {
  return new Text(t, p)
}
