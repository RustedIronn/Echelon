"""Shared ecological/shore/footpath fields for the saved alpine composition."""
import numpy as np

def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)

def communities(x,y):
 # Follow the shallow drainage folds authored in the preceding landform pass.
 left=x+40-.13*y-5*np.sin(y*.024)
 right=x-38+.09*y+3*np.sin(y*.033)
 seasonless=smooth((y-38)/26)*(1-smooth((y-175)/45))
 broken=.78+.13*np.sin(y*.093+x*.032)+.09*np.sin(x*.143-y*.046)
 mesic=np.maximum(np.exp(-(left/15)**2),.85*np.exp(-(right/12)**2))*seasonless*broken
 quiet=np.exp(-((x-(5+.045*y))/19)**2)*smooth((y-53)/35)*(1-smooth((y-145)/50))
 return np.clip(mesic,0,1),np.clip(quiet,0,1),seasonless

class CohesionFields:
 def __init__(self,sections,paths):self.sections=sections;self.paths=paths
 def section(self,x,y):
  sy,cx,l,r,lev,f=self.sections.T
  center=np.interp(y,sy,cx);left=np.interp(y,sy,l);right=np.interp(y,sy,r);level=np.interp(y,sy,lev);factor=np.interp(y,sy,f)
  side=np.where(x<center,-1,1);shore=np.where(side<0,(left-x)/factor,(x-right)/factor)
  active=smooth((y-47)/14)*(1-smooth((y-195)/18))
  return center,left,right,level,factor,side,shore,active
 def shore_fields(self,x,y):
  c,l,r,level,f,side,shore,active=self.section(x,y)
  bars=np.zeros_like(x,dtype=np.float32);erosion=bars.copy()
  for yc,bank,length,strength in [(73,-1,8,.94),(112,1,10,.92),(158,-1,9,.58)]:
   along=np.exp(-((y-yc)/length)**2)
   width=1+.15*np.sin(y*.39+x*.17)
   tongue=np.exp(-((shore+.35)/(width*.95))**2)
   bars=np.maximum(bars,along*tongue*(side==bank)*strength)
   erosion=np.maximum(erosion,along*np.exp(-((shore-.10)/.70)**2)*(side!=bank)*.19)
  return bars*active,erosion*active,level,shore,active
 def warp(self,x,y):
  c,l,r,level,f,side,shore,active=self.section(x,y)
  shift=1.60*np.exp(-((y-79)/11)**2)-1.05*np.exp(-((y-111)/15)**2)+.55*np.exp(-((y-151)/12)**2)
  # Recede smoothly into adjoining land instead of moving an independent water ribbon.
  neighborhood=np.exp(-(np.abs(x-c)/((r-l)/2+8*f))**4)
  return (shift*f*active*neighborhood).astype(np.float32)
 def terrain_offset(self,a):
  x,y,z=a.T;bars,erosion,level,shore,active=self.shore_fields(x,y)
  # Deposits remain attached to the natural shore, grading into submerged gravel.
  target=level+.23-.20*smooth((-shore-.25)/.9)-.13*np.exp(-((y-158)/10)**2)
  raise_=np.maximum(0,target-z)*bars
  cut=erosion*np.clip((z-level+.3)/.6,0,1)
  return (raise_-cut-.018*self.footpaths(x,y)**1.2).astype(np.float32)
 def footpaths(self,x,y):
  result=np.zeros_like(x,dtype=np.float32)
  ids=np.flatnonzero((x>19)&(x<63)&(y>98)&(y<153))
  if not len(ids):return result
  xx=x[ids];yy=y[ids];distance=np.full(len(ids),1e5)
  for route in self.paths:
   for a,b in zip(route[:-1],route[1:]):
    vx,vy=b[0]-a[0],b[1]-a[1];t=np.clip(((xx-a[0])*vx+(yy-a[1])*vy)/(vx*vx+vy*vy),0,1)
    d=np.hypot(xx-a[0]-t*vx,yy-a[1]-t*vy);distance=np.minimum(distance,d)
  # Unequal edges with interrupted turf, not a clean road stripe.
  width=.40+.06*np.sin(xx*1.11+yy*.49)+.045*np.sin(yy*1.7-xx*.7)
  wear=1-smooth((distance-width)/.38)
  wear*=.80+.12*np.sin(xx*2.13+yy*1.1)+.08*np.sin(yy*3.2)
  result[ids]=np.clip(wear,0,1)
  return result
