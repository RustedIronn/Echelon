"""A measured side-profile diagram of the saved terrain; never saves a scene."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'echelon_alpine_composition_01.blend'))
ground=bpy.data.objects['Continuous meadow foothills and mountain range']
tree=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
profiles=[]
for name,x,end,color in [('Left massif',-107,404,(.11,.40,.28,1)),('Central massif',14,419,(.17,.32,.62,1)),('Right massif',124,428,(.58,.30,.14,1))]:
    points=[]
    for y in range(180,end+1,2):
        hit,_,_,_=tree.ray_cast(Vector((x,y,200)),Vector((0,0,-1)),300)
        assert hit is not None
        points.append([float(y),float(hit.z)])
    profiles.append({'name':name,'x_m':x,'points_y_z_m':points,'color':color})
(root/'climb_profile_measurements.json').write_text(json.dumps(profiles,indent=2))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1400;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG'
world=bpy.data.worlds.new('Diagram white');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1);scene.world=world

def material(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True;t=m.node_tree;t.nodes.clear()
    o=t.nodes.new('ShaderNodeOutputMaterial');e=t.nodes.new('ShaderNodeEmission');e.inputs[0].default_value=color;t.links.new(e.outputs[0],o.inputs['Surface']);return m
ink=material('Diagram ink',(.075,.09,.11,1));grid=material('Diagram grid',(.83,.86,.88,1))

def line(name,points,mat,width=.12):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=width;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,(x,y) in zip(s.points,points):p.co=(x,y,0,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(mat)

def text(body,x,y,size=3.4,mat=ink):
    c=bpy.data.curves.new(body,'FONT');c.body=body;c.size=size
    o=bpy.data.objects.new(body,c);scene.collection.objects.link(o);o.location=(x,y,.2);c.materials.append(mat)

for height in [0,20,40,60,80,100]:
    line('Height grid',[(180,height),(440,height)],grid,.055);text(str(height),167,height-1.2,2.9)
for distance in [180,220,260,300,340,380,420]:text(str(distance),distance-3,-7,2.9)
line('Axes',[(180,100),(180,0),(440,0)],ink,.10)
text('MEADOW TO ALPINE RANGE — actual saved terrain',176,115,4.2)
text('Height (m)',167,104,3);text('Distance along valley (m)',245,-15,3)
for i,profile in enumerate(profiles):
    mat=material(profile['name'],profile['color']);line(profile['name'],profile['points_y_z_m'],mat,.26)
    text(profile['name'],188+i*80,104,3.3,mat)
text('Three longitudinal sections through the landscape; small dips include real gullies.',180,-24,2.8)
bpy.ops.object.camera_add(location=(308,47,250));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=320;scene.camera=camera
scene.render.filepath=str(root/'climb_profile_preview.png');bpy.ops.render.render(write_still=True)
print('MEASURED_CLIMB_PROFILE_RENDERED; no scene saved.')
