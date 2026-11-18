// Genera las figuras 1, 2 y 4 (PDF vectorial) a partir de los HTML de esta carpeta.
// Uso: node build_figuras.cjs   (requiere Playwright con Chromium)
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();
 for(const [html,pdf,w,h] of [['fig1_resumen_grafico.html','../fig1_resumen_grafico.pdf','181mm','61mm'],['fig2_app.html','../fig2_app.pdf','181mm','113.1mm'],['fig4_casos.html','../fig4_casos.pdf','181mm','40mm']]){
  const p=await b.newPage();await p.goto('file://'+path.resolve(__dirname,html));await p.evaluate(()=>document.fonts.ready);
  await p.pdf({path:path.resolve(__dirname,pdf),width:w,height:h,printBackground:true,pageRanges:'1'});await p.close();console.log('ok',pdf);}
 await b.close();})();
