export function* betweenZonePairs([zoneA,zoneB],size){
  for(const a of zoneA)for(const b of zoneB){
    yield a*size+b;
    yield b*size+a;
  }
}

function directDistance(a,b){
  const radians=Math.PI/180;
  const angle=Math.sin((b.lat-a.lat)*radians/2)**2+
    Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin((b.lon-a.lon)*radians/2)**2;
  return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(angle)));
}

export function zoneFlow({nodes,links,paths,matrix,zones}){
  const size=nodes.length;
  const loads=new Float64Array(links.length*2);
  let trips=0,routeDistance=0,straightDistance=0;
  for(const pair of betweenZonePairs(zones,size)){
    const weight=matrix[pair];
    const path=paths[pair];
    if(!weight||!path?.length)continue;
    trips+=weight;
    straightDistance+=weight*directDistance(nodes[Math.floor(pair/size)],nodes[pair%size]);
    for(const arc of path){
      loads[arc]+=weight;
      routeDistance+=weight*links[arc>>1].len/1000;
    }
  }
  return {loads,trips,routeKm:trips?routeDistance/trips:0,directKm:trips?straightDistance/trips:0};
}
