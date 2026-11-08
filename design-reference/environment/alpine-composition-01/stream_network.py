"""Shared editable stream geography for terrain carving, water and vegetation."""
import math
import functools


def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)


# Compress the near-valley reach, rather than scaling the world or camera.
# The turn and confluence belong to the visible near meadow; the main arm
# then leaves the frame, while the smaller arm supplies the receding depth.
MAIN_CONTROLS=[(-38,-3),(-5,4),(7,5),(16,-1),(25,-14),(38,-38),(63,-90),(104,-172)]
TRIBUTARY_CONTROLS=[(25,-14),(44,-15),(69,1),(99,-9),(132,-5),(166,-25),(201,-62),(225,-98)]


class Stream:
    def __init__(self,name,controls,scale):self.name=name;self.controls=controls;self.scale=scale
    def active(self,y):return self.controls[0][0]<=y<=self.controls[-1][0]
    def center(self,y):
        c=self.controls
        for i in range(len(c)-1):
            ya,xa=c[i];yb,xb=c[i+1]
            if y<=yb:
                t=max(0,min(1,(y-ya)/(yb-ya)));prev=c[max(i-1,0)];nxt=c[min(i+2,len(c)-1)]
                ma=(xb-prev[1])/(yb-prev[0]);mb=(nxt[1]-xa)/(nxt[0]-ya)
                return (2*t**3-3*t*t+1)*xa+(t**3-2*t*t+t)*ma*(yb-ya)+(-2*t**3+3*t*t)*xb+(t**3-t*t)*mb*(yb-ya)
        return c[-1][1]
    def factor(self,y):return math.sqrt(1+((self.center(y+.1)-self.center(y-.1))/.2)**2)
    def entry_taper(self,y):return 1-.10*(1-smooth((y+5)/35)) if self.name=='main' else 1
    def left_taper(self,y):return 1-.10*smooth((y-17)/15) if self.name=='main' else 1
    def bank_softening(self,y):return smooth((y-30)/20)*(1-smooth((y-145)/40)) if self.name=='tributary' else 0
    def width(self,y):return self.scale*(5.6+.65*math.sin(y*.057+.4)+.28*math.sin(y*.127+1.2))*self.entry_taper(y)*self.left_taper(y)
    def banks(self,y):
        turn=max(-1,min(1,25*(self.center(y+1)-2*self.center(y)+self.center(y-1))))
        nominal=4.7*(.4+.6*self.entry_taper(y)) if self.name=='main' else 3.2
        nominal*=self.left_taper(y)*(1-.25*self.bank_softening(y))
        return [nominal*(1-.10*turn+.045*math.sin(y*.61)),nominal*(1+.10*turn+.04*math.sin(y*.57+1.2))]
    def level(self,y):
        z=1.5+.006*(y+38)+.55*smooth((y-65)/80)
        return z+(6*smooth((y-80)/130) if self.name=='tributary' else 0)
    def carve(self,x,y,ground):
        if not self.active(y):return ground
        d=abs(x-self.center(y))/self.factor(y);half=self.width(y)/2
        bank=self.banks(y)[0 if x<self.center(y) else 1]
        bed=self.level(y)-(.65 if self.name=='main' else .45)+.10*(min(d,half)/half)**2
        if d<half:return min(ground,bed)
        if d<half+bank:return min(ground,bed+(ground-bed)*smooth((d-half)/bank))
        return ground
    def floodplain(self,x,y,z):
        if not self.active(y):return z
        d=abs(x-self.center(y))/self.factor(y)
        inner=self.width(y)/2+max(self.banks(y));outer=24 if self.name=='main' else 18
        influence=1-smooth((d-inner)/(outer-inner))
        if self.name=='tributary':influence*=1-smooth((y-180)/45)
        freeboard=.48-.22*self.bank_softening(y)
        return z-max(0,z-self.level(y)-freeboard)*influence
    @functools.lru_cache(maxsize=4096)
    def section(self,y,base):
        cx=self.center(y);factor=self.factor(y);half=self.width(y)/2;bank=self.banks(y);wet=[]
        for side in [-1,1]:
            lo=0.;hi=bank[0 if side<0 else 1]
            for _ in range(23):
                d=(lo+hi)/2;x=cx+side*(half+d)*factor
                if self.carve(x,y,base(x,y))<self.level(y):lo=d
                else:hi=d
            wet.append((half+(lo+hi)/2)*factor)
        return cx,factor,half,bank,wet


class StreamNetwork:
    def __init__(self):
        self.main=Stream('main',MAIN_CONTROLS,.85)
        self.tributary=Stream('tributary',TRIBUTARY_CONTROLS,.40)
        self.streams=[self.main,self.tributary]
    def carve(self,x,y,z):
        for stream in self.streams:z=stream.carve(x,y,z)
        return z
    def floodplain(self,x,y,z):
        for stream in self.streams:z=stream.floodplain(x,y,z)
        return z
    def near(self,x,y,base):
        candidates=[]
        for stream in self.streams:
            if not stream.active(y):continue
            section=stream.section(round(y*2)/2,base);cx,factor,half,bank,wet=section
            shore=(abs(x-cx)-wet[0 if x<cx else 1])/factor
            candidates.append((shore,stream,section))
        return min(candidates,key=lambda item:item[0]) if candidates else None
    def water_envelope(self,x,y):
        levels=[]
        for stream in self.streams:
            if stream.active(y):
                d=abs(x-stream.center(y))/stream.factor(y)
                if d<stream.width(y)/2+max(stream.banks(y))+.8:levels.append(stream.level(y))
        return max(levels) if levels else None

    def water_mesh(self,spacing=.5):
        vertices=[];faces=[];indices={}
        x0=-220.;y0=-38.;nx=int((30-x0)/spacing);ny=int((225-y0)/spacing)
        def vertex(i,j,fallback):
            key=(i,j)
            if key not in indices:
                x=x0+i*spacing;y=y0+j*spacing;z=self.water_envelope(x,y)
                indices[key]=len(vertices);vertices.append((x,y,fallback if z is None else z))
            return indices[key]
        for j in range(ny):
            y=y0+(j+.5)*spacing
            for i in range(nx):
                x=x0+(i+.5)*spacing;level=self.water_envelope(x,y)
                if level is None:continue
                faces.append(tuple(vertex(a,b,level) for a,b in [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]))
        top_count=len(vertices);edges={}
        for face in faces:
            for a,b in zip(face,face[1:]+face[:1]):
                key=tuple(sorted((a,b)))
                if key in edges:del edges[key]
                else:edges[key]=(a,b)
        vertices+= [(x,y,z-1.3) for x,y,z in vertices[:top_count]]
        faces+= [tuple(top_count+i for i in reversed(face)) for face in list(faces)]
        faces+= [(a,top_count+a,top_count+b,b) for a,b in edges.values()]
        return vertices,faces,top_count
