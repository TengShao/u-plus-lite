const { execSync } = require('child_process')
const { version } = require('./package.json')

let gitCommit = 'unknown'
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
} catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
  },
}
module.exports = nextConfig
