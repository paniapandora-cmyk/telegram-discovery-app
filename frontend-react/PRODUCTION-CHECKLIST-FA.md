# Production Cutover Checklist

1. از Frontend فعلی Production نسخه پشتیبان بگیر.
2. داخل پوشه این پروژه اجرا کن:
   - `npm install`
   - `npm run build`
3. پوشه `dist/` را روی محیط Preview منتشر کن.
4. URL آزمایشی Telegram Mini App را موقتاً به Preview بده.
5. داخل خود Telegram این موارد را تست کن:
   - For You / Trending / Fresh
   - Explore
   - Search
   - Add Channel
   - Viewer
   - Open Post / Open Channel / Share
   - Save / Unsave / Saved
   - History
   - Feedback: not_interested
   - Profile
   - Notifications
   - Creator Center
   - 7 / 30 day switching
   - Content Performance
   - Bot Analytics owner-only
   - Telegram BackButton
6. در Network بررسی کن درخواست‌ها به Worker فعلی پروژه می‌روند.
7. بعد از تأیید، build React را جایگزین Frontend قدیمی کن.
8. فایل‌های patch قدیمی را در React لود نکن.
9. Worker / Supabase / RPCها را هنگام Cutover دست نزن مگر برای باگ تأییدشده.
