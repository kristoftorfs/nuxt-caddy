import semver from 'semver'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import chalk from 'chalk'

chalk.level = 1

// Find package.json by searching upwards from the current working directory
function findPackageJson() {
  let currentDir = process.cwd()

  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath
    }
    currentDir = path.dirname(currentDir)
  }

  throw new Error('package.json not found in current directory or any parent directory')
}

// Custom commands for engines that don't use --version
const customCommands = {
  // Example: python: 'python --version',
  // Example: java: 'java -version'
}

// Custom version parsers for engines that don't return clean semver
const versionParsers = {
  gh: output => output.match(/gh version (\d+\.\d+\.\d+)/)?.[1],
  node: output => output.replace('v', '').trim(),
  default: output => output.trim(),
}

function checkEngine(engineName, requiredVersion) {
  try {
    const command = customCommands[engineName] || `${engineName} --version`
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    const parser = versionParsers[engineName] || versionParsers.default
    const currentVersion = parser(output)

    if (!currentVersion) {
      throw new Error(`Could not parse ${engineName} version from: ${output}`)
    }

    if (!semver.satisfies(currentVersion, requiredVersion)) {
      console.error(chalk.red(`✗ ${engineName} ${requiredVersion} required`))
      console.error(chalk.gray(`  Current version: ${currentVersion}`))
      return false
    }

    console.log(chalk.green(`✓ ${engineName} ${chalk.cyan(currentVersion)} satisfies requirement ${chalk.yellow(requiredVersion)}`))
    return true
  }
  catch (error) {
    if (error.code === 'ENOENT' || error.status === 127) {
      console.error(chalk.red(`✗ ${engineName} not found`))
    }
    else {
      console.error(chalk.red(`✗ ${engineName} check failed: ${error.message}`))
    }
    return false
  }
}

try {
  // Auto-detect package.json location
  const packageJsonPath = findPackageJson()
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  const engines = packageJson.engines

  if (!engines || Object.keys(engines).length === 0) {
    console.log(chalk.blue('ℹ No engines specified in package.json'))
    process.exit(0)
  }

  console.log(chalk.bold.blue('Checking development requirements...\n'))

  let allPassed = true

  // Check each engine requirement
  for (const [engineName, requiredVersion] of Object.entries(engines)) {
    const passed = checkEngine(engineName, requiredVersion)
    if (!passed) {
      allPassed = false
    }
  }

  if (!allPassed) {
    console.error(chalk.red.bold('\n✗ Some requirements not met'))
    process.exit(1)
  }

  console.log(chalk.green.bold('\n✓ All development requirements satisfied'))
}
catch (error) {
  console.error(chalk.red(`✗ Failed to read package.json: ${error.message}`))
  process.exit(1)
}
