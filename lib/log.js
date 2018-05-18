'use strict'

let chalk = require('chalk')
let output = console.log.bind(console) // eslint-disable-line
let error = chalk.red
let success = chalk.green

function log() {
  let args = [].slice.call(arguments)

  if (args.length === 0) {
    output()
    return
  }
  output([].slice.call(arguments).join(''))
}

log.fatal = function fatal() {

  output(error([].slice.call(arguments).join('')))
}

log.success = function fatal() {

  output(success([].slice.call(arguments).join('')))
}


module.exports = log


