// Run with Node, Playwright and pdf-lib installed (or available through NODE_PATH).
const {chromium} = require('playwright');
const {PDFDocument} = require('pdf-lib');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const name = new URL(req.url, 'http://localhost').pathname;
      const file = path.join(root, name.endsWith('/') ? name+'index.html' : name);
      if (!file.startsWith(root+path.sep)) throw new Error('Invalid path');
      const mime = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'};
      res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'msedge', headless:true});
  const out = process.env.STORY_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'my-story-output-tests');
  await fs.mkdir(out, {recursive:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/app/`);
    await page.evaluate(async () => {
      const scenes=[];
      for(let i=1;i<=4;i++){
        const image=new Image();
        image.src=`/assets/samples/page-${i}.png`;
        await image.decode();
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=1024;
        canvas.getContext('2d').drawImage(image,0,0,1024,1024);
        scenes.push({dataUrl:canvas.toDataURL('image/jpeg',.85)});
      }
      window.testScenes=scenes;
      window.testPlan={title:'Leto koje pamtimo — Vrnjačka Banja',synopsis:'A holiday together.',scenes:scenes.map((_,i)=>({title:['The Arrival','The Best Part','An Evening Together','The Way Home'][i], summary:'A family moment, remembered in its own way.',location:'Park',time:'Day',action:'INTERNAL DO NOT DISPLAY',framing:'Wide',emotion:'Joy',visual_anchor:'Trees'}))};
    });
    for(const id of ['story-digital','story-print-30x40','story-print-50x70']){
      const result=await page.evaluate(async id=>{
        const preset=MY_STORY_CONFIG.outputPresets['My Story'].find(p=>p.id===id);
        const result=await MyStoryOutput.build(testPlan,testScenes,preset);
        return {pdf:Array.from(new Uint8Array(await result.blob.arrayBuffer())),preview:result.preview};
      },id);
      const bytes=Buffer.from(result.pdf);
      const doc=await PDFDocument.load(bytes);
      assert.equal(doc.getPageCount(),id==='story-digital'?5:1);
      if(id!=='story-digital'){
        const expected=id.endsWith('30x40')?[30,40]:[50,70];
        const size=doc.getPage(0).getSize();
        assert.ok(Math.abs(size.width*2.54/72-expected[0])<.001);
        assert.ok(Math.abs(size.height*2.54/72-expected[1])<.001);
      }
      await fs.writeFile(path.join(out,id+'.pdf'),bytes);
      await fs.writeFile(path.join(out,id+'.jpg'),Buffer.from(result.preview.split(',')[1],'base64'));
    }
    let calls=[];
    let preparationCalls=0;
    const continuity={character_continuity:'PRIVATE_CHARACTER_BRIEF',visual_style:'PRIVATE_STYLE_BRIEF',world_continuity:'PRIVATE_WORLD_BRIEF'};
    let fail=true;
    await page.route('**/api/story-render',async route=>{
      const request=route.request().postDataJSON();
      if(request.stage==='continuity'){
        preparationCalls++;
        return route.fulfill({json:{continuity}});
      }
      for(const key of Object.keys(continuity)) assert.equal(request.plan[key],continuity[key]);
      assert.equal(request.images.length,1);
      if(request.sceneIndex>0) assert.ok(request.continuityImage.startsWith('data:image/jpeg;base64,'));
      calls.push(request.sceneIndex);
      if(request.sceneIndex===1 && fail){fail=false;return route.fulfill({status:503,json:{error:'Test outage'}});}
      const image=await page.evaluate(i=>testScenes[i],request.sceneIndex);
      await route.fulfill({json:{sceneIndex:request.sceneIndex,image}});
    });
    await page.evaluate(()=>{
      state.format='My Story';state.outputPresetId='story-digital';
      state.lastPlan=testPlan;state.publicPreview=testPlan;
      state.lastDetails={memory:'Original memory'};state.lastImages=[testScenes[0]];
      state.planRevision=state.inputRevision;
    });
    await page.evaluate(()=>generateSnapshot());
    assert.equal(calls.length,0,'Unpaid generation must not run');
    assert.equal(preparationCalls,0,'Unpaid continuity planning must not run');
    await page.evaluate(()=>{state.payment.status='paid';return Promise.all([generateSnapshot(),generateSnapshot()]);});
    assert.deepEqual(calls,[0,1]);
    await page.locator('#retryGenerationBtn').click();
    await page.waitForFunction(()=>!generationBusy);
    assert.deepEqual(calls,[0,1,1,2,3],'Retry must reuse scene zero');
    assert.ok(await page.locator('#downloadImageLink').getAttribute('href').then(href=>href.startsWith('blob:')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'mobile-result.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:path.join(out,'desktop-result.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>state.lastDetails.memory),'Original memory');
    assert.equal(await page.evaluate(()=>state.lastPlan.character_continuity),undefined,'Local plan must stay unchanged');
    assert.equal(await page.locator('body').textContent().then(value=>value.includes('PRIVATE_CHARACTER_BRIEF')),false);
    await page.evaluate(()=>generateSnapshot());
    assert.deepEqual(calls,[0,1,1,2,3],'Re-export must not regenerate finished artwork');
    assert.equal(preparationCalls,1,'Prepare continuity only once, including retry and re-export');
    assert.deepEqual(errors,[]);
    console.log('PASS: 3 PDF formats, physical sizes, mobile layout, payment gate, retry and original memory. Artifacts: '+out);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
