// RAEB/KDEEB numerical core. Paper sections 3.1, 4.3–5.2 and 6.1.
// Rail adaptation: hier(r)=1 (no fictitious road classes); controls normalize
// route awareness to [0,1] and multiply the automatically estimated kernel.
export const LEVELS=[0,.05,.10,.20,.40,1];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function resample(points,count=32){
  const out=new Float32Array(count*2),lengths=new Float64Array(points.length);
  for(let i=1;i<points.length;i++)lengths[i]=lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  const total=lengths.at(-1)||0;let j=1;
  for(let k=0;k<count;k++){
    const t=total*k/(count-1);while(j<points.length-1&&lengths[j]<t)j++;
    const a=points[Math.max(0,j-1)],b=points[Math.min(j,points.length-1)],u=(t-lengths[j-1])/(lengths[j]-lengths[j-1]||1);
    out[2*k]=a[0]+(b[0]-a[0])*u;out[2*k+1]=a[1]+(b[1]-a[1])*u;
  }
  return out;
}

export function discreteFrechet(a,b){
  const n=a.length/2,m=b.length/2;let prev=new Float64Array(m).fill(Infinity),row=new Float64Array(m);
  for(let i=0;i<n;i++){
    for(let j=0;j<m;j++){
      const d=Math.hypot(a[2*i]-b[2*j],a[2*i+1]-b[2*j+1]);
      row[j]=i===0&&j===0?d:Math.max(d,Math.min(i?prev[j]:Infinity,j?row[j-1]:Infinity,i&&j?prev[j-1]:Infinity));
    }
    [prev,row]=[row,prev];
  }
  return prev[m-1];
}

export function routeHierarchy(links){
  const maxLen=Math.max(1,...links.map(l=>l.len)),maxFlow=Math.max(1,...links.map(l=>l.reference_flow||0));
  const ranked=links.map((l,i)=>({i,score:.3*l.len/maxLen+.1+.6*(l.reference_flow||0)/maxFlow})).sort((a,b)=>b.score-a.score||a.i-b.i);
  const level=new Uint8Array(links.length);
  for(let k=1;k<LEVELS.length;k++)for(let j=0;j<Math.ceil(LEVELS[k]*ranked.length);j++)if(!level[ranked[j].i])level[ranked[j].i]=k;
  return {ranked,level};
}

export function estimateKernel(routes,ranked,width,height){
  // Algorithm 1: Frechet distances, DBSCAN and half the largest cluster's
  // average distance. A small rail graph needs a declared minimum pool.
  const size=Math.min(routes.length,Math.max(16,Math.ceil(routes.length*.01)));
  const selected=ranked.slice(0,size).map(r=>resample(routes[r.i],12));
  const distances=Array.from({length:size},()=>new Float64Array(size));
  for(let i=0;i<size;i++)for(let j=i+1;j<size;j++)distances[i][j]=distances[j][i]=discreteFrechet(selected[i],selected[j]);
  const epsilon=5,minNum=Math.min(8,size),visited=new Uint8Array(size),labels=new Int32Array(size).fill(-1),clusters=[];
  const neighbors=i=>Array.from({length:size},(_,j)=>j).filter(j=>distances[i][j]<=epsilon);
  for(let i=0;i<size;i++){
    if(visited[i])continue;visited[i]=1;const near=neighbors(i);if(near.length<minNum)continue;
    const cluster=[],queue=[...near],id=clusters.length;
    for(let q=0;q<queue.length;q++){
      const j=queue[q];if(!visited[j]){visited[j]=1;const nn=neighbors(j);if(nn.length>=minNum)for(const k of nn)if(!queue.includes(k))queue.push(k);}
      if(labels[j]<0){labels[j]=id;cluster.push(j);}
    }
    clusters.push(cluster);
  }
  const largest=clusters.sort((a,b)=>b.length-a.length)[0];
  const pool=largest?.length>1?largest:Array.from({length:size},(_,i)=>i);
  let total=0,pairs=0;
  for(const i of pool)for(const j of pool)if(i!==j){total+=distances[i][j];pairs++;}
  const raw=pairs?total/pairs/2:Math.min(width,height)*.04;
  return {radius:clamp(raw,2,Math.min(width,height)*.10),rawRadius:raw,dbscanFallback:!largest,routePool:size};
}

export function normalizedMI(a,b){
  let maxA=0,maxB=0;for(let i=0;i<a.length;i++){maxA=Math.max(maxA,a[i]);maxB=Math.max(maxB,b[i]);}
  if(maxA===0&&maxB===0)return 1;
  const pixels=a instanceof Uint8Array&&b instanceof Uint8Array;
  const joint=new Uint32Array(65536),ha=new Uint32Array(256),hb=new Uint32Array(256),n=a.length;
  for(let i=0;i<n;i++){
    const x=clamp(Math.round(pixels?a[i]:255*a[i]/(maxA||1)),0,255),y=clamp(Math.round(pixels?b[i]:255*b[i]/(maxB||1)),0,255);
    joint[(x<<8)|y]++;ha[x]++;hb[y]++;
  }
  let Hx=0,Hy=0,mi=0;
  for(let i=0;i<256;i++){if(ha[i]){const p=ha[i]/n;Hx-=p*Math.log(p);}if(hb[i]){const p=hb[i]/n;Hy-=p*Math.log(p);}}
  for(let i=0;i<65536;i++)if(joint[i]){const p=joint[i]/n;mi+=p*Math.log(p/((ha[i>>8]/n)*(hb[i&255]/n)));}
  return Hx+Hy?2*mi/(Hx+Hy):1;
}

// Exact discrete radial Epanechnikov convolution of the rasterized samples.
// Three row prefix moments reduce each disk row to O(1), instead of splatting
// a full kernel for every one of millions of trajectory samples.
export function epanechnikov(field,width,height,radius){
  const stride=width+1,size=stride*height;
  const p0=new Float64Array(size),p1=new Float64Array(size),p2=new Float64Array(size);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=y*stride+x,w=field[y*width+x];p0[k+1]=p0[k]+w;p1[k+1]=p1[k]+w*x;p2[k+1]=p2[k]+w*x*x;
  }
  const result=new Float32Array(width*height),rr=radius*radius,integer=Math.ceil(radius);
  for(let dy=-integer;dy<=integer;dy++){
    if(dy*dy>rr)continue;
    const dx=Math.floor(Math.sqrt(rr-dy*dy)),factor=1-dy*dy/rr;
    for(let y=Math.max(0,-dy);y<Math.min(height,height-dy);y++){
      const row=(y+dy)*stride,dest=y*width;
      for(let x=0;x<width;x++){
        const lo=row+Math.max(0,x-dx),hi=row+Math.min(width,x+dx+1);
        const s0=p0[hi]-p0[lo],s1=p1[hi]-p1[lo],s2=p2[hi]-p2[lo];
        result[dest+x]+=Math.max(0,(factor-x*x/rr)*s0+2*x*s1/rr-s2/rr);
      }
    }
  }
  return result;
}

function splat(points,masses,samples,width,height){
  const field=new Float32Array(width*height);
  for(let curve=0;curve<masses.length;curve++)for(let j=0;j<samples;j++){
    const k=(curve*samples+j)*2,x=clamp(points[k],0,width-1.001),y=clamp(points[k+1],0,height-1.001),ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,w=masses[curve];
    field[iy*width+ix]+=w*(1-fx)*(1-fy);field[iy*width+ix+1]+=w*fx*(1-fy);
    field[(iy+1)*width+ix]+=w*(1-fx)*fy;field[(iy+1)*width+ix+1]+=w*fx*fy;
  }
  return field;
}

// Blended trail image for paper Eq. 5: convergence compares rendered trails,
// not the changing KDE radius. The raster is the same bounded worker grid.
export function trailImage(points,weights,samples,width,height){
  const optical=new Float32Array(width*height);
  for(let c=0;c<weights.length;c++){
    let previous=-1;
    for(let j=1;j<samples;j++){
      const k=(c*samples+j)*2,ax=points[k-2],ay=points[k-1],dx=points[k]-ax,dy=points[k+1]-ay;
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));
      for(let t=0;t<=steps;t++){
        const x=clamp(Math.round(ax+dx*t/steps),0,width-1),y=clamp(Math.round(ay+dy*t/steps),0,height-1),index=y*width+x;
        if(index!==previous){optical[index]+=weights[c]/800;previous=index;}
      }
    }
  }
  return Uint8Array.from(optical,v=>Math.round(255*(1-Math.exp(-v))));
}

export function makeScene(nodes,links,paths,weights,width,height,samples=32){
  const gw=clamp(Math.round(width/4),192,320),gh=Math.max(96,Math.round(height*gw/width)),sx=(gw-3)/width,sy=(gh-3)/height;
  const project=p=>[p[0]*sx+1,p[1]*sy+1];
  const nodeXY=nodes.map(project),routes=links.map(l=>l.points.map(project));
  const hierarchy=routeHierarchy(links),kernel=estimateKernel(routes,hierarchy.ranked,gw,gh);
  const n=nodes.length,active=[];
  for(let pair=0;pair<weights.length;pair++)if(weights[pair]>0&&paths[pair]?.length)active.push(pair);
  const metadata=new Float32Array(active.length*4),seedCache=new Map();
  for(let i=0;i<active.length;i++){const pair=active[i];metadata.set([weights[pair],Math.floor(pair/n),pair%n,0],i*4);}
  const sampleLevels=new Float32Array(active.length*samples);
  function seed(level){
    if(seedCache.has(level))return seedCache.get(level);
    const points=new Float32Array(active.length*samples*2);
    for(let i=0;i<active.length;i++){
      const pair=active[i],origin=nodeXY[Math.floor(pair/n)],destination=nodeXY[pair%n];
      if(level===0){points.set(resample([origin,destination],samples),i*samples*2);continue;}
      const poly=[origin],tags=[hierarchy.level[paths[pair][0]>>1]];
      for(const arc of paths[pair]){
        const link=arc>>1,r=routes[link],tag=hierarchy.level[link];
        if(arc&1)for(let k=r.length-1;k>=0;k--){poly.push(r[k]);tags.push(tag);}
        else for(const p of r){poly.push(p);tags.push(tag);}
      }
      poly.push(destination);tags.push(tags.at(-1));
      const lengths=new Float64Array(poly.length);
      for(let j=1;j<poly.length;j++)lengths[j]=lengths[j-1]+Math.hypot(poly[j][0]-poly[j-1][0],poly[j][1]-poly[j-1][1]);
      const kept=[0];for(let j=1;j<poly.length-1;j++)if(tags[j]<=level)kept.push(j);kept.push(poly.length-1);
      let next=1,original=1;const total=lengths.at(-1);
      for(let j=0;j<samples;j++){
        // All hierarchy levels use the ORIGINAL route arc-length parameter.
        // Resampling each simplified curve independently makes corresponding
        // points slide around corners and creates spurious diagonal curtains.
        const t=total*j/(samples-1);
        while(next<kept.length-1&&lengths[kept[next]]<t)next++;
        while(original<poly.length-1&&lengths[original]<t)original++;
        const lo=kept[next-1],hi=kept[next],u=(t-lengths[lo])/(lengths[hi]-lengths[lo]||1),k=(i*samples+j)*2;
        points[k]=poly[lo][0]+u*(poly[hi][0]-poly[lo][0]);points[k+1]=poly[lo][1]+u*(poly[hi][1]-poly[lo][1]);
        if(level===5)sampleLevels[i*samples+j]=Math.max(tags[original-1],tags[original]);
      }
    }
    seedCache.set(level,points);return points;
  }
  function retention(f){seed(5);const out=new Float32Array(sampleLevels.length);for(let i=0;i<out.length;i++)out[i]=clamp(f*5-sampleLevels[i]+1,0,1);return out;}
  function guide(f){
    const field=new Float32Array(gw*gh),k=f*5;
    for(let i=0;i<routes.length;i++){
      const strength=clamp(k-hierarchy.level[i]+1,0,1);if(!strength)continue;
      const r=routes[i];
      for(let j=1;j<r.length;j++){
        const [ax,ay]=r[j-1],[bx,by]=r[j],steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)*1.5));
        for(let t=0;t<=steps;t++){
          const x=clamp(Math.round(ax+(bx-ax)*t/steps),0,gw-1),y=clamp(Math.round(ay+(by-ay)*t/steps),0,gh-1);
          field[y*gw+x]=Math.max(field[y*gw+x],strength);
        }
      }
    }
    return field;
  }
  function seedAt(f){
    const k=f*5,lo=Math.floor(k),hi=Math.ceil(k),a=seed(lo);if(lo===hi)return a.slice();
    const b=seed(hi),out=new Float32Array(a.length),t=k-lo;
    for(let i=0;i<out.length;i++)out[i]=a[i]+t*(b[i]-a[i]);return out;
  }
  function css(points){
    const result=new Float32Array(points.length);
    for(let i=0;i<result.length;i+=2){result[i]=(points[i]-1)/sx;result[i+1]=(points[i+1]-1)/sy;}return result;
  }
  return {gridToCss:[1/sx,1/sy],hierarchy,nodeCount:n,width:gw,height:gh,samples,active,metadata,kernel,routes,seed,seedAt,guide,retention,sampleLevels,css,weights:active.map(p=>weights[p]),scale:Math.max(1/sx,1/sy)};
}

export async function bundle(scene,fidelity,strength,{cancelled=()=>false,progress=()=>{},maxIterations=48}={}){
  const started=performance.now(),{width,height,samples}=scene;
  const reference=scene.seed(5),points=scene.seedAt(fidelity);
  if(strength<=0||fidelity>=1||!scene.active.length)return {points:scene.css(points),stats:{iterations:0,nmi:1,converged:true,ms:performance.now()-started,kernel:scene.kernel}};
  const seed=points.slice(),guide=scene.guide(fidelity),retained=scene.retention(fidelity);
  const masses=new Float32Array(scene.active.length);
  for(let c=0;c<masses.length;c++){
    let len=0;for(let j=1;j<samples;j++){const k=(c*samples+j)*2;len+=Math.hypot(points[k]-points[k-2],points[k+1]-points[k-1]);}
    masses[c]=scene.weights[c]*Math.max(1,len/(samples-1));
  }
  let radius=Math.max(.05,scene.kernel.radius*strength),previous=trailImage(points,scene.weights,samples,width,height),nmi=0,iterations=0;
  let next=new Float32Array(points.length);
  for(let iteration=0;iteration<maxIterations;iteration++){
    if(cancelled())return null;
    const field=epanechnikov(splat(points,masses,samples,width,height),width,height,radius);
    let max=0;for(const v of field)max=Math.max(max,v);
    for(let i=0;i<field.length;i++)field[i]+=1.1*max*guide[i];

    for(let c=0;c<masses.length;c++)for(let j=0;j<samples;j++){
      const k=(c*samples+j)*2,x=points[k],y=points[k+1];
      if(j===0||j===samples-1){next[k]=seed[k];next[k+1]=seed[k+1];continue;}
      const binding=retained[c*samples+j];
      if(binding===1){next[k]=reference[k];next[k+1]=reference[k+1];continue;}
      const ix=clamp(Math.round(x),1,width-2),iy=clamp(Math.round(y),1,height-2),p=iy*width+ix;
      const dx=field[p+1]-field[p-1],dy=field[p+width]-field[p-width],len=Math.hypot(dx,dy)||1;
      const step=binding>0?Math.min(radius,.45):radius;
      next[k]=clamp(x+step*dx/len,1,width-2);next[k+1]=clamp(y+step*dy/len,1,height-2);
    }
    // Laplacian smoothing, with fixed endpoints. No graph edge is added here.
    for(let c=0;c<masses.length;c++)for(let j=1;j<samples-1;j++){
      const k=(c*samples+j)*2;
      const binding=retained[c*samples+j];
      const px=.25*next[k-2]+.5*next[k]+.25*next[k+2],py=.25*next[k-1]+.5*next[k+1]+.25*next[k+3];
      points[k]=(1-binding)*px+binding*reference[k];points[k+1]=(1-binding)*py+binding*reference[k+1];
    }
    const image=trailImage(points,scene.weights,samples,width,height);
    if(previous)nmi=normalizedMI(previous,image);
    iterations=iteration+1;previous=image;radius=radius*.9;
    if(iteration===1||iteration===4)progress(scene.css(points),{iteration:iterations,nmi});
    if(nmi>=.8)break;
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  let deviation=0,checked=0;
  const step=Math.max(1,Math.ceil(scene.active.length/128));
  for(let c=0;c<scene.active.length;c+=step){const start=c*samples*2;deviation+=discreteFrechet(points.subarray(start,start+samples*2),reference.subarray(start,start+samples*2));checked++;}
  return {points:scene.css(points),stats:{iterations,nmi,converged:nmi>=.8,ms:performance.now()-started,kernel:scene.kernel,deviationPx:checked?deviation/checked*scene.scale:0,deviationSample:checked}};
}

// KDEEB is direction independent: at f=0, O→D and D→O have identical
// reversed seeds. Solve their summed weight once and expand every original
// directed OD afterwards. This is an exact multiplicity reduction, not sampling.
export async function bundleFree(scene,options={}){
  const groups=new Map(),members=new Uint32Array(scene.active.length),reversed=new Uint8Array(scene.active.length),first=[],weights=[];
  for(let i=0;i<scene.active.length;i++){
    const o=scene.metadata[i*4+1],d=scene.metadata[i*4+2],key=Math.min(o,d)*scene.nodeCount+Math.max(o,d);
    let g=groups.get(key);if(g===undefined){g=groups.size;groups.set(key,g);first.push(i);weights.push(0);}
    members[i]=g;reversed[i]=o>d?1:0;weights[g]+=scene.weights[i];
  }
  const S=scene.samples,cache=new Map();
  const seed=level=>{
    if(cache.has(level))return cache.get(level);const full=scene.seed(level),out=new Float32Array(first.length*S*2);
    for(let g=0;g<first.length;g++)for(let j=0;j<S;j++){
      const i=first[g],source=(i*S+(reversed[i]?S-1-j:j))*2,target=(g*S+j)*2;
      out[target]=full[source];out[target+1]=full[source+1];
    }
    cache.set(level,out);return out;
  };
  const expand=points=>{
    const out=new Float32Array(scene.active.length*S*2);
    for(let i=0;i<scene.active.length;i++)for(let j=0;j<S;j++){
      const source=(members[i]*S+(reversed[i]?S-1-j:j))*2,target=(i*S+j)*2;
      out[target]=points[source];out[target+1]=points[source+1];
    }return out;
  };
  const reduced={...scene,active:first,weights,seed,seedAt:()=>seed(0).slice(),retention:()=>new Float32Array(first.length*S)};
  const result=await bundle(reduced,0,1,{...options,progress:(points,stats)=>options.progress?.(expand(points),stats)});
  return result?{points:expand(result.points),stats:{...result.stats,directedRelations:scene.active.length,freeSymmetricTrails:first.length}}:null;
}
