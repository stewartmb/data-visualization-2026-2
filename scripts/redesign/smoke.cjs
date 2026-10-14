// Functional regression on the real app. Requires Playwright; server must already run.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BASE=process.env.ATLAS_URL||'http://127.0.0.1:8765/atlas/';
const ROOT=path.resolve(__dirname,'../..');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1,acceptDownloads:true});
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>requests.push(r.url()));
  async function state(){return page.evaluate(async()=>{const {state}=await import('/atlas/src/model.js?v=20261014-9');return {...state,cohort:state.cohort?[...state.cohort]:null};});}
  await page.goto(BASE);await page.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await page.locator('#cohort-count').innerText(),'424 / 424');
  assert.equal(await page.locator('#station-picker option').count(),425);
  await page.screenshot({path:path.join(ROOT,'redesign/capturas/atlas.png'),fullPage:true});
  // Selection + details: radial/rectangular must encode exactly 168 cells.
  await page.selectOption('#station-picker','1');
  assert.equal((await state()).selected,'1');
  assert.equal(await page.locator('#detail-body svg path').count(),168);
  await page.locator('[data-clock="false"]').click();
  assert.equal(await page.locator('#detail-body svg rect').count(),168);
  await page.locator('[data-clock="true"]').click();
  await page.locator('#pin-station').click();assert.deepEqual((await state()).pins,['1']);
  await page.locator('#inspect-tab-compare').click();assert.equal(await page.locator('#detail-body svg path[fill="none"][stroke]').count(),2);
  await page.locator('#inspect-tab-evolution').click();assert.equal(await page.locator('#detail-body svg path[fill="none"][stroke]').count(),1);
  await page.locator('#inspect-tab-source').click();assert.match(await page.locator('#detail-body').innerText(),/168 celdas/);
  await page.locator('#inspect-tab-fingerprint').click();
  await page.screenshot({path:path.join(ROOT,'redesign/capturas/detalle.png'),fullPage:true});
  await page.selectOption('#station-picker','224');assert.match(await page.locator('.service-context').innerText(),/Contexto de servicio/);
  await page.locator('.service-context summary').click();assert.match(await page.locator('.service-context').innerText(),/63 St/);
  await page.selectOption('#station-picker','118');await page.locator('.service-context summary').click();assert.match(await page.locator('.service-context').innerText(),/L Project/);
  await page.selectOption('#station-picker','1');
  // Shared selection across all views and a fully offline render.
  await page.locator('[data-view="map"]').click();assert.equal(await page.locator('.map-dot').count(),424);
  assert.equal((await state()).selected,'1');assert.equal(await page.locator('.map-bg').count(),5);
  await page.locator('#pin-station').click();await page.locator('#close-inspector').click();await page.screenshot({path:path.join(ROOT,'redesign/capturas/geografia.png'),fullPage:true});
  // Geographic brush returns a proper subset; zoom compensates marker size.
  await page.locator('#map-select').click();
  const mapBox=await page.locator('.map-svg').boundingBox();
  await page.mouse.move(mapBox.x+10,mapBox.y+60);await page.mouse.down();await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height-20,{steps:12});await page.mouse.up();
  const mapGroup=(await state()).cohort;assert.ok(mapGroup.length>0&&mapGroup.length<424);assert.equal(await page.locator('.map-dot').count(),mapGroup.length);
  await page.locator('#reset').click();
  await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height/2);await page.mouse.wheel(0,-180);
  await page.waitForFunction(()=>+document.querySelector('.map-dot').getAttribute('r')<4.1);
  await page.locator('#map-center').click();await page.waitForFunction(()=>Math.abs(+document.querySelector('.map-dot').getAttribute('r')-4.1)<.001);
  await page.locator('[data-view="paths"]').click();assert.equal(await page.locator('.path-station').count(),424);
  await page.screenshot({path:path.join(ROOT,'redesign/capturas/trayectorias.png'),fullPage:true});
  await page.locator('#all-paths').click();assert.equal((await state()).pathsFocus,false);
  // Brush using the actual pointer, in empty plot space, must preserve the empty set.
  const box=await page.locator('.paths-svg').boundingBox();
  await page.mouse.move(box.x+68,box.y+44);await page.mouse.down();await page.mouse.move(box.x+73,box.y+49,{steps:4});await page.mouse.up();
  assert.equal((await state()).cohort.length,0);
  await page.reload();await page.waitForSelector('#loading',{state:'hidden'});assert.equal((await state()).cohort.length,0);
  await page.locator('#reset').click();
  // Cohort by borough, task preset, year and query; persistence across views.
  await page.selectOption('#borough','Queens');assert.equal(await page.locator('#cohort-count').innerText(),'79 / 424');
  await page.locator('[data-view="atlas"]').click();await page.selectOption('#station-picker','1');
  await page.locator('#find-neighbors').click();assert.equal((await state()).cohort.length,13);
  assert.equal((await state()).selected,'1');assert.equal(await page.locator('#cohort-count').innerText(),'13 / 424');
  await page.locator('#close-inspector').click();await page.selectOption('#year','2021');assert.equal((await state()).year,2021);
  await page.locator('[data-view="map"]').click();assert.equal(await page.locator('.map-dot').count(),13);
  await page.locator('#reset').click();await page.selectOption('#year','2024');
  await page.locator('[data-preset="decoupled"]').click();assert.equal(await page.locator('#cohort-count').innerText(),'21 / 424');
  await page.locator('[data-view="evidence"]').click();assert.equal(await page.locator('tbody tr').count(),21);
  // Export should contain only the active cohort, plus header and source timestamp.
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
  const p=await download.path(),csv=fs.readFileSync(p,'utf8');assert.equal(csv.trim().split('\n').length,22);assert.match(csv,/retrieved_at_utc/);
  await page.locator('#save').click();assert.equal(await page.locator('[data-saved]').count(),1);
  await page.reload();await page.waitForSelector('#loading',{state:'hidden'});assert.equal(await page.locator('tbody tr').count(),21);
  await page.screenshot({path:path.join(ROOT,'redesign/capturas/evidencia.png'),fullPage:true});
  // Empty search and recovery.
  await page.locator('#reset').click();await page.locator('#search').fill('NO-EXISTE-ESTACION-999');await page.waitForFunction(()=>document.querySelector('#cohort-count').textContent==='0 / 424');
  await page.locator('#reset').click();await page.locator('[data-view="atlas"]').click();
  await page.selectOption('#station-picker','1');await page.locator('#help').click();assert.equal(await page.locator('#guide').evaluate(e=>e.open),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#guide').evaluate(e=>e.open),false);assert.equal((await state()).selected,'1');
  await page.locator('#close-inspector').click();
  // Offline reload: all runtime resources are local.
  await page.route('**/*',route=>route.request().url().startsWith(new URL(BASE).origin+'/')?route.continue():route.abort());
  await page.reload();await page.waitForSelector('#loading',{state:'hidden'});assert.equal(await page.locator('#cohort-count').innerText(),'424 / 424');
  // Mobile has a usable layout without horizontal overflow.
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(ROOT,'redesign/capturas/movil.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await browser.close();
  const result={result:'PASS',verified_at_utc:new Date().toISOString(),browser:browser.version(),console_errors:errors.length,failed_requests:requests.length,checks:['actual data load','168 radial and matrix cells','selection and pins','all views','service context for 63 St and L Project','geographic brush','zoom and radius compensation','empty brush and URL restore','borough filter','12 nearest neighbors','year switch','volume vs rhythm cohort','CSV export','local bookmarks','empty search','keyboard Escape','local runtime resources','390px layout'],screenshots:6};
  fs.writeFileSync(path.join(ROOT,'redesign/ui-checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exit(1);});
