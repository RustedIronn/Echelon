"""Small authored hillside settlement; no external architecture assets."""
import math
import bpy


def build_hamlet(layout,terrain,collection,plaster,copper,scale=1):
    def material(name,color,roughness=.82):
        m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness
        return m

    stone=material('Hamlet weathered foundation stone',(.17,.185,.145))
    st=stone.node_tree;sp=st.nodes.get('Principled BSDF')
    grain=st.nodes.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=8;grain.inputs['Detail'].default_value=2
    bump=st.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.25;bump.inputs['Distance'].default_value=.035
    st.links.new(grain.outputs['Fac'],bump.inputs['Height']);st.links.new(bump.outputs['Normal'],sp.inputs['Normal'])
    timber=material('Hamlet aged timber',(.105,.065,.035))
    glass=material('Hamlet unlit window recess',(.018,.034,.038),.32)
    trim=material('Hamlet pale window trim',(.67,.64,.53))
    slate=material('Hamlet weathered slate',(.11,.135,.145))
    shingle=material('Hamlet warm brown shingles',(.17,.105,.057))
    rose=material('Hamlet warm limewash',(.52,.40,.29))

    def mesh(name,vertices,faces,mat):
        data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.data.materials.append(mat);return obj

    records=[]
    offsets=[(0,0,0),(2,4,8),(-9,8,-10),(3,9,4),(-15,18,-16)]
    for k,(x,y,w,d,h,degrees) in enumerate(layout):
        dx,dy,turn=offsets[k];x+=dx;y+=dy;degrees+=turn
        angle=math.radians(degrees);label=f'Village {k+1:02}'
        def xy(dx,dy):return x+scale*(math.cos(angle)*dx-math.sin(angle)*dy),y+scale*(math.sin(angle)*dx+math.cos(angle)*dy)
        def point(dx,dy,height):return (*xy(dx,dy),z+scale*(height-z))
        def box(name,dx,dy,z,sx,sy,sz,mat):
            corners=[point(dx+a*sx/2,dy+b*sy/2,z+c*sz/2) for c in [-1,1] for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            return mesh(label+' '+name,corners,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)

        heights=[terrain(*xy(dx,dy)) for dx,dy in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]
        z=sum(heights)/len(heights)-.10;bottom=min(heights)-.45;eave=z+h
        facade=plaster if k in [0,1,3] else (rose if k==2 else timber)
        body=box('wall mass',0,0,(bottom+eave)/2,w,d,eave-bottom,facade)
        body['architecture']='Meadow chapel' if k==0 else 'Alpine cottage'
        body['ground_seat_height']=z
        records.append({'building':label,'type':body['architecture'],'position_xy':[x,y],'ground_seat_height':z,'rotation_degrees':degrees,'architectural_scale':scale})
        box('stone foundation',0,0,(bottom+z+.08)/2,w+.10,d+.10,z+.08-bottom,stone)
        pitch=math.radians([53,43,48,39,46][k]);rise=w*.5*math.tan(pitch)
        overhang=.30 if k==0 else .52
        roofmat=copper if k in [0,2] else (slate if k in [1,4] else shingle)
        # Gable walls and roof are separate editable objects.
        gables=[point(-w/2,-d/2,eave),point(w/2,-d/2,eave),point(0,-d/2,eave+rise),point(-w/2,d/2,eave),point(w/2,d/2,eave),point(0,d/2,eave+rise)]
        mesh(label+' plaster gables',gables,[(0,1,2),(3,5,4)],facade)
        rv=[point(-w/2-overhang,-d/2-overhang,eave-overhang*math.tan(pitch)),point(w/2+overhang,-d/2-overhang,eave-overhang*math.tan(pitch)),point(w/2+overhang,d/2+overhang,eave-overhang*math.tan(pitch)),point(-w/2-overhang,d/2+overhang,eave-overhang*math.tan(pitch)),point(0,-d/2-overhang,eave+rise),point(0,d/2+overhang,eave+rise)]
        rooftop=mesh(label+' pitched roof',rv,[(0,4,5,3),(4,1,2,5)],roofmat)
        solid=rooftop.modifiers.new('Timber roof thickness','SOLIDIFY');solid.thickness=.12*scale
        for side in [-1,1]:
            box('timber eave '+str(side),side*w/2,0,eave-.10,.12,d+.30,.20,timber)

        def front_window(dx,dz,width=.62,height=.88):
            front=-d/2-.025
            box('window recess',dx,front,dz,width,.055,height,glass)
            box('window top',dx,front-.035,dz+height/2,width+.12,.07,.075,trim)
            box('window sill',dx,front-.045,dz-height/2,width+.16,.13,.09,trim)
            for side in [-1,1]:box('window jamb',dx+side*width/2,front-.035,dz,.07,.07,height,trim)
            box('window mullion',dx,front-.06,dz,.035,.045,height,trim)

        def entrance_steps(dx,dy,floor,width=1.15):
            ground=z+(terrain(*xy(dx,dy-.55))-z)/scale
            count=max(0,min(6,math.ceil((floor-ground)/.20)))
            for i in range(count):
                sy=dy-.22-.28*i;top=floor-.18*i
                foot=z+(terrain(*xy(dx,sy))-z)/scale-.08
                if top>foot+.04:box('grounded entry step',dx,sy,(foot+top)/2,width,.33,top-foot,stone)

        for dx in [-w*.29,w*.29]:front_window(dx,z+1.9)
        front_window(0,eave+rise*.42,.55,.72)
        for dy in [-d*.26,d*.22]:
            box('side window',-w/2-.025,dy,z+1.9,.055,.65,.9,glass)
            box('side window sill',-w/2-.07,dy,z+1.43,.12,.8,.09,trim)

        if k==0:
            # Modest chapel tower with a steep, weathered copper spire.
            tx=-w*.04;ty=-d*.40;tw=1.65;td=1.85;top=z+6.9
            box('chapel tower',tx,ty,(z+top)/2,tw,td,top-z,plaster)
            box('chapel belfry opening',tx,ty-td/2-.03,top-.85,.65,.065,1.05,glass)
            box('chapel tower cornice',tx,ty,top-.12,tw+.18,td+.18,.18,trim)
            # Eight-sided steep spire, with an understated finial.
            ring=[point(tx+1.12*math.cos(i*math.tau/8+math.pi/8),ty+1.12*math.sin(i*math.tau/8+math.pi/8),top) for i in range(8)]
            mesh(label+' copper spire',ring+[point(tx+.06,ty,top+3.7)],[(i,(i+1)%8,8) for i in range(8)],copper)
            box('chapel finial',tx+.06,ty,top+3.86,.055,.055,.34,timber)
            box('chapel entry',tx,ty-td/2-.04,z+.8,.75,.08,1.6,timber)
            entrance_steps(tx,ty-td/2,z+.06)
        else:
            box('front door',0,-d/2-.035,z+.85,.75,.07,1.7,timber)
            # One restrained porch/chalet balcony creates depth, not ornament spam.
            if k in [1,3]:
                box('porch floor',0,-d/2-.50,z+.12,w*.72,1.0,.22,timber)
                for side in [-1,1]:box('porch post',side*w*.32,-d/2-.8,z+1.18,.12,.12,2.2,timber)
                box('porch beam',0,-d/2-.8,z+2.28,w*.77,.16,.18,timber)
                entrance_steps(0,-d/2-1.0,z+.23)
            else:entrance_steps(0,-d/2,z+.06)
            box('masonry chimney',w*.24,d*.20,eave+rise*.70,.48,.58,1.7,stone)

        # Roof seams establish a simple authored construction rhythm at this scale.
        for row in [-.28,.23]:
            dy=d*row
            for side in [-1,1]:
                a=point(0,dy,eave+rise+.015);b=point(side*(w/2+overhang),dy,eave-overhang*math.tan(pitch)+.015)
                cv=bpy.data.curves.new(label+' roof seam','CURVE');cv.dimensions='3D';cv.bevel_depth=.018*scale;cv.bevel_resolution=0
                spline=cv.splines.new('POLY');spline.points.add(1)
                for p,co in zip(spline.points,[a,b]):p.co=(*co,1)
                obj=bpy.data.objects.new(label+' roof seam',cv);collection.objects.link(obj);cv.materials.append(timber)
    return records
