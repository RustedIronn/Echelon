"""Modest British/European countryside architecture; authored geometry, no imports."""
import bpy,math,random
from mathutils import Vector

def material(name,color,stone=False):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;t=m.node_tree;t.nodes.clear();p=t.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Roughness'].default_value=.88;p.inputs['Specular IOR Level'].default_value=.23;out=t.nodes.new('ShaderNodeOutputMaterial');t.links.new(p.outputs[0],out.inputs[0])
 uv=t.nodes.new('ShaderNodeTexCoord');noise=t.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=3;t.links.new(uv.outputs['UV'],noise.inputs['Vector'])
 ramp=t.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*(v*.80 for v in color),1);ramp.color_ramp.elements[1].color=(*(min(1,v*1.12) for v in color),1);t.links.new(noise.outputs['Fac'],ramp.inputs[0]);t.links.new(ramp.outputs['Color'],p.inputs['Base Color'])
 bump=t.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.012;t.links.new(noise.outputs['Fac'],bump.inputs['Height']);t.links.new(bump.outputs[0],p.inputs['Normal'])
 if stone:
  warp=t.nodes.new('ShaderNodeVectorMath');warp.operation='SCALE';warp.inputs['Scale'].default_value=.045;t.links.new(noise.outputs['Color'],warp.inputs[0]);add=t.nodes.new('ShaderNodeVectorMath');add.operation='ADD';t.links.new(uv.outputs['UV'],add.inputs[0]);t.links.new(warp.outputs[0],add.inputs[1]);brick=t.nodes.new('ShaderNodeTexBrick');brick.inputs['Scale'].default_value=1;brick.inputs['Mortar Size'].default_value=.012;brick.inputs['Mortar Smooth'].default_value=.025;brick.inputs['Brick Width'].default_value=.57;brick.inputs['Row Height'].default_value=.23;brick.inputs['Color1'].default_value=(*color,1);brick.inputs['Color2'].default_value=(*(v*.78 for v in color),1);brick.inputs['Mortar'].default_value=(*(v*.72 for v in color),1);t.links.new(add.outputs[0],brick.inputs['Vector']);t.links.new(brick.outputs['Color'],p.inputs['Base Color']);bump.inputs['Distance'].default_value=.025;t.links.new(brick.outputs['Fac'],bump.inputs['Height'])
 return m

class Builder:
 def __init__(self,label,collection,origin,ax,ay):self.label=label;self.collection=collection;self.origin=Vector(origin);self.ax=Vector(ax);self.ay=Vector(ay);self.buffers={}
 def point(self,x,y,z):return self.origin+self.ax*x+self.ay*y+Vector((0,0,z))
 def face(self,part,points,mat,uv=None):
  key=(part,mat.name)
  if key not in self.buffers:self.buffers[key]=[[],[],[]]
  vertices,faces,uvs=self.buffers[key];i=len(vertices);vertices.extend([tuple(p) for p in points]);faces.append(tuple(range(i,i+len(points))));uvs.extend(uv or [(p[0],p[2]) for p in points])
 def box(self,part,cx,cy,cz,w,d,h,mat):
  pts=[self.point(cx+x*w/2,cy+y*d/2,cz+z*h/2) for z in [-1,1] for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
  for ids in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
   uv=[]
   for i in ids:
    delta=pts[i]-self.origin;xx=delta.dot(self.ax);yy=delta.dot(self.ay);zz=delta.z
    uv.append((xx,yy) if ids in [(0,3,2,1),(4,5,6,7)] else ((yy,zz) if ids in [(1,2,6,5),(3,0,4,7)] else (xx,zz)))
   self.face(part,[pts[i] for i in ids],mat,uv)
 def facade(self,part,width,height,depth,openings,mat,side=False,wall_at=None):
  # Tile around openings, leaving real holes and reveals through a 24 cm wall.
  us=sorted(set([-width/2,width/2]+[q[0]+s*q[2]/2 for q in openings for s in [-1,1]]));zs=sorted(set([-1.0,height]+[q[1]+s*q[3]/2 for q in openings for s in [-1,1]]))
  for ua,ub in zip(us,us[1:]):
   for za,zb in zip(zs,zs[1:]):
    u=(ua+ub)/2;z=(za+zb)/2
    if not(-width/2<=u<=width/2 and -1.0<=z<=height):continue
    if any(abs(u-a)<w/2-1e-5 and abs(z-b)<h/2-1e-5 for a,b,w,h,kind in openings):continue
    if side:self.box(part,wall_at,u,z,.24,ub-ua,zb-za,mat)
    else:self.box(part,u,wall_at if wall_at is not None else -depth/2,z,ub-ua,.24,zb-za,mat)
 def window(self,u,z,w,h,depth,frame,glass,dressing,door=False,arch=False,wallmat=None):
  y=-depth/2
  self.box('Recessed glazing' if not door else 'Panelled doors',u,y+.115,z,w,.045,h,glass)
  for side in [-1,1]:self.box('Window and door joinery',u+side*(w/2-.028),y+.05,z,.055,.065,h,frame)
  for side in [-1,1]:self.box('Window and door joinery',u,y+.05,z+side*(h/2-.028),w,.065,.055,frame)
  if arch:
   r=w/2;spring=z+h/2-r;top=z+h/2
   for i in range(16):
    a=i*math.pi/16;b=(i+1)*math.pi/16
    ring=[self.point(u+(r+.015)*math.cos(a),y-.145,spring+(r+.015)*math.sin(a)),self.point(u+(r+.10)*math.cos(a),y-.145,spring+(r+.10)*math.sin(a)),self.point(u+(r+.10)*math.cos(b),y-.145,spring+(r+.10)*math.sin(b)),self.point(u+(r+.015)*math.cos(b),y-.145,spring+(r+.015)*math.sin(b))];self.face('Arched stone window heads',ring,dressing)
    fill=[self.point(u+r*math.cos(a),y-.121,spring+r*math.sin(a)),self.point(u+r*math.cos(b),y-.121,spring+r*math.sin(b)),self.point(u+r*math.cos(b),y-.121,top),self.point(u+r*math.cos(a),y-.121,top)];self.face('Arch masonry spandrels',fill,wallmat or dressing)
  else:self.box('Stone lintels and sills',u,y-.025,z+h/2+.07,w+.22,.28,.14,dressing)
  if not door:
   self.box('Stone lintels and sills',u,y-.06,z-h/2-.045,w+.20,.30,.09,dressing)
   for dz in [-h*.18,h*.18]:self.box('Fine sash bars',u,y+.015,z+dz,w,.028,.026,frame)
   self.box('Fine sash bars',u,y+.012,z,.026,.03,h,frame)
  else:
   for dz in [-h*.25,h*.23]:
    for dx in [-w*.23,w*.23]:self.box('Door panels',u+dx,y+.072,z+dz,w*.36,.035,h*.35,glass)
 def end_window(self,side,yy,z,w,h,width,frame,glass,dressing):
  x=side*width/2
  self.box('End wall recessed glazing',x-side*.115,yy,z,.045,w,h,glass)
  for sign in [-1,1]:self.box('End wall joinery',x-side*.05,yy+sign*(w/2-.028),z,.065,.055,h,frame)
  for sign in [-1,1]:self.box('End wall joinery',x-side*.05,yy,z+sign*(h/2-.028),.065,w,.055,frame)
  self.box('End wall stone lintels',x+side*.025,yy,z+h/2+.07,.28,w+.20,.14,dressing)
  self.box('End wall stone sills',x+side*.06,yy,z-h/2-.04,.30,w+.18,.09,dressing)
  self.box('End wall joinery',x-side*.025,yy,z,.045,.028,h,frame)
 def roof(self,w,d,eave,pitch,mat,edge,seed):
  rng=random.Random(seed);rise=d*.5*math.tan(pitch);over=.18
  for side in [-1,1]:
   p=[self.point(-w/2-over,side*(d/2+over),eave-over*math.tan(pitch)),self.point(w/2+over,side*(d/2+over),eave-over*math.tan(pitch)),self.point(w/2+over,0,eave+rise),self.point(-w/2-over,0,eave+rise)];self.face('Roof structure',p,mat)
   # Narrow overlapping slate courses, combined into one editable roof mesh.
   rows=max(4,round((d/2+over)/.29));step=(d/2+over)/rows
   for row in range(rows):
    y0=row*step;y1=min(d/2+over,(row+1)*step+.04);offset=.18 if row%2 else 0;x=-w/2-over-offset
    while x<w/2+over:
     xa=max(-w/2-over,x);xb=min(w/2+over,x+.37);lift=.020+rng.uniform(-.004,.004)
     pts=[self.point(xa,side*y0,eave+rise-y0*math.tan(pitch)+lift),self.point(xb,side*y0,eave+rise-y0*math.tan(pitch)+lift),self.point(xb,side*y1,eave+rise-y1*math.tan(pitch)+lift),self.point(xa,side*y1,eave+rise-y1*math.tan(pitch)+lift)];self.face('Laid slate courses',pts,mat,[(xa,y0),(xb,y0),(xb,y1),(xa,y1)]);x+=.37
   self.box('Narrow eave fascia',0,side*(d/2+over),eave-over*math.tan(pitch)-.035,w+.38,.08,.11,edge)
  for side in [-1,1]:
   pts=[self.point(side*w/2,-d/2,eave),self.point(side*w/2,d/2,eave),self.point(side*w/2,0,eave+rise)];self.face('Masonry gables',pts,edge)
  self.box('Ridge and coping',0,0,eave+rise+.045,w+.40,.18,.10,edge)
  return rise
 def finish(self):
  objects=[]
  for (part,matname),(vs,fs,uvs) in self.buffers.items():
   me=bpy.data.meshes.new(self.label+' '+part);me.from_pydata(vs,[],fs);me.update();uv=me.uv_layers.new(name='Architectural metres')
   for loop in me.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
   o=bpy.data.objects.new(self.label+' '+part,me);self.collection.objects.link(o);me.materials.append(bpy.data.materials[matname]);o['architecture']='Countryside vernacular-inspired; authored for the hero camera';objects.append(o)
  return objects

def build_settlement(records,parent,ground):
 stone=material('Country coursed local stone',(.29,.265,.215),True);lime=material('Country warm roughcast limewash',(.49,.47,.41));graylime=material('Country pale gray limewash',(.43,.445,.41));dress=material('Country dressed stone details',(.34,.325,.28));slate=material('Country weathered blue slate',(.105,.135,.145));joinery=material('Country painted wood joinery',(.38,.40,.35));oak=material('Country aged door timber',(.10,.073,.045));glass=material('Country dark recessed windows',(.025,.037,.036));clay=material('Country clay chimney pots',(.22,.12,.075))
 p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.24;p.inputs['Specular IOR Level'].default_value=.50
 out=[]
 for index,rec in enumerate(records):
  sub=bpy.data.collections.new('Country building '+str(index+1));parent.children.link(sub);ax=Vector(rec['ax']);ay=Vector(rec['ay']);door=Vector(rec['door_xy']+[0]);church=index==0
  if church:w,d,h,pitch=4.8,6.6,3.4,math.radians(44)
  else:w,d,h,pitch=[(6.6,4.6,3.00,40),(5.6,4.4,4.35,39),(6.5,4.6,4.15,38),(5.5,4.3,4.30,41)][index-1];pitch=math.radians(pitch)
  origin=door+ay*(d/2-.025);floor=ground(door.x,door.y)+.055;origin.z=floor;b=Builder('Country '+('chapel' if church else 'cottage '+str(index)),sub,origin,ax,ay);wallmat=stone if index in [0,2,4] else (lime if index==1 else graylime)
  windows=[(-w*(.30 if church else .32),1.70 if church else 1.35,.73 if church else .82,1.55 if church else 1.12,'window'),(w*(.30 if church else .27),1.70 if church else 1.35,.73 if church else .82,1.55 if church else 1.12,'window')]
  if not church and index!=1:windows += [(-w*.30,3.35,.66,.94,'window'),(w*.30,3.35,.66,.94,'window')]
  openings=windows+[(0,.91,.86,1.82,'door')];b.facade('Front masonry',w,h,d,openings,wallmat,wall_at=-d/2);b.facade('Back masonry',w,h,d,[],wallmat,wall_at=d/2)
  for side in [-1,1]:
   endopen=[(0,1.45,.70,1.0,'window')]
   b.facade('End masonry',d,h,w,endopen,wallmat,side=True,wall_at=side*w/2);b.end_window(side,0,1.45,.70,1.0,w,joinery,glass,dress)
  for u,z,ww,hh,kind in openings:b.window(u,z,ww,hh,d,joinery,oak if kind=='door' else glass,dress,kind=='door',church and kind=='window',wallmat)
  rise=b.roof(w,d,h,pitch,slate,wallmat,337+index)
  # Quiet corner dressings reinforce wall thickness without toy-like outlines.
  for sx in [-1,1]:
   for sy in [-1,1]:
    for row in range(int(h/.40)):b.box('Corner dressings',sx*(w/2-.04),sy*(d/2-.04),.18+row*.40,.20,.20,.22,dress)
  for sign in ([-1,1] if index in [1,3] else [1]):
   if church:break
   cx=sign*(w/2-.55);b.box('Masonry chimney stacks',cx,.10,h+rise-.05,.48,.55,1.05,stone);b.box('Chimney coping',cx,.10,h+rise+.49,.59,.66,.12,dress)
   for dx in [-.13,.13]:b.box('Clay chimney pots',cx+dx,.10,h+rise+.70,.13,.16,.30,clay)
  # Low actual threshold, not a giant slab around the house.
  threshold=origin-ay*(d/2+.23);z0=ground(threshold.x,threshold.y);top=floor+.04
  b.box('Entry threshold',0,-d/2-.23,(z0+top)/2-floor,1.10,.42,max(.10,top-z0+.05),dress)
  if church:
   # Small stone bellcote and sober low slate cap replace the cartoon red spire.
   tx=-w*.20;ty=-d*.28;tw=1.55;td=1.65;top=6.7
   b.box('Stone bell tower',tx,ty,top/2,tw,td,top,stone)
   for z in [3.7,5.5,6.65]:b.box('Tower string courses',tx,ty,z,tw+.11,td+.11,.11,dress)
   for yy in [-1,1]:
    b.box('Belfry recesses',tx,ty+yy*(td/2+.012),5.82,.66,.035,.91,glass)
    for j in range(6):b.box('Belfry louvers',tx,ty+yy*(td/2+.035),5.45+j*.13,.61,.08,.055,oak)
   pts=[b.point(tx+sx*(tw/2+.12),ty+sy*(td/2+.12),top+.10) for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]+[b.point(tx,ty,top+.95)]
   for j in range(4):b.face('Slate tower cap',[pts[j],pts[(j+1)%4],pts[4]],slate)
  # Small distinct entrance treatments and a practical lean-to, not ornament spam.
  if index==1:
   # Low timber porch on the one-storey cottage; native roof/pillars.
   for sx in [-1,1]:b.box('Weathered porch posts',sx*.68,-d/2-.65,1.02,.09,.09,2.04,oak)
   b.box('Porch lintel',0,-d/2-.65,2.08,1.50,.12,.12,oak)
   b.face('Porch slate shelter',[b.point(-.84,-d/2+.05,2.48),b.point(.84,-d/2+.05,2.48),b.point(.84,-d/2-.91,2.15),b.point(-.84,-d/2-.91,2.15)],slate)
  if index==3:
   # Rear service lean-to partly visible on the end of the long cottage.
   b.box('Low service wing',w/2+.50,.65,.90,1.10,2.25,2.15,wallmat)
   b.face('Service wing slate',[b.point(w/2-.05,-.58,2.65),b.point(w/2+1.14,-.58,2.13),b.point(w/2+1.14,1.90,2.13),b.point(w/2-.05,1.90,2.65)],slate)
  objects=b.finish();out.append({'building':index+1,'type':'stone rural chapel' if church else 'vernacular cottage','front_door_xy':rec['door_xy'],'origin':list(origin),'footprint_m':[w,d],'eaves_m':h,'roof_pitch_degrees':math.degrees(pitch),'objects':len(objects)})
 return out
