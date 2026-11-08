import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import {
  createFoliageData,
  createDistantTerrainGeometry,
  createStreamGeometry,
  createTerrainGeometry,
  createWildflowerData,
  terrainHeightAt,
} from "./threeLandscapeData.js";

const ASSET_ROOT = "/assets/environment";

function CameraComposition() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(8.5, 10, 25);
    camera.lookAt(-.3, 4, -95);
  }, [camera]);
  return null;
}

function prepareTexture(texture, repeatX = 22, repeatY = 32, color = true) {
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function TerrainMaterial() {
  const [baseColor, baseNormal, baseRoughness, baseAo, variationColor] = useLoader(THREE.TextureLoader, [
    `${ASSET_ROOT}/terrain/grass-base/Grass006_2K-PNG_Color.png`,
    `${ASSET_ROOT}/terrain/grass-base/Grass006_2K-PNG_NormalGL.png`,
    `${ASSET_ROOT}/terrain/grass-base/Grass006_2K-PNG_Roughness.png`,
    `${ASSET_ROOT}/terrain/grass-base/Grass006_2K-PNG_AmbientOcclusion.png`,
    `${ASSET_ROOT}/terrain/grass-variation/Grass007_2K-PNG_Color.png`,
  ]);
  const material = useMemo(() => {
    prepareTexture(baseColor);
    prepareTexture(baseNormal, 22, 32, false);
    prepareTexture(baseRoughness, 22, 32, false);
    prepareTexture(baseAo, 22, 32, false);
    prepareTexture(variationColor, 17, 24);
    const result = new THREE.MeshStandardMaterial({
      map: baseColor,
      normalMap: baseNormal,
      normalScale: new THREE.Vector2(.28, .28),
      roughnessMap: baseRoughness,
      aoMap: baseAo,
      color: "#d5e0a0",
      roughness: .92,
      metalness: 0,
    });
    result.onBeforeCompile = (shader) => {
      shader.uniforms.variationMap = { value: variationColor };
      shader.vertexShader = `attribute float streamBank;\nvarying vec3 echelonWorldPosition;\nvarying float echelonStreamBank;\n${shader.vertexShader}`.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nechelonWorldPosition = worldPosition.xyz;\nechelonStreamBank = streamBank;",
      );
      shader.fragmentShader = `uniform sampler2D variationMap;\nvarying vec3 echelonWorldPosition;\nvarying float echelonStreamBank;\n${shader.fragmentShader}`.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
          vec2 variationUv = fract(echelonWorldPosition.xz * .084 + vec2(.17,.31));
          vec3 variation = pow(texture2D(variationMap, variationUv).rgb, vec3(2.2));
          float landDistance = 1.0 - smoothstep(-79.0, -47.0, echelonWorldPosition.z);
          float mountain = 1.0 - smoothstep(-124.0, -82.0, echelonWorldPosition.z);
          float blendNoise = smoothstep(-.45,.62,sin(echelonWorldPosition.x*.17)*sin(echelonWorldPosition.z*.14));
          diffuseColor.rgb = mix(diffuseColor.rgb, variation, blendNoise * .18 * (1.0 - landDistance));
          vec3 foothill = vec3(.47,.57,.43) + sin(echelonWorldPosition.x*.11)*.018;
          float rock = mountain * smoothstep(3.6, 8.6, echelonWorldPosition.y);
          float snow = mountain * smoothstep(8.7, 12.6, echelonWorldPosition.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, foothill, landDistance * .77);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.37,.42,.40), rock * .9);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86,.89,.85), snow * .96);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.42,.52,.29), echelonStreamBank * .16);`,
      );
    };
    result.customProgramCacheKey = () => "echelon-continuous-land-v3";
    return result;
  }, [baseAo, baseColor, baseNormal, baseRoughness, variationColor]);
  return <primitive object={material} attach="material" />;
}

function Terrain() {
  const geometry = useMemo(() => createTerrainGeometry(), []);
  const distantGeometry = useMemo(() => createDistantTerrainGeometry(), []);
  return <group>
    <mesh geometry={geometry} receiveShadow><TerrainMaterial /></mesh>
    <mesh geometry={distantGeometry} receiveShadow><TerrainMaterial /></mesh>
  </group>;
}

function Stream() {
  const geometry = useMemo(() => createStreamGeometry(), []);
  const bedGeometry = useMemo(() => createStreamGeometry(330, 10, { widthMultiplier: .94, verticalOffset: -.055 }), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      shallow: { value: new THREE.Color("#9bc1bb") },
      deep: { value: new THREE.Color("#3d7178") },
      reflection: { value: new THREE.Color("#d7e8e1") },
    },
    vertexShader: "varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform vec3 shallow; uniform vec3 deep; uniform vec3 reflection; varying vec2 vUv; varying vec3 vWorld;
      float noise(vec2 p){return fract(sin(dot(p,vec2(27.19,91.71)))*4812.71);}
      void main(){
        float center=1.0-abs(vUv.x*2.0-1.0);
        float grain=noise(floor(vWorld.xz*4.2));
        vec3 color=mix(shallow,deep,center*.5+grain*.11);
        float softReflection=pow(center,1.5)*(.1+.1*noise(floor(vWorld.xz*1.3)));
        color=mix(color,reflection,softReflection);
        gl_FragColor=vec4(color,.58);
      }`,
  }), []);
  return <group>
    <mesh geometry={bedGeometry} receiveShadow><meshStandardMaterial color="#8d896b" roughness={1} /></mesh>
    <mesh geometry={geometry} material={material} renderOrder={1} />
  </group>;
}

function FoliageField() {
  const mesh = useRef(null);
  const foliage = useMemo(() => createFoliageData(), []);
  const matrix = useMemo(() => new THREE.Object3D(), []);
  const [map, alphaMap, normalMap, roughnessMap] = useLoader(THREE.TextureLoader, [
    `${ASSET_ROOT}/foliage/grass-low/Foliage007_2K-PNG_Color.png`,
    `${ASSET_ROOT}/foliage/grass-low/Foliage007_2K-PNG_Opacity.png`,
    `${ASSET_ROOT}/foliage/grass-low/Foliage007_2K-PNG_NormalGL.png`,
    `${ASSET_ROOT}/foliage/grass-low/Foliage007_2K-PNG_Roughness.png`,
  ]);
  useMemo(() => {
    prepareTexture(map, 1, 1);
    prepareTexture(alphaMap, 1, 1, false);
    prepareTexture(normalMap, 1, 1, false);
    prepareTexture(roughnessMap, 1, 1, false);
  }, [alphaMap, map, normalMap, roughnessMap]);
  useLayoutEffect(() => {
    foliage.forEach((clump, index) => {
      matrix.position.set(clump.x, clump.y + (clump.scale * .43), clump.z);
      matrix.rotation.set(0, clump.rotation, 0);
      matrix.scale.set(clump.scale * .82, clump.scale, 1);
      matrix.updateMatrix();
      mesh.current?.setMatrixAt(index, matrix.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [foliage, matrix]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, foliage.length]} castShadow receiveShadow>
    <planeGeometry args={[1.18, 1.28]} />
    <meshStandardMaterial map={map} alphaMap={alphaMap} normalMap={normalMap} roughnessMap={roughnessMap} side={THREE.DoubleSide} transparent alphaTest={.4} depthWrite color="#9fb46d" roughness={.9} />
  </instancedMesh>;
}

function flowerMaterial(source) {
  return new THREE.MeshStandardMaterial({
    map: source.map ?? null,
    alphaMap: source.alphaMap ?? null,
    color: source.color?.clone() ?? new THREE.Color("#ffffff"),
    transparent: Boolean(source.transparent),
    alphaTest: source.alphaTest || .25,
    side: THREE.DoubleSide,
    roughness: .78,
    metalness: 0,
  });
}

function PackedFlowerInstances({ asset, flowers }) {
  const mesh = useRef(null);
  const matrix = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    flowers.forEach((flower, index) => {
      matrix.position.set(flower.x, flower.y - (asset.minY * flower.scale) + .012, flower.z);
      matrix.rotation.set(0, flower.rotation, 0);
      matrix.scale.setScalar(flower.scale);
      matrix.updateMatrix();
      mesh.current?.setMatrixAt(index, matrix.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [asset.minY, flowers, matrix]);
  return flowers.length ? <instancedMesh ref={mesh} args={[asset.geometry, asset.material, flowers.length]} castShadow receiveShadow /> : null;
}

function FlowersFromPack() {
  const gltf = useLoader(GLTFLoader, `${ASSET_ROOT}/flowers/flowers_pack_4.glb`);
  const flowers = useMemo(() => createWildflowerData(), []);
  const flowerMeshes = useMemo(() => {
    const meshes = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      geometry.computeBoundingBox();
      meshes.push({ geometry, material: flowerMaterial(node.material), minY: geometry.boundingBox.min.y });
    });
    return meshes;
  }, [gltf]);
  return flowerMeshes.map((asset, species) => <PackedFlowerInstances key={species} asset={asset} flowers={flowers.filter((flower) => flower.species === species)} />);
}

function cloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const puffs = [[100,142,80],[165,110,94],[241,125,112],[325,93,78],[386,132,92],[275,71,66]];
  context.clearRect(0, 0, canvas.width, canvas.height);
  puffs.forEach(([x, y, radius]) => {
    const gradient = context.createRadialGradient(x, y, radius * .08, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,.88)");
    gradient.addColorStop(.52, "rgba(248,251,247,.58)");
    gradient.addColorStop(1, "rgba(236,242,238,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, radius * 1.15, radius * .58, 0, 0, Math.PI * 2);
    context.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function CloudFormations() {
  const texture = useMemo(() => cloudTexture(), []);
  const clouds = [
    { position: [-22, 19, -83], scale: [21, 8, 1], opacity: .52 },
    { position: [14, 24, -96], scale: [25, 9, 1], opacity: .42 },
    { position: [35, 15, -72], scale: [16, 6, 1], opacity: .28 },
  ];
  return clouds.map((cloud, index) => <sprite key={index} position={cloud.position} scale={cloud.scale}>
    <spriteMaterial map={texture} color="#fbf8e6" transparent depthWrite={false} opacity={cloud.opacity} />
  </sprite>);
}

function SkyDome() {
  const uniforms = useMemo(() => ({ sunDirection: { value: new THREE.Vector3(-.52, .67, -.53).normalize() } }), []);
  return <mesh scale={205}><sphereGeometry args={[1, 64, 36]} /><shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader="varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,0.)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
    fragmentShader="uniform vec3 sunDirection;varying vec3 vDir;void main(){float h=smoothstep(-.15,.82,vDir.y);vec3 horizon=vec3(.79,.88,.76);vec3 zenith=vec3(.22,.55,.82);vec3 sky=mix(horizon,zenith,h);float sun=max(dot(normalize(vDir),sunDirection),0.);sky+=vec3(1.,.79,.43)*(pow(sun,90.)*.65+pow(sun,6.)*.09);gl_FragColor=vec4(sky,1.);}"
  /></mesh>;
}

function Sun() {
  return <group position={[-30, 31, -78]}>
    <mesh><sphereGeometry args={[1.22, 24, 18]} /><meshBasicMaterial color="#fff4bd" toneMapped={false} /></mesh>
    <mesh scale={4.2}><sphereGeometry args={[1, 24, 18]} /><meshBasicMaterial color="#ffe5a1" transparent opacity={.055} depthWrite={false} /></mesh>
  </group>;
}

function Village() {
  const gltf = useLoader(GLTFLoader, `${ASSET_ROOT}/village/house_village.glb`);
  const village = useMemo(() => {
    const model = gltf.scene.clone(true);
    model.traverse((node) => {
      if (!node.isMesh) return;
      if (node.name === "Cube_Mat_0") node.visible = false;
      node.castShadow = false;
      node.receiveShadow = true;
      node.material = new THREE.MeshStandardMaterial({ map: node.material.map ?? null, color: node.material.color?.clone() ?? new THREE.Color("#ffffff"), roughness: .82, metalness: 0 });
    });
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.position.set(-(bounds.min.x + (size.x * .5)), -bounds.min.y, -(bounds.min.z + (size.z * .5)));
    model.scale.setScalar(8.16 / Math.max(size.x, size.z));
    return model;
  }, [gltf]);
  const position = useMemo(() => new THREE.Vector3(24, terrainHeightAt(24, -73) + .02, -73), []);
  return <primitive object={village} position={position} rotation={[0, -.68, 0]} />;
}

function AfternoonWorld() {
  return <>
    <CameraComposition />
    <SkyDome />
    <Sun />
    <CloudFormations />
    <fog attach="fog" args={["#b8cfbe", 180, 260]} />
    <hemisphereLight args={["#dff2ff", "#8fa267", 1.55]} />
    <directionalLight castShadow position={[-30, 42, 21]} intensity={2.35} color="#fff1bc" shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={1} shadow-camera-far={120} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
    <Terrain />
    <Stream />
    <FoliageField />
    <FlowersFromPack />
    <Village />
  </>;
}

export function ThreeLandscapeWorld({ className = "" }) {
  return <Canvas className={className} dpr={[1, 1.5]} shadows camera={{ fov: 35, near: .1, far: 260 }} gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }} fallback={<div className="landscape-environment__fallback" />}>
    <Suspense fallback={null}><AfternoonWorld /></Suspense>
  </Canvas>;
}
