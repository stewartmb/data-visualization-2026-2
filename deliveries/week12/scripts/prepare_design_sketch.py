#!/usr/bin/env python3
"""Static data-driven sketch, not a screenshot or a RAEB solver result."""
from pathlib import Path
import json,shutil
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Polygon,Rectangle
P=Path(__file__).resolve().parents[1];R=P.parents[1];A=P/'atlas/data';OUT=R/'deliveries/week06/sketches'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10})
def main():
 f=json.loads((A/'flows.json').read_text());h=json.loads((A/'historical_contrast.json').read_text());geo=json.loads((A/'boroughs.geojson').read_text());nodes=f['nodes'];links=f['links'];n=len(nodes)
 U={y:np.array([np.array(h['profiles'][s['id']][str(y)]['p'])*h['profiles'][s['id']][str(y)]['weekly'] for s in nodes]) for y in [2019,2024]};tot={y:U[y].sum(axis=0) for y in U};prof={y:tot[y]/tot[y].sum() for y in tot}
 fig=plt.figure(figsize=(15,8.5),facecolor='#f7f8f7');gs=fig.add_gridspec(2,2,width_ratios=[2.2,1],wspace=.13,hspace=.4);ax=fig.add_subplot(gs[:,0]);scatter=fig.add_subplot(gs[0,1]);clock=fig.add_subplot(gs[1,1],projection='polar')
 for feat in geo['features']:
  coords=feat['geometry']['coordinates'];polys=coords if feat['geometry']['type']=='MultiPolygon' else [coords]
  for poly in polys:ax.add_patch(Polygon(poly[0],facecolor='#e5e8e8',edgecolor='#b6c1c3',lw=.5))
 weights=np.asarray(f['flows']['2024'])[0,8].reshape(-1,2).sum(axis=1);width=.15+3*np.sqrt(weights/max(weights))
 ax.add_collection(LineCollection([l['coords'] for l in links],colors='#286f86',linewidths=width,alpha=.7))
 starts=np.asarray(f['starts']['2024'])[:,0,8];ax.scatter([s['lon'] for s in nodes],[s['lat'] for s in nodes],s=3+45*starts/starts.max(),c='#205d73',edgecolors='white',linewidths=.35)
 ax.set_xlim(-74.08,-73.72);ax.set_ylim(40.56,40.92);ax.set_aspect(1/np.cos(np.radians(40.7)));ax.axis('off');ax.set_title('01 / CONEXIONES · red de referencia y OD 2024, lunes 08 h',loc='left',fontsize=13,pad=12)
 inset=ax.inset_axes([.77,.02,.2,.2]);inset.scatter([s['lon'] for s in nodes],[s['lat'] for s in nodes],s=.6,c='#9aaeb4');inset.set_xticks([]);inset.set_yticks([]);inset.set_title('CONTEXTO',fontsize=8);inset.add_patch(Rectangle((-74.08,40.56),.36,.36,fill=False,edgecolor='#1c687d',lw=1))
 for axis in [ax,scatter]:axis.set_facecolor('#f7f8f7')
 V={y:U[y].sum(axis=1) for y in U};p={y:U[y]/V[y][:,None] for y in U};tv=50*np.abs(p[2024]-p[2019]).sum(axis=1);ix=100*V[2024]/V[2019]
 scatter.scatter(ix,tv,s=13,c='#4f879b',alpha=.6);scatter.axvline(100,color='#8c9c9f',ls='--');scatter.grid(alpha=.2);scatter.set_title('02 / VOLUMEN × FORMA · entradas 2019 → 2024',loc='left',fontsize=11);scatter.set_xlabel('Volumen: 2019 = 100 %');scatter.set_ylabel('Cambio de forma · TV pp');scatter.spines[['top','right']].set_visible(False)
 theta=np.linspace(0,2*np.pi,25);r=np.arange(1,9);delta=(100*(prof[2024]-prof[2019])).reshape(7,24);clock.set_theta_zero_location('N');clock.set_theta_direction(-1);mesh=clock.pcolormesh(theta,r,delta,cmap='RdBu_r',vmin=-.65,vmax=.65,edgecolors='white',linewidth=.5);clock.set_ylim(0,8);clock.set_yticks([]);clock.set_xticks(np.arange(0,2*np.pi,np.pi/4),['00','03','06','09','12','15','18','21']);clock.grid(False);clock.spines['polar'].set_visible(False);clock.set_title('03 / REPARTO SEMANAL · Lun interior → Dom exterior',pad=22,fontsize=11);fig.colorbar(mesh,ax=clock,shrink=.55,pad=.15,label='Cambio de peso · pp')
 fig.suptitle('Fractal · Boceto con datos reales: mapa OD 2024 + contraste de entradas 2019–2024',x=.04,y=.98,ha='left',fontsize=16,fontweight='bold');fig.text(.04,.02,'Vista estática de diseño · tramos GTFS 2026 sin abstracción (fidelidad 1) · no es captura ni resultado del solver RAEB · fuentes MTA/Open NY',fontsize=9)
 OUT.mkdir(exist_ok=True);fig.savefig(OUT/'panel-actual.png',dpi=150,bbox_inches='tight');fig.savefig(OUT/'panel-actual.svg',bbox_inches='tight');plt.close(fig)
 for dest in [R/'deliveries/week07/sketches',P/'paper/figuras']:
  dest.mkdir(exist_ok=True,parents=True);shutil.copy2(OUT/'panel-actual.png',dest/'panel-actual.png')
 print('Data-driven sketch exported with titles, units, legends and layout.')
if __name__=='__main__':main()
