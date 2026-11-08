"""Fresh-file verification of the edited two-stream valley; does not modify the blend."""
import bpy,json,sys,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root))
from stream_network import StreamNetwork
bpy.ops.wm.open_mainfile(filepath=str(root/'echelon_alpine_composition_01.blend'))
scene=bpy.context.scene;cam=scene.camera
baseline=json.loads((root/'valley_revision_preservation.json').read_text())
net=StreamNetwork();deps=bpy.context.evaluated_depsgraph_get()
ground=bpy.data.objects['Continuous meadow foothills and mountain range']
water=bpy.data.objects['Water inside carved channel - static graded surface']
tree=BVHTree.FromObject(ground,deps);wt=BVHTree.FromObject(water,deps)
def height(x,y):
    p,*_=tree.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600)
    assert p is not None
    return p.z
def visibility(point):
    point=Vector(point);q=world_to_camera_view(scene,cam,point)
    origin=cam.location.copy();direction=(point-origin).normalized();remaining=(point-origin).length+.05
    hit=False;obj=None
    for _ in range(8):
        hit,loc,n,face,obj,m=scene.ray_cast(deps,origin,direction,distance=remaining)
        if not hit or obj.name!='Bounded light aerial perspective':break
        remaining-=(loc-origin).length+.002;origin=loc+direction*.002
    inside=q.z>0 and 0<=q.x<=1 and 0<=q.y<=1
    return dict(screen_bottom_origin=[q.x,q.y],in_frame=inside,visible=bool(inside and hit and obj==water),occluder=obj.name if hit else None)
views=[a.spaces.active.region_3d.view_perspective for s in bpy.data.screens for a in s.areas if a.type=='VIEW_3D']
error=max(abs(cam.matrix_world[i][j]-baseline['camera_matrix'][i][j]) for i in range(4) for j in range(4))
assert error<1e-6 and cam.data.lens==baseline['lens'] and all(v=='CAMERA' for v in views)
samples=[]
for stream,ys in [(net.main,[0,7,12,16,21,25,30,35,40,60,90]),(net.tributary,[32,44,65,85,108,135,160,190,210,223])]:
    for y in ys:
        x=stream.center(y);z=stream.level(y)
        p,*_=wt.ray_cast(Vector((x,y,z+.08)),Vector((0,0,-1)),.2)
        item=dict(stream=stream.name,y=y,world=[x,y,z],bed_clearance_m=z-height(x,y),water_top_error_m=abs(p.z-z) if p else None,**visibility((x,y,z+.001)))
        samples.append(item)
        assert p is not None and abs(p.z-z)<.015,'Discontinuous water: '+str(item)
        assert item['bed_clearance_m']>.30,'Bed intersects water: '+str(item)
mount=np.array([tuple(v.co) for v in ground.data.vertices if v.co.y>232],dtype=np.float32)
mount=mount[np.lexsort((mount[:,2],mount[:,0],mount[:,1]))]
digest=hashlib.sha256(mount.tobytes()).hexdigest()
hamlet=[]
layout=json.loads((root/'composition_measurements.json').read_text())['landforms']['hamlet_layout']
for name,old in baseline['hamlet_wall_vertices'].items():
    o=bpy.data.objects[name];points=[o.matrix_world@v.co for v in o.data.vertices];bottom=min(p.z for p in points)
    old_span=[max(p[i] for p in old)-min(p[i] for p in old) for i in range(3)]
    new_span=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    center_change=[sum(p[i] for p in points)/len(points)-sum(p[i] for p in old)/len(old) for i in range(2)]
    old_center=[sum(p[i] for p in old)/len(old) for i in range(2)]
    expected=[36+(old_center[0]-36)*.78,124+(old_center[1]-143)*.76]
    center=[sum(p[i] for p in points)/len(points) for i in range(2)]
    authored_height=layout[int(name.split()[1])-1][4]
    eave_scale=(max(p.z for p in points)-o['ground_seat_height'])/authored_height
    hamlet.append(dict(object=name,dimension_ratio=[a/b for a,b in zip(new_span,old_span)],above_ground_eave_scale=eave_scale,center_xy_change_m=center_change,current_center_xy=center,expected_center_xy=expected,layout_error_m=max(abs(a-b) for a,b in zip(center,expected)),minimum_foundation_burial_m=min(height(p.x,p.y)-bottom for p in points if abs(p.z-bottom)<.001)))
textures=[]
for n in bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'].nodes:
    if n.type!='TEX_IMAGE':continue
    im=n.image;expected='sRGB' if n.name.endswith('color') else 'Non-Color'
    assert im and im.packed_file and all(im.size) and im.colorspace_settings.name==expected
    textures.append(dict(node=n.name,packed=True,size=list(im.size),colorspace=im.colorspace_settings.name))
endpoints={s.name:visibility((s.center(s.controls[-1][0]),s.controls[-1][0],s.level(s.controls[-1][0])+.001)) for s in net.streams}
join_y,join_x=net.tributary.controls[0]
review=dict(active_camera=cam.name,saved_view_perspectives=views,camera_matrix_error=error,stream_samples=samples,endpoints=endpoints,mountain_vertex_count=len(mount),mountain_coordinate_hash=digest,mountain_coordinates_unchanged=digest==baseline['mountain_hash'],hamlet=hamlet,terrain_texture_maps=textures,left_meadow_longitudinal_section=[dict(x=-24,y=y,ground_z=height(-24,y)) for y in [0,12,24,36,44]],confluence_water_level_error_m=abs(net.main.level(join_y)-net.tributary.level(join_y)))
peak=max(ground.data.vertices,key=lambda v:v.co.z).co
previous=baseline['restrained_refinement_baseline']['highest_vertex']
review['mountain_setback_check']=dict(highest_vertex=list(peak),previous_highest_vertex=previous,measured_peak_y_change_m=peak.y-previous[1],measured_peak_height_change_m=peak.z-previous[2],intended_setback_change_m=14)
review['foreground_width_taper']=[dict(y=y,bed_width_factor=net.main.entry_taper(y)) for y in [0,9,18,30,44]]
review['left_crossing_width_visibility']=[]
for y in [16,21,25,28]:
    s=net.main;half=s.width(y)*s.factor(y)/2
    visible=[visibility((s.center(y)+half*f,y,s.level(y)+.001))['visible'] for f in [-.8,-.4,0,.4,.8]]
    review['left_crossing_width_visibility'].append(dict(y=y,visible_samples=visible,visible_fraction=sum(visible)/len(visible)))
report=json.loads((root/'composition_measurements.json').read_text());report['verified_saved_file']=review
report['camera'].update(fixed_to_pre_revision_camera=True,lens_mm=cam.data.lens)
for key in ['previous_position','height_change_m','ground_position_change_m','previous_eye_height_m','previous_target']:report['camera'].pop(key,None)
report['stream']=dict(main_control_points_y_x=net.main.controls,tributary_control_points_y_x=net.tributary.controls,main_width_scale=.85,tributary_width_scale=.40,foreground_bed_narrowing_max_fraction=.10,foreground_bank_narrowing_max_fraction=.06,taper_end_y_m=30,bed_depth_m=dict(main=.65,tributary=.45),confluence_xy_m=[join_x,join_y],construction='Connected closed water volume, shared channel and bank terrain definitions; near-meadow bends cross left out of frame, tributary recedes into foothills.')
report['landforms'].pop('dry_upper_bank_refinement',None)
report['landforms'].update(left_foreground_rise_m=1.3,left_rise_transition_width_m=36,foreground_contours='Broad bottom-left crest fades over 43 m toward water and middle distance; previous raised platform removed.')
report['restrained_composition_refinement']=dict(mountain_setback_m=54,additional_setback_m=14,hamlet_architectural_scale=.86,camera_side_bank_easing_max_m=.18,bank_easing_y_range_m=[8,82],camera_unchanged=True)
report['restrained_composition_refinement']['hamlet_architectural_scale']=.81
report['stream_hamlet_cleanup']=dict(left_reach_narrowing_fraction=.10,left_taper_y_range_m=[17,32],hamlet_architectural_scale=.81,hamlet_group_compression_xy=[.78,.76],hamlet_layout_center_y_m=124,tributary_bank_freeboard_m=[.26,.48],tributary_bank_softening_y_m=[30,185],distant_water_roughness=.22,diagnosis='Water surface present with 0.45 m bed clearance; grassy terrain reflected in water, exposed shoulders exaggerated the empty-channel impression. Natural upper endpoint remains hidden.')
report['streamside_hierarchy_pass']=dict(previous_confluence_xy_m=[-23,44],current_confluence_xy_m=[join_x,join_y],new_confluence_camera=visibility((join_x,join_y,net.main.level(join_y)+.001)),mountain_geometry_setback_m=54,atmosphere='World-distance and altitude graded volume; low near-field density, increasing through the distant valley.',density_range=[.00005,.0018],near_valley_y_range_m=[100,400])
report['projections_bottom_origin']['stream_bend']=report['streamside_hierarchy_pass']['new_confluence_camera']['screen_bottom_origin']
(root/'composition_measurements.json').write_text(json.dumps(report,indent=2))
print('FRESH FILE REVIEW',json.dumps(review,indent=2),flush=True)
assert abs(peak.y-previous[1]-14)<1 and abs(peak.z-previous[2])<1.5,'Mountain change exceeds the restrained setback.'
assert all(all(.80<r<.82 for r in h['dimension_ratio'][:2]) and abs(h['above_ground_eave_scale']-.81)<.001 and h['layout_error_m']<.01 and h['minimum_foundation_burial_m']>=-.01 for h in hamlet),'Hamlet scale, position or grounding incorrect.'
assert not endpoints['main']['in_frame'],'Main stream endpoint inside frame.'
assert not endpoints['tributary']['visible'],'Tributary endpoint exposed.'
assert any(s['visible'] and s['y']>=21 for s in samples if s['stream']=='main'),'Leftward water reach hidden.'
assert all(s['visible_fraction']>=.6 for s in review['left_crossing_width_visibility']),'The left crossing is substantially obscured.'
assert any(s['visible'] and s['y']>=85 for s in samples if s['stream']=='tributary'),'Receding tributary hidden.'
assert len(textures)>=12
print('FRESH FILE CHECKS PASSED',flush=True)
