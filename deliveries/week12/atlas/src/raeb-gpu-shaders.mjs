// WebGPU compute and drawing share the same optical rasterizer. All totals
// accumulate in two u32 words (carry addition), avoiding float-atomic extensions.
export const COMPUTE = /* wgsl */ `
struct Params {
 dims:vec4u, raster:vec4u, control:vec4f, project:vec4f, conversion:vec4f, flags:vec4u,
}
struct Wide {lo:atomic<u32>,hi:atomic<u32>,}
struct Optical {blue:Wide,orange:Wide,}
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read_write> points:array<vec2f>;
@group(0) @binding(2) var<storage,read_write> advected:array<vec2f>;
@group(0) @binding(3) var<storage,read> lowSeed:array<vec2f>;
@group(0) @binding(4) var<storage,read> highSeed:array<vec2f>;
@group(0) @binding(5) var<storage,read> reference:array<vec2f>;
@group(0) @binding(6) var<storage,read> levels:array<f32>;
@group(0) @binding(7) var<storage,read> metadata:array<vec4f>;
@group(0) @binding(8) var<storage,read_write> masses:array<f32>;
@group(0) @binding(9) var<storage,read_write> density:array<Wide>;
@group(0) @binding(10) var<storage,read_write> decoded:array<f32>;
@group(0) @binding(11) var<storage,read_write> field:array<f32>;
@group(0) @binding(12) var<storage,read_write> guide:array<atomic<u32>>;
@group(0) @binding(13) var<storage,read_write> maxima:array<f32>;
@group(0) @binding(14) var<storage,read_write> fieldMax:array<f32>;
@group(0) @binding(15) var<storage,read_write> optical:array<Optical>;
@group(0) @binding(16) var<storage,read_write> previousImage:array<u32>;
@group(0) @binding(17) var<storage,read_write> currentImage:array<u32>;
@group(0) @binding(18) var<storage,read_write> joint:array<atomic<u32>>;
@group(0) @binding(19) var<storage,read_write> histA:array<atomic<u32>>;
@group(0) @binding(20) var<storage,read_write> histB:array<atomic<u32>>;
@group(0) @binding(21) var<storage,read_write> nmiParts:array<vec4f>;
@group(0) @binding(22) var<storage,read_write> statistics:array<vec4f>;
@group(0) @binding(23) var<storage,read> railVertices:array<vec2f>;
@group(0) @binding(24) var<storage,read> rails:array<vec4f>;
fn addWide(accumulator:ptr<storage,Wide,read_write>,amount:f32){
 let value=floor(max(0.0,amount)*65536.0+0.5);
 let high=floor(value/4294967296.0);
 let low=u32(value-high*4294967296.0);
 let old=atomicAdd(&(*accumulator).lo,low);
 let carry=select(0u,1u,old>0xffffffffu-low);
 atomicAdd(&(*accumulator).hi,u32(high)+carry);
}
fn readWide(accumulator:ptr<storage,Wide,read_write>)->f32{
 return (f32(atomicLoad(&(*accumulator).hi))*4294967296.0+f32(atomicLoad(&(*accumulator).lo)))/65536.0;
}
fn retained(i:u32)->f32{return clamp(p.control.x*5.0-levels[i]+1.0,0.0,1.0);}
fn seed(i:u32)->vec2f{return mix(lowSeed[i],highSeed[i],p.control.w);}
@compute @workgroup_size(256) fn initialize(@builtin(global_invocation_id) id:vec3u){
 let c=id.x;if(c>=p.dims.z){return;}let base=c*p.dims.w;var len=0.0;
 for(var j=0u;j<p.dims.w;j++){points[base+j]=seed(base+j);if(j>0u){len+=distance(seed(base+j),seed(base+j-1u));}}
 masses[c]=metadata[c].x*max(1.0,len/f32(p.dims.w-1u));
}
@compute @workgroup_size(256) fn splat(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=p.dims.z*p.dims.w){return;}
 let xy=clamp(points[i],vec2f(0.0),vec2f(p.dims.xy)-vec2f(1.001));
 let cell=vec2u(xy);let fraction=fract(xy);let base=cell.y*p.dims.x+cell.x;let mass=masses[i/p.dims.w];
 addWide(&density[base],mass*(1.0-fraction.x)*(1.0-fraction.y));
 addWide(&density[base+1u],mass*fraction.x*(1.0-fraction.y));
 addWide(&density[base+p.dims.x],mass*(1.0-fraction.x)*fraction.y);
 addWide(&density[base+p.dims.x+1u],mass*fraction.x*fraction.y);
}
@compute @workgroup_size(256) fn decodeDensity(@builtin(global_invocation_id) id:vec3u){
 if(id.x<p.dims.x*p.dims.y){decoded[id.x]=readWide(&density[id.x]);}
}
@compute @workgroup_size(8,8) fn convolve(@builtin(global_invocation_id) id:vec3u){
 if(any(id.xy>=p.dims.xy)){return;}
 let radius=p.control.z;let rr=radius*radius;let limit=i32(ceil(radius));var sum=0.0;
 for(var dy=-limit;dy<=limit;dy++){
  let y=i32(id.y)+dy;if(y<0||y>=i32(p.dims.y)){continue;}
  for(var dx=-limit;dx<=limit;dx++){
   let x=i32(id.x)+dx;let dd=f32(dx*dx+dy*dy);if(x<0||x>=i32(p.dims.x)||dd>rr){continue;}
   sum+=decoded[u32(y)*p.dims.x+u32(x)]*max(0.0,1.0-dd/rr);
  }
 }
 field[id.y*p.dims.x+id.x]=sum;
}
var<workgroup> maxWork:array<f32,256>;
@compute @workgroup_size(256) fn maximum(@builtin(global_invocation_id) id:vec3u,@builtin(local_invocation_index) local:u32,@builtin(workgroup_id) group:vec3u){
 var value=0.0;if(id.x<p.dims.x*p.dims.y){value=field[id.x];}maxWork[local]=value;workgroupBarrier();
 for(var stride=128u;stride>0u;stride/=2u){if(local<stride){maxWork[local]=max(maxWork[local],maxWork[local+stride]);}workgroupBarrier();}
 if(local==0u){maxima[group.x]=maxWork[0];}
}
@compute @workgroup_size(1) fn maximumFinal(){
 var m=0.0;for(var i=0u;i<arrayLength(&maxima);i++){m=max(m,maxima[i]);}fieldMax[0]=m;
}
@compute @workgroup_size(256) fn boost(@builtin(global_invocation_id) id:vec3u){
 if(id.x<p.dims.x*p.dims.y){field[id.x]+=1.1*fieldMax[0]*f32(atomicLoad(&guide[id.x]))/65535.0;}
}
@compute @workgroup_size(256) fn advect(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=p.dims.z*p.dims.w){return;}let j=i%p.dims.w;
 if(j==0u||j==p.dims.w-1u){advected[i]=seed(i);return;}
 let binding=retained(i);if(binding==1.0){advected[i]=reference[i];return;}
 let xy=points[i];let cell=vec2u(clamp(floor(xy+vec2f(.5)),vec2f(1),vec2f(p.dims.xy)-vec2f(2)));
 let k=cell.y*p.dims.x+cell.x;let gradient=vec2f(field[k+1u]-field[k-1u],field[k+p.dims.x]-field[k-p.dims.x]);
 let magnitude=length(gradient);var delta=vec2f(0);if(magnitude>0.0){delta=gradient/magnitude;}
 let step=select(p.control.z,min(p.control.z,.45),binding>0.0);
 advected[i]=clamp(xy+step*delta,vec2f(1),vec2f(p.dims.xy)-vec2f(2));
}
@compute @workgroup_size(256) fn smoothPoints(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=p.dims.z*p.dims.w){return;}let j=i%p.dims.w;
 if(j==0u||j==p.dims.w-1u){points[i]=seed(i);return;}
 let candidate=.25*advected[i-1u]+.5*advected[i]+.25*advected[i+1u];
 points[i]=mix(candidate,reference[i],retained(i));
}
// Liang–Barsky clipping bounds the work even when the camera zooms far in.
struct Clipped {a:vec2f,b:vec2f,t0:f32,t1:f32,valid:u32,}
fn clip(a:vec2f,b:vec2f)->Clipped{
 var lo=0.0;var hi=1.0;let d=b-a;let limits=vec2f(p.raster.xy)-vec2f(1.001);
 let pp=array<f32,4>(-d.x,d.x,-d.y,d.y);let qq=array<f32,4>(a.x,limits.x-a.x,a.y,limits.y-a.y);
 for(var k=0u;k<4u;k++){
  if(abs(pp[k])<1e-12){if(qq[k]<0.0){return Clipped(a,b,lo,hi,0u);}}
  else {let r=qq[k]/pp[k];if(pp[k]<0.0){lo=max(lo,r);}else{hi=min(hi,r);}if(lo>hi){return Clipped(a,b,lo,hi,0u);}}
 }
 return Clipped(a+d*lo,a+d*hi,lo,hi,1u);
}
fn screen(v:vec2f)->vec2f{return v*p.project.xy+p.project.zw;}
fn putOptical(index:u32,amount:f32,focused:bool){
 if(focused){addWide(&optical[index].orange,amount);}else{addWide(&optical[index].blue,amount);}
}
@compute @workgroup_size(64) fn rasterCurves(@builtin(global_invocation_id) id:vec3u){
 let c=id.x;if(c>=p.dims.z){return;}let base=c*p.dims.w;
 let focus=p.raster.w>0u&&u32(metadata[c].y)+1u==p.raster.w;
 let dim=select(1.0,.18,p.raster.w>0u&&!focus);var previous=0xffffffffu;
 for(var j=1u;j<p.dims.w;j++){
  let a=screen(points[base+j-1u]);let b=screen(points[base+j]);let segment=clip(a,b);if(segment.valid==0u){previous=0xffffffffu;continue;}
  let count=u32(max(1.0,ceil(max(abs(segment.b.x-segment.a.x),abs(segment.b.y-segment.a.y)))));
  let r0=retained(base+j-1u);let r1=retained(base+j);
  for(var t=0u;t<=count;t++){
   let f=f32(t)/f32(count);let xy=vec2u(clamp(floor(mix(segment.a,segment.b,f)+vec2f(.5)),vec2f(0),vec2f(p.raster.xy)-vec2f(1)));
   let index=xy.y*p.raster.x+xy.x;if(index!=previous){
    let original=mix(segment.t0,segment.t1,f);let weight=1.0-mix(r0,r1,original);
    putOptical(index,metadata[c].x*weight*dim/800.0,focus);previous=index;
   }
  }
 }
}
@compute @workgroup_size(64) fn rasterRails(@builtin(global_invocation_id) id:vec3u){
 let l=id.x;if(l>=p.raster.z){return;}let row=rails[l*2u];let selected=rails[l*2u+1u].x;
 let membership=clamp(p.control.x*5.0-row.z+1.0,0.0,1.0);if(membership==0.0){return;}
 var previous=0xffffffffu;
 for(var j=1u;j<u32(row.y);j++){
  let a=screen(railVertices[u32(row.x)+j-1u]);let b=screen(railVertices[u32(row.x)+j]);let segment=clip(a,b);if(segment.valid==0u){previous=0xffffffffu;continue;}
  let count=u32(max(1.0,ceil(max(abs(segment.b.x-segment.a.x),abs(segment.b.y-segment.a.y)))));
  for(var t=0u;t<=count;t++){
   let xy=vec2u(clamp(floor(mix(segment.a,segment.b,f32(t)/f32(count))+vec2f(.5)),vec2f(0),vec2f(p.raster.xy)-vec2f(1)));
   let index=xy.y*p.raster.x+xy.x;if(index!=previous){
    if(p.raster.w>0u){putOptical(index,max(0.0,row.w-selected)*.18*membership/800.0,false);putOptical(index,selected*membership/800.0,true);}
    else{putOptical(index,row.w*membership/800.0,false);}previous=index;
   }
  }
 }
}
@compute @workgroup_size(64) fn rasterGuide(@builtin(global_invocation_id) id:vec3u){
 let l=id.x;if(l>=p.raster.z){return;}let row=rails[l*2u];let membership=clamp(p.control.x*5.0-row.z+1.0,0.0,1.0);if(membership==0.0){return;}
 for(var j=1u;j<u32(row.y);j++){
  let a=railVertices[u32(row.x)+j-1u];let b=railVertices[u32(row.x)+j];let count=u32(max(1.0,ceil(distance(a,b)*1.5)));
  for(var t=0u;t<=count;t++){
   let xy=vec2u(clamp(floor(mix(a,b,f32(t)/f32(count))+vec2f(.5)),vec2f(0),vec2f(p.dims.xy)-vec2f(1)));
   atomicMax(&guide[xy.y*p.dims.x+xy.x],u32(floor(membership*65535.0+.5)));
  }
 }
}
@compute @workgroup_size(256) fn image(@builtin(global_invocation_id) id:vec3u){
 if(id.x<p.raster.x*p.raster.y){let tau=readWide(&optical[id.x].blue)+readWide(&optical[id.x].orange);currentImage[id.x]=u32(floor(255.0*(1.0-exp(-tau))+.5));}
}
@compute @workgroup_size(256) fn histogram(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=p.dims.x*p.dims.y){return;}let a=previousImage[id.x];let b=currentImage[id.x];atomicAdd(&joint[(a<<8u)|b],1u);atomicAdd(&histA[a],1u);atomicAdd(&histB[b],1u);
}
var<workgroup> nmiWork:array<vec4f,256>;
@compute @workgroup_size(256) fn mutualInformation(@builtin(global_invocation_id) id:vec3u,@builtin(local_invocation_index) local:u32,@builtin(workgroup_id) group:vec3u){
 let i=id.x;let n=f32(p.dims.x*p.dims.y);var value=vec4f(0);let count=atomicLoad(&joint[i]);
 if(count>0u){let q=f32(count)/n;let a=f32(atomicLoad(&histA[i>>8u]))/n;let b=f32(atomicLoad(&histB[i&255u]))/n;value.x=q*log(q/(a*b));}
 if(i<256u){let a=f32(atomicLoad(&histA[i]))/n;let b=f32(atomicLoad(&histB[i]))/n;if(a>0.0){value.y=-a*log(a);}if(b>0.0){value.z=-b*log(b);}}
 nmiWork[local]=value;workgroupBarrier();
 for(var stride=128u;stride>0u;stride/=2u){if(local<stride){nmiWork[local]+=nmiWork[local+stride];}workgroupBarrier();}
 if(local==0u){nmiParts[group.x]=nmiWork[0];}
}
@compute @workgroup_size(1) fn mutualInformationFinal(){
 var sum=vec4f(0);for(var i=0u;i<256u;i++){sum+=nmiParts[i];}var nmi=1.0;if(sum.y+sum.z>0.0){nmi=clamp(2.0*sum.x/(sum.y+sum.z),0.0,1.0);}statistics[0]=vec4f(nmi,sum.y,sum.z,sum.x);
}
`;

export const DISPLAY = /* wgsl */ `
struct Params {dims:vec4u,raster:vec4u,control:vec4f,project:vec4f,conversion:vec4f,flags:vec4u,}
struct Wide {lo:u32,hi:u32,} struct Optical {blue:Wide,orange:Wide,}
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(15) var<storage,read> optical:array<Optical>;
@vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{
 let vertices=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(vertices[i],0,1);
}
fn tau(v:Wide)->f32{return (f32(v.hi)*4294967296.0+f32(v.lo))/65536.0;}
@fragment fn fragment(@builtin(position) xy:vec4f)->@location(0) vec4f{
 let index=u32(xy.y)*p.raster.x+u32(xy.x);let b=1.0-exp(-tau(optical[index].blue));let o=1.0-exp(-tau(optical[index].orange));
 let rgb=vec3f(.78,.32,.15)*o+vec3f(.055,.33,.43)*b*(1.0-o);return vec4f(rgb,o+b*(1.0-o));
}
`;
