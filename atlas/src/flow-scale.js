import {fmt,signed,showTooltip,hideTooltip} from './model.js?v=20261028-4';

export function bindFlowScale(bar,{diverging=false,unit='viajes por día',capped=false}={}){
  let limit,summary;
  const format=diverging?signed:fmt;

  bar.tabIndex=0;
  bar.setAttribute('role','img');

  bar.addEventListener('pointerenter',showValue);
  bar.addEventListener('pointermove',showValue);
  bar.addEventListener('pointerleave',hideTooltip);
  bar.addEventListener('focus',()=>{
    if(!summary)return;
    const box=bar.getBoundingClientRect();
    showTooltip(summary,{clientX:box.left,clientY:box.bottom});
  });
  bar.addEventListener('blur',hideTooltip);

  function showValue(event){
    if(limit===undefined)return;
    const {left,width}=bar.getBoundingClientRect();
    const offset=event.clientX-left;
    const position=width-offset<=1?1:Math.max(0,offset/width);
    // The map scales colour by the square root of the flow or change.
    const intensity=diverging?2*position-1:position;
    const value=Math.round(limit*intensity*Math.abs(intensity)*10)/10||0;
    showTooltip(`${format(value)}${capped&&position===1?'+':''} ${unit}`,event);
  }

  return value=>{
    limit=value;
    const anchors=diverging?[-limit,0,limit]:[0,limit/4,limit];
    summary=`${anchors.map(format).join(' · ')}${capped?'+':''} ${unit}`;
    bar.setAttribute('aria-label',summary);
  };
}

// The references use the same pixel radii as the corresponding map marks.
export function bindCircleScale(container,diverging){
  const samples=Array.from(container.querySelectorAll('.map-circle-sample'));
  const fractions=[1/16,1/4,1];

  for(const sample of samples){
    const tooltip=event=>showTooltip(sample.getAttribute('aria-label'),event);
    sample.addEventListener('pointerenter',tooltip);
    sample.addEventListener('pointerleave',hideTooltip);
    sample.addEventListener('focus',()=>{
      const box=sample.getBoundingClientRect();
      tooltip({clientX:box.left,clientY:box.bottom});
    });
    sample.addEventListener('blur',hideTooltip);
  }

  return (limit,radius,fill)=>{
    container.hidden=!limit;
    if(!limit)return;
    samples.forEach((sample,index)=>{
      const value=fractions[index]*limit;
      const mark=sample.firstElementChild;
      mark.style.setProperty('--circle-size',`${2*radius(value)}px`);
      if(!diverging)mark.style.background=fill(value);
      sample.setAttribute('aria-label',`${diverging?'Cambio de ':''}${fmt(value)} viajes por día`);
    });
  };
}
