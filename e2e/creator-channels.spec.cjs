const { test, expect } = require('@playwright/test');

for (const width of [320, 390]) {
  test(`all owned channels are selectable without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('https://telegram.org/js/telegram-web-app.js', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => {
      window.Telegram = { WebApp: {
        initData: 'e2e-member', initDataUnsafe: { user: { id: 123456789, first_name: 'E2E' } },
        ready() {}, expand() {}, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
      } };
    });
    await page.route(/\/functions\/v1\/growth-referral-v1/, r => r.fulfill({ json: { ok: true, member: true } }));
    await page.route(/\/functions\/v1\/onboarding-v1/, r => r.fulfill({ json: { onboarding_done: true, topics: [] } }));
    await page.route(/\/functions\/v1\/bot-owner-analytics-v1/, r => r.fulfill({ json: { ok: true, stats: {} } }));
    const channels = ['first_channel', 'second_channel', 'hoviateman'].map((username, i) => ({
      id: `22222222-2222-4222-8222-22222222222${i}`,
      username, title: i === 2 ? 'هویت' : `کانال ${i + 1}`, verified: true, is_bot_admin: true,
    }));
    await page.route('**/api/**', r => r.fulfill({ json: r.request().url().includes('/creator/channels')
      ? { ok: true, channels } : { ok: true, items: [], channels: [] } }));
    await page.goto('/');
    await page.getByRole('navigation', { name: 'ناوبری اصلی' }).getByRole('button', { name: 'پروفایل', exact: true }).click();
    await page.getByRole('button', { name: /Creator Center/ }).click();
    const picker = page.getByRole('group', { name: 'کانال‌های من' });
    await expect(picker.getByRole('button')).toHaveCount(3);
    expect(await picker.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const button of await picker.getByRole('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const hoviat = picker.getByRole('button', { name: /هویت/ });
    await hoviat.click();
    await expect(hoviat).toHaveAttribute('aria-pressed', 'true');
  });
}
