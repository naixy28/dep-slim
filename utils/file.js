const fs = require('fs')
const path = require('path')

module.exports = {
  readFileInDir(dir, fileName) {
    return new Promise((res, rej) => {
      fs.readFile(path.join(dir, fileName), 'utf8', (err, data) => {
        if (err) {
          rej(err)
          return
        } else {
          res(data)
        }
      })
    })
  }
}