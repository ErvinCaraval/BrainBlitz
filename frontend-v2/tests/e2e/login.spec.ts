import { test, expect } from '@playwright/test'

test('login: formulario visible y validaciones', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/login/)

  const emailInputs = page.locator('input[type="email"]')
  const passwordInputs = page.locator('input[type="password"]')

  await expect(emailInputs).toHaveCount(1)
  await expect(passwordInputs).toHaveCount(1)

  await expect(emailInputs.first()).toBeVisible()
  await expect(passwordInputs.first()).toBeVisible()

  const submit = page.getByRole('button', { name: /iniciar sesión|iniciando sesión/i })
  await expect(submit).toBeVisible()
})
