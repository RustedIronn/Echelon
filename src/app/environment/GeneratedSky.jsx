import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createSkyUniforms, makeGeneratedSky, makeRawSky, writeSkyUniforms } from './generatedSky.js';
import { SKY_ACTIVE } from './skyShader.js';

// Holds the generated sky and the environment light made from it. It stays hidden (and the approved panorama stays in use) until the time-of-day
// system switches it on; switching it off restores the approved sky and environment exactly.
export default function GeneratedSky({ resources }) {
  const gl = useThree((state) => state.gl); const scene = useThree((state) => state.scene); const invalidate = useThree((state) => state.invalidate);
  const rig = useMemo(() => {
    const uniforms = createSkyUniforms(); const material = makeGeneratedSky(resources, uniforms);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material); mesh.name = 'generated-sky'; mesh.scale.setScalar(1400); mesh.visible = false;
    const envScene = new THREE.Scene(); const envMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), makeRawSky(uniforms)); envMesh.scale.setScalar(100); envScene.add(envMesh);
    return { uniforms, mesh, material, envScene, envMesh, active: false, target: null, approvedEnvironment: null, timer: 0, lastEnv: 0, last: null };
  }, [resources]);

  useLayoutEffect(() => {
    const regenerate = () => {
      if (!rig.active) return; rig.lastEnv = performance.now();
      const generator = new THREE.PMREMGenerator(gl); const target = generator.fromScene(rig.envScene, 0, 0.1, 1000, { size: 256 }); generator.dispose();
      rig.target?.dispose(); rig.target = target; scene.environment = target.texture; invalidate();
      window.setTimeout(() => window.__echelonPrototype?.refreshWaterOptics?.(), 60); // the cached water reflection must see the new sky
    };
    const api = {
      setActive(on) {
        if (on === rig.active) return;
        const panorama = scene.getObjectByName('panorama-sky');
        if (on) { rig.approvedEnvironment = scene.environment; rig.active = true; SKY_ACTIVE.value = 1; rig.mesh.visible = true; if (panorama) panorama.visible = false; }
        else { rig.active = false; SKY_ACTIVE.value = 0; clearTimeout(rig.timer); rig.mesh.visible = false; if (panorama) panorama.visible = true; scene.environment = rig.approvedEnvironment; }
      },
      update(state) {
        writeSkyUniforms(rig.uniforms, state); rig.last = state;
        // The environment light is rebuilt shortly after the sky stops changing (it costs a few milliseconds), never on every slider tick.
        clearTimeout(rig.timer); const wait = performance.now() - rig.lastEnv > 400 ? 0 : 250; rig.timer = setTimeout(regenerate, wait);
      },
    };
    scene.userData.todRig = api; scene.userData.todSky = rig.material;
    return () => { clearTimeout(rig.timer); api.setActive(false); delete scene.userData.todRig; rig.target?.dispose(); };
  }, [gl, scene, invalidate, rig]);

  useEffect(() => () => { rig.mesh.geometry.dispose(); rig.material.dispose(); rig.envMesh.geometry.dispose(); rig.envMesh.material.dispose(); }, [rig]);
  return <primitive object={rig.mesh} />;
}
