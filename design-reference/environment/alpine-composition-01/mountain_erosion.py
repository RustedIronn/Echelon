"""Deterministic, art-directed drainage erosion on the existing alpine landform.

Uses Blender's bundled NumPy only. This is a simplified stream-power incision
and slope-transport model, not a calibrated geological/hydrological simulation.
The seed perturbation affects routing only and is removed from the final shape.
"""
import math
import numpy as np


def smooth(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)


class ErosionField:
    def __init__(self,source_height,spacing=.8,iterations=36):
        self.x0=-220.;self.y0=232.;self.spacing=spacing
        self.xs=np.arange(self.x0,220+spacing*.25,spacing)
        self.ys=np.arange(self.y0,420+spacing*.25,spacing)
        xx,yy=np.meshgrid(self.xs,self.ys)
        original=np.array([[source_height(float(x),float(y)) for x in self.xs] for y in self.ys],dtype=np.float64)
        rows,cols=original.shape;size=original.size
        rng=np.random.default_rng(7831)

        def coherent_noise(period):
            gx=(xx-self.x0)/period;gy=(yy-self.y0)/period
            ix=gx.astype(int);iy=gy.astype(int);tx=smooth(gx-ix);ty=smooth(gy-iy)
            values=rng.uniform(-1,1,(int(iy.max())+2,int(ix.max())+2))
            return (values[iy,ix]*(1-tx)+values[iy,ix+1]*tx)*(1-ty)+(values[iy+1,ix]*(1-tx)+values[iy+1,ix+1]*tx)*ty

        seed=.16*coherent_noise(3.2)+.08*coherent_noise(1.6)
        initial=original+seed
        height=initial.copy()
        mask=smooth((yy-234)/26)*smooth((original-15)/22)
        mask*=smooth((xx-self.x0)/12)*smooth((220-xx)/12)*smooth((420-yy)/8)
        # Dipping layers alter erodibility; they are not added as height stripes.
        strata=.83+.17*np.sin(original*.51+xx*.047+yy*.025)
        geology=1.0+.22*np.exp(-((xx+100)/68)**2)-.15*np.exp(-((xx-15)/42)**2)
        erodibility=strata*geology
        # Broad resistant faces interrupt the channel rhythm. These are smooth
        # bedrock domains, not an evenly spaced family of painted gully masks.
        quiet=np.maximum.reduce([
            .82*np.exp(-((xx+5)/29)**2-((yy-345)/36)**2),
            .76*np.exp(-((xx-49)/31)**2-((yy-326)/35)**2),
            .56*np.exp(-((xx+146)/39)**2-((yy-306)/35)**2),
            .62*np.exp(-((xx-146)/30)**2-((yy-340)/39)**2),
        ])
        ids=np.arange(size).reshape(rows,cols)
        neighbours=[]
        for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
            target=np.roll(ids,(-dy,-dx),(0,1));valid=np.ones((rows,cols),dtype=bool)
            if dy<0:valid[:1,:]=False
            if dy>0:valid[-1:,:]=False
            if dx<0:valid[:,:1]=False
            if dx>0:valid[:,-1:]=False
            target=np.where(valid,target,ids)
            neighbours.append((target,spacing*math.hypot(dx,dy)))

        def routing(surface):
            best=np.zeros_like(surface);receiver=ids.copy();flat=surface.ravel()
            for target,distance in neighbours:
                slope=(surface-flat[target])/distance
                use=slope>best;best[use]=slope[use];receiver[use]=target[use]
            area=np.full(size,spacing*spacing,dtype=np.float64)
            receivers=receiver.ravel()
            # Strict downhill routing gives a topological accumulation order.
            for index in np.argsort(flat)[::-1]:
                target=receivers[index]
                if target!=index:area[target]+=area[index]
            return receiver,best,area.reshape(rows,cols)

        transported=np.zeros_like(height)
        for iteration in range(iterations):
            receiver,slope,area=routing(height)
            # A runoff threshold protects interfluves: the mountain must be
            # dissected by drainage, not lowered uniformly across every face.
            primary=smooth((np.log1p(area)-math.log(100))/math.log(8))
            initiation=10+22*quiet
            discharge=np.maximum(0,np.sqrt(area)-np.sqrt(initiation))
            resistance=1-.78*quiet*(1-.65*primary)
            incision=.052*discharge*np.power(np.maximum(slope,0),.9)*erodibility*resistance
            incision=np.minimum(incision,.28)*mask
            # Cap total lowering so the existing mountain masses and skyline
            # remain recognisable rather than dissolving into deep canyons.
            local_limit=2.8+5.2*primary
            incision=np.minimum(incision,np.maximum(0,local_limit-(initial-height)))
            height-=incision
            # Small transfers from unstable banks broaden cuts into V sections.
            receiver_height=height.ravel()[receiver]
            excess=np.maximum(0,height-receiver_height-spacing*.82)
            transfer=np.minimum(.035*excess,.085)*mask*(1-.65*quiet)
            height-=transfer
            deposition=np.zeros(size)
            np.add.at(deposition,receiver.ravel(),transfer.ravel()*.65)
            deposition=deposition.reshape(rows,cols)*mask
            height+=deposition;transported+=deposition
            height=np.maximum(height,initial-8.0)

        receiver,slope,area=routing(height)
        delta=(height-initial)*mask
        # A very small lateral filter removes one-cell D8 edges, preserving the
        # converging drainage network and its hierarchy of tributaries.
        blur=(np.roll(delta,1,0)+np.roll(delta,-1,0)+np.roll(delta,1,1)+np.roll(delta,-1,1))*0.25
        self.delta=.72*delta+.28*blur*mask
        self.incision=np.maximum(0,-self.delta)
        self.drainage=smooth((np.log1p(area)-math.log(8))/math.log(100))*mask
        self.talus=np.clip(transported/.65,0,1)*mask
        active=self.incision[mask>.5]
        self.report={'method':'D8 contributing area, stream-power-style incision and bounded slope transport',
                     'calibrated_simulation':False,'seed':7831,'spacing_m':spacing,'iterations':iterations,
                     'bounds_xy_m':[self.x0,220,self.y0,420],'grid_shape':[rows,cols],
                     'incision_max_m':float(self.incision.max()),'incision_median_active_m':float(np.median(active)),
                     'incision_p95_active_m':float(np.percentile(active,95)),
                     'hierarchy':'Area-led primary channels, restrained secondary feeders, and broad resistant bedrock faces',
                     'secondary_to_primary_incision_limits_m':[2.8,8.0],
                     'runoff_initiation_area_range_m2':[10,28.1],
                     'seed_perturbation_in_final_surface':False,
                     'source_reference':'https://landlab.readthedocs.io/en/latest/generated/api/landlab.components.stream_power.stream_power.html'}
        print('MOUNTAIN_EROSION',self.report,flush=True)

    def sample(self,x,y,field='delta'):
        gx=(x-self.x0)/self.spacing;gy=(y-self.y0)/self.spacing
        data=getattr(self,field)
        if gx<0 or gy<0 or gx>=data.shape[1]-1 or gy>=data.shape[0]-1:return 0.0
        ix=int(gx);iy=int(gy);tx=gx-ix;ty=gy-iy
        return float((data[iy,ix]*(1-tx)+data[iy,ix+1]*tx)*(1-ty)+(data[iy+1,ix]*(1-tx)+data[iy+1,ix+1]*tx)*ty)
