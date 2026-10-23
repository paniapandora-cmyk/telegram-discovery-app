const { test, expect } = require('@playwright/test');

for (const width of [320, 390, 768]) {
  test(`readable navigation and in-flow viewer action at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('https://telegram.org/js/telegram-web-app.js', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => {
      window.Telegram = { WebApp: { initData: 'e2e-member', ready() {}, expand() {}, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
    });
    await page.route(/\/functions\/v1\/growth-referral-v1/, r => r.fulfill({ json: { ok: true, member: true } }));
    await page.route(/\/functions\/v1\/onboarding-v1/, r => r.fulfill({ json: { onboarding_done: true, topics: [] } }));
    await page.route(/\/functions\/v1\/related-content-v1/, r => r.fulfill({ json: { items: [] } }));
    const items = [{ content_id: '33333333-3333-4333-8333-333333333331', title: 'تست خوانایی', text_content: 'متن آزمایشی برای بررسی نمایش صفحه', content_type: 'TEXT', channel_username: 'testchannel', source_url: 'https://t.me/testchannel/1' }];
    await page.route('**/api/**', r => r.fulfill({ json: { ok: true, items: r.request().url().includes('/feed?') ? items : [], likes: 0, comments: 0 } }));
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'ناوبری اصلی' });
    await expect(nav).toBeVisible();
    for (const label of await nav.locator('button span').all()) {
      expect(await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('.postCard').filter({ hasText: 'تست خوانایی' }).click();
    const cta = page.locator('.viewer .telegramCta').first();
    await expect(cta).toHaveCSS('position', 'static');
    await expect(cta).toBeEnabled();
    await cta.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
