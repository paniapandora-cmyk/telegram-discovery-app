const {test,expect}=require('@playwright/test');
async function setup(page) {
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.addInitScript(()=>{window.Telegram={WebApp:{initData:'e2e-member',ready(){},expand(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}}}};});
 await page.route(/\/functions\/v1\/growth-referral-v1/,r=>r.fulfill({json:{ok:true,member:true}}));
 await page.route(/\/functions\/v1\/onboarding-v1/,r=>r.fulfill({json:{onboarding_done:true,topics:[]}}));
 await page.route(/\/functions\/v1\/related-content-v1/,r=>r.fulfill({json:{items:[]}}));
}
const items=[1,2,3].map(n=>({content_id:`33333333-3333-4333-8333-33333333333${n}`,title:n===1?'آموزش كِتاب ۱۲':'مطلب '+n,text_content:'متن آموزشی',content_type:'TEXT',channel_username:n===3?'otherchannel':'testchannel',channel_title:n===3?'دیگر':'دانش',saved:true,saved_at:`2026-09-0${n}T10:00:00Z`,social:{likes:0,liked:false,comments:0}}));
const nav=(page,name)=>page.getByRole('navigation',{name:'ناوبری اصلی'}).getByRole('button',{name,exact:true});
test('saved search, channel filter, order, retry and session preferences',async({page})=>{
 await setup(page);let fail=false,unsaves=0;
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/saved'))return fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{items}});
  if(path.endsWith('/unsave'))unsaves++;
  return r.fulfill({json:{ok:true,items:[],likes:0,comments:0}});
 });
 await page.goto('/');await nav(page,'ذخیره‌ها').click();
 const cards=page.locator('.libraryCardV12');await expect(cards).toHaveCount(3);
 const input=page.getByPlaceholder('عنوان، کانال یا موضوع را جست‌وجو کن...');
 await input.fill('کتاب 12 دانش');await expect(cards).toHaveCount(1);
 await nav(page,'خانه').click();await nav(page,'ذخیره‌ها').click();
 await expect(input).toHaveValue('کتاب 12 دانش');await expect(cards).toHaveCount(1);
 await page.getByRole('button',{name:'پاک کردن فیلترها',exact:true}).click();
 await page.getByLabel('فیلتر کانال ذخیره‌ها').selectOption('@testchannel');
 await page.getByLabel('مرتب‌سازی ذخیره‌ها').selectOption('oldest');
 await expect(cards).toHaveCount(2);await cards.first().click();
 await expect(page.locator('[data-viewer-post]')).toHaveCount(2);
 await expect(page.locator('[data-viewer-post]').first()).toContainText('آموزش كِتاب ۱۲');
 await page.locator('[data-viewer-post]').first().getByRole('button',{name:'بازگشت',exact:true}).click();
 fail=true;await page.getByRole('button',{name:'تازه‌سازی ذخیره‌ها'}).click();
 await expect(page.getByRole('alert')).toContainText('دریافت ذخیره‌ها انجام نشد');await expect(cards).toHaveCount(2);
 fail=false;await page.getByRole('button',{name:'تازه‌سازی ذخیره‌ها'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 await cards.first().getByRole('button',{name:/حذف .* از ذخیره‌ها/}).focus();await page.keyboard.press('Enter');
 await expect.poll(()=>unsaves).toBe(1);await expect(page.locator('[data-viewer-post]')).toHaveCount(0);
});
test('search retry and failed history deletion remain recoverable',async({page})=>{
 await setup(page);let failSearch=true,failDelete=true;
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/search'))return failSearch?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{items}});
  if(path.endsWith('/search-history')){
   if(r.request().method()==='DELETE')return failDelete?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{ok:true}});
   return r.fulfill({json:{items:[{query:'کتاب',result_count:3}]}});
  }
  return r.fulfill({json:{ok:true,items:[]}});
 });
 await page.goto('/');await nav(page,'جستجو').click();
 await page.getByRole('button',{name:'پاک کردن',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('پاک کردن تاریخچه انجام نشد');
 await expect(page.locator('.searchRecentRailV11')).toContainText('کتاب');
 failDelete=false;await page.getByRole('button',{name:'پاک کردن',exact:true}).click();await expect(page.locator('.searchRecentRailV11')).toHaveCount(0);
 await page.getByPlaceholder('نام کانال، موضوع یا متن پست...').fill('کتاب');
 await expect(page.getByRole('alert')).toContainText('جست‌وجوی آنلاین انجام نشد');
 await expect(page.getByRole('heading',{name:'نتیجه‌ای پیدا نشد'})).toHaveCount(0);
 failSearch=false;await page.getByRole('button',{name:'تلاش دوباره برای جست‌وجو'}).click();
 await expect(page.locator('.searchPostGridV11 .exploreTileV4')).toHaveCount(3);
 await nav(page,'خانه').click();await nav(page,'جستجو').click();
 await expect(page.getByPlaceholder('نام کانال، موضوع یا متن پست...')).toHaveValue('کتاب');
});
