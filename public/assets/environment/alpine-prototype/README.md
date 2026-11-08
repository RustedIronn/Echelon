# Private desktop prototype derivatives

Base assets come from `export_prototype.py`; native normal/roughness maps use its `--surface-only` mode; the current sky/display transform, grass, depth/wetness and flower LODs come from `prepare_parity.py` under `design-reference/environment/webgl-prototype/`.

See `PARITY_REPORT.md` for the current reproduction steps and source attribution. These local assets include Royalty Free derivatives and are ignored from source control. They are not cleared for public raw-asset redistribution. No Blender master is stored or overwritten here.

The next parity refinement uses `prepare_cohesion_surfaces.py` for direction-independent terrain/range/hamlet AO. See `COHESION_REVIEW.md` for full-frame comparisons, measured performance, cached-reflection limitations and reproduction steps. Existing private licensing restrictions remain.

Current water/middle-meadow pass: run `prepare_canopy_material.py` then `prepare_canopy_roots.py` after the existing preparations. See `CORRIDOR_REVIEW.md` for source-derived canopy/placement data, optical-cache costs, comparisons and remaining limitations. All are local derivatives under the same source licensing restrictions.
