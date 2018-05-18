
const log = require('./lib/log')

const chalk = require('chalk')
const table = require('text-table')
const stringLength = require('string-length')
const yellowUnderline = chalk.underline.yellow

const CWD = process.cwd()
const {
  REQUIRES,
  DEPENDENCIES,
  REDUNDANT_DEPENDENCIES,
  REQUIRE_REDUNDANT_DEPENDENCIES,
  NEED_UPDATE,
  DEP_FILTERS,
  PKG_FILE,
  LOCK_FILE,
} = require('./config/index')

const { getFilteredKeys, getHigherVersion, isLowerMinorVersion } = require('./utils/tool')
const readFileInDir = require('./utils/file').readFileInDir

let name
let latestVersion = {}
let simplifiedDependencyTree = {}
let directDependencies // npm i --save
let redundantIndirectDeps = {}

/**
 *
 * special case: if redundant deps have the highest version which is higher than installed in top level,
 * it should not be warned as a redundant dep. Meanwhile those use the verion in top level should be marked
 * as redundant
 *
 */

function makePretty(data) {
  const deps = data[REDUNDANT_DEPENDENCIES]
  const result = []

  if (deps) {
    for (let key of Object.keys(deps)) {
      const currentDep = deps[key]
  
      for (let pkg of Object.keys(currentDep[NEED_UPDATE])) {
        result.push([
          chalk.red(pkg),
          `${chalk.red(currentDep[NEED_UPDATE][pkg].version)} -> ${chalk.green(currentDep[NEED_UPDATE][pkg].suggestVersion)}`,
          chalk.gray(`${key}@${currentDep.version}`),
          name,
        ])
      }
      result.push([' '])
    }
  }
  return result
}

function parseFormat(data) {
  const deps = data[REDUNDANT_DEPENDENCIES]

  if (!deps) {
    return
  }
  
  for (let key of Object.keys(deps)) {
    // remove pkgs do not need to optimize
    if (!deps[key][REDUNDANT_DEPENDENCIES] && !deps[key][REQUIRE_REDUNDANT_DEPENDENCIES]) {
      delete deps[key]
    }

    // remove pkgs not installed directly by npm install
    if (directDependencies.indexOf(key) < 0) {
      delete deps[key]
    }

    // merge information
    if (deps[key]) {
      deps[key][NEED_UPDATE] = {}

      if (deps[key][REQUIRE_REDUNDANT_DEPENDENCIES]) {
        deps[key][NEED_UPDATE] = JSON.parse(JSON.stringify(deps[key][REQUIRE_REDUNDANT_DEPENDENCIES]))
      }

      if (deps[key][REDUNDANT_DEPENDENCIES]) {
        for (let k of Object.keys(deps[key][REDUNDANT_DEPENDENCIES])) {
          deps[key][NEED_UPDATE][k] = {
            version: deps[key][REDUNDANT_DEPENDENCIES][k].version,
            suggestVersion: latestVersion[k]
          }
        }
      }

      delete deps[key][REQUIRE_REDUNDANT_DEPENDENCIES]
      delete deps[key][REDUNDANT_DEPENDENCIES]
    }
  }
}

function getRedundantDep(module, isTopLevel = true) {
  const result = {
    version: module.version,
    [REDUNDANT_DEPENDENCIES]: {},
    [REQUIRE_REDUNDANT_DEPENDENCIES]: {},
  }

  // if pkgs in requires has a lower semver than latest version, it should be updated.
  if (module[REQUIRES]) {
    for (let key of Object.keys(module[REQUIRES])) {
      if (latestVersion[key] && isLowerMinorVersion(module[REQUIRES][key], latestVersion[key])) {
        result[REQUIRE_REDUNDANT_DEPENDENCIES][key] = {
          version: module[REQUIRES][key],
          suggestVersion: latestVersion[key]
        }
      }
    }
  }

  if (!Object.keys(result[REQUIRE_REDUNDANT_DEPENDENCIES]).length) {
    delete result[REQUIRE_REDUNDANT_DEPENDENCIES]
  }

  if (module[DEPENDENCIES]) {
    for (let key of getFilteredKeys(module[DEPENDENCIES], DEP_FILTERS)) {
      if (isTopLevel || isLowerMinorVersion(module[DEPENDENCIES][key].version, latestVersion[key])) {
        result[REDUNDANT_DEPENDENCIES][key] = getRedundantDep(module[DEPENDENCIES][key], false)
      }
    }
  }

  if (!Object.keys(result[REDUNDANT_DEPENDENCIES]).length) {
    delete result[REDUNDANT_DEPENDENCIES]
  }

  return result
}

function getLatestVersion(module, name, result) {
  if (name) {
    if (result[name]) {
      result[name] = getHigherVersion(result[name], module.version)
    } else {
      result[name] = module.version
    }
  }

  if (module[DEPENDENCIES]) {
    for (let key of getFilteredKeys(module[DEPENDENCIES], DEP_FILTERS)) {
      getLatestVersion(module[DEPENDENCIES][key], key, result)
    }
  }
}

function simplifyDep(module) {
  const result = {
    version: module.version,
  }

  if (module[DEPENDENCIES]) {
    result[DEPENDENCIES] = {}
    
    for (let key of getFilteredKeys(module[DEPENDENCIES], DEP_FILTERS)) {
      result[DEPENDENCIES][key] = simplifyDep(module[DEPENDENCIES][key])
    }
  }

  if (module[REQUIRES]) {
    result[REQUIRES] = module[REQUIRES]
  }
  
  return result
}

function depSlim(lockData, pkgData, cb) {
  name = lockData.name
  directDependencies = getFilteredKeys(pkgData[DEPENDENCIES], DEP_FILTERS)
  
  // get latest version of each package
  getLatestVersion(lockData, '', latestVersion)

  // get simplified dependence tree
  simplifiedDependencyTree = simplifyDep(lockData)
  
  // get redundant tree
  redundantIndirectDeps = getRedundantDep(simplifiedDependencyTree)

  // parse to readable format
  parseFormat(redundantIndirectDeps)

  // output
  const head = ['Redundant-Package', 'Suggestion', 'Location', 'Project']
  const list = makePretty(redundantIndirectDeps)
  const outTable = [head].concat(list)

  outTable[0] = outTable[0].map(head => yellowUnderline(head))

  const tableOpts = {
    align: ['l', 'l', 'l', 'l', 'l'],
    stringLength: stringLength
  }

  if (outTable.length > 1) {
    log(table(outTable, tableOpts))
    log(`${chalk.yellow('What to do now?\n1. Follow Suggestions to solve redundancy and install redundancy-solved version\n2. Use npm dedupe to optimize dependency tree\n3. Run me again')}`)
    cb(false)
    return
  } else {
    log.success('Congratulations! Your project has no redundant package!')
    cb(true)
    return
  }

}

function depSlimRunner(cb) {
  Promise.all([readFileInDir(CWD, LOCK_FILE), readFileInDir(CWD, PKG_FILE)])
    .then(data => {
      try {
        const lockData = JSON.parse(data[0])
        const pkgData = JSON.parse(data[1])
        
        depSlim(lockData, pkgData, cb)
      } catch (err) {
        log.fatal(err)
      }
    })
    .catch(() => {
      log.fatal('To run Package Redundancy Check, \'package.json\' and \'package-lock.json\' are required.')
    })
}

module.exports = depSlimRunner