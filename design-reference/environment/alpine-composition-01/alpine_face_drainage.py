"""Bounded drainage incision for mountain faces, with isotropic routing and slope transport.
Art-direction model, not calibrated physical erosion. No packages beyond Blender NumPy.
"""
import numpy as np,heapq,math
from habitat_structure_fields import smooth,noise2

def carve_faces(xyz,protection):
 ids=np.flatnonzero(xyz[:,1]>=268);a=xyz[ids];xs=np.unique(a[:,0]);ys=np.unique(a[:,1]);order=np.lexsort((a[:,0],a[:,1]));assert len(a)==len(xs)*len(ys)
 source=a[order,2].reshape((len(ys),len(xs)));spacing=float(np.median(np.diff(xs)));gy=np.arange(ys[0],ys[-1]+spacing*.1,spacing);h=np.array([np.interp(gy,ys,source[:,i]) for i in range(len(xs))]).T;initial=h.copy();rows,cols=h.shape;xx,yy=np.meshgrid(xs,gy)
 # Priority-flood conditioning gives gullies real connected outlets instead of
 # stopping every time small rock relief produces a local mesh depression.
 filled=h.copy();visited=np.zeros_like(h,dtype=bool);heap=[]
 for j in range(rows):
  for i in ([0,cols-1] if j not in [0,rows-1] else range(cols)):
   if not visited[j,i]:visited[j,i]=True;heapq.heappush(heap,(filled[j,i],j,i))
 while heap:
  level,j,i=heapq.heappop(heap)
  for dj,di in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
   nj=j+dj;ni=i+di
   if nj<0 or nj>=rows or ni<0 or ni>=cols or visited[nj,ni]:continue
   visited[nj,ni]=True;filled[nj,ni]=max(filled[nj,ni],level+.00005);heapq.heappush(heap,(filled[nj,ni],nj,ni))
 index=np.arange(h.size).reshape(h.shape);receiver=index.copy();steepest=np.zeros_like(h);length=np.full_like(h,spacing)
 for dj,di in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
  target=np.roll(index,(-dj,-di),(0,1));valid=np.ones_like(h,dtype=bool)
  if dj<0:valid[0,:]=False
  if dj>0:valid[-1,:]=False
  if di<0:valid[:,0]=False
  if di>0:valid[:,-1]=False
  dist=spacing*math.hypot(di,dj);slope=(filled-filled.ravel()[target])/dist;take=(slope>steepest)&valid;steepest[take]=slope[take];receiver[take]=target[take];length[take]=dist
 rr=receiver.ravel();area=np.full(h.size,spacing*spacing)
 for p in np.argsort(filled.ravel())[::-1]:
  if rr[p]!=p:area[rr[p]]+=area[p]
 area=area.reshape(h.shape);channels=smooth((np.log1p(area)-np.log(12))/np.log(32));quiet=.45+.55*noise2(xx,yy,31,59);mask=smooth((yy-270)/22)*smooth((initial-13)/17)*(1-smooth((yy-445)/25))
 for k in range(28):
  slope=np.maximum(0,(h-h.ravel()[receiver])/length)
  cut=np.minimum(.26,.045*np.sqrt(area)*np.power(slope,.9))*channels*quiet*mask
  limit=1.2+6.4*channels;cut=np.minimum(cut,np.maximum(0,limit-(initial-h)));h-=cut
  # A little side-wall transport broadens major cuts into genuine faces.
  downhill=h.ravel()[receiver];move=np.minimum(.045,np.maximum(0,h-downhill-length*.95)*.045)*mask*channels
  h-=move;deposition=np.zeros(h.size);np.add.at(deposition,rr,move.ravel()*.25);h+=deposition.reshape(h.shape)*mask
 delta=h-initial
 # Filter routing-grid stair steps once, with no smoothing of the whole range.
 blur=(np.roll(delta,1,0)+np.roll(delta,-1,0)+np.roll(delta,1,1)+np.roll(delta,-1,1))*.25;delta=.72*delta+.28*blur
 sampled=np.array([np.interp(ys,gy,delta[:,i]) for i in range(len(xs))]).T.ravel();out=np.zeros(len(xyz));out[ids[order]]=sampled;out*=protection
 print('CONNECTED FACE INCISION',float(out.min()),float(np.percentile(abs(out[out!=0]),95)),flush=True)
 return out
