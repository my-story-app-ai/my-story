// Run against the local preview: NODE_PATH may point to bundled Playwright.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let calls=0;
    let testKey='';
    await page.route('**/config.js',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace(/geoapifyApiKey: "[^"]*"/,`geoapifyApiKey: "${testKey}"`)});
    });
    await page.route('https://api.geoapify.com/**',route=>{calls++;return route.fulfill({json:{results:[]}});});
    await page.goto('http://127.0.0.1:8765/app/');
    await page.evaluate(()=>gotoStep(4));
    await page.locator('#place').fill('Vrnjacka');
    await page.waitForTimeout(650);
    assert.equal(calls,0,'No key must mean no external calls');
    testKey='test-only';
    await page.unroute('https://api.geoapify.com/**');
    let fail=false;
    await page.route('https://api.geoapify.com/**',async route=>{
      calls++;
      const query=new URL(route.request().url()).searchParams.get('text');
      if(fail) return route.fulfill({status:429,json:{error:'Quota'}});
      if(query==='Unknown') return route.fulfill({json:{results:[]}});
      if(query==='Slow') await new Promise(resolve=>setTimeout(resolve,900));
      await route.fulfill({json:{results:[{formatted:query==='Kotor'?'Kotor, Montenegro':'Vrnjacka Banja, Serbia',lat:43.62,lon:20.89,place_id:'fixture'}]}});
    });
    await page.reload();await page.evaluate(()=>gotoStep(4));
    const input=page.locator('#place');
    await input.fill('Vr');await page.waitForTimeout(550);assert.equal(calls,0);
    await input.fill('Vrn');await input.fill('Vrnjacka');
    await page.locator('[role="option"]').waitFor();assert.equal(calls,1);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),'my-story-place-mobile.png'),fullPage:true});
    await input.press('ArrowDown');await input.press('Enter');
    assert.equal(await input.inputValue(),'Vrnjacka');
    assert.equal(await page.evaluate(()=>collect().placeLocation.formatted),'Vrnjacka Banja, Serbia');
    await page.evaluate(()=>{gotoStep(3);gotoStep(4);});
    assert.equal(await page.evaluate(()=>MyStoryPlace.getSelection().placeId),'fixture');
    await input.fill('Unknown');assert.equal(await page.evaluate(()=>MyStoryPlace.getSelection()),null);
    await page.waitForFunction(()=>document.getElementById('placeSearchStatus').textContent.startsWith('No matches'));
    fail=true;await input.fill('Kotor');
    await page.waitForFunction(()=>document.getElementById('placeSearchStatus').textContent.includes('unavailable'));
    assert.equal(await input.inputValue(),'Kotor');
    fail=false;await input.fill('Slow');await page.waitForTimeout(500);await input.fill('Kotor');
    await page.locator('[role="option"]').waitFor();await page.waitForTimeout(700);
    assert.equal(await page.locator('[role="option"]').textContent(),'Kotor, Montenegro');
    await page.locator('[role="option"]').click();
    assert.equal(await page.evaluate(()=>MyStoryPlace.getSelection().formatted),'Kotor, Montenegro');
    await page.evaluate(()=>resetFlow());
    assert.equal(await input.inputValue(),'');assert.equal(await page.evaluate(()=>MyStoryPlace.getSelection()),null);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: no-key fallback, debounce, keyboard and touch selection, free text, API failure, stale responses, navigation, reset and mobile width. All API responses mocked.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
