/**
 * @description get filtered keys from an object
 * @param {obj} obj
 * @param {array} filters
 */
function getFilteredKeys(obj, filters) {
  if (typeof obj === 'object') {
    return Object.keys(obj).filter(k => {
      if (!filters || filters.length === 0) {
        return true
      }

      for (let f of filters) {
        if (k.indexOf(f) >= 0) {
          return true
        }
      }
      return false
    })
  }
  return []
}

/**
 * @description compare semver version
 * @param {semver string} x
 * @param {semver string} y
 */
function getHigherVersion(x, y) {
  const xVersion = x.split('.')
  const yVersion = y.split('.')

  for (let i = 0; i < 3; i++) {
    if (+xVersion[i] !== +yVersion[i]) {
      return +xVersion[i] > +yVersion[i] ? x : y
    }
  }
  return x
}

/**
 * @description if current semver is lt than latest semver
 * @param {semver string} oldV
 * @param {semver string} latestV
 */
function isLowerMinorVersion(oldV, latestV) {
  const xVersion = oldV.split('.')
  const yVersion = latestV.split('.')

  for (let i = 0; i < 2; i++) {
    if (+xVersion[i] < +yVersion[i]) {
      return true
    } else if (+xVersion[i] > +yVersion[i]) {
      return false
    }
  }

  return false
}

module.exports = {
  getHigherVersion,
  getFilteredKeys,
  isLowerMinorVersion
}
