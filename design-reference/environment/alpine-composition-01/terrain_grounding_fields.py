"""Shared geographic and habitat fields for the grounding pass."""
import numpy as np,math
from habitat_structure_fields import smooth,noise2

def sample_mass(h,x,y,spec):
 H,W=h.shape;peak=np.unravel_index(h.argmax(),h.shape);pu=np.array([peak[1]/(W-1)-.5,peak[0]/(H-1)-.5]);px,py,w,d,height,angle=spec;angle=math.radians(angle);co=math.cos(angle);si=math.sin(angle);off=np.array([[co,-si],[si,co]])@(pu*np.array([w,d]));cx=px-off[0];cy=py-off[1];dx=x-cx;dy=y-cy;u=(co*dx+si*dy)/w+.5;v=(-si*dx+co*dy)/d+.5;valid=(u>=0)&(u<=1)&(v>=0)&(v<=1);out=np.zeros_like(x,dtype=np.float32);ii=np.flatnonzero(valid)
 if not len(ii):return out
 uu=u[ii]*(W-1);vv=v[ii]*(H-1);ix=np.minimum(np.floor(uu).astype(int),W-2);iy=np.minimum(np.floor(vv).astype(int),H-2);fx=uu-ix;fy=vv-iy;value=h[iy,ix]*(1-fx)*(1-fy)+h[iy,ix+1]*fx*(1-fy)+h[iy+1,ix]*(1-fx)*fy+h[iy+1,ix+1]*fx*fy;edge=smooth(np.minimum.reduce([u[ii],1-u[ii],v[ii],1-v[ii]])/.08);out[ii]=np.maximum(0,value-.012)*height*edge;return out

def main_range(h,x,y,specs):
 out=np.zeros_like(x,dtype=np.float32)
 for spec in specs:
  b=sample_mass(h,x,y,spec);k=.85;f=np.clip(.5+.5*(out-b)/k,0,1);out=b*(1-f)+out*f+k*f*(1-f)
 return out

def hamlet_mask(x,y):return smooth((x+3)/18)*(1-smooth((x-66)/25))*smooth((y-75)/25)*(1-smooth((y-163)/28))
def shelf(x,y,d,level):
 plane=6.25+.035*(x-38)+.060*(y-128)
 # A river-side terrace cannot sit below the nearby channel's stage.
 freeboard=level+.25+.02*np.maximum(d,0);enforce=(1-smooth((d-22)/13))*(d>-1);return np.maximum(plane,plane+(freeboard-plane)*enforce)

def smooth_route(points):
 p=np.array(points,float);out=[]
 for i in range(len(p)-1):
  a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
  for t in np.linspace(0,1,10,endpoint=False):out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(p[-1]);return np.array(out)
LANE=smooth_route([[14.63,29.1],[16,35],[18.1,44.5],[21.3,59.7],[22.0,70.5],[29,93],[35,107],[39,117],[38.5,123],[36.8,130],[37.5,139],[36.2,144.6]])

def lane_field(x,y,doors):
 out=np.zeros_like(x,dtype=np.float32);ids=np.flatnonzero((x>0)&(x<80)&(y>25)&(y<166))
 if not len(ids):return out
 xx=x[ids];yy=y[ids];distance=np.full(len(ids),1e5)
 for a,b in zip(LANE[:-1],LANE[1:]):
  vx,vy=b-a;f=np.clip(((xx-a[0])*vx+(yy-a[1])*vy)/(vx*vx+vy*vy),0,1);distance=np.minimum(distance,np.hypot(xx-a[0]-f*vx,yy-a[1]-f*vy))
 width=.79+.09*(noise2(xx,yy,2.8,13)-.5);wear=1-smooth((distance-width)/.40);wear*=smooth((yy-29)/7)*(1-smooth((yy-148)/12))
 # One modest shared chapel forecourt, not a road spur to every house.
 courtyard=np.exp(-(((xx-34.5)/3.2)**2+((yy-112.0)/1.65)**2)**2)*.72;wear=np.maximum(wear,courtyard)
 for door in doors:
  apr=np.exp(-(((xx-door[0])/.82)**2+((yy-door[1])/.78)**2)**2)*.65;wear=np.maximum(wear,apr)
 wear*=.84+.16*noise2(xx,yy,.68,9);out[ids]=wear;return out

def buildings_field(x,y,buildings):
 core=np.zeros_like(x,dtype=np.float32)
 for rec in buildings:
  px,py=rec['origin'][:2];ang=rec['angle'];co=math.cos(ang);si=math.sin(ang);dx=x-px;dy=y-py;u=co*dx+si*dy;v=-si*dx+co*dy;w,d=rec['footprint'];sdf=np.maximum(np.abs(u)-(w/2+.30),np.abs(v)-(d/2+.35));core=np.maximum(core,1-smooth((sdf+.05)/.4))
 return core

def rock_contact(x,y,rocks):
 cover=np.zeros_like(x,dtype=np.float32)
 for rec in rocks:
  dx=x-rec['xy'][0];dy=y-rec['xy'][1];rx,ry=rec['radii'];a=rec['angle'];co=math.cos(a);si=math.sin(a);u=co*dx+si*dy;v=-si*dx+co*dy;radius=np.sqrt((u/rx)**2+(v/ry)**2);edge=.86+.27*(noise2(x,y,.22,14)-.5);part=(1-smooth((radius-.72)/edge));cover=np.maximum(cover,part)
 return cover
