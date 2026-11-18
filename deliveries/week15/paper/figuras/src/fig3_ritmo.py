# Figura 3: comparación 2021 -> 2025 de 5 Av/53 St, recortes de la captura c_ritmo.png (app, 1920x1200).
# Uso: python3 fig3_ritmo.py   (escribe ../fig3_ritmo.pdf)
from PIL import Image, ImageDraw, ImageFont
import os
here=os.path.dirname(os.path.abspath(__file__))
im=Image.open(os.path.join(here,'c_ritmo.png')).convert('RGB')
S=2
mapa=im.crop((540,395,1100,705))            # 560x310
reloj=im.crop((1560,350,1912,780))          # 352x430
disp=im.crop((1560,795,1912,1182))          # 352x387
W=1120; g=14
mapa=mapa.resize((W,int(W*mapa.height/mapa.width)),Image.LANCZOS)
w2=(W-g)//2
reloj=reloj.resize((w2,int(w2*reloj.height/reloj.width)),Image.LANCZOS)
disp=disp.resize((w2,int(w2*disp.height/disp.width)),Image.LANCZOS)
h2=max(reloj.height,disp.height)
out=Image.new('RGB',(W,mapa.height+g+h2),'white')
out.paste(mapa,(0,0)); out.paste(reloj,(0,mapa.height+g)); out.paste(disp,(w2+g,mapa.height+g+(h2-disp.height)))
d=ImageDraw.Draw(out)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34)
except Exception: f=ImageFont.load_default()
for t,(x,y) in (('a',(12,10)),('b',(12,mapa.height+g+10)),('c',(w2+g+12,mapa.height+g+10))):
    d.rectangle((x-6,y-4,x+38,y+42),fill='white',outline='#172d3b',width=2); d.text((x+4,y-2),t,fill='#172d3b',font=f)
for box in ((0,0,W-1,mapa.height-1),(0,mapa.height+g,w2-1,mapa.height+g+h2-1),(w2+g,mapa.height+g,W-1,mapa.height+g+h2-1)):
    d.rectangle(box,outline='#b8c0c2',width=2)
out.save(os.path.join(here,'..','fig3_ritmo.pdf'),resolution=300)
out.save(os.path.join(here,'_fig3_prev.jpg'),quality=85)
