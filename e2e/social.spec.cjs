const {test,expect}=require('@playwright/test');
test('comments, reply, report, own delete, likes and failed saves work on mobile',async({page})=>{
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.addInitScript(()=>{window.Telegram={WebApp:{initData:'e2e-verified-member',ready(){},expand(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){}}}};});
 await page.route(/\/functions\/v1\/growth-referral-v1/,r=>r.fulfill({json:{ok:true,member:true}}));
 await page.route(/\/functions\/v1\/onboarding-v1/,r=>r.fulfill({json:{onboarding_done:true,topics:[]}}));
 const id='33333333-3333-4333-8333-333333333333';let liked=false,items=[],failComment=true,failSave=true,saveCalls=0,replyParent;
 const stats=()=>({likes:liked?1:0,liked,comments:items.length});
 await page.route('https://telegram-discovery-app.paniapandora.workers.dev/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname,method=r.request().method();
  const ok=json=>r.fulfill({json});const body=method==='GET'?{}:r.request().postDataJSON();
  if(path.endsWith('/feed'))return ok({items:[{content_id:id,title:'پست آزمون گفتگو',text_content:'متن پست برای آزمون تعامل کاربران',channel_username:'testchannel',source_url:'https://t.me/testchannel/12',social:stats()}]});
  if(path.endsWith('/social'))return ok({ok:true,...stats()});
  if(path.endsWith('/like')){liked=body.liked;return ok({ok:true,...stats()});}
  if(path.endsWith('/comments/report')){items=items.map(c=>c.id===body.comment_id?{...c,reported:true}:c);return ok({ok:true});}
  if(path.endsWith('/comments')){
   if(method==='GET')return ok({ok:true,items,has_more:false,...stats()});
   if(method==='POST'){
    if(failComment){failComment=false;return r.fulfill({status:503,json:{error:'unavailable'}});}
    replyParent=body.parent_id;
    items.unshift({id:crypto.randomUUID(),body:body.text,author:'کاربر آزمون',mine:true,created_at:new Date().toISOString()});return ok({ok:true});
   }
   if(method==='DELETE'){items=items.filter(c=>c.id!==body.comment_id);return ok({ok:true});}
  }
  if(path.endsWith('/save')){saveCalls++;if(failSave)return r.fulfill({status:503,json:{error:'unavailable'}});return ok({ok:true,saved:true});}
  return ok({ok:true,items:[]});
 });
 await page.goto('/');const card=page.locator('.postCard').filter({hasText:'پست آزمون گفتگو'}).first();await expect(card).toBeVisible();
 await card.getByRole('button',{name:'لایک در دیسکاوری',exact:true}).click();await expect(card.getByRole('button',{name:'برداشتن لایک'})).toHaveAttribute('aria-pressed','true');
 await card.getByRole('button',{name:'نظرات دیسکاوری'}).focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'نظرات دیسکاوری'});await expect(dialog).toBeVisible();await expect(page.getByText('جزئیات پست',{exact:true})).toHaveCount(0);
 const input=dialog.getByRole('textbox');await input.fill('<script>alert(1)</script> نظر من');await dialog.getByRole('button',{name:'ارسال نظر',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('متن حفظ شده');await expect(input).toHaveValue('<script>alert(1)</script> نظر من');
 await dialog.getByRole('button',{name:'ارسال نظر',exact:true}).click();await expect(dialog.locator('.commentBody')).toHaveText('<script>alert(1)</script> نظر من');await expect(dialog.locator('script')).toHaveCount(0);
 await dialog.getByRole('button',{name:'پاسخ',exact:true}).click();await input.fill('پاسخ من');await dialog.getByRole('button',{name:'ارسال نظر',exact:true}).click();await expect(dialog.locator('.commentItem')).toHaveCount(2);expect(replyParent).toBeTruthy();
 await dialog.getByRole('button',{name:'حذف نظر من',exact:true}).first().click();await dialog.getByRole('button',{name:'بله، حذف کن'}).click();await expect(dialog.locator('.commentItem')).toHaveCount(1);
 items.push({id:crypto.randomUUID(),body:'نظر کاربر دیگر',author:'دیگری',mine:false,created_at:new Date().toISOString()});
 await dialog.getByRole('button',{name:'بستن نظرات'}).click();await card.getByRole('button',{name:'نظرات دیسکاوری'}).click();await dialog.getByRole('button',{name:'گزارش',exact:true}).click();await expect(dialog.getByRole('button',{name:'گزارش شد'})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await card.getByRole('button',{name:'ذخیره',exact:true}).click();await expect(page.locator('.socialToast')).toContainText('ذخیره‌سازی انجام نشد');await expect(card.getByRole('button',{name:'ذخیره',exact:true})).toHaveAttribute('aria-pressed','false');
 failSave=false;await card.getByRole('button',{name:'ذخیره',exact:true}).click();await expect(card.getByRole('button',{name:'حذف از ذخیره‌ها'})).toHaveAttribute('aria-pressed','true');expect(saveCalls).toBe(2);
 await card.locator('h3').click();await expect(page.getByRole('button',{name:'برداشتن لایک'})).toHaveAttribute('aria-pressed','true');
});
