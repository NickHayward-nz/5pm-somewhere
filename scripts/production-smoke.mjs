#!/usr/bin/env node
// Lightweight production smoke check for 5PM Somewhere.
// No secrets, no browser automation: verifies deploy basics that often regress PWA launches.

const baseUrl = process.env.FIVEPM_PRODUCTION_URL || 'https://5pmsomewhere.live'

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': '5pm-launch-smoke/1.0',
    },
  })
  const text = await response.text()
  return { response, text }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function unique(values) {
  return [...new Set(values)]
}

async function main() {
  const checks = []
  const root = new URL('/', baseUrl).toString()
  const { response: homeResponse, text: html } = await fetchText(root)

  checks.push(`home_status=${homeResponse.status}`)
  assert(homeResponse.ok, `Expected ${root} to return 2xx, got ${homeResponse.status}`)
  assert(html.includes('<title>5PM Somewhere</title>'), 'Production HTML is missing the expected title')
  assert(html.includes('/assets/index-'), 'Production HTML does not reference a Vite index asset')

  const assetPaths = unique([...html.matchAll(/\/assets\/index-[^"']+\.js/g)].map((match) => match[0]))
  assert(assetPaths.length > 0, 'Could not find production JS bundle path in HTML')
  checks.push(`bundle_count=${assetPaths.length}`)

  const bundleUrl = new URL(assetPaths[0], baseUrl).toString()
  const { response: bundleResponse, text: bundle } = await fetchText(bundleUrl)
  checks.push(`bundle_status=${bundleResponse.status}`)
  checks.push(`bundle=${assetPaths[0]}`)
  assert(bundleResponse.ok, `Expected bundle ${bundleUrl} to return 2xx, got ${bundleResponse.status}`)

  const forbiddenBundleStrings = [
    'VITE_VERCEL_GIT',
    'VITE_VERCEL_PROJECT',
    'VITE_VERCEL_DEPLOYMENT',
    '/storage/v1/object/public/moments/',
  ]
  for (const needle of forbiddenBundleStrings) {
    assert(!bundle.includes(needle), `Production bundle contains forbidden string: ${needle}`)
  }

  const swUrl = new URL('/sw.js', baseUrl).toString()
  const { response: swResponse, text: sw } = await fetchText(swUrl)
  checks.push(`sw_status=${swResponse.status}`)
  assert(swResponse.ok, `Expected ${swUrl} to return 2xx, got ${swResponse.status}`)
  assert(sw.includes('precache') || sw.includes('__WB_MANIFEST'), 'Service worker does not look like a Workbox precache worker')

  const howUrl = new URL('/how-it-works', baseUrl).toString()
  const { response: howResponse, text: howHtml } = await fetchText(howUrl)
  checks.push(`how_it_works_status=${howResponse.status}`)
  assert(howResponse.ok, `Expected ${howUrl} to return 2xx, got ${howResponse.status}`)
  assert(howHtml.includes('<title>5PM Somewhere</title>'), 'How-it-works route did not return the app shell')

  console.log('Production smoke check passed')
  for (const check of checks) console.log(`- ${check}`)
}

main().catch((error) => {
  console.error('Production smoke check failed')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
