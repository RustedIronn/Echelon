"""Hero-scale grass volumes and fluvial bank forms; static and shared across layers."""
import numpy as np

def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
def noise2(x,y,scale,seed=0):
 x=x/scale;y=y/scale;i=np.floor(x);j=np.floor(y);u=smooth(x-i);v=smooth(y-j)
 def h(a,b):return np.mod(np.sin(a*127.1+b*311.7+seed*74.13)*43758.5453,1)
 return (h(i,j)*(1-u)+h(i+1,j)*u)*(1-v)+(h(i,j+1)*(1-u)+h(i+1,j+1)*u)*v
def masses(x,y):
 # Stretched interlocking growth, with fine structure subordinate to broad masses.
 nx=x+.24*y;ny=y-.13*x
 coarse=noise2(nx,ny,3.4,11);medium=noise2(nx,ny,1.3,29);fine=noise2(nx,ny,.48,42)
 return np.clip(.62*coarse+.27*medium+.11*fine,0,1)
class HabitatStructure:
 def __init__(self,sections):self.sections=sections
 def bank(self,x,y):
  distance=np.full_like(x,1e4,dtype=np.float32);level=np.zeros_like(x,dtype=np.float32);side=np.ones_like(x);which=np.zeros_like(x,dtype=np.int32)
  for k,sections in enumerate(self.sections):
   yy,c,left,right,z,f=sections.T;center=np.interp(y,yy,c);l=np.interp(y,yy,left);r=np.interp(y,yy,right);factor=np.interp(y,yy,f)
   sign=np.where(x<center,-1,1);d=np.where(sign<0,(l-x)/factor,(x-r)/factor)
   active=(y>=yy[0])&(y<=yy[-1]);take=(d<distance)&active
   distance=np.where(take,d,distance);level=np.where(take,np.interp(y,yy,z),level);side=np.where(take,sign,side);which=np.where(take,k,which)
  return distance,level,side,which
 def bank_patches(self,x,y):
  d,z,side,which=self.bank(x,y);ledges=np.zeros_like(x,dtype=np.float32);bars=ledges.copy()
  # Unequal reaches: several turf cuts and a few broad inside shelves, not a border.
  for k,yc,bank,length in [(0,9,-1,5.0),(0,24,1,5.5),(0,39,-1,5),(1,76,1,8),(1,113,-1,7.5)]:
   along=np.exp(-((y-yc)/length)**2)*(which==k)*(side==bank)
   broken=.83+.17*noise2(x,y,1.8,19)
   ledges=np.maximum(ledges,along*np.exp(-((d-.14)/.53)**2)*broken)
  for k,yc,bank,length in [(0,15,1,5),(0,29,-1,6),(1,86,-1,8)]:
   along=np.exp(-((y-yc)/length)**2)*(which==k)*(side==bank)
   bars=np.maximum(bars,along*np.exp(-((d+.28)/.95)**2))
  return ledges,bars,d,z
 def offset(self,a):
  x,y,z=a.T;ledges,bars,d,level=self.bank_patches(x,y)
  # A readable dry turf shoulder followed by an eroded shallow face.
  shelf=np.maximum(0,level+.31-z)*ledges*.90*smooth((d+.16)/.34)
  toe=np.maximum(0,z-(level-.10))*ledges*.65*(1-smooth((d+.18)/.44))
  deposits=np.maximum(0,level+.15-z)*bars*.82
  field=(.10*(masses(x,y)-.48)+.035*(noise2(x,y,6.2,8)-.5))
  field*=smooth((y+3)/9)*(1-smooth((y-150)/45))*smooth((d-.7)/1.4)
  return (shelf-toe+deposits+field).astype(np.float32)
