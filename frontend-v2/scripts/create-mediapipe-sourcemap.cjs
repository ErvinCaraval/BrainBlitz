const fs = require('fs')
const path = require('path')

const mapPath = path.join(__dirname, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'vision_bundle_mjs.js.map')

try {
  const dir = path.dirname(mapPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(mapPath)) {
    fs.writeFileSync(mapPath, '{}')
    console.log('Created placeholder sourcemap at', mapPath)
  } else {
    console.log('Sourcemap already exists at', mapPath)
  }
} catch (err) {
  console.error('Failed to create placeholder sourcemap:', err)
  process.exitCode = 1
}
