const { test, expect } = require('@playwright/test');

const personalizationUrl = /\/functions\/v1\/personalization-v1/;
const onboardingUrl = /\/functions\/v1\/onboarding-v1/;
const growthUrl = /\/functions\/v1\/growth-referral-v1/;

test.beforeEach(async ({page}) => {
  await page.route(growthUrl, route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ok:true,member:true}) }));
  await page.route(onboardingUrl, route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({onboarding_done:true,topics:[]}) }));
});

async function stubTelegram(page, initData = '') {
  // Keep the live SDK from replacing the test session with empty browser initData.
  await page.route('https://telegram.org/js/telegram-web-app.js', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  // Construct methods in the browser: functions cannot be serialized as script arguments.
  await page.addInitScript((initData) => {
    window.Telegram = { WebApp: {
      initData,
      initDataUnsafe: initData ? { user: { id: 123456789, first_name: 'E2E', username: 'e2e_user' } } : {},
      ready() {}, expand() {}, openLink() {}, openTelegramLink() {},
      HapticFeedback: { selectionChanged() {}, impactOccurred() {} },
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
    } };
  }, initData);
}

test('membership blocks entry until server confirms joining', async ({page}) => {
  await stubTelegram(page, 'e2e-init-data');
  let member = false;
  await page.route(growthUrl, route => route.fulfill({status:member ? 200 : 403,contentType:'application/json',body:JSON.stringify(member ? {ok:true,member:true} : {ok:false,error:'membership_required'})}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'به جمع هویت خوش آمدی'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'ناوبری اصلی'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'عضو شدم؛ بررسی و ورود'})).toBeEnabled();
  // A retry while still a nonmember must remain blocked.
  await page.getByRole('button',{name:'عضو شدم؛ بررسی و ورود'}).click();
  await expect(page.getByRole('alert')).toContainText('هنوز عضویتت تأیید نشده');
  await expect(page.getByRole('navigation',{name:'ناوبری اصلی'})).toHaveCount(0);
  member = true;
  await page.getByRole('button',{name:'عضو شدم؛ بررسی و ورود'}).click();
  await expect(page.getByRole('navigation',{name:'ناوبری اصلی'})).toBeVisible();
});

test('browser without Telegram authentication cannot enter', async ({page}) => {
  await stubTelegram(page, '');
  await page.goto('/');
  await expect(page.getByText('برای تأیید عضویت، برنامه را از داخل ربات تلگرام باز کن.')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'ناوبری اصلی'})).toHaveCount(0);
});

test('home, viewer, save and primary navigation stay functional without backend', async ({ page }) => {
  await stubTelegram(page, 'e2e-verified-member');
  await page.route('https://telegram-discovery-app.paniapandora.workers.dev/**', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'e2e offline backend' }) });
  });

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'ناوبری اصلی' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button', { name: 'خانه', exact: true })).toHaveAttribute('aria-current', 'page');

  const firstCard = page.locator('.postCard').first();
  await expect(firstCard).toBeVisible();
  const title = (await firstCard.locator('h3').textContent())?.trim();
  expect(title).toBeTruthy();

  await firstCard.click();
  await expect(page.getByText('جزئیات پست')).toBeVisible();
  const save = page.locator('.viewerActionsV12 button[aria-pressed]').first();
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'بازگشت', exact: true }).click();
  await nav.getByRole('button', { name: 'ذخیره‌ها', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'ذخیره‌ها', exact: true })).toHaveAttribute('aria-current', 'page');
  if (title) await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  await nav.getByRole('button', { name: 'اکسپلور', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'اکسپلور', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'جستجو', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'جستجو', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'پروفایل', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'پروفایل', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('personalization follow flow updates the UI end to end', async ({ page }) => {
  await stubTelegram(page, 'e2e-init-data');

  let following = false;
  const topicId = '11111111-1111-4111-8111-111111111111';
  const creatorId = '22222222-2222-4222-8222-222222222222';
  const creator = {
    creator_id: creatorId,
    title: 'کانال تست E2E',
    username: 'e2e_channel',
    bio: 'کانال آزمایشی',
    avatar_url: null,
    source_url: 'https://t.me/e2e_channel',
    verified: true,
    following: false,
    followed_at: null,
    follower_count: 100,
    recent_posts: 8,
    topic_affinity: 0.8,
    quality: 0.9,
    freshness: 0.9,
    recommendation_score: 0.91,
  };

  const state = () => ({
    topics: [{ id: topicId, name: 'تکنولوژی', slug: 'technology', description: '', selected: true, weight: 1 }],
    selected_count: 1,
    following: following ? [{ ...creator, following: true, followed_at: new Date().toISOString() }] : [],
    suggestions: following ? [] : [{ ...creator, following: false }],
    following_count: following ? 1 : 0,
    algorithm: 'topics-follow-quality-freshness-v1',
  });

  await page.route(onboardingUrl, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ onboarding_done: true, topics: [] }) });
  });
  await page.route(personalizationUrl, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body?.action === 'follow') following = Boolean(body.following);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state()) });
  });
  await page.route('https://telegram-discovery-app.paniapandora.workers.dev/**', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'e2e fallback' }) });
  });

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'ناوبری اصلی' });
  await nav.getByRole('button', { name: 'پروفایل', exact: true }).click();
  const personalizationEntry = page.getByText('شخصی‌سازی کشف', { exact: true }).first();
  await expect(personalizationEntry).toBeVisible();
  await personalizationEntry.click();

  await expect(page.getByRole('heading', { name: 'شخصی‌سازی کشف' })).toBeVisible();
  const follow = page.getByRole('button', { name: /دنبال کن/ }).first();
  await expect(follow).toBeVisible();
  await follow.click();
  await expect(page.getByRole('button', { name: /دنبال می‌کنی/ }).first()).toBeVisible();
  await expect(page.getByText('کانال دنبال شد و از این به بعد در «برای تو» وزن بیشتری می‌گیرد.')).toBeVisible();
});
