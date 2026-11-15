export const OD_CHANGE_LIMIT = 1700;
export const OD_RAIL_MAX_WIDTH = 5;
export const OD_CHANGE_COLORS = {loss:'#176c91', neutral:'#aab3b7', gain:'#b6532c'};

export function railChange(delta, limit=OD_CHANGE_LIMIT) {
  return Math.sqrt(Math.min(Math.abs(delta)/limit,1));
}

export function odDelta(before, after) {
  return Math.round((after-before)*1000)/1000;
}

export function flowStrength(trips, maximum) {
  return Math.sqrt(Math.max(0,Math.min(trips/maximum,1)));
}

// Grow the flow-dependent part of the stroke, with a cap for dense junctions.
export function zoomStrokeScale(zoom) {
  return Math.min(2.3,1+.6*Math.log2(Math.max(1,zoom)));
}

export function railFlowWidth(trips, maximum) {
  return .85+(OD_RAIL_MAX_WIDTH-.85)*flowStrength(trips,maximum);
}

export function flowCount(value, formatter) {
  return value>0&&value<.1?`<${formatter(.1)}`:formatter(value);
}

export async function readGzip(url,json=false) {
  const response=await fetch(url);
  if(!response.ok)throw Error(`No se pudo leer ${url}: ${response.status}`);
  const decoded=new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
  return json?decoded.json():decoded.arrayBuffer();
}

export function frameURL(dataURL,year,day,hour) {
  const period=day===null?'annual':`${day}-${String(hour).padStart(2,'0')}`;
  return new URL(`raeb/${year}/${period}.f32.gz`,dataURL);
}

export function networkURL(dataURL,meta) {
  const url=new URL(meta.raeb.network,dataURL);
  if(meta.route_model)url.searchParams.set('model',meta.route_model);
  return url;
}
