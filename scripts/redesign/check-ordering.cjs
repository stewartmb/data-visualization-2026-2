const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/atlas/?mode=current&sort=change');await page.waitForSelector('#matrix-sort');
 assert.equal(await page.locator('#matrix-sort').inputValue(),'morning');
 assert.equal(await page.locator('#matrix-sort option[value="change"]').count(),0);
 assert.equal(await page.locator('#matrix-sort option[value="similar"]').getAttribute('disabled'),'');
 await page.locator('[data-mode="base"]').click();await page.selectOption('#matrix-sort','volume');
 assert.match(await page.locator('.order-explanation').innerText(),/2020/);
 await page.selectOption('#matrix-day','0');assert.match(await page.locator('.order-explanation').innerText(),/lunes/);
 await page.selectOption('#matrix-sort','morning');
 const result=await page.evaluate(async()=>{
  const {atlasOrder}=await import('/atlas/src/atlas-order.js');const data=await (await fetch('/atlas/data/atlas.json')).json();const ss=data.stations;
  const sum=a=>a.reduce((x,y)=>x+y,0);
  let cases=0;
  for(const mode of ['base','current','delta'])for(const day of ['all','0','5']){
   const st={mode,day,year:2024,sort:'morning'};
   const days=day==='all'?[0,1,2,3,4]:[+day];
   const am=(s,y)=>{const p=s.profiles[y].p;return 100*sum(days.flatMap(d=>p.slice(d*24+6,d*24+10)))/sum(days.flatMap(d=>p.slice(d*24,d*24+24)));};
   const o=atlasOrder(ss,st,null);const expected=[...ss].sort((a,b)=>mode==='delta'?(am(a,'2024')-am(a,'2020'))-(am(b,'2024')-am(b,'2020')):am(b,mode==='base'?'2020':'2024')-am(a,mode==='base'?'2020':'2024'));
   if(o.rows[0].id!==expected[0].id)throw Error('AM order '+mode+' '+day);cases++;
   for(const [sort] of o.options){const t=atlasOrder(ss,{...st,sort},ss[100]);if(t.rows.length!==424||t.rows.some(s=>!Number.isFinite(t.value(s))))throw Error('Invalid '+sort);cases++;}
  }
  const b=atlasOrder(ss,{mode:'base',year:2024,day:'all',sort:'volume'},null);const exp=[...ss].sort((a,b)=>b.profiles['2020'].daily-a.profiles['2020'].daily);if(b.rows[0].id!==exp[0].id)throw Error('Baseline volume');
  const nearest=atlasOrder(ss,{mode:'base',year:2024,day:'0',sort:'similar'},ss[100]);if(nearest.rows[0].id!==ss[100].id)throw Error('Self similarity');
  return {cases,baselineTop:b.rows[0].name};
 });
 await page.locator('[data-mode="delta"]').click();assert.equal(await page.locator('#matrix-sort option[value="change"]').count(),1);
 await page.selectOption('#matrix-sort','morningUp');assert.match(await page.locator('.order-explanation').innerText(),/mayor aumento/);
 await page.locator('[data-detail="true"]').click();await page.locator('.matrix-scroll').evaluate(e=>e.scrollTop=600);await page.selectOption('#matrix-day','1');assert.equal(await page.locator('.matrix-scroll').evaluate(e=>e.scrollTop),0);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',...result,browserErrors:errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
