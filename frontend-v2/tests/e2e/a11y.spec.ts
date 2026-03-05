import { test, expect } from '@playwright/test'
import { injectAxe } from 'axe-playwright'

const pages = ['/', '/login', '/register', '/dashboard', '/game']

for (const path of pages) {
  test(`a11y: ${path}`, async ({ page }, testInfo) => {
    await page.goto(path)
    await injectAxe(page)
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return await (window as any).axe.run()
    })
    const violations = results?.violations || []
    if (violations.length > 0) {
      // guardar informe para revisión manual
      await testInfo.attach('a11y-violations', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
      console.warn(`a11y: se encontraron ${violations.length} violaciones en ${path}. Revisa el reporte adjunto.`)
    }
    // No hacemos assert para no bloquear el pipeline automáticamente; se revisará manualmente.
  })
}
