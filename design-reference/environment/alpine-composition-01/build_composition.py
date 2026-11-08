"""Isolated camera-first composition; metres, +Y toward distant land."""
import bpy, bmesh, math, json, random, functools
import sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils import noise as organic_noise
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent
RESOURCE_LIBRARY=next((Path.home()/'blenderkit_data'/'scenes').glob('in-the-nature*/*.blend'),None)
MATERIAL_ROOT=ROOT/'material-resources'
sys.path.insert(0,str(ROOT))
from hamlet_geometry import build_hamlet
from mountain_erosion import ErosionField
from stream_network import Stream,StreamNetwork,MAIN_CONTROLS,TRIBUTARY_CONTROLS
NETWORK=StreamNetwork()
RIGHT_VALLEY_AXIS=Stream('retained valley axis',[(-38,-3),(-5,4),(18,9),(48,-4),(76,-14),(108,8),(138,-6),(165,-48),(185,-119),(210,-205)],.85)
LOCKED_CAMERA=json.loads((ROOT/'scope_preservation.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
organic_noise.seed_set(7124)
# The study is revised in place; do not accumulate .blend1 iteration copies.
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
land=collection('01 Continuous geography');river=collection('02 Carved stream');village=collection('03 Hillside hamlet');rig=collection('04 Fixed camera and daylight');guides=collection('05 Design guides')
def place(o,c):
    for old in list(o.users_collection):old.objects.unlink(o)
    c.objects.link(o)
def mat(name,color,rough=.85):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
meadow=mat('Sage meadow',(.29,.39,.19));rock=mat('Cool alpine stone',(.31,.36,.40));snow=mat('Pale upper surfaces',(.78,.81,.79));gravel=mat('Shallow channel bed',(.33,.30,.23));watermat=mat('Simple water - geometry validation',(.15,.29,.32),.24);wall=mat('Warm village plaster',(.72,.61,.43));roof=mat('Muted clay roofs',(.28,.15,.11))
CONTROLS=MAIN_CONTROLS
MOUNTAIN_SETBACK=54.0
HAMLET=[(33,133,5,7,3.8,-8),(41,137,4,6,3.3,4),(36,147,4.8,6,3.5,-13),(49,145,4,5,3,7),(54,152,4.3,6,3.5,-4)]
# Compact the authored settlement and bring its layout centre 19 m nearer.
# Account for the architecture helper's original per-building offsets so the
# actual buildings, rather than just nominal layout points, follow this plan.
HAMLET_OFFSETS=[(0,0),(2,4),(-9,8),(3,9),(-15,18)]
HAMLET=[(36+(x+dx-36)*.78-dx,124+(y+dy-143)*.76-dy,w,d,h,a) for (x,y,w,d,h,a),(dx,dy) in zip(HAMLET,HAMLET_OFFSETS)]
def center(y):
    return NETWORK.main.center(y)
CHANNEL_SCALE=.85
def width(y):return NETWORK.main.width(y)
def banks(y):
    return NETWORK.main.banks(y)
def level(y):return NETWORK.main.level(y)
def gauss(x,y,cx,cy,rx,ry):return math.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2)
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)
# Each authored crest has its own depth, shoulders and front/rear reach.
# Uneven station spacing builds broad massifs with subsidiary crests.
RIDGES=[
    {'name':'High watershed','front':126,'back':83,'stations':[(-240,345,24),(-188,350,32),(-152,338,47),(-120,360,61),(-107,364,67),(-93,358,59),(-64,347,45),(-37,364,54),(-23,369,59),(-7,354,43),(5,366,59),(14,374,74),(23,379,69),(35,377,62),(49,366,55),(73,353,43),(90,374,58),(100,382,68),(111,388,70),(118,389,66),(127,382,73),(142,371,60),(161,356,40),(185,368,49),(240,380,25)]},
    {'name':'Left descending shoulder','front':83,'back':64,'stations':[(-240,275,13),(-193,273,22),(-151,292,32),(-127,306,42),(-111,304,39),(-85,286,25),(-56,267,19),(-27,282,26),(7,294,15),(42,308,7)]},
    {'name':'Right offset massif','front':95,'back':70,'stations':[(-30,295,7),(8,278,18),(34,286,29),(54,312,39),(65,315,43),(79,305,34),(103,288,26),(126,302,31),(152,326,42),(168,320,37),(191,299,24),(240,312,14)]},
]
# Refine the existing watershed crest into uneven arêtes and subsidiary crowns.
watershed=RIDGES[0]['stations']
watershed[:]=[p for p in watershed if not(-7<p[0]<35 or 90<=p[0]<142)]
watershed.extend([(0,366,52),(5,373,65),(9,374,62),(14,379,74),(19,378,67),(23,382,70),(28,374,61),(90,370,52),(96,379,61),(102,387,70),(107,389,64),(112,390,69),(118,384,60),(124,388,74),(130,380,67),(136,374,62)])
watershed.sort(key=lambda p:p[0])
for item,reach in zip(RIDGES,[190,126,140]):item['foothill_front']=reach
SPURS=[
    [(-106,364,0,13),(-91,322,6,17),(-72,281,4,23),(-39,230,0,29)],
    [(24,379,0,12),(12,331,7,17),(31,291,4,22),(14,240,0,29)],
    [(116,389,0,14),(99,350,6,20),(116,312,3,25),(91,270,0,32)],
]
GULLIES=[
    [(-96,354,0,3),(-101,331,4,6),(-91,300,6,10),(-69,267,0,16)],
    [(31,367,0,3),(43,341,6,7),(51,315,8,11),(43,286,0,18)],
    [(108,380,0,3),(119,351,5,8),(139,326,7,13),(155,296,0,19)],
    [(-33,361,0,3),(-43,336,4,7),(-32,310,3,11),(-18,283,0,19)],
]
SECONDARY_GULLIES=[
    [(-124,352,0,2),(-129,337,2.2,4),(-123,314,3.5,7),(-108,289,0,11)],
    [(-141,299,0,2),(-130,281,2.6,5),(-108,263,0,12)],
    [(9,365,0,2),(2,349,3,5),(-5,328,4.5,8),(-12,299,0,13)],
    [(64,308,0,3),(56,292,3,6),(64,270,0,11)],
    [(132,368,0,3),(140,347,3.2,6),(133,327,0,12)],
]
ROCK_RIBS=[
    [(-119,349,0,2),(-117,330,2.8,5),(-105,308,2.0,8),(-85,284,0,11)],
    [(24,361,0,2),(29,343,3.2,5),(25,322,2.4,7),(37,300,0,11)],
    [(123,368,0,2),(128,348,2.6,5),(121,328,2.0,8),(132,308,0,11)],
]
ALPINE_ARETES=[
    [(-107,362,0,3),(-101,343,5,6),(-111,320,8,9),(-98,297,4,14),(-78,272,0,20)],
    [(-106,355,0,3),(-131,334,5,7),(-143,307,3,11),(-157,286,0,16)],
    [(14,376,0,3),(28,351,7,6),(19,323,8,10),(40,290,0,19)],
    [(20,369,0,3),(-3,344,5,7),(-16,315,3,12),(-25,289,0,18)],
    [(124,384,0,3),(115,365,6,6),(132,342,7,9),(120,314,3,14),(104,286,0,22)],
]
ALPINE_CUTS=[
    [(-119,351,0,2),(-116,333,5,4),(-121,309,7,7),(-108,285,0,13)],
    [(-94,347,0,2),(-83,322,7,5),(-91,294,5,9),(-65,268,0,16)],
    [(18,369,0,2),(15,349,7,5),(7,326,10,9),(18,295,0,17)],
    [(30,358,0,2),(41,336,8,6),(34,311,7,10),(48,282,0,18)],
    [(112,378,0,2),(106,357,5,5),(113,335,8,8),(98,306,0,16)],
    [(130,371,0,2),(144,345,6,5),(149,320,5,10),(167,294,0,19)],
]
CIRQUES=[(-96,324,19,25,7), (34,335,17,27,8), (129,350,15,24,6)]
def angular_rib(x,y,spine):
    nearest=1e9;value=0
    for a,b in zip(spine,spine[1:]):
        vx=b[0]-a[0];vy=b[1]-a[1]
        t=max(0,min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy)))
        d=math.hypot(x-a[0]-t*vx,y-a[1]-t*vy)
        if d<nearest:
            nearest=d;h=a[2]*(1-t)+b[2]*t;w=a[3]*(1-t)+b[3]*t
            value=h*max(0,1-d/w)**.85
    return value
def spine_field(x,y,spine):
    """Continuous authored spine with a zero-height endpoint at either end."""
    nearest=1e9;value=0
    for a,b in zip(spine,spine[1:]):
        vx=b[0]-a[0];vy=b[1]-a[1]
        t=max(0,min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy)))
        distance=math.hypot(x-a[0]-t*vx,y-a[1]-t*vy)
        if distance<nearest:
            nearest=distance;amplitude=a[2]*(1-t)+b[2]*t;spread=a[3]*(1-t)+b[3]*t
            value=amplitude*math.exp(-2*(distance/spread)**2)
    return value
def ridge(x,stations):
    for a,b in zip(stations,stations[1:]):
        if x<=b[0]:
            t=max(0,min(1,(x-a[0])/(b[0]-a[0])))
            # Slightly eased crest interpolation retains asymmetric sharp summits.
            t=.8*t+.2*smooth(t)
            return a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t
    return stations[-1][1:]
def unshifted_mountain_height(x,y,continuous_climb=False):
    if y<180:return 0.0
    result=0
    for item in RIDGES:
        stations=item['stations']
        if x<stations[0][0] or x>stations[-1][0]:continue
        ry,rh=ridge(x,stations)
        if y<=ry:
            reach=item['foothill_front'] if continuous_climb else item['front']
            t=max(0,min(1,(y-(ry-reach))/reach))
            mass=rh*t**1.65
            if item['name']=='High watershed' and y>235:
                # A shallow high bowl makes a steeper headwall below the crest,
                # without adding a noise-displaced or horizontally terraced face.
                face=.70+.055*gauss(x,0,-100,0,70,1)
                mass-=rh*.065*math.exp(-((t-face)/.14)**2)*smooth((y-235)/25)
        else:
            t=max(0,1-(y-ry)/item['back']);mass=rh*t**1.15
        if mass<=0:continue
        # Smooth union connects adjacent shoulders without a visible join.
        k=min(3.5,2*min(result,mass))
        blend=max(k-abs(result-mass),0)/k if k>1e-9 else 0
        result=max(result,mass)+blend*blend*k*.25
    # Shallow geological shaping follows the existing mass; it cannot form
    # detached caps or invent a second summit on the face of a mountain.
    relief=sum(spine_field(x,y,s) for s in SPURS)-sum(spine_field(x,y,g) for g in GULLIES)
    medium=sum(angular_rib(x,y,r) for r in ROCK_RIBS)-sum(spine_field(x,y,g) for g in SECONDARY_GULLIES)
    alpine=.70*sum(angular_rib(x,y,r) for r in ALPINE_ARETES)-.65*sum(spine_field(x,y,g) for g in ALPINE_CUTS)
    alpine-=sum(.45*depth*gauss(x,y,cx,cy,rx,ry) for cx,cy,rx,ry,depth in CIRQUES)
    return max(0,result+relief*smooth(result/20)+medium*smooth((result-9)/20)+alpine*smooth((y-235)/35)*smooth((result-12)/25))

def mountain_height(x,y):
    # Retain the tiny original lowland toes under the protected meadow, then
    # translate the actual mountain masses away along the valley's +Y axis.
    if y<=210:return unshifted_mountain_height(x,y)
    shifted=unshifted_mountain_height(x,y-MOUNTAIN_SETBACK,continuous_climb=True)
    blend=smooth((y-210)/32)
    return unshifted_mountain_height(x,y)*(1-blend)+shifted*blend if blend<1 else shifted
def base(x,y):
    z=1.9+.010*(y+30)
    z+=.7*gauss(x,y,-25,-3,18,27)+.75*gauss(x,y,34,56,34,39)
    z+=3.2*gauss(x,y,-34,93,31,37)+5*gauss(x,y,42,141,46,47)
    z+=7.7*gauss(x,y,-24,161,43,38)+5*gauss(x,y,100,177,68,55)
    foothill=8*gauss(x,y,-74,220,77,60)+9*gauss(x,y,78,237,85,67)
    foothill+=4.5*gauss(x,y,19,204,43,49)
    # Existing low foothills stay in place; no added ramp or raised apron.
    z+=foothill+mountain_height(x,y)
    if y<185 and x>10:
        axis=RIGHT_VALLEY_AXIS.center(y);factor=RIGHT_VALLEY_AXIS.factor(y)
        distance=abs(x-axis)/factor
        old_floor=.30+.17*gauss(x,y,RIGHT_VALLEY_AXIS.center(42)-12,42,18,22)+.12*gauss(x,y,RIGHT_VALLEY_AXIS.center(92)+19,92,20,21)
        lowering=max(0,z-(level(y)+old_floor))*math.exp(-(distance/38)**4)*smooth((185-y)/55)
        z-=lowering*smooth((x-10)/15)
    if y<190:
        left_mask=(1-smooth((x-5)/18))*(1-smooth((y-140)/50))
        old_platform=3.2*gauss(x,y,-34,93,31,37)+7.7*gauss(x,y,-24,161,43,38)
        z-=old_platform*left_mask
        # A near-left crest rolls away from the viewer, rather than maintaining
        # the old raised plateau through the middle distance.
        near_surface=2.0+.005*(y+10)
        near_surface+=1.3*(1-smooth((x+35)/36))*(1-smooth((y+5)/43))
        near_surface+=.10*gauss(x,y,-30,4,23,20)-.08*gauss(x,y,-19,29,24,18)
        blend=left_mask*(1-smooth((y-65)/40))
        z=z*(1-blend)+near_surface*blend
    # Ease only the camera-side shoulder along the left-crossing reach.
    # A compact 18 cm cut feathers into the existing meadow; no broad flattening.
    if 8<y<82 and x<NETWORK.main.center(y):
        s=NETWORK.main;distance=abs(x-s.center(y))/s.factor(y)
        shoulder=s.width(y)/2+s.banks(y)[0]
        easing=.18*math.exp(-((distance-shoulder-2)/7)**2)*smooth((y-8)/10)*(1-smooth((y-62)/20))
        z-=min(easing,max(0,z-s.level(y)-.30))
    z=NETWORK.floodplain(x,y,z)
    return z
def meadow_vigor(x,y):
    broad=organic_noise.noise_vector(Vector((x*.055,y*.055,3.71)))[0]
    local=organic_noise.noise_vector(Vector((x*.17,y*.17,8.21)))[1]
    distances=[abs(x-stream.center(y))/stream.factor(y) for stream in NETWORK.streams if stream.active(y)]
    moisture=.10*math.exp(-(min(distances)/23)**2) if distances and y<170 else 0
    return max(.08,min(.95,.52+.32*broad+.13*local+moisture))
ungraded_base=base
HAMLET_LEVELS=[(x,y,w,d,math.radians(a),ungraded_base(x,y)) for x,y,w,d,h,a in HAMLET]
def base(x,y):
    z=ungraded_base(x,y)
    # Small terraced building seats follow the hill's existing elevation.
    # Limit cut/fill to 0.4 m and feather over 8 m; preserve the hillside's grade.
    for cx,cy,w,d,angle,height in HAMLET_LEVELS:
        dx=math.cos(angle)*(x-cx)+math.sin(angle)*(y-cy)
        dy=-math.sin(angle)*(x-cx)+math.cos(angle)*(y-cy)
        distance=max(abs(dx)-w/2-.3,abs(dy)-d/2-.3,0)
        if distance<8:z+=max(-.4,min(.4,height-z))*smooth(1-distance/8)
    return z
def channel_terrain(x,y):
    return NETWORK.carve(x,y,base(x,y))
@functools.lru_cache(maxsize=8192)
def section(y):
    return NETWORK.main.section(y,base)

def terrain(x,y):
    return channel_terrain(x,y)
def mesh(name,verts,faces,c,materials):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);c.objects.link(o)
    for m in materials:data.materials.append(m)
    for p in data.polygons:p.use_smooth=True
    return o

unweathered_terrain=terrain
erosion_field=ErosionField(lambda x,y:unweathered_terrain(x,y+MOUNTAIN_SETBACK))
def terrain(x,y):
    return unweathered_terrain(x,y)+erosion_field.sample(x,y-MOUNTAIN_SETBACK)

NY=1080;xmin=-220;xmax=220;ymin=-40;ymax=500
verts=[];terrain_rows=[];terrain_xs=[]
for j in range(NY+1):
    y=ymin+(ymax-ymin)*j/NY
    xs=[xmin+(xmax-xmin)*i/264 for i in range(265)]
    for stream in NETWORK.streams:
        if not stream.active(y):continue
        cx,factor,half,bank,wet=stream.section(y,base)
        left=cx-(half+bank[0])*factor;right=cx+(half+bank[1])*factor
        xs.extend(left+(right-left)*i/40 for i in range(41))
        xs.extend([cx,cx-wet[0],cx+wet[1],cx-half*factor,cx+half*factor])
    xs=sorted(set(round(x,7) for x in xs if xmin<=x<=xmax))
    if y>225:xs=[xmin+(xmax-xmin)*i/264 for i in range(265)]
    terrain_rows.append(list(range(len(verts),len(verts)+len(xs))));terrain_xs.append(xs)
    verts.extend((x,y,terrain(x,y)) for x in xs)
faces=[]
for row in range(NY):
    a=terrain_rows[row];b=terrain_rows[row+1];ax=terrain_xs[row];bx=terrain_xs[row+1]
    if ax==bx:
        faces.extend((a[i],a[i+1],b[i+1],b[i]) for i in range(len(a)-1));continue
    i=j=0
    while i<len(a)-1 or j<len(b)-1:
        if j==len(b)-1 or (i<len(a)-1 and ax[i+1]<bx[j+1]):faces.append((a[i],a[i+1],b[j]));i+=1
        else:faces.append((a[i],b[j+1],b[j]));j+=1

ground=mesh('Continuous meadow foothills and mountain range',verts,faces,land,[meadow,rock,snow,gravel])
# Resolve upper-ridge stair stepping without subdividing or moving the meadow.
bm=bmesh.new();bm.from_mesh(ground.data)
upper_edges=[e for e in bm.edges if all(v.co.y>238 for v in e.verts)]
subdivision=bmesh.ops.subdivide_edges(bm,edges=upper_edges,cuts=1,use_grid_fill=True)
for item in subdivision['geom_inner']+subdivision['geom_split']:
    if isinstance(item,bmesh.types.BMVert):item.co.z=terrain(item.co.x,item.co.y)
bm.to_mesh(ground.data);bm.free();ground.data.update()
for p in ground.data.polygons:
    x,y,z=p.center
    gully_depth=sum(spine_field(x,y,g) for g in GULLIES) if y>260 else 0
    rib_height=sum(spine_field(x,y,s) for s in SPURS) if y>260 else 0
    snowline=56-1.6*gully_depth+1.3*rib_height+7*(1-p.normal.z)+4*p.normal.x
    if z>snowline and p.normal.z>.53:p.material_index=2
    elif z>23 or (y>225 and p.normal.z<.72):p.material_index=1
    elif y<210 and z<level(y)-.02:p.material_index=3
    elif 25<y<70 and x<center(y) and z<level(y)+.10 and gauss(x,y,center(48)-4,48,9,15)>.25:p.material_index=3
wv,wf,top_count=NETWORK.water_mesh()
water=mesh('Water inside carved channel - static graded surface',wv,wf,river,[watermat])
water['top_vertex_count']=top_count
water['network_controls']=json.dumps({'main':MAIN_CONTROLS,'tributary':TRIBUTARY_CONTROLS})
curve=bpy.data.curves.new('River control polyline','CURVE');curve.dimensions='3D';spl=curve.splines.new('POLY');spl.points.add(len(CONTROLS)-1)
for p,(y,x) in zip(spl.points,CONTROLS):p.co=(x,y,level(y),1)
guide=bpy.data.objects.new('Editable river design guide',curve);guides.objects.link(guide);guide.hide_render=True;guide.hide_set(True);guide['control_points_y_x']=json.dumps(CONTROLS)
hamlet_detail=build_hamlet(HAMLET,terrain,village,wall,roof,scale=.81)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='ECHELON HERO - low left bank fixed camera';place(cam,rig);cam.matrix_world=Matrix(LOCKED_CAMERA['camera_matrix'])
target=Vector((-4,100,8));cam.data.lens=LOCKED_CAMERA['lens'];cam.data.sensor_width=36;cam.data.clip_end=1500;scene.camera=cam
cam['eye_height_above_meadow_m']=cam.location.z-terrain(cam.location.x,cam.location.y)
bpy.ops.object.light_add(type='SUN',location=(-400,-100,280));sun=bpy.context.object;sun.name='Simple afternoon sun';sun.rotation_euler=(Vector((0,200,0))-sun.location).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.4;sun.data.angle=math.radians(6);place(sun,rig)
world=bpy.data.worlds.new('Simple blue daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.61,.79,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45

def look_development():
    """Editable, self-contained materials and restrained camera-near plant detail."""
    def node(tree,kind,name):
        n=tree.nodes.new(kind);n.label=name;n.name=name;return n
    def math_node(tree,operation,a,b=None,name='Mask math'):
        n=node(tree,'ShaderNodeMath',name);n.operation=operation
        for i,value in enumerate([a,b]):
            if value is None:continue
            if isinstance(value,(float,int)):n.inputs[i].default_value=value
            else:tree.links.new(value,n.inputs[i])
        return n.outputs[0]
    def noise(tree,coords,scale,detail,name):
        n=node(tree,'ShaderNodeTexNoise',name);n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail;n.inputs['Roughness'].default_value=.64;tree.links.new(coords,n.inputs['Vector']);return n
    def ramp(tree,value,stops,name):
        n=node(tree,'ShaderNodeValToRGB',name)
        while len(n.color_ramp.elements)>2:n.color_ramp.elements.remove(n.color_ramp.elements[-1])
        for i,(position,color) in enumerate(stops):
            e=n.color_ramp.elements[i] if i<2 else n.color_ramp.elements.new(position)
            e.position=position;e.color=(*color,1)
        tree.links.new(value,n.inputs[0]);return n.outputs[0]
    def mix(tree,fac,a,b,name):
        n=node(tree,'ShaderNodeMixRGB',name)
        if isinstance(fac,(int,float)):n.inputs[0].default_value=fac
        else:tree.links.new(fac,n.inputs[0])
        for i,v in [(1,a),(2,b)]:
            if isinstance(v,tuple):n.inputs[i].default_value=(*v,1)
            else:tree.links.new(v,n.inputs[i])
        return n.outputs[0]
    def attribute(tree,name):
        n=node(tree,'ShaderNodeAttribute',name);n.attribute_name=name;return n.outputs['Fac']

    def load_material_maps(slug,selectors):
        path=MATERIAL_ROOT/(slug+'_source.blend')
        if slug=='alpine-rock' and not path.exists():
            if RESOURCE_LIBRARY is None:raise FileNotFoundError('The retained Aerial Rocks 04 material library is unavailable.')
            with bpy.data.libraries.load(str(RESOURCE_LIBRARY),link=False) as (src,dst):dst.materials=['aerial_rocks_04']
            bpy.data.libraries.write(str(path),{dst.materials[0]},fake_user=True)
        with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.materials=list(src.materials)
        images=[];visited=set()
        def collect(tree):
            if tree is None or tree.name in visited:return
            visited.add(tree.name)
            for n in tree.nodes:
                if n.type=='TEX_IMAGE' and n.image:images.append(n.image)
                elif n.type=='GROUP':collect(n.node_tree)
        for material in dst.materials:
            if material:collect(material.node_tree)
        result={}
        for role,pattern in selectors.items():
            image=next((i for i in images if pattern.lower() in i.name.lower()),None)
            if image is None:raise RuntimeError(f'Missing {role} map in {slug}.')
            image.colorspace_settings.name='sRGB' if role=='color' else 'Non-Color'
            result[role]=image
        return result

    source_maps={
        'turf':load_material_maps('meadow-turf',{'color':'diffuseOriginal','height':'height','smoothness':'smoothness','normal':'normal'}),
        'earth':load_material_maps('meadow-earth',{'color':'albedo','height':'displacement','roughness':'roughness','normal':'normal'}),
        'gravel':load_material_maps('stream-gravel',{'color':'BaseColor','height':'Height','roughness':'roughness','normal':'Normal'}),
        'rock':load_material_maps('alpine-rock',{'color':'_diff_','height':'_disp_','roughness':'_rough_','normal':'_nor_'}),
    }

    def sampled_maps(tree,coords,kind,metres):
        mapping=node(tree,'ShaderNodeVectorMath',kind+' world texture scale');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=1/metres;tree.links.new(coords,mapping.inputs[0])
        result={}
        for role,image in source_maps[kind].items():
            if role=='normal':continue # Tangent normals cannot be box-projected without reorientation.
            tex=node(tree,'ShaderNodeTexImage',kind+' scanned '+role);tex.image=image;tex.projection='BOX';tex.projection_blend=.28;tex.extension='REPEAT';tex.interpolation='Linear';tree.links.new(mapping.outputs[0],tex.inputs['Vector']);result[role]=tex.outputs['Color']
        return result
    wall.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.62,.59,.49,1)
    roof.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.25,.075,.042,1)

    # Continuous habitat masks live on the actual terrain, avoiding material bands.
    attrs={name:ground.data.attributes.new(name,'FLOAT','POINT') for name in ['alpine_rock','alpine_snow','streambed','damp_soil','meadow_vigor','mountain_incision','mountain_drainage','mountain_talus']}
    count=len(ground.data.vertices);positions=[0.0]*(count*3);normals=[0.0]*(count*3)
    ground.data.vertices.foreach_get('co',positions);ground.data.vertices.foreach_get('normal',normals)
    values={name:[0.0]*count for name in attrs}
    for i in range(count):
        x,y,z=positions[i*3:i*3+3];nz=normals[i*3+2]
        values['meadow_vigor'][i]=meadow_vigor(x,y)
        drainage=0.0
        if y>218:
            slope_exposure=smooth((.96-nz)/.35)
            lower_alpine=smooth((z-16)/23)*(.48+.52*slope_exposure)
            upper_alpine=.88*smooth((z-37)/16)
            natural_rock=max(lower_alpine,upper_alpine)*smooth((y-200)/45)
            previous_rock=smooth((z-12)/25)*smooth((y-155)/60)*(.65+.35*smooth((.97-nz)/.25))
            transition=smooth((y-218)/28)
            values['alpine_rock'][i]=previous_rock*(1-transition)+natural_rock*transition
        else:
            values['alpine_rock'][i]=smooth((z-12)/25)*smooth((y-155)/60)*(.65+.35*smooth((.97-nz)/.25))
        if y>232:
            cut=erosion_field.sample(x,y-MOUNTAIN_SETBACK,'incision');drainage=erosion_field.sample(x,y-MOUNTAIN_SETBACK,'drainage')
            values['mountain_incision'][i]=min(1,cut/4)
            values['mountain_drainage'][i]=drainage
            values['mountain_talus'][i]=erosion_field.sample(x,y-MOUNTAIN_SETBACK,'talus')
            values['alpine_rock'][i]=min(1,values['alpine_rock'][i]+.20*smooth(cut/2)*smooth((z-20)/18))
        if y>230:
            mountain_y=y-MOUNTAIN_SETBACK
            gd=sum(spine_field(x,mountain_y,g) for g in GULLIES);rh=sum(spine_field(x,mountain_y,s) for s in SPURS)
            alpine_shelter=sum(spine_field(x,mountain_y,g) for g in ALPINE_CUTS)
            bowl=sum(depth*gauss(x,mountain_y,cx,cy,rx,ry) for cx,cy,rx,ry,depth in CIRQUES)
            exposure=max(0,-.698*normals[i*3]-.523*normals[i*3+1]+.488*nz)
            threshold=49-1.3*gd+1.0*rh+11*(1-nz)+5*exposure-.8*alpine_shelter-.65*bowl-3*drainage
            snow_pockets=organic_noise.noise_vector(Vector((x*.075,mountain_y*.075,z*.075)))[0]*5
            values['alpine_snow'][i]=smooth((z-threshold+3+snow_pockets)/9)*smooth((nz-.55)/.28)
        nearby=NETWORK.near(x,y,base) if y<=225 else None
        if nearby:
            proximity,stream,stream_section=nearby;surface=stream.level(y)
            values['streambed'][i]=(1-smooth((proximity+.3)/.95))*smooth((surface+.22-z)/.35)
            values['damp_soil'][i]=(1-smooth(max(0,proximity)/1.4))*smooth((surface+.4-z)/.5)
    for name,attribute_data in attrs.items():attribute_data.data.foreach_set('value',values[name])

    terrain_group=bpy.data.node_groups.new('Echelon terrain - meadow rock snow and wet banks','ShaderNodeTree')
    terrain_group.interface.new_socket(name='Surface',in_out='OUTPUT',socket_type='NodeSocketShader')
    t=terrain_group;out=node(t,'NodeGroupOutput','Surface output')
    geom=node(t,'ShaderNodeNewGeometry','World-scale surface coordinates');coords=geom.outputs['Position']
    scans={kind:sampled_maps(t,coords,kind,metres) for kind,metres in [('turf',1.2),('earth',1.5),('gravel',1.5),('rock',70)]}
    broad=noise(t,coords,.065,3,'Broad meadow green variation')
    fine=noise(t,coords,7.5,3,'Meadow earth and fine grass texture')
    small=noise(t,coords,43,2,'Fine ground grain')
    grass_color=ramp(t,broad.outputs['Fac'],[(.2,(.12,.22,.040)),(.5,(.19,.29,.065)),(.8,(.26,.35,.095))],'Fresh alpine greens')
    fine_color=ramp(t,fine.outputs['Fac'],[(.25,(.38,.46,.20)),(.75,(.86,.93,.52))],'Small green variation')
    grass_color=mix(t,.06,grass_color,fine_color,'Soft grass surface breakup')
    habitat_color=ramp(t,attribute(t,'meadow_vigor'),[(.2,(.23,.28,.075)),(.55,(.18,.29,.060)),(.85,(.125,.245,.060))],'Ecological green variation')
    grass_color=mix(t,.45,grass_color,habitat_color,'Related ground and vegetation greens')
    # Distant grass is a related fine canopy, not a brighter bare-earth strip.
    separate=node(t,'ShaderNodeSeparateXYZ','Meadow distance');t.links.new(coords,separate.inputs[0])
    distant=node(t,'ShaderNodeMapRange','Gradual midground canopy response');distant.clamp=True;distant.interpolation_type='SMOOTHERSTEP';distant.inputs['From Min'].default_value=110;distant.inputs['From Max'].default_value=195;t.links.new(separate.outputs['Y'],distant.inputs['Value'])
    canopy=noise(t,coords,1.9,2,'Short hillside grass surface')
    canopy_color=ramp(t,canopy.outputs['Fac'],[(.18,(.13,.245,.055)),(.52,(.19,.29,.070)),(.83,(.245,.33,.095))],'Related hillside canopy greens')
    canopy_mix=math_node(t,'MULTIPLY',distant.outputs['Result'],.48,'Distant canopy color weight')
    grass_color=mix(t,canopy_mix,grass_color,canopy_color,'Vegetated foothill ground response')
    earth_weight=math_node(t,'SUBTRACT',1,attribute(t,'meadow_vigor'),'Quieter habitat earth exposure')
    earth_weight=math_node(t,'MULTIPLY',earth_weight,.42,'Subordinate meadow earth')
    scanned_meadow=mix(t,earth_weight,scans['turf']['color'],scans['earth']['color'],'Grass and meadow earth scans')
    fresh=node(t,'ShaderNodeHueSaturation','Meadow scan daylight palette');fresh.inputs['Saturation'].default_value=.82;fresh.inputs['Value'].default_value=1.35;t.links.new(scanned_meadow,fresh.inputs['Color'])
    grass_color=mix(t,.68,grass_color,fresh.outputs['Color'],'Scanned meadow foundation')
    rock_noise=noise(t,coords,.12,3,'Rock strata medium scale')
    rock_grain=noise(t,coords,9,3,'Rock grain')
    rock_color=ramp(t,rock_noise.outputs['Fac'],[(.2,(.16,.19,.19)),(.48,(.30,.32,.30)),(.8,(.48,.46,.39))],'Warm grey limestone')
    fractured=node(t,'ShaderNodeTexVoronoi','Medium rock fracture edges');fractured.feature='DISTANCE_TO_EDGE';fractured.inputs['Scale'].default_value=.26;t.links.new(coords,fractured.inputs['Vector'])
    fracture_color=ramp(t,fractured.outputs['Distance'],[(.015,(.20,.23,.22)),(.13,(.40,.41,.37))],'Subtle fractured limestone response')
    rock_color=mix(t,.14,rock_color,fracture_color,'Quiet rock fracture color')
    stone_palette=node(t,'ShaderNodeHueSaturation','Alpine rock mineral palette');stone_palette.inputs['Saturation'].default_value=.50;stone_palette.inputs['Value'].default_value=.85;t.links.new(scans['rock']['color'],stone_palette.inputs['Color'])
    rock_color=mix(t,.78,rock_color,stone_palette.outputs['Color'],'Scanned alpine rock faces')
    talus_weight=math_node(t,'MULTIPLY',attribute(t,'mountain_talus'),.22,'Subordinate transported rock fragments')
    rock_color=mix(t,talus_weight,rock_color,scans['gravel']['color'],'Eroded rock and local slope debris')
    pebbles=node(t,'ShaderNodeTexVoronoi','Small streambed gravel');pebbles.inputs['Scale'].default_value=26;t.links.new(coords,pebbles.inputs['Vector'])
    bed_color=ramp(t,pebbles.outputs['Distance'],[(.08,(.12,.12,.095)),(.38,(.31,.29,.22)),(.75,(.48,.45,.34))],'Gravel and sand')
    bed_color=mix(t,.85,bed_color,scans['gravel']['color'],'Scanned gravel and finer sediment')
    base_color=mix(t,attribute(t,'alpine_rock'),grass_color,rock_color,'Meadow to alpine rock')
    snow_relief=ramp(t,scans['rock']['height'],[(.2,(.35,.35,.35)),(.65,(1,1,1))],'Snow broken by rock surface')
    snow_mask=math_node(t,'MULTIPLY',attribute(t,'alpine_snow'),snow_relief,'Terrain and rock-led snow cover')
    base_color=mix(t,snow_mask,base_color,(.83,.88,.90),'Terrain-following snow')
    base_color=mix(t,attribute(t,'streambed'),base_color,bed_color,'Recessed bed and soil blend')
    damp=math_node(t,'MULTIPLY',attribute(t,'damp_soil'),.22,'Dampness strength')
    base_color=mix(t,damp,base_color,(.085,.10,.045),'Damp bank transition')
    p=node(t,'ShaderNodeBsdfPrincipled','Terrain surface');t.links.new(base_color,p.inputs['Base Color']);p.inputs['Specular IOR Level'].default_value=.26
    turf_rough=math_node(t,'SUBTRACT',1,scans['turf']['smoothness'],'Convert source smoothness to roughness')
    rough=mix(t,earth_weight,turf_rough,scans['earth']['roughness'],'Meadow roughness maps')
    rough=mix(t,attribute(t,'alpine_rock'),rough,scans['rock']['roughness'],'Rock roughness map')
    rough=mix(t,attribute(t,'streambed'),rough,scans['gravel']['roughness'],'Gravel roughness map')
    rough_map=node(t,'ShaderNodeMapRange','Natural terrain roughness range');rough_map.clamp=True;rough_map.inputs['To Min'].default_value=.65;rough_map.inputs['To Max'].default_value=.97;t.links.new(rough,rough_map.inputs['Value']);t.links.new(rough_map.outputs['Result'],p.inputs['Roughness'])
    ground_bump=node(t,'ShaderNodeBump','Fine meadow body');ground_bump.inputs['Strength'].default_value=.20;ground_bump.inputs['Distance'].default_value=.018;t.links.new(fine.outputs['Fac'],ground_bump.inputs['Height'])
    grass_only=math_node(t,'SUBTRACT',1,attribute(t,'alpine_rock'),'Exclude rock from distant turf')
    turf_weight=math_node(t,'MULTIPLY',distant.outputs['Result'],grass_only,'Distant meadow canopy weight')
    turf_weight=math_node(t,'MULTIPLY',turf_weight,.72,'Short sward normal strength')
    turf_bump=node(t,'ShaderNodeBump','Distant short grass canopy relief');turf_bump.inputs['Distance'].default_value=.14;t.links.new(turf_weight,turf_bump.inputs['Strength']);t.links.new(canopy.outputs['Fac'],turf_bump.inputs['Height']);t.links.new(ground_bump.outputs['Normal'],turf_bump.inputs['Normal'])
    grain_bump=node(t,'ShaderNodeBump','Stone and soil grain');grain_bump.inputs['Strength'].default_value=.18;grain_bump.inputs['Distance'].default_value=.006;t.links.new(small.outputs['Fac'],grain_bump.inputs['Height']);t.links.new(turf_bump.outputs['Normal'],grain_bump.inputs['Normal'])
    meadow_height=mix(t,earth_weight,scans['turf']['height'],scans['earth']['height'],'Scanned meadow microrelief')
    ground_detail=node(t,'ShaderNodeBump','Scanned soil and short turf relief');ground_detail.inputs['Strength'].default_value=.42;ground_detail.inputs['Distance'].default_value=.055;t.links.new(meadow_height,ground_detail.inputs['Height']);t.links.new(grain_bump.outputs['Normal'],ground_detail.inputs['Normal'])
    gravel_detail=node(t,'ShaderNodeBump','Shallow gravel relief');gravel_detail.inputs['Distance'].default_value=.06;t.links.new(attribute(t,'streambed'),gravel_detail.inputs['Strength']);t.links.new(scans['gravel']['height'],gravel_detail.inputs['Height']);t.links.new(ground_detail.outputs['Normal'],gravel_detail.inputs['Normal'])
    rock_bump=node(t,'ShaderNodeBump','Scanned geological relief');rock_bump.inputs['Distance'].default_value=2.0;t.links.new(attribute(t,'alpine_rock'),rock_bump.inputs['Strength']);t.links.new(scans['rock']['height'],rock_bump.inputs['Height']);t.links.new(gravel_detail.outputs['Normal'],rock_bump.inputs['Normal']);t.links.new(rock_bump.outputs['Normal'],p.inputs['Normal']);t.links.new(p.outputs[0],out.inputs[0])
    for m in [meadow,rock,snow,gravel]:
        m.node_tree.nodes.clear();g=m.node_tree.nodes.new('ShaderNodeGroup');g.node_tree=terrain_group;o=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(g.outputs[0],o.inputs['Surface'])

    # Real transmission and absorption; a restrained static normal only.
    t=watermat.node_tree;t.nodes.clear();o=node(t,'ShaderNodeOutputMaterial','Water output');p=node(t,'ShaderNodeBsdfPrincipled','Clear alpine water')
    p.inputs['Base Color'].default_value=(.88,.98,.96,1);p.inputs['Roughness'].default_value=.065;p.inputs['IOR'].default_value=1.333;p.inputs['Transmission Weight'].default_value=1
    geo=node(t,'ShaderNodeNewGeometry','Water world coordinates');stretch=node(t,'ShaderNodeVectorMath','Long gentle ripples');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(2.5,.65,1);t.links.new(geo.outputs['Position'],stretch.inputs[0])
    water_axes=node(t,'ShaderNodeSeparateXYZ','Water distance along valley');t.links.new(geo.outputs['Position'],water_axes.inputs[0])
    reflection_softness=node(t,'ShaderNodeMapRange','Broader distant sky reflections');reflection_softness.clamp=True;reflection_softness.interpolation_type='SMOOTHERSTEP';reflection_softness.inputs['From Min'].default_value=35;reflection_softness.inputs['From Max'].default_value=100;reflection_softness.inputs['To Min'].default_value=.065;reflection_softness.inputs['To Max'].default_value=.22;t.links.new(water_axes.outputs['Y'],reflection_softness.inputs['Value']);t.links.new(reflection_softness.outputs['Result'],p.inputs['Roughness'])
    waves=noise(t,stretch.outputs[0],2.6,2,'Static water normals');b=node(t,'ShaderNodeBump','Small water surface response');b.inputs['Strength'].default_value=.2;b.inputs['Distance'].default_value=.035;t.links.new(waves.outputs['Fac'],b.inputs['Height']);t.links.new(b.outputs['Normal'],p.inputs['Normal']);t.links.new(p.outputs[0],o.inputs['Surface'])
    absorption=node(t,'ShaderNodeVolumeAbsorption','Shallow blue-green absorption');absorption.inputs['Color'].default_value=(.30,.67,.55,1);absorption.inputs['Density'].default_value=.16;t.links.new(absorption.outputs[0],o.inputs['Volume'])

    # Clear daylight: physical sky and a matching, separately controlled sun.
    t=world.node_tree;t.nodes.clear();o=node(t,'ShaderNodeOutputWorld','Alpine world');background=node(t,'ShaderNodeBackground','Clear daylight strength');background.inputs[1].default_value=.065
    sky=node(t,'ShaderNodeTexSky','Clear alpine sky');sky.sky_type='MULTIPLE_SCATTERING';sky.sun_disc=False
    direction=(sun.location-Vector((0,200,0))).normalized();sky.sun_elevation=math.asin(direction.z);sky.sun_rotation=math.atan2(direction.y,direction.x);sky.altitude=1200;sky.air_density=.8;sky.aerosol_density=.25
    t.links.new(sky.outputs['Color'],background.inputs[0]);t.links.new(background.outputs[0],o.inputs['Surface']);sun.data.energy=3.0;sun.data.angle=math.radians(3)
    detail=collection('06 Restrained meadow and stream detail')
    haze=bpy.data.materials.new('Subtle bounded alpine aerial perspective');haze.use_nodes=True;t=haze.node_tree;t.nodes.clear();o=node(t,'ShaderNodeOutputMaterial','Haze output');v=node(t,'ShaderNodeVolumeScatter','Light atmospheric separation');v.inputs['Color'].default_value=(.68,.80,1,1);v.inputs['Anisotropy'].default_value=.15;t.links.new(v.outputs[0],o.inputs['Volume'])
    # Keep the streamside meadow crisp. Atmospheric separation builds beyond
    # the near valley and thins above the range, preserving geological forms.
    position=node(t,'ShaderNodeNewGeometry','Atmosphere world position')
    axes=node(t,'ShaderNodeSeparateXYZ','Distance and altitude');t.links.new(position.outputs['Position'],axes.inputs[0])
    depth=node(t,'ShaderNodeMapRange','Valley to distant range haze');depth.clamp=True;depth.interpolation_type='SMOOTHERSTEP'
    depth.inputs['From Min'].default_value=100;depth.inputs['From Max'].default_value=400;depth.inputs['To Min'].default_value=.00005;depth.inputs['To Max'].default_value=.0018;t.links.new(axes.outputs['Y'],depth.inputs['Value'])
    altitude=node(t,'ShaderNodeMapRange','Thin upper atmosphere');altitude.clamp=True;altitude.interpolation_type='SMOOTHERSTEP'
    altitude.inputs['From Min'].default_value=20;altitude.inputs['From Max'].default_value=180;altitude.inputs['To Min'].default_value=1;altitude.inputs['To Max'].default_value=.15;t.links.new(axes.outputs['Z'],altitude.inputs['Value'])
    density=math_node(t,'MULTIPLY',depth.outputs['Result'],altitude.outputs['Result'],'Depth and height graded aerial density');t.links.new(density,v.inputs['Density'])
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,350,145));box=bpy.context.object;box.name='Bounded light aerial perspective';box.dimensions=(1000,700,310);box.data.materials.append(haze);box.display_type='WIRE';place(box,rig)

    # Three related growth layers replace a uniform upright-blade parcel.
    rng=random.Random(7124)
    palette=[(.16,.28,.045),(.21,.34,.070),(.28,.38,.110),(.13,.26,.070),(.29,.32,.13)]
    grass_mats=[mat('Meadow leaf - '+str(i),c,.78) for i,c in enumerate(palette)]
    for m,c in zip(grass_mats,palette):
        t=m.node_tree;p=t.nodes.get('Principled BSDF');p.inputs['Subsurface Weight'].default_value=.02;p.inputs['Sheen Weight'].default_value=.14;p.inputs['Specular IOR Level'].default_value=.25
        translucent=node(t,'ShaderNodeBsdfTranslucent','Thin leaf daylight');translucent.inputs[0].default_value=(*c,1)
        blend=node(t,'ShaderNodeMixShader','Soft light through meadow leaves');blend.inputs[0].default_value=.16;t.links.new(p.outputs[0],blend.inputs[1]);t.links.new(translucent.outputs[0],blend.inputs[2]);t.links.new(blend.outputs[0],t.nodes.get('Material Output').inputs['Surface'])

    def leaf(buffers,x,y,z,angle,length,height,width,style,material,segments,surface_normal=None):
        vertices,faces,indices=buffers
        a=len(vertices);axis=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-axis.y,axis.x,0))
        up_axis=Vector((0,0,1))
        if surface_normal is not None:
            up_axis=surface_normal.normalized()
            axis=(axis-up_axis*axis.dot(up_axis)).normalized();side=up_axis.cross(axis).normalized()
        curl=rng.uniform(-.20,.20)*length
        for step in range(segments+1):
            t=step/segments
            if style=='accent':
                forward=length*t*t;up=height*t
            else:
                forward=length*t;up=height*math.sin(math.pi*t*.91)
            centre=Vector((x,y,z))+axis*forward+side*(curl*t*t)+up_axis*up
            if style=='basal':spread=width*(math.sin(math.pi*t)**.70+.035)/2
            else:spread=width*(.14+.86*math.sin(math.pi*t)**.65)*(1-.9*t**5)/2
            fold=width*.12*math.sin(math.pi*t)
            vertices.extend([tuple(centre-side*spread),tuple(centre+Vector((0,0,fold))),tuple(centre+side*spread)])
        for step in range(segments):
            i=a+step*3;faces.extend([(i,i+3,i+4,i+1),(i+1,i+4,i+5,i+2)]);indices.extend([material,material])

    counts={}
    hillside_tree=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    # Detail decreases by distance, while the vegetation language stays related.
    configurations=[
        ('Foreground arching grass',140000,(-33,25),(-7,44),'grass',5),
        ('Low basal meadow foliage',21000,(-33,36),(-6,74),'basal',5),
        ('Midground meadow continuation',110000,(-100,100),(34,155),'mid',3),
        ('Meadow to foothill transition',760000,(-185,100),(118,277),'hill',3),
    ]
    for name,attempts,xrange,yrange,kind,segments in configurations:
        if kind=='hill':
            previous_random_state=rng.getstate();rng.seed(9341)
        buffers=([],[],[]);roots=0;leaves=0
        for attempt in range(attempts):
            x=rng.uniform(*xrange);y=rng.uniform(*yrange)
            if kind=='hill':
                hit,normal,face,distance=hillside_tree.ray_cast(Vector((x,y,200)),Vector((0,0,-1)),300)
                if hit is None:continue
                z=hit.z
                # Meadow growth follows gentle shoulders and recedes on rock faces.
                habitat=(1-smooth((z-17)/17))*(.5+.5*smooth((normal.z-.30)/.55))
                if habitat<.02:continue
                # Sampling in XY otherwise underplants steep faces per square
                # metre of actual surface. Preserve flat-land density and
                # compensate for the larger surface area on the bank slopes.
                if rng.random()>min(1,.25/max(.20,normal.z)):continue
            else:z=terrain(x,y)
            q=world_to_camera_view(scene,cam,Vector((x,y,z+.18)))
            if q.z<=0 or not(-.035<q.x<1.035 and -.03<q.y<.60):continue
            nearby=NETWORK.near(x,y,base)
            shore_distance=nearby[0] if nearby else 100.0
            if nearby and (shore_distance<.18 or z<nearby[1].level(y)+.09):continue
            bank_growth=.40+.60*smooth((shore_distance-.8)/7) if kind in ['mid','hill'] else 1.0
            if any(abs(x-hx)<6 and abs(y-hy)<7 for hx,hy,*rest in HAMLET):continue
            vigor=meadow_vigor(x,y)
            density=.30+.63*vigor
            if kind=='grass':density*=1-smooth((y-30)/14)
            elif kind=='basal':density*=.8*(1-smooth((y-53)/21))
            elif kind=='mid':density*=smooth((y-34)/13)*(1-.65*smooth((y-105)/50))
            else:density*=smooth((y-118)/35)*(1-smooth((y-240)/37))*habitat
            if rng.random()>density:continue
            roots+=1
            dominant=3 if vigor>.67 else (1 if vigor>.42 else 2)
            phase=rng.uniform(0,math.tau);cluster_height=rng.uniform(.08,.14)+vigor*.07
            number=rng.randint(5,8) if kind!='basal' else rng.randint(4,6)
            for k in range(number):
                angle=phase+k*2.39996+rng.uniform(-.35,.35)
                bx=x+rng.uniform(-.09,.09);by=y+rng.uniform(-.09,.09)
                if kind=='hill':
                    ground_hit,_,_,_=hillside_tree.ray_cast(Vector((bx,by,200)),Vector((0,0,-1)),300)
                    bz=ground_hit.z-.016
                else:bz=terrain(bx,by)-.016
                material=dominant if rng.random()<.76 else rng.randrange(4)
                if kind=='basal':
                    style='basal';length=rng.uniform(.085,.17);height=rng.uniform(.035,.075);w=rng.uniform(.022,.041)
                    material=3 if rng.random()<.8 else 0
                elif rng.random()<.055:
                    style='accent';length=rng.uniform(.035,.09);height=rng.uniform(.22,.32);w=rng.uniform(.003,.006)
                    if vigor<.4 and rng.random()<.4:material=4
                else:
                    style='grass';length=rng.uniform(.18,.37)*(1.18 if kind=='mid' else 1)
                    height=cluster_height*rng.uniform(.65,1.15)*(1.15 if kind=='mid' else 1);w=rng.uniform(.009,.018)
                height*=bank_growth
                length*=.75+.25*bank_growth
                if kind=='hill':
                    # Short interlocking sward, rather than distant upright pins.
                    length*=1.65;height*=.60;w*=1.55
                leaf(buffers,bx,by,bz,angle,length,height,w,style,material,segments,normal if kind=='hill' else None);leaves+=1
        obj=mesh(name,*buffers[:2],detail,grass_mats)
        for polygon,index in zip(obj.data.polygons,buffers[2]):polygon.material_index=index
        obj['root_count']=roots;obj['leaf_count']=leaves;obj['growth_layer']=kind
        counts[name]={'roots':roots,'leaves':leaves}
        if kind=='hill':rng.setstate(previous_random_state)
    roots=counts['Foreground arching grass']['roots']
    blades=counts['Foreground arching grass']['leaves']

    stone=mat('Wet limestone stones',(.26,.28,.24),.72)
    placements=[(9,-1,.88,.25),(11,-1,.93,.18),(14,-1,.86,.14),(24,1,.91,.28),(26,1,.82,.16),(43,-1,.88,.20),(46,-1,.93,.30),(49,-1,.85,.16),(72,1,.88,.24),(111,-1,.9,.18)]
    for i,(y,side,fraction,size) in enumerate(placements):
        cx,factor,half,bw,wet=section(y);x=cx+side*wet[0 if side<0 else 1]*fraction
        z=terrain(x,y);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+size*.25));o=bpy.context.object;o.name=f'Bank limestone {i+1:02}';o.scale=(size*1.2,size*.85,size*.7);o.rotation_euler=(rng.random()*.2,rng.random()*.2,rng.random()*math.tau)
        for v in o.data.vertices:v.co*=rng.uniform(.86,1.12)
        o.data.materials.append(stone);place(o,detail)
    return {'foreground_grass_roots':roots,'foreground_grass_blades':blades,'meadow_layers':counts,'ecology_seed':7124,'ecology_samples':[{'point':[x,y],'vigor':meadow_vigor(x,y)} for x,y in [(-12,8),(-24,31),(20,75),(-40,118)]],'stone_count':len(placements),'terrain_material':'Unified editable meadow, rock, snow, bed, vigor and dampness masks','water':'Closed refractive volume, IOR 1.333, static normals and absorption','sky':'Blender 5.2 multiple-scattering physical sky, matching sun, bounded thin haze','export_note':'Procedural terrain materials will need baking or recreation for Three.js.'}

lookdev=look_development()
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.cycles.samples=96
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for dev in prefs.devices:dev.use=dev.type!='CPU'
    scene.cycles.device='GPU'
except Exception:pass
scene.render.resolution_x=1440;scene.render.resolution_y=810;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'composition_preview.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.context.view_layer.update()
def project(point):
    v=world_to_camera_view(scene,cam,Vector(point));return [round(v.x,4),round(v.y,4)]
report={'units':'metres; +X right, +Y mountains, +Z up','camera':{'position':list(cam.location),'rotation_degrees':[math.degrees(a) for a in cam.rotation_euler],'lens_mm':28,'sensor_width_mm':36,'horizontal_fov_degrees':math.degrees(cam.data.angle_x),'aspect':'16:9','eye_above_terrain_m':cam['eye_height_above_meadow_m'],'previous_position':[2,-6,3.402907609939575],'height_change_m':cam.location.z-3.402907609939575,'target':list(target)},'targets':{'sky':'upper 35-45% above mountain silhouette','stream':'lower right, middle left, hidden endpoint','village':'right third below mountains','foreground':'left and lower meadow'},'stream':{'control_points_y_x':CONTROLS,'bed_below_water_m':.65,'water_gradient':.006,'horizontal_channel_scale':CHANNEL_SCALE,'bank_profile':'asymmetric bend-sensitive smoothstep transition shared with ground','samples':[{'y':y,'bed_width_m':width(y),'bank_transition_m':banks(y),'wet_width_perpendicular_m':sum(section(y)[4])/section(y)[1]} for y in [0,18,48,76,104,132]]},'landforms':{'left_foreground_rise_m':1.8,'left_rise_transition_width_m':25,'ridge_networks':RIDGES,'hamlet_layout':HAMLET},'projections_bottom_origin':{'village':project((40,142,terrain(40,142)+3)),'stream_bend':project((center(76),76,level(76))),'left_peak':project((-106,364,base(-106,364))),'right_peak':project((116,389,base(116,389)))}}
report['camera'].update(previous_position=[2,-6,3.646505832672119],height_change_m=cam.location.z-3.646505832672119,ground_position_change_m=[-5,-4],previous_eye_height_m=1.8,previous_target=[-4,100,10])
report['stream'].update(water_level_profile='0.6% base grade plus a smooth 0.55 m upstream rise from Y 65 to 145 m',water_gradient_range=[.006,.0163125])
report['landforms'].update(descending_ribs=SPURS,erosion_gullies=GULLIES,foreground_contours='Four authored low shoulders/swales outside the channel; no random displacement',valley_floor_relief='0.30 m bank height plus two shallow floodplain shoulders')
report['landforms']['secondary_erosion_cuts']=SECONDARY_GULLIES
report['landforms']['medium_rock_ribs']=ROCK_RIBS
report['landforms'].update(alpine_aretes=ALPINE_ARETES,alpine_erosion_cuts=ALPINE_CUTS,upper_cirques=CIRQUES,mountain_reference_policy='Public listing preview images only; no mountain assets downloaded or imported.')
report['landforms']['hamlet_architecture']=hamlet_detail
report['landforms']['mountain_erosion']=erosion_field.report
report['landforms']['mountain_setback_m']=MOUNTAIN_SETBACK
report['landforms']['mountain_coordinates']='Ridge and erosion definitions use mountain-local Y; add the setback for world coordinates.'
report['landforms']['foothill_transition']='Added aprons removed. Original low foothills retained; mountain masses translated 40 m farther along +Y, creating physical separation rather than a raised slope.'
report['landforms']['continuous_climb']={'method':'Lengthened convex mountain-front profiles blend directly into the low foothills, with gradually increasing grade. No separate raised apron.','front_reach_m':{r['name']:r['foothill_front'] for r in RIDGES},'protected_meadow_y_max_m':210,'exponent':1.65}
report['projections_bottom_origin']['left_peak']=project((-106,364+MOUNTAIN_SETBACK,base(-106,364+MOUNTAIN_SETBACK)))
report['projections_bottom_origin']['right_peak']=project((116,389+MOUNTAIN_SETBACK,base(116,389+MOUNTAIN_SETBACK)))
report['landforms']['dry_upper_bank_refinement']={'region_y_m':[138,217],'region_x_fade_m':[0,25],'graded_shoulder_width_m':[46,54],'protected_dry_margin_from_wet_edge_m':0,'purpose':'Grade dry land continuously from the exact wet edge; remove the lower cliff remnant without altering wetted channel.'}
report['camera'].update(fixed_to_pre_revision_camera=True,lens_mm=cam.data.lens)
for obsolete in ['previous_position','height_change_m','ground_position_change_m','previous_eye_height_m','previous_target']:
    report['camera'].pop(obsolete,None)
report['stream']={'main_control_points_y_x':MAIN_CONTROLS,'tributary_control_points_y_x':TRIBUTARY_CONTROLS,'main_width_scale':.85,'tributary_width_scale':.40,'bed_depth_m':{'main':.65,'tributary':.45},'confluence_xy_m':[-23,44],'construction':'One connected closed water volume; both channels carve the continuous terrain, with shared graded floodplain and bank definitions.','endpoints':'Main leaves the left camera edge; tributary recedes behind foothill contours.','samples':[{'stream':s.name,'y':y,'bed_width_m':s.width(y),'water_z_m':s.level(y)} for s,ys in [(NETWORK.main,[0,18,32,44,62]),(NETWORK.tributary,[65,108,160,205])] for y in ys]}
report['landforms'].pop('dry_upper_bank_refinement',None)
report['landforms'].update(left_foreground_rise_m=1.3,left_rise_transition_width_m=36,foreground_contours='Broad bottom-left crest fades over 43 m toward the valley and middle distance; previous raised left-midground platform removed.',valley_floor_relief='Compact graded floodplains around both stream arms; original right-valley landform retained for hamlet grounding.')
join_y,join_x=TRIBUTARY_CONTROLS[0]
report['stream']['confluence_xy_m']=[join_x,join_y]
report['projections_bottom_origin']['stream_bend']=project((join_x,join_y,level(join_y)))
report['look_development']=lookdev
report['restrained_composition_refinement']={'mountain_setback_m':MOUNTAIN_SETBACK,'additional_setback_m':14,'hamlet_architectural_scale':.86,'camera_side_bank_easing_max_m':.18,'bank_easing_y_range_m':[20,105],'foreground_bed_narrowing_max_fraction':.10,'foreground_bank_narrowing_max_fraction':.06,'foreground_taper_end_y_m':30,'camera_unchanged':True}
report['restrained_composition_refinement']['bank_easing_y_range_m']=[8,82]
report['streamside_hierarchy_pass']={'previous_confluence_xy_m':[-23,44],'current_confluence_xy_m':[join_x,join_y],'mountain_geometry_setback_m':MOUNTAIN_SETBACK,'atmosphere':'World-distance and altitude graded volume; low near-field density, increasing through the distant valley.','density_range':[.00005,.0018],'near_valley_y_range_m':[100,400]}
report['stream_hamlet_cleanup']={'left_reach_narrowing_fraction':.10,'left_taper_y_range_m':[17,32],'hamlet_architectural_scale':.81,'hamlet_group_compression_xy':[.78,.76],'hamlet_layout_center_y_m':124,'tributary_bank_freeboard_m':[.26,.48],'tributary_bank_softening_y_m':[30,185],'distant_water_roughness':.22,'diagnosis':'Saved water was continuous with 0.45 m bed clearance; reflected grassy slopes and broad exposed bank shoulders weakened its water read. Uppermost reach remains naturally hidden by terrain.'}
report['restrained_composition_refinement']['hamlet_architectural_scale']=.81
report['material_resources']={'manifest':'material-resources/download_manifest.json','credits':'material-resources/ASSET_SOURCES.md','mapping':'world-coordinate blended box projection','height_response':'Triplanar height-derived bump; tangent normal maps retained without incorrect box projection','packed_sources':True}
(ROOT/'composition_measurements.json').write_text(json.dumps(report,indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'echelon_alpine_composition_01.blend'))
bpy.ops.render.render(write_still=True)
