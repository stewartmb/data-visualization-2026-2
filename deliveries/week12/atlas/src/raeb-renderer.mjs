// Instanced WebGL2 line strips: one vertex per trail sample, never a DOM path
// per OD. Slider previews change uniforms only; no routing or panel rebuild.
const VERTEX=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uAnchors;
uniform sampler2D uLayout;
uniform sampler2D uMetadata;
uniform sampler2D uFromLayout;
uniform sampler2D uRetention;
uniform bool uFromPreview;
uniform vec2 uFromParameters;
uniform int uTextureWidth;
uniform int uSamples;
uniform int uRenderSamples;
uniform vec2 uViewport;
uniform vec3 uCamera;
uniform vec2 uParameters;
uniform float uTween;
uniform bool uPreview;
uniform float uSelected;
out vec4 vColor;
vec4 at(sampler2D source,int i){return texelFetch(source,ivec2(i%uTextureWidth,i/uTextureWidth),0);}
vec2 previewAt(int point,int curve,int sampleIndex,vec4 anchor,vec2 parameters){
  vec2 start=at(uAnchors,curve*uSamples).zw;
  vec2 end=at(uAnchors,(curve+1)*uSamples-1).zw;
  vec2 straight=mix(start,end,float(sampleIndex)/float(uSamples-1));
  vec2 seed=mix(straight,anchor.zw,parameters.x);
  vec2 bundled=mix(anchor.xy,anchor.zw,parameters.x);
  return mix(seed,bundled,parameters.y);
}
void main(){
  int curve=gl_InstanceID;
  int sampleIndex=int(round(float(gl_VertexID)*float(uSamples-1)/float(uRenderSamples-1)));
  int point=curve*uSamples+sampleIndex;
  vec4 anchor=at(uAnchors,point);
  vec2 position;
  if(uPreview){position=previewAt(point,curve,sampleIndex,anchor,uParameters);}
  else{
    vec2 from=uFromPreview?previewAt(point,curve,sampleIndex,anchor,uFromParameters):at(uFromLayout,point).xy;
    position=mix(from,at(uLayout,point).xy,uTween);
  }
  vec4 metadata=at(uMetadata,curve);
  bool focus=uSelected>=0.0&&abs(metadata.y-uSelected)<0.1;
  float retained=clamp(uParameters.x*5.0-at(uRetention,point).x+1.0,0.0,1.0);
  float alpha=1.0-exp(-metadata.x*(1.0-retained)/800.0);
  if(uSelected>=0.0)alpha*=focus?1.0:0.18;
  vColor=focus?vec4(.78,.32,.15,alpha):vec4(.055,.33,.43,alpha);
  vec2 screen=position*uCamera.x+uCamera.yz;
  gl_Position=vec4(screen.x/uViewport.x*2.0-1.0,1.0-screen.y/uViewport.y*2.0,0,1);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 color;
void main(){if(vColor.a==0.0)discard;color=vColor;}`;

export class RaebRenderer{
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.className='raeb-canvas';
    this.canvas.setAttribute('aria-hidden','true');this.canvas.style.cssText='display:block;pointer-events:none;width:100%;height:100%';
    const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'high-performance'});
    if(!gl)throw Error('Esta vista necesita WebGL2 para dibujar todos los OD de forma interactiva.');
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['uAnchors','uLayout','uMetadata','uFromLayout','uRetention','uFromPreview','uFromParameters','uTextureWidth','uSamples','uRenderSamples','uViewport','uCamera','uParameters','uTween','uPreview','uSelected'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
    this.textures=Array.from({length:5},()=>gl.createTexture());
    this.textureWidth=1024;this.camera={k:1,x:0,y:0};this.parameters={fidelity:.9,strength:.65};this.selected=-1;this.preview=true;this.count=0;
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    this.canvas.dataset.renderer='WebGL2 instanced line strips';
    for(let i=0;i<5;i++)this.upload(i,new Float32Array(4));
  }
  resize(width,height){
    this.width=width;this.height=height;const ratio=Math.min(1.5,devicePixelRatio||1);
    this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);this.schedule();
  }
  upload(unit,data,channels=4){
    const gl=this.gl,w=this.textureWidth,h=Math.max(1,Math.ceil(data.length/channels/w));
    const padded=data.length===w*h*channels?data:new Float32Array(w*h*channels);if(padded!==data)padded.set(data);
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,channels===1?gl.R32F:channels===2?gl.RG32F:gl.RGBA32F,w,h,0,channels===1?gl.RED:channels===2?gl.RG:gl.RGBA,gl.FLOAT,padded);
  }
  anchors(free,reference){
    this.free=free;this.reference=reference;
    const packed=new Float32Array(free.length*2);
    for(let i=0,j=0;i<free.length;i+=2,j+=4){packed[j]=free[i];packed[j+1]=free[i+1];packed[j+2]=reference[i];packed[j+3]=reference[i+1];}
    this.upload(0,packed);this.schedule();
  }
  scene(free,reference,metadata,count,samples,retention){
    this.count=count;this.samples=samples;this.hasLayout=false;this.upload(2,metadata);this.upload(4,retention,1);this.anchors(free,reference);this.preview=true;this.schedule();
  }
  layout(target){
    this.fromPreview=this.preview||!this.hasLayout;
    this.fromParameters={...this.parameters};
    if(!this.fromPreview)[this.textures[1],this.textures[3]]=[this.textures[3],this.textures[1]];
    // Upload XY directly; interpolating in the shader avoids constructing a
    // 74 MB from/to buffer on the UI thread for every worker update.
    this.upload(1,target,2);this.hasLayout=true;this.transitionStart=performance.now();this.preview=false;this.schedule();
  }
  setParameters(fidelity,strength){this.parameters={fidelity,strength};this.preview=true;this.inputAt=performance.now();this.qualityUntil=performance.now()+160;this.schedule();}
  setCamera(camera){this.camera=camera;this.inputAt=performance.now();this.qualityUntil=performance.now()+160;this.schedule();}
  schedule(){if(!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;this.draw();});}
  draw(){
    const gl=this.gl,u=this.uniforms;if(!this.width||!this.height)return;
    const start=performance.now();gl.clear(gl.COLOR_BUFFER_BIT);if(!this.count||this.exact||this.awaitingSeed)return;
    gl.useProgram(this.program);
    for(let i=0;i<5;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);}
    gl.uniform1i(u.uAnchors,0);gl.uniform1i(u.uLayout,1);gl.uniform1i(u.uMetadata,2);gl.uniform1i(u.uFromLayout,3);gl.uniform1i(u.uRetention,4);gl.uniform1i(u.uFromPreview,this.fromPreview?1:0);
    const fp=this.fromParameters||this.parameters;gl.uniform2f(u.uFromParameters,fp.fidelity,fp.strength);
    gl.uniform1i(u.uTextureWidth,this.textureWidth);gl.uniform1i(u.uSamples,this.samples);
    gl.uniform2f(u.uViewport,this.width,this.height);gl.uniform3f(u.uCamera,this.camera.k,this.camera.x,this.camera.y);
    gl.uniform2f(u.uParameters,this.parameters.fidelity,this.parameters.strength);
    const t=Math.min(1,(performance.now()-(this.transitionStart||0))/90);
    gl.uniform1f(u.uTween,t);gl.uniform1i(u.uPreview,this.preview?1:0);gl.uniform1f(u.uSelected,this.selected);
    const reduced=performance.now()<(this.qualityUntil||0)||(!this.preview&&t<1),renderSamples=reduced?Math.min(8,this.samples):this.samples;
    gl.uniform1i(u.uRenderSamples,renderSamples);
    gl.drawArraysInstanced(gl.LINE_STRIP,0,renderSamples,this.count);
    this.canvas.dataset.glError=String(gl.getError());this.canvas.dataset.renderSamples=String(renderSamples);
    this.canvas.dataset.submitMs=(performance.now()-start).toFixed(2);
    if(this.inputAt){this.canvas.dataset.inputToPaintMs=(performance.now()-this.inputAt).toFixed(2);this.inputAt=0;}
    if(reduced){clearTimeout(this.qualityTimer);this.qualityTimer=setTimeout(()=>this.schedule(),170);}
    if(!this.preview&&t<1)this.schedule();
  }
}
