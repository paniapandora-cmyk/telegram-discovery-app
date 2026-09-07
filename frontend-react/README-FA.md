# Telegram Discovery — React Final Source

این بسته، سورس کامل Frontend نسخه React آماده‌شده برای Telegram Discovery است.

## نسخه مرجع
AppDeploy snapshot: `1788748812636`

نسخه زنده:
https://telegram-discovery-react-ui-usycqn.v2.appdeploy.ai/

## اجزای اصلی
- React 19 + Vite + TypeScript
- UI کاملاً RTL و Mobile-first
- Telegram WebApp SDK
- Home / Explore / Search / Saved / Profile
- Viewer
- Add Channel
- History
- Notifications
- Creator Center
- Bot Owner Analytics
- 7/30-day Creator Analytics
- Content Performance
- Save / Unsave
- Impression / Open / View / Long View tracking
- not_interested Feedback
- Telegram share/open/channel actions

## Backend
این Frontend از Worker و APIهای فعلی پروژه استفاده می‌کند و کلید Service Role یا Supabase Secret داخل آن قرار نگرفته است.

### Discovery
- `/api/discovery/feed`
- `/api/discovery/trending`
- `/api/discovery/explore`
- `/api/discovery/save`
- `/api/discovery/unsave`
- `/api/discovery/saved`
- `/api/discovery/history`
- `/api/discovery/events`
- `/api/discovery/impression`
- `/api/discovery/feedback`
- `/api/discovery/profile`
- `/api/discovery/notifications`

### Telegram
- `/api/telegram/search`
- `/api/telegram/channel-avatar`
- `/api/telegram/preview-image`
- `/api/add-channel`

### Creator
- `/api/creator/dashboard`
- `/api/creator/analytics`
- `/api/creator/content`
- `/api/creator/content-performance`
- `/api/creator/claims`

### Bot Owner Analytics
- `bot-owner-analytics-v1`
- فقط با `x-telegram-init-data` معتبر

## نصب و اجرا
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
```

خروجی در `dist/` ساخته می‌شود.

## Production Cutover
Frontend قدیمی HTML/CSS patch-based نباید همراه React لود شود. فایل‌هایی مثل cinematic-ui-system، media-consistency و home-compact متعلق به نسخه قدیمی هستند و در React استفاده نمی‌شوند.

Worker، Supabase و RPCهای فعلی را هنگام Cutover تغییر نده مگر اینکه در تست Mini App یک باگ Backend واقعی پیدا شود.

## GitHub
در زمان تهیه این ZIP هیچ Push یا تغییر مستقیمی روی GitHub انجام نشده است.
