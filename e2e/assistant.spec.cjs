const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.route('https://telegram.org/js/telegram-web-app.js', route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(()=>{window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A123%7D&hash=test',ready(){},expand(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){}}}};});
  await page.route('https://telegram-discovery-app.paniapandora.workers.dev/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"ok":false}'}));
  await page.route(/\/functions\/v1\/growth-referral-v1/,route=>route.fulfill({contentType:'application/json',body:'{"ok":true,"member":true}'}));
  await page.route(/\/functions\/v1\/onboarding-v1/,route=>route.fulfill({contentType:'application/json',body:'{"onboarding_done":true,"topics":[]}'}));
}
test('assistant renders safe sources, forwards recent history and saves only on click',async({page})=>{
  await prepare(page);
  let requests=[], saves=0;
  await page.route('**/api/discovery/save',route=>{saves++;return route.fulfill({contentType:'application/json',body:'{"ok":true,"saved":true}'});});
  await page.route('**/api/ai/chat',route=>{
    requests.push(route.request().postDataJSON());
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,reply:'**پیشنهاد امروز**\n- یک مطلب مفید [1]\n<script>window.hacked=true</script>',sources:[{id:'11111111-1111-4111-8111-111111111111',title:'منبع واقعی',url:'https://t.me/testchannel/12',channel:'کانال تست',kind:'discovery'},{title:'لینک نامعتبر',url:'javascript:alert(1)',id:''}],pages:['saved','admin'],access:{ai_remaining:4}})});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'دستیار کشف',exact:true}).click();
  await page.getByRole('button',{name:'پیدا کردن پست',exact:true}).click();
  await page.getByRole('textbox',{name:'پیام به دستیار'}).fill('درباره یادگیری پست پیدا کن');
  await page.getByRole('button',{name:'ارسال',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'دستیار کشف'});
  await expect(dialog.locator('strong')).toHaveText('پیشنهاد امروز');
  await expect(dialog.getByRole('link',{name:'[1] منبع واقعی',exact:true})).toHaveAttribute('href','https://t.me/testchannel/12');
  await expect(dialog.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(dialog.locator('script')).toHaveCount(0);
  expect(saves).toBe(0);
  await dialog.getByRole('button',{name:'ذخیرهٔ پست',exact:true}).click();
  await expect(dialog.getByRole('status').filter({hasText:'ذخیره شد'})).toBeVisible();
  expect(saves).toBe(1);
  await page.getByRole('textbox',{name:'پیام به دستیار'}).fill('کوتاه‌تر بگو');
  await page.getByRole('button',{name:'ارسال',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(2);
  expect(requests[1].history.map(x=>x.role)).toEqual(['user','assistant']);
  expect(requests[0].mode).toBe('discover');
  await expect(dialog.getByRole('button',{name:'پاک کردن گفتگو'})).toBeEnabled();
  await dialog.getByRole('button',{name:'پاک کردن گفتگو'}).click();
  await expect(dialog.getByText('پیشنهاد امروز',{exact:true})).toHaveCount(0);
});
test('post summary shares selected excerpt only after pressing send',async({page})=>{
  await prepare(page);let requests=[];
  await page.route('**/api/ai/chat',route=>{requests.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:'{"ok":true,"reply":"خلاصهٔ متن انتخابی"}'});});
  await page.goto('/');await page.locator('.postCard').first().click();
  await page.getByRole('button',{name:'خلاصه با دستیار'}).click();
  const dialog=page.getByRole('dialog',{name:'دستیار کشف'});
  await expect(dialog).toBeVisible();expect(requests).toHaveLength(0);
  await dialog.getByRole('button',{name:'ارسال',exact:true}).click();
  await expect(dialog.getByText('خلاصهٔ متن انتخابی',{exact:true})).toBeVisible();
  expect(requests[0].mode).toBe('summarize');expect(requests[0].selected.text.length).toBeGreaterThan(0);
});
