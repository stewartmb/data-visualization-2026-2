// Coordinates and distances are in screen pixels. Start with compact groups,
// then merge overlapping markers so numbered groups do not cover each other.
export function stationRadius(zoom){
  return Math.min(6.5,3.4+1.25*Math.log2(Math.max(1,zoom)));
}

export function clusterRadius(count){return 9+Math.min(4,Math.log2(count));}

export function clusterStations(points,distance,protectedIds=new Set()){
  const groups=[];
  for(const point of [...points].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
    let nearest=null,best=Infinity;
    if(!protectedIds.has(point.id))for(const group of groups){
      if(group.protected)continue;
      const d=Math.hypot(point.x-group.x,point.y-group.y);
      if(d<best&&d<=distance&&group.members.every(p=>Math.hypot(point.x-p.x,point.y-p.y)<=distance)){
        nearest=group;best=d;
      }
    }
    if(nearest){
      const n=nearest.members.length;
      nearest.x=(nearest.x*n+point.x)/(n+1);nearest.y=(nearest.y*n+point.y)/(n+1);
      nearest.members.push(point);
    }else groups.push({x:point.x,y:point.y,members:[point],protected:protectedIds.has(point.id)});
  }
  const radius=g=>g.members.length===1?(distance-3)/2:clusterRadius(g.members.length);
  let merged=true;
  while(merged){
    merged=false;
    outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const a=groups[i],b=groups[j];
      if(a.protected||b.protected||Math.hypot(a.x-b.x,a.y-b.y)>=radius(a)+radius(b)+2)continue;
      const na=a.members.length,nb=b.members.length;
      a.x=(a.x*na+b.x*nb)/(na+nb);a.y=(a.y*na+b.y*nb)/(na+nb);
      a.members.push(...b.members);groups.splice(j,1);merged=true;break outer;
    }
  }
  return groups;
}
