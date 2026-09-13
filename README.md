# Telegram Discovery — Project Handoff / Complete Source Export

این README برای تحویل کامل وضعیت فعلی پروژه در تاریخ **2026-09-13** ساخته شده است. شاخهٔ `project-export-2026-09-13` از `main` منشعب شده تا هیچ تغییری به نسخهٔ اصلی پروژه تحمیل نشود. تمام فایل‌های کدی که در وضعیت فعلی ریپو نگه‌داری می‌شوند، همراه همین README در ZIP این شاخه قرار می‌گیرند.

> نکتهٔ مهم: این خروجی شامل **تمام فایل‌های tracked موجود در وضعیت فعلی شاخهٔ main** در لحظهٔ ساخت خروجی است، از جمله نسخه‌های قدیمی/نسخه‌دار کد که هنوز در ریپو نگه داشته شده‌اند. فایل‌هایی که در تاریخ Git کاملاً حذف شده‌اند و دیگر در tree فعلی وجود ندارند، جزو archive شاخه نیستند؛ تاریخ Git در خود GitHub باقی می‌ماند.

---

## 1) هدف کلی پروژه

**Telegram Discovery** یک Mini App / Web App برای کشف، جست‌وجو و مشاهدهٔ محتوای تلگرام است که در کنار تجربهٔ کاربری عمومی، یک بخش Creator/Owner برای ثبت کانال، رهگیری آمار و رشد، و یک لایهٔ AI برای دستیار هوشمند دارد.

معماری فعلی پروژه چند لایه است:

1. **Frontend legacy / single-page** در `index.html` و فایل‌های JS سطح ریشه.
2. **Frontend جدید React/Vite** در `frontend-react/`.
3. **Cloudflare Worker** در `worker.ts` برای Proxy/API routing و اتصال Mini App به سرویس‌های backend.
4. **Supabase Edge Functions** در `supabase/functions/` برای Discovery API، Creator Dashboard، Telegram sync، AI gateway و سایر سرویس‌ها.
5. **Supabase SQL migrations** در `supabase/migrations/` برای ساخت/تغییر schema، RPCها، personalization، tracking، ranking و sync.
6. **Telegram integration** شامل WebApp initData، sync منابع عمومی، MTProto/public preview و tracking.
7. **AI integration** با OpenAI Responses API از طریق `ai-gateway-v1`؛ کلید API فقط در secret سمت سرور نگه‌داری می‌شود و به مرورگر ارسال نمی‌شود.

هدف نهایی محصول این است که کاربر بتواند مثل یک «Explore/Discovery هوشمند تلگرام» محتوا و کانال‌های مناسب را پیدا کند، و مالک کانال بتواند عملکرد کانالش را اندازه‌گیری و رشد آن را مدیریت کند.

---

## 2) وضعیت فعلی پروژه — دقیقاً کجای کار هستیم؟

آخرین وضعیت `main` هنگام ساخت این خروجی روی commit زیر بود:

- `47fa41fd761d6e51485504a640f1de7ad6751d88`
- پیام commit: `fix: limit Telegram public sync concurrency`

در commits بلافاصله قبل از آن این بخش‌ها تکمیل/اتصال داده شده‌اند:

- fallback برای Telegram public preview sync؛
- routing زمان‌بندی sync به public preview fallback؛
- محدودسازی concurrency برای sync تلگرام؛
- Channel Profile داخل خود Mini App؛
- اتصال Channel Profile به Home، Search و Viewer؛
- Personalization Center و feed آگاه از follow؛
- Related Content؛
- Search/Explore ranking migrations؛
- Creator tracking و membership attribution؛
- Growth/referral/broadcast؛
- AI gateway و UI/Client دستیار هوشمند.

### AI الان در چه مرحله‌ای است؟

فایل `supabase/functions/ai-gateway-v1/index.ts` اکنون:

- `OPENAI_API_KEY` را از environment secret می‌خواند؛
- `OPENAI_MODEL` را از env می‌خواند و fallback فعلی `gpt-5` است؛
- Telegram Mini App `initData` را سمت سرور اعتبارسنجی می‌کند؛
- پیام کاربر را به `https://api.openai.com/v1/responses` می‌فرستد؛
- خروجی مدل را به Mini App برمی‌گرداند؛
- کلید OpenAI را به client نمی‌دهد.

در حال حاضر instruction خود gateway صریحاً می‌گوید مدل هنوز نباید ادعا کند به داده‌ها/ابزارهای پروژه دسترسی دارد مگر اینکه بعداً این ابزارها به آن داده شوند. بنابراین **اتصال پایهٔ AI انجام شده، ولی Tool Calling / RAG / اتصال مستقیم دستیار به Search، Creator stats و داده‌های واقعی پروژه مرحلهٔ بعدی است.**

### مرحلهٔ بعدی پیشنهادی

مرحلهٔ بعدی پروژه باید روی این ترتیب متمرکز شود:

1. تثبیت و تست production برای Telegram source/public sync و Channel Profile؛
2. وصل‌کردن `ai-gateway-v1` به ابزارهای واقعی پروژه (Search، read post/channel، Creator stats) با کنترل دسترسی؛
3. اضافه‌کردن conversation context محدود و rate limit/cost limit برای AI؛
4. اتصال کامل AI به UI جدید React و در صورت نیاز bot chat؛
5. تست end-to-end روی Telegram Mini App واقعی؛
6. مانیتورینگ خطاها، latency و attribution عضویت‌ها؛
7. بعد از پایداری، توسعهٔ monetization بر اساس creator analytics / tracked joins.

---

## 3) مراحل انجام‌شده تا امروز — به ترتیب کلی

ترتیب زیر خلاصهٔ مسیر توسعهٔ پروژه است، بدون حذف اجزای اصلی:

1. ساخت نسخهٔ اولیهٔ Telegram Discovery Mini App و UI تک‌صفحه‌ای.
2. اتصال Discovery API و Search به Supabase.
3. ایجاد Cloudflare Worker برای proxy کردن APIها و مدیریت CORS/Telegram integration.
4. توسعهٔ Explore، Trending، Feed، Saved، Viewer و Search UI.
5. افزودن Creator Center / Creator Dashboard.
6. اضافه‌کردن metrics شامل Views، Telegram Opens، Join Clicks، Telegram Joins، Active Joins، Leaves و conversion.
7. توسعهٔ tracking links، referrals و membership attribution برای کانال‌های مالکین.
8. حل/توسعهٔ sync منابع تلگرام و اضافه‌کردن source/public preview fallback.
9. اضافه‌کردن pagination/ranking برای Explore و Search.
10. مهاجرت تدریجی UI به React + Vite + TypeScript.
11. توسعهٔ Saved/History/Viewer جدید و Related Content.
12. توسعهٔ Personalization Center و follow-aware feed.
13. توسعهٔ Channel Profile داخل Mini App و اتصال آن به Home/Search/Viewer.
14. اضافه‌کردن Growth، Invite، broadcast و referral layers.
15. اضافه‌کردن UI و client برای AI Chat.
16. ساخت Supabase Edge Function `ai-gateway-v1` و اتصال امن به OpenAI Responses API.
17. ثبت secretهای سمت سرور برای AI/Telegram در محیط backend (مقادیر secret داخل repo ذخیره نمی‌شوند).
18. آخرین اصلاح فعلی: بهبود مسیر Telegram public sync و محدودسازی concurrency.

---

## 4) ابزارها، Runtimeها و کتابخانه‌های لازم

### Runtime / Platform

- **Node.js 20** — در GitHub Actions هم Node 20 استفاده شده است.
- **npm** — package manager فعلی پروژه.
- **TypeScript**
- **React 19**
- **Vite 6**
- **Supabase** و Supabase Edge Functions / Deno runtime
- **Cloudflare Workers**
- **Wrangler 4**
- **Telegram Mini Apps / WebApp API**
- **OpenAI Responses API** از طریق HTTP fetch در Edge Function
- **GitHub Actions** برای build/smoke verification

### Dependencies سطح ریشه (`package.json`)

```bash
npm install
```

Dependencies اصلی:

- `teleproto ^1.229.0`

Dev dependencies:

- `typescript 5.9.2`
- `wrangler ^4.127.0`

Scripts ریشه:

```bash
npm run check
npm run smoke
npm run deploy
```

### Dependencies Frontend React (`frontend-react/package.json`)

```bash
cd frontend-react
npm install
```

Dependencies:

- `react ^19.0.0`
- `react-dom ^19.0.0`
- `lucide-react ^0.469.0`

Dev dependencies:

- `@types/react ^19.0.0`
- `@types/react-dom ^19.0.0`
- `@vitejs/plugin-react ^4.3.0`
- `autoprefixer ^10.4.0`
- `postcss ^8.4.0`
- `tailwindcss ^3.4.0`
- `typescript ^5.7.0`
- `vite ^6.0.0`

Optional dependency:

- `@rollup/rollup-linux-x64-gnu ^4.0.0`

Frontend scripts:

```bash
npm run dev
npm run build
npm run preview
```

### Python / pip

در tree فعلی پروژه **هیچ فایل Python و هیچ `requirements.txt` / `pyproject.toml` وجود ندارد** و وابستگی pip فعالی برای اجرای نسخهٔ فعلی پروژه دیده نمی‌شود. بنابراین در حال حاضر `pip install ...` جزو setup پروژه نیست.

---

## 5) Environment variables / Secrets لازم

مقادیر secret نباید داخل Git commit شوند. بر اساس کد فعلی، این متغیرها یا معادل‌هایشان در محیط deployment استفاده می‌شوند:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (اختیاری؛ fallback فعلی داخل gateway وجود دارد)
- `TELEGRAM_BOT_TOKEN`
- `DISCOVERY_TELEGRAM_BOT_TOKEN` (fallback/alias در بعضی مسیرها)
- Supabase URL / service-role / anon values مورد نیاز Edge Functions و Worker، مطابق deployment فعلی
- Cloudflare Worker vars/secrets مطابق `wrangler.jsonc` و محیط Cloudflare

**هیچ مقدار واقعی secret در README ثبت نشده است.**

---

## 6) نقشهٔ کامل فایل‌ها و وظیفهٔ هر فایل

### فایل‌های سطح ریشه

| فایل | وظیفه |
|---|---|
| `.assetsignore` | تنظیم فایل‌هایی که در بعضی فرایندهای asset/build نادیده گرفته می‌شوند. |
| `.gitignore` | فایل‌ها/دایرکتوری‌هایی که Git نباید track کند. |
| `ai-chat-ui.js` | UI دستیار هوشمند در نسخهٔ legacy/non-React. |
| `ai-client.js` | client مرورگر برای ارسال پیام AI به `ai-gateway-v1`؛ کلید OpenAI در browser قرار نمی‌گیرد. |
| `bot-owner-analytics-v1.js` | لایه/اسکریپت analytics مربوط به owner/creator و bot. |
| `cinematic-ui-system-v2.2.js` | سیستم UI/interaction سینمایی نسخه‌دار برای تجربهٔ بصری پروژه. |
| `creator-growth-ui-v7.2.js` | نسخهٔ 7.2 از UI رشد Creator. |
| `creator-growth-ui.js` | نسخه/هستهٔ UI Growth برای creator. |
| `design-tokens.json` | design tokenها مانند spacing/color/radius/type values. |
| `home-compact-controls-stable-v2.js` | کنترل‌های compact و stable صفحهٔ Home. |
| `index.html` | نسخهٔ اصلی/legacy Mini App تک‌صفحه‌ای؛ شامل UI و integrationهای قدیمی/موجود. |
| `media-consistency-v1.js` | منطق یکسان‌سازی/پایداری نمایش media. |
| `package.json` | وابستگی‌ها و scripts ریشه برای Worker/TypeScript/Wrangler. |
| `package-lock.json` | lockfile دقیق npm سطح ریشه. |
| `worker.ts` | Cloudflare Worker اصلی؛ proxy/routing بین Mini App و Supabase APIs و integrationهای مربوط. |
| `wrangler.jsonc` | تنظیمات deployment Cloudflare Worker. |
| `telegram-discovery-v19-final.zip` | archive قدیمی/نسخه‌دار پروژه که قبلاً در repo نگه‌داری شده است؛ منبع اجرایی اصلی فعلی نیست اما حذف نشده. |

### `.github/workflows/`

| فایل | وظیفه |
|---|---|
| `.github/workflows/react-build.yml` | نصب dependencyهای React، build با Node 20 و upload کردن `frontend-react/dist` به عنوان artifact. |
| `.github/workflows/telegram-discovery-smoke.yml` | smoke/verification CI برای بخش‌های مهم Telegram Discovery و تغییرات backend/frontend. |

---

## `frontend-react/` — Frontend جدید React

### فایل‌های تنظیمات و build

| فایل | وظیفه |
|---|---|
| `frontend-react/BUILD-INFO.txt` | اطلاعات build/export فعلی frontend. |
| `frontend-react/MANIFEST-SHA256.txt` | checksum/manifest برای کنترل صحت فایل‌های build/export. |
| `frontend-react/PRODUCTION-CHECKLIST-FA.md` | چک‌لیست فارسی آماده‌سازی production. |
| `frontend-react/README-FA.md` | راهنمای فارسی موجود برای frontend React. |
| `frontend-react/README.md` | README قبلی بسیار کوچک/placeholder داخل frontend. |
| `frontend-react/index.html` | entry HTML پروژه Vite. |
| `frontend-react/package.json` | dependencyها و scripts frontend. |
| `frontend-react/package-lock.json` | lockfile frontend React. |
| `frontend-react/postcss.config.js` | تنظیم PostCSS/Autoprefixer. |
| `frontend-react/tailwind.config.js` | تنظیم Tailwind CSS. |
| `frontend-react/tsconfig.json` | تنظیم TypeScript frontend. |
| `frontend-react/vite.config.ts` | تنظیم Vite build/dev server. |
| `frontend-react/functions/api/[[path]].ts` | proxy/API function catch-all برای deployment frontend و مسیرهای API. |

### Entry و application shell

| فایل | وظیفه |
|---|---|
| `frontend-react/src/App.tsx` | component سطح بالای React app. |
| `frontend-react/src/main.tsx` | bootstrapping React و mount کردن app. |
| `frontend-react/src/index.css` | CSS پایهٔ global entry. |
| `frontend-react/src/types.ts` | typeهای مشترک TypeScript. |
| `frontend-react/src/app/DiscoveryApp.tsx` | shell/router/state اصلی تجربهٔ Discovery در React. |
| `frontend-react/src/.keep` | نگه‌داشتن دایرکتوری در Git. |
| `frontend-react/src/app/.keep` | placeholder Git برای app directory. |

### Components

| فایل | وظیفه |
|---|---|
| `frontend-react/src/components/AIChat.tsx` | UI چت دستیار AI در frontend React. |
| `AddChannelSheet.tsx` | sheet/modal اضافه‌کردن کانال. |
| `BottomNav.tsx` | navigation پایین Mini App. |
| `BroadcastCard.tsx` | کارت/کنترل broadcast/growth messaging. |
| `ChannelRail.tsx` | rail افقی/لیست کانال‌ها در UI. |
| `CreatorAdsCard.tsx` | کارت تبلیغات Creator. |
| `CreatorAdsLauncher.tsx` | entry/launcher برای creator ads. |
| `CreatorPromoKit.tsx` | ابزار/کیت promotion برای creator. |
| `ExploreTile.tsx` | tile/grid item صفحه Explore. |
| `FeedTabs.tsx` | تب‌های feed مانند For You/Trending/Explore. |
| `GrowthCard.tsx` | کارت growth/referral/reward. |
| `Header.tsx` | header عمومی اپ. |
| `InviteNudge.tsx` | CTA/nudge دعوت کاربر. |
| `LibraryThumb.tsx` | thumbnail کارت‌های Library/Saved/History. |
| `OnboardingGate.tsx` | gate و flow onboarding پیش از ورود کامل به تجربه. |
| `OwnerAdsDashboard.tsx` | dashboard تبلیغات/مالک کانال. |
| `PostCard.tsx` | کارت نمایش پست در feed. |
| `SearchControls.tsx` | کنترل‌های جست‌وجو/filter. |
| `Viewer.tsx` | viewer جزئیات پست/media و actionهای مرتبط. |
| `frontend-react/src/components/.keep` | placeholder Git. |

### Data / API clients

| فایل | وظیفه |
|---|---|
| `frontend-react/src/data/account.ts` | account/profile/account-related data access. |
| `ads.ts` | داده/API مربوط به ads. |
| `broadcast.ts` | داده/API broadcast. |
| `channel-profile.ts` | client و مدل دادهٔ Channel Profile داخل app. |
| `channels.ts` | دریافت/مدیریت لیست کانال‌ها. |
| `creator-promo.ts` | داده/API promo creator. |
| `demo.ts` | داده‌های demo/fallback غیرحساس برای UI. |
| `explore.ts` | data layer Explore، paging/ranking requests. |
| `growth.ts` | client growth/referral/reward. |
| `library.ts` | Saved/History/Library data. |
| `live.ts` | data layer محتوای live/واقعی و feed endpoints. |
| `notifications.ts` | notification data/API. |
| `onboarding.ts` | onboarding API/data. |
| `personalization.ts` | Personalization Center و preferences/follow-aware data. |
| `search.ts` | Search API/data/ranking. |
| `tracking.ts` | tracking event/link/conversion data. |
| `frontend-react/src/data/.keep` | placeholder Git. |

### Library helpers

| فایل | وظیفه |
|---|---|
| `frontend-react/src/lib/postMedia.ts` | helperهای تشخیص/نمایش media پست. |

### Pages

| فایل | وظیفه |
|---|---|
| `AdsPage.tsx` | صفحه Ads. |
| `ChannelPage.tsx` | صفحه Channel Profile داخل Mini App. |
| `CreatorPage.tsx` | Creator Center / dashboard page. |
| `ExplorePage.tsx` | Explore/grid discovery. |
| `HistoryPage.tsx` | تاریخچهٔ مشاهده/مصرف محتوا. |
| `HomePage.tsx` | صفحه Home/feed اصلی. |
| `InvitePage.tsx` | صفحه دعوت/referral. |
| `NotificationsPage.tsx` | notification center. |
| `PersonalizationPage.tsx` | Personalization Center. |
| `ProfilePage.tsx` | profile/settings entry. |
| `SavedPage.tsx` | محتوای ذخیره‌شده. |
| `SearchPage.tsx` | صفحه جست‌وجو. |
| `SupportPage.tsx` | پشتیبانی/راهنما. |
| `frontend-react/src/pages/.keep` | placeholder Git. |

### Styles

| فایل | وظیفه |
|---|---|
| `frontend-react/src/styles/app.css` | style اصلی frontend React. |
| `ads-v1.css` | styles بخش ads. |
| `channel-profile-v14.css` | نسخهٔ 14 استایل Channel Profile. |
| `creator-ads-launcher.css` | styles launcher تبلیغات creator. |
| `creator-center-v5.css` | نسخهٔ 5 style Creator Center. |
| `creator-promo-select.css` | styles انتخاب promo. |
| `creator-promo.css` | styles promo kit. |
| `creator-tracking-v7.css` | styles tracking/analytics creator. |
| `detail-micro-v8.css` | micro-detail styles viewer/details. |
| `detail-pass-v8.css` | detail/viewer pass نسخه 8. |
| `explore-masonry-v7.css` | masonry layout Explore. |
| `explore-ranking-v11.css` | UI states مربوط به ranking Explore. |
| `explore-search-v4.css` | Explore/Search combined styles. |
| `functional.css` | styles utility/functional عمومی. |
| `growth-rewards.css` | styles reward/growth. |
| `growth.css` | styles اصلی Growth. |
| `invite-growth-v10.css` | نسخهٔ 10 invite/growth experience. |
| `library-viewer-v12.css` | Saved/History/Viewer styles نسخه 12. |
| `live-media-v2.css` | media styles برای live content. |
| `live.css` | styles live/feed. |
| `mobile-hotfix-v7.css` | hotfixهای mobile نسخه 7. |
| `notifications-center-v9.css` | Notification Center نسخه 9. |
| `onboarding.css` | styles onboarding. |
| `personalization-v13.css` | Personalization Center نسخه 13. |
| `premium-v2.css` | iteration قدیمی premium visual system v2. |
| `premium-v3.css` | iteration premium v3. |
| `premium-v4.css` | iteration premium v4. |
| `premium-v5.css` | iteration premium v5. |
| `reference-v6.css` | reference/visual baseline نسخه 6. |
| `search-discovery-v11.css` | Search/Discovery UI نسخه 11. |
| `viewer-saved-v3.css` | Viewer/Saved styles نسخه 3. |
| `frontend-react/src/styles/.keep` | placeholder Git. |

### Tests

| فایل | وظیفه |
|---|---|
| `frontend-react/tests/explore-v16.mjs` | contract/smoke تست Explore v16. |
| `feed-contract.mjs` | تست قرارداد داده/API feed. |
| `pages.test.ts` | تست صفحات/ساختار frontend. |
| `tests.txt` | مستند/خروجی تست‌ها یا checklist تست موجود. |
| `frontend-react/tests/.keep` | placeholder Git. |

---

## `supabase/functions/` — Edge Functions

| مسیر | وظیفه |
|---|---|
| `ai-gateway-v1/index.ts` | gateway امن OpenAI؛ Telegram initData validation، فراخوانی Responses API و بازگرداندن پاسخ AI. |
| `channel-profile-v1/index.ts` | API پروفایل کانال و داده‌های مرتبط برای صفحه Channel. |
| `creator-dashboard-v2/index.ts` | API Creator Dashboard؛ dashboard/content metrics و اتصال به RPCهای creator. |
| `creator-member-attribution-v1/index.ts` | attribution عضویت/خروج/رویدادها به creator/tracking source. |
| `creator-referral-v2/index.ts` | referral/tracking flow برای creator. |
| `discovery-api-v33/index.ts` | API اصلی Discovery نسخه 33؛ feed/content/discovery endpoints. |
| `discovery-api-v33/deno.json` | تنظیم Deno function. |
| `discovery-api-v33/inex.ts` | فایل placeholder/typo قدیمی یک‌بایتی که در repo حفظ شده است. |
| `growth-broadcast-v1/index.ts` | broadcast/growth backend. |
| `growth-referral-v1/index.ts` | backend referral رشد و دعوت. |
| `onboarding-v1/index.ts` | onboarding backend. |
| `personalization-v1/index.ts` | API Personalization Center و preferences/follows. |
| `related-content-v1/index.ts` | endpoint محتوای مرتبط. |
| `telegram-chat-ui-v1/index.ts` | endpoint/logic UI یا interaction چت تلگرام. |
| `telegram-media-v1/index.ts` | دریافت/حل media تلگرام برای نمایش در app. |
| `telegram-mtproto/index.ts` | integration MTProto/Teleproto برای منابع تلگرام. |
| `telegram-mtproto/deno.json` | dependency/config مربوط به function MTProto. |
| `telegram-public-sync-v1/index.ts` | sync بر پایه Telegram public preview fallback. |
| `telegram-source-sync-v2/index.ts` | sync اصلی sourceهای تلگرام نسخه 2. |
| `telegram-source-sync-v2/pages.ts` | helper/page parsing برای sync source. |

---

## `supabase/migrations/` — Database migrations

| فایل | وظیفه |
|---|---|
| `20260828080000_telegram_mtproto_sources.sql` | schema/data support برای sourceهای Telegram MTProto. |
| `20260901214640_harden_function_search_path.sql` | hardening امنیتی `search_path` توابع DB. |
| `20260908180000_telegram_history_cursor.sql` | cursor/history support برای sync تلگرام. |
| `20260908_creator_membership_events_v11.sql` | رویدادهای membership creator نسخه 11. |
| `20260908_creator_tracking_v10.sql` | tracking creator نسخه 10. |
| `20260908_restore_tracked_membership_v12.sql` | restore/repair مسیر tracked membership نسخه 12. |
| `20260909070000_explore_paging_v16.sql` | paging/ranking infrastructure Explore v16. |
| `20260911000100_bot_start_tracking.sql` | tracking شروع کاربر از bot/deep-link. |
| `20260911_growth_campaigns_v1.sql` | schema campaigns رشد. |
| `20260911_growth_referrals_v1.sql` | schema referrals رشد. |
| `20260913003500_search_discovery_ranking_v2.sql` | ranking جست‌وجو/Discovery نسخه 2. |
| `20260913003600_explore_discovery_ranking_v4.sql` | ranking Explore نسخه 4. |
| `20260913010000_related_content_v1.sql` | DB/RPC support محتوای مرتبط. |
| `20260913014200_personalization_center_v1.sql` | schema/RPC مرکز شخصی‌سازی. |
| `20260913015000_personalized_follow_feed_v3.sql` | feed شخصی‌سازی‌شده با follow-awareness نسخه 3. |
| `20260913020500_route_telegram_sync_to_public_preview_v1.sql` | route scheduler/sync به public preview fallback. |
| `20260913023500_telegram_public_sync_concurrency_v2.sql` | محدودسازی concurrency public sync نسخه 2. |
| `20260913030000_channel_profile_v1.sql` | schema/RPCهای Channel Profile v1. |

---

## 7) مسیر اجرای محلی / Build

### Frontend React

```bash
cd frontend-react
npm install
npm run dev
```

Build production:

```bash
cd frontend-react
npm install
npm run build
```

### Cloudflare Worker

از root:

```bash
npm install
npm run check
npm run deploy
```

برای deploy واقعی باید login/config صحیح Cloudflare/Wrangler و secrets لازم موجود باشند.

### Supabase Edge Functions

Edge Functionها برای runtime Supabase/Deno نوشته شده‌اند. deploy آن‌ها باید از محیط Supabase CLI یا workflow/deployment متصل به project انجام شود. قبل از deploy، secrets backend باید در Supabase تنظیم شوند و هرگز در source hard-code نشوند.

---

## 8) ارتباط بخش‌ها با هم

مسیر کلی request در معماری فعلی:

```text
Telegram Mini App / Browser
        │
        ├── React frontend / legacy index.html
        │
        ├── Cloudflare Worker (worker.ts)
        │        │
        │        └── Supabase Edge Functions
        │                 ├── discovery-api-v33
        │                 ├── creator-dashboard-v2
        │                 ├── channel-profile-v1
        │                 ├── personalization-v1
        │                 ├── related-content-v1
        │                 ├── telegram-source/public sync
        │                 └── ai-gateway-v1 ──> OpenAI Responses API
        │
        └── Telegram WebApp initData / deep links / tracking
```

Database migrations زیرساخت RPC/table/viewهای مورد نیاز این سرویس‌ها را فراهم می‌کنند.

---

## 9) نکات مهم برای ادامهٔ توسعه

- `OPENAI_API_KEY` هرگز نباید وارد frontend، GitHub commit یا client bundle شود.
- AI Gateway فعلی فقط پاسخ عمومی می‌دهد؛ برای پاسخ مبتنی بر دادهٔ واقعی باید Tool Calling/RAG اضافه شود.
- Creator stats باید فقط بعد از احراز مالکیت/هویت کاربر خوانده شوند.
- tracked joins و membership attribution از دارایی‌های مهم monetization پروژه‌اند و نباید با تغییرات UI از بین بروند.
- Telegram sync باید rate/concurrency محدود داشته باشد تا sourceها یا Supabase تحت فشار قرار نگیرند.
- `index.html` و فایل‌های JS ریشه legacy هستند؛ `frontend-react/` مسیر جدیدتر UI است. تا زمانی که cutover کامل نشده، حذف legacy توصیه نمی‌شود.
- SQL migrations باید به ترتیب و با بررسی history محیط Supabase اعمال شوند؛ migration قدیمی را ویرایش نکنید، migration جدید بسازید.
- قبل از deploy production، `npm run build` و تست‌های smoke/contract اجرا شوند.

---

## 10) خلاصهٔ تحویل

این شاخهٔ export برای این ساخته شده که یک نقطهٔ تحویل/backup قابل دانلود داشته باشیم:

- تمام sourceهای فعلی root؛
- تمام React frontend؛
- تمام Supabase Edge Functions؛
- تمام SQL migrations؛
- Cloudflare Worker و Wrangler config؛
- GitHub Actions workflows؛
- lockfiles و configهای build؛
- فایل‌های نسخه‌دار/legacy که هنوز در repo هستند؛
- همین README با وضعیت پروژه و مرحلهٔ بعدی.

**Branch:** `project-export-2026-09-13`

**Base commit:** `47fa41fd761d6e51485504a640f1de7ad6751d88`
