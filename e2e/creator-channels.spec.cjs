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
    let failChannels = false;
    let metricRequests = 0;
    let failContent = false;
    await page.route('**/api/**', r => {
      const url = r.request().url();
      if (url.includes('/creator/analytics')) {
        metricRequests++;
        const channelId = new URL(url).searchParams.get('channel_id');
        return r.fulfill({ json: { channels: [{ channel_id: 'other-channel', views: 999 }, { channel_id: channelId, views: 123 }] } });
      }
      if (url.includes('/creator/content-performance') && failContent) return r.fulfill({ status: 503, json: { error: 'unavailable' } });
      if (url.includes('/creator/channels') && failChannels) {
        return r.fulfill({ status: 503, json: { error: 'unavailable' } });
      }
      return r.fulfill({ json: url.includes('/creator/channels')
        ? { ok: true, channels } : { ok: true, items: [], channels: [] } });
    });
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
    const refresh = page.getByRole('button', { name: 'تازه‌سازی کانال‌ها و آمار' });
    await expect(refresh).toBeEnabled();
    const previousRequests = metricRequests;
    failChannels = true;
    await refresh.click();
    await expect(page.getByRole('alert')).toContainText('دریافت فهرست کانال‌ها انجام نشد');
    await expect(picker.getByRole('button')).toHaveCount(3);
    await expect(page.getByText('کانال مالکیتی پیدا نشد', { exact: true })).toHaveCount(0);
    await expect.poll(() => metricRequests).toBeGreaterThan(previousRequests);
    failChannels = false;
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(hoviat).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.creatorSummaryV5 article').first()).toContainText('۱۲۳');
    await expect(page.locator('.creatorSummaryV5')).not.toContainText('۹۹۹');
    failContent = true;
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.getByRole('alert')).toContainText('پست‌ها دریافت نشدند');
    await expect(page.locator('.creatorSummaryV5 article').first()).toContainText('۱۲۳');
  });
}
