import './styles.css';
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#club-scene')!;
const audio = document.querySelector<HTMLAudioElement>('#audio')!;
const audioFile = document.querySelector<HTMLInputElement>('#audioFile')!;
const playPause = document.querySelector<HTMLButtonElement>('#playPause')!;
const captureAudio = document.querySelector<HTMLButtonElement>('#captureAudio')!;
const fullscreen = document.querySelector<HTMLButtonElement>('#fullscreen')!;
const hideControls = document.querySelector<HTMLButtonElement>('#hideControls')!;
const controlPanel = document.querySelector<HTMLElement>('.control-panel')!;
const trackName = document.querySelector<HTMLElement>('#trackName')!;
const bassMeter = document.querySelector<HTMLElement>('#bassMeter')!;
const midMeter = document.querySelector<HTMLElement>('#midMeter')!;
const highMeter = document.querySelector<HTMLElement>('#highMeter')!;
const energySlider = document.querySelector<HTMLInputElement>('#energy')!;
const laserSlider = document.querySelector<HTMLInputElement>('#lasers')!;

let audioContext: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let activeSource: AudioNode | undefined;
let localAudioSource: MediaElementAudioSourceNode | undefined;
let captureStream: MediaStream | undefined;
let captureSource: MediaStreamAudioSourceNode | undefined;
let frequencyData = new Uint8Array(1024);
let timeData = new Uint8Array(1024);
let smoothedBass = 0;
let smoothedMid = 0;
let smoothedHigh = 0;
let controlsHidden = false;
let idleTimer: number | undefined;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04020c, 0.018);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 5.4, 21);

const clock = new THREE.Clock();
const floorGroup = new THREE.Group();
const laserGroup = new THREE.Group();
const beamGroup = new THREE.Group();
const fixtureGroup = new THREE.Group();
const stageGroup = new THREE.Group();
const ledGroup = new THREE.Group();
const architectureGroup = new THREE.Group();
const clubInteriorGroup = new THREE.Group();
const djGroup = new THREE.Group();
const balconyGroup = new THREE.Group();
const ceilingRigGroup = new THREE.Group();
scene.add(floorGroup, stageGroup, ledGroup, laserGroup, beamGroup, fixtureGroup, architectureGroup, clubInteriorGroup, djGroup, balconyGroup, ceilingRigGroup);

const ambient = new THREE.AmbientLight(0x151226, 1.4);
scene.add(ambient);

const backLight = new THREE.PointLight(0x66ffee, 48, 70, 1.6);
backLight.position.set(0, 8, -18);
scene.add(backLight);

const magentaLight = new THREE.PointLight(0xff2afc, 40, 65, 1.8);
magentaLight.position.set(-12, 7, -6);
scene.add(magentaLight);

const limeLight = new THREE.PointLight(0xaaff22, 26, 55, 2);
limeLight.position.set(11, 6, 4);
scene.add(limeLight);

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x090814,
  metalness: 0.58,
  roughness: 0.26,
  emissive: 0x12001f,
  emissiveIntensity: 0.15,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.4;
floorGroup.add(floor);

const gridMaterial = new THREE.LineBasicMaterial({ color: 0x2cf9ff, transparent: true, opacity: 0.18 });
const grid = new THREE.GridHelper(100, 50, 0x20f5ff, 0xff2afc);
grid.position.y = -2.38;
grid.material = gridMaterial;
floorGroup.add(grid);

const tunnelMaterial = new THREE.MeshBasicMaterial({
  color: 0x151025,
  transparent: true,
  opacity: 0.72,
  side: THREE.BackSide,
});
const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(24, 9, 90, 28, 1, true), tunnelMaterial);
tunnel.rotation.x = Math.PI / 2;
tunnel.position.z = -18;
scene.add(tunnel);

const ringMaterial = new THREE.LineBasicMaterial({ color: 0xff3df4, transparent: true, opacity: 0.42 });
for (let i = 0; i < 18; i += 1) {
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 96 }, (_, index) => {
        const angle = (index / 96) * Math.PI * 2;
        const radius = 4.8 + i * 0.82;
        return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, -i * 4.2);
      }),
    ),
    ringMaterial.clone(),
  );
  ring.position.y = 1.5;
  scene.add(ring);
}

const stageMetal = new THREE.MeshStandardMaterial({
  color: 0x070a12,
  metalness: 0.92,
  roughness: 0.18,
  emissive: 0x070716,
  emissiveIntensity: 0.22,
});
const blackChrome = new THREE.MeshStandardMaterial({
  color: 0x020308,
  metalness: 0.98,
  roughness: 0.12,
  emissive: 0x02020a,
  emissiveIntensity: 0.08,
});
const ledMaterials: THREE.MeshBasicMaterial[] = [];
const ledStrips: THREE.Mesh[] = [];
const haloRings: THREE.Mesh[] = [];
const jewelLights: THREE.Mesh[] = [];
const stageWashLights: THREE.PointLight[] = [];

function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

addBox(stageGroup, [18, 0.8, 7.4], [0, -1.95, -17.5], stageMetal);
addBox(stageGroup, [24, 0.36, 1.1], [0, -1.15, -14.2], stageMetal);
addBox(stageGroup, [30, 0.32, 0.9], [0, -0.95, -20.9], blackChrome);
addBox(stageGroup, [5.2, 5.8, 1.0], [-15.2, 1.1, -18.6], blackChrome);
addBox(stageGroup, [5.2, 5.8, 1.0], [15.2, 1.1, -18.6], blackChrome);
addBox(stageGroup, [4.2, 3.4, 0.8], [-21, -0.1, -16], stageMetal);
addBox(stageGroup, [4.2, 3.4, 0.8], [21, -0.1, -16], stageMetal);

[
  [0, 3.2, -19.8, 0xff2afc],
  [-8.5, 2.8, -18.2, 0x2cf9ff],
  [8.5, 2.8, -18.2, 0xf8ff51],
  [-17, 2.3, -16.2, 0x8d5bff],
  [17, 2.3, -16.2, 0x8cff2c],
].forEach(([x, y, z, color]) => {
  const light = new THREE.PointLight(color as number, 20, 36, 1.35);
  light.position.set(x as number, y as number, z as number);
  stageWashLights.push(light);
  scene.add(light);
});

const ledPanelGeometry = new THREE.BoxGeometry(1.12, 1.38, 0.16);
const heroScreenMaterial = new THREE.MeshBasicMaterial({
  color: 0x314dff,
  transparent: true,
  opacity: 0.32,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const heroScreen = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.6, 24, 12), heroScreenMaterial);
heroScreen.position.set(0, 5.55, -22.18);
ledGroup.add(heroScreen);

for (let row = 0; row < 7; row += 1) {
  for (let col = 0; col < 15; col += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL((col / 16 + row / 18) % 1, 0.95, 0.55),
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    ledMaterials.push(material);
    const panel = new THREE.Mesh(ledPanelGeometry, material);
    panel.position.set((col - 7) * 1.22, 1.2 + row * 1.52, -22.05);
    ledGroup.add(panel);
  }
}

const stripMaterial = new THREE.MeshBasicMaterial({
  color: 0x2cf9ff,
  transparent: true,
  opacity: 0.78,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
[
  [[24, 0.08, 0.08], [0, 7.2, -21.82]],
  [[22, 0.08, 0.08], [0, -0.35, -21.75]],
  [[0.08, 8, 0.08], [-9.8, 3.45, -21.75]],
  [[0.08, 8, 0.08], [9.8, 3.45, -21.75]],
  [[8, 0.08, 0.08], [-15.2, 4.35, -17.95]],
  [[8, 0.08, 0.08], [15.2, 4.35, -17.95]],
].forEach(([size, position]) => {
  const strip = addBox(ledGroup, size as [number, number, number], position as [number, number, number], stripMaterial.clone());
  ledStrips.push(strip);
});

const trussMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e2430,
  metalness: 0.88,
  roughness: 0.24,
  emissive: 0x09111f,
  emissiveIntensity: 0.12,
});
const trussGeometry = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);
function addTruss(position: THREE.Vector3, length: number, rotation: THREE.Euler) {
  const truss = new THREE.Mesh(trussGeometry, trussMaterial);
  truss.position.copy(position);
  truss.scale.y = length;
  truss.rotation.copy(rotation);
  architectureGroup.add(truss);
  return truss;
}

for (let x = -18; x <= 18; x += 3) {
  addTruss(new THREE.Vector3(x, 7.9, -15.6), 2.7, new THREE.Euler(0, 0, Math.PI / 2));
  addTruss(new THREE.Vector3(x, 9.6, -22.5), 2.7, new THREE.Euler(0, 0, Math.PI / 2));
}
for (let x = -20; x <= 20; x += 4) {
  addTruss(new THREE.Vector3(x, 8.75, -19.05), 7.4, new THREE.Euler(Math.PI / 2, 0, 0));
}
for (let x = -23; x <= 23; x += 46) {
  for (let z = -23; z <= -14; z += 3) {
    addTruss(new THREE.Vector3(x, 3.8, z), 9.4, new THREE.Euler(0, 0, 0));
  }
}

const luxuryColors = [0xff2afc, 0x2cf9ff, 0xf8ff51, 0x8cff2c, 0x8d5bff, 0xff4d78];
const haloGeometry = new THREE.TorusGeometry(3.7, 0.035, 8, 120);
for (let i = 0; i < 4; i += 1) {
  const halo = new THREE.Mesh(
    haloGeometry,
    new THREE.MeshBasicMaterial({
      color: luxuryColors[i % luxuryColors.length],
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.set((i - 1.5) * 5.2, 5.4 + (i % 2) * 1.0, -21.65);
  halo.rotation.x = Math.PI / 2;
  haloRings.push(halo);
  ledGroup.add(halo);
}

const jewelGeometry = new THREE.SphereGeometry(0.085, 12, 8);
for (let side = -1; side <= 1; side += 2) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const jewel = new THREE.Mesh(
        jewelGeometry,
        new THREE.MeshBasicMaterial({
          color: luxuryColors[(row + col) % luxuryColors.length],
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      jewel.position.set(side * (13.4 + col * 1.75), -0.9 + row * 0.78, -17.85);
      jewelLights.push(jewel);
      ledGroup.add(jewel);
    }
  }
}

for (let i = 0; i < 72; i += 1) {
  const angle = (i / 72) * Math.PI * 2;
  const radius = 10.8 + Math.sin(i * 1.7) * 0.55;
  const jewel = new THREE.Mesh(
    jewelGeometry,
    new THREE.MeshBasicMaterial({
      color: luxuryColors[i % luxuryColors.length],
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  jewel.position.set(Math.cos(angle) * radius, 5.55 + Math.sin(angle) * 2.2, -20.95);
  jewelLights.push(jewel);
  ledGroup.add(jewel);
}

const boothMaterial = new THREE.MeshStandardMaterial({
  color: 0x03040a,
  metalness: 0.9,
  roughness: 0.16,
  emissive: 0x16001f,
  emissiveIntensity: 0.22,
});
const boothTop = addBox(djGroup, [16.4, 0.55, 3.3], [0, -1.25, 10.4], boothMaterial);
const boothFront = addBox(djGroup, [17.2, 1.15, 0.28], [0, -0.75, 8.75], blackChrome);
const boothNeonMaterial = new THREE.MeshBasicMaterial({
  color: 0xff2afc,
  transparent: true,
  opacity: 0.78,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const boothNeons = [
  addBox(djGroup, [16.6, 0.06, 0.08], [0, -0.13, 8.58], boothNeonMaterial.clone()),
  addBox(djGroup, [0.08, 0.08, 3.2], [-8.4, -0.55, 10.35], boothNeonMaterial.clone()),
  addBox(djGroup, [0.08, 0.08, 3.2], [8.4, -0.55, 10.35], boothNeonMaterial.clone()),
];

const deckMaterial = new THREE.MeshStandardMaterial({
  color: 0x05070c,
  metalness: 0.86,
  roughness: 0.18,
  emissive: 0x021020,
  emissiveIntensity: 0.18,
});
const platterMaterial = new THREE.MeshBasicMaterial({
  color: 0x2cf9ff,
  transparent: true,
  opacity: 0.88,
  blending: THREE.AdditiveBlending,
});
const platters: THREE.Mesh[] = [];
for (let x = -5.6; x <= 5.6; x += 3.75) {
  addBox(djGroup, [2.4, 0.18, 1.45], [x, -0.82, 10.35], deckMaterial);
  const platter = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 48), platterMaterial.clone());
  platter.position.set(x, -0.68, 10.1);
  platter.rotation.x = Math.PI / 2;
  platters.push(platter);
  djGroup.add(platter);
}

const djBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x07070b,
  metalness: 0.25,
  roughness: 0.42,
  emissive: 0x1b0624,
  emissiveIntensity: 0.28,
});
const djBody = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.45, 18), djBodyMaterial);
djBody.position.set(0, -0.05, 12.05);
djGroup.add(djBody);
const djHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), djBodyMaterial);
djHead.position.set(0, 0.88, 12.05);
djGroup.add(djHead);
const headphone = new THREE.Mesh(
  new THREE.TorusGeometry(0.42, 0.035, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0x2cf9ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending }),
);
headphone.position.copy(djHead.position).add(new THREE.Vector3(0, 0.02, 0));
headphone.rotation.y = Math.PI / 2;
djGroup.add(headphone);

const crowdCount = 280;
const crowdBodyGeometry = new THREE.CylinderGeometry(0.09, 0.12, 0.72, 7);
const crowdHeadGeometry = new THREE.SphereGeometry(0.105, 8, 6);
const crowdBodyMaterial = new THREE.MeshBasicMaterial({ color: 0x11131d, transparent: true, opacity: 0.86 });
const crowdHeadMaterial = new THREE.MeshBasicMaterial({ color: 0x1e2536, transparent: true, opacity: 0.9 });
const crowdBodies = new THREE.InstancedMesh(crowdBodyGeometry, crowdBodyMaterial, crowdCount);
const crowdHeads = new THREE.InstancedMesh(crowdHeadGeometry, crowdHeadMaterial, crowdCount);
const crowdDummy = new THREE.Object3D();
for (let i = 0; i < crowdCount; i += 1) {
  const lane = Math.random() - 0.5;
  const depth = Math.random();
  const x = lane * (7 + depth * 18);
  const z = 6.8 - depth * 20.5;
  const y = -1.88 + Math.random() * 0.16;
  crowdDummy.position.set(x, y, z);
  crowdDummy.rotation.y = Math.random() * Math.PI * 2;
  crowdDummy.scale.setScalar(0.72 + Math.random() * 0.58);
  crowdDummy.updateMatrix();
  crowdBodies.setMatrixAt(i, crowdDummy.matrix);
  crowdDummy.position.y = y + 0.52 * crowdDummy.scale.y;
  crowdDummy.updateMatrix();
  crowdHeads.setMatrixAt(i, crowdDummy.matrix);
}
clubInteriorGroup.add(crowdBodies, crowdHeads);

const balconyMaterial = new THREE.MeshStandardMaterial({
  color: 0x06070d,
  metalness: 0.8,
  roughness: 0.18,
  emissive: 0x080410,
  emissiveIntensity: 0.18,
});
const railMaterial = new THREE.MeshBasicMaterial({
  color: 0x2cf9ff,
  transparent: true,
  opacity: 0.68,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
for (let side = -1; side <= 1; side += 2) {
  addBox(balconyGroup, [9.4, 0.34, 28], [side * 18.6, 1.45, -6.3], balconyMaterial);
  addBox(balconyGroup, [0.12, 0.12, 27.2], [side * 14.0, 2.25, -6.5], railMaterial.clone());
  addBox(balconyGroup, [8.8, 0.08, 0.1], [side * 18.6, 2.35, 6.9], railMaterial.clone());
  addBox(balconyGroup, [9.4, 0.34, 24], [side * 20.8, 4.45, -8.8], balconyMaterial);
  addBox(balconyGroup, [0.12, 0.12, 23.2], [side * 16.2, 5.25, -8.9], railMaterial.clone());
  addBox(balconyGroup, [8.8, 0.08, 0.1], [side * 20.8, 5.35, 2.8], railMaterial.clone());
  for (let i = 0; i < 26; i += 1) {
    const guest = new THREE.Mesh(crowdBodyGeometry, crowdBodyMaterial);
    guest.position.set(side * (15.1 + Math.random() * 5.1), 2.02 + Math.random() * 3.0, 5.8 - Math.random() * 26);
    guest.scale.setScalar(0.75 + Math.random() * 0.4);
    balconyGroup.add(guest);
  }
}

function makeNeonSign(label: string, color: string) {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 160;
  const context = signCanvas.getContext('2d')!;
  context.clearRect(0, 0, signCanvas.width, signCanvas.height);
  context.font = '700 58px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = 24;
  context.fillStyle = color;
  context.fillText(label, 256, 78);
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.8, 1.8, 1);
  return sprite;
}
const vipSign = makeNeonSign('VIP LOUNGE', '#ff3df4');
vipSign.position.set(17.5, 3.35, -2.2);
balconyGroup.add(vipSign);
const clubSign = makeNeonSign('NEON CLUB', '#f4fbff');
clubSign.position.set(0, 3.45, -21.75);
clubSign.scale.set(6.8, 2.0, 1);
ledGroup.add(clubSign);

const ceilingRings: THREE.Mesh[] = [];
for (let i = 0; i < 4; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.2 + i * 1.85, 0.055, 10, 160),
    new THREE.MeshBasicMaterial({
      color: luxuryColors[i % luxuryColors.length],
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.position.set(0, 9.45 - i * 0.18, -4.6 - i * 1.2);
  ring.rotation.x = Math.PI / 2;
  ceilingRings.push(ring);
  ceilingRigGroup.add(ring);
}

const ceilingBulbs: THREE.Mesh[] = [];
for (let i = 0; i < 96; i += 1) {
  const ringIndex = i % 4;
  const angle = (i / 24) * Math.PI * 2;
  const radius = 5.2 + ringIndex * 1.85;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshBasicMaterial({
      color: luxuryColors[i % luxuryColors.length],
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  bulb.position.set(Math.cos(angle) * radius, 9.45 - ringIndex * 0.18, -4.6 - ringIndex * 1.2 + Math.sin(angle) * radius);
  ceilingBulbs.push(bulb);
  ceilingRigGroup.add(bulb);
}

const laserMaterials = [
  new THREE.MeshBasicMaterial({ color: 0x22f7ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xff2afc, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xa6ff22, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xfff250, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false }),
];

const laserBeams: THREE.Mesh[] = [];
const coneGeometry = new THREE.ConeGeometry(0.035, 44, 8, 1, true);
for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 8; i += 1) {
    const beam = new THREE.Mesh(coneGeometry, laserMaterials[(i + (side > 0 ? 1 : 0)) % laserMaterials.length].clone());
    beam.position.set(side * (4 + i * 1.4), 6 + (i % 2) * 1.1, -12 - i * 0.9);
    beam.rotation.z = side * (Math.PI / 2);
    beam.rotation.y = side * (0.2 + i * 0.04);
    laserBeams.push(beam);
    laserGroup.add(beam);

    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.48, 16),
      new THREE.MeshStandardMaterial({ color: 0x08070d, metalness: 0.8, roughness: 0.18, emissive: 0x111111 }),
    );
    fixture.position.copy(beam.position);
    fixture.rotation.z = Math.PI / 2;
    fixtureGroup.add(fixture);
  }
}

const spotlightColors = [0xff2afc, 0x2cf9ff, 0xf8ff51, 0x8cff2c, 0x8d5bff, 0xff4d78];
const spotlights: THREE.SpotLight[] = [];
for (let i = 0; i < 10; i += 1) {
  const light = new THREE.SpotLight(spotlightColors[i % spotlightColors.length], 18, 70, 0.25, 0.65, 1.5);
  light.position.set((i - 4.5) * 2.6, 8 + (i % 3), -7 - (i % 4) * 2.4);
  light.target.position.set(Math.sin(i) * 8, -2.4, -26 + Math.cos(i) * 8);
  scene.add(light, light.target);
  spotlights.push(light);
}

type MovingHead = {
  base: THREE.Mesh;
  yoke: THREE.Mesh;
  lens: THREE.Mesh;
  light: THREE.SpotLight;
  target: THREE.Object3D;
};
const movingHeads: MovingHead[] = [];
const headBaseGeometry = new THREE.CylinderGeometry(0.34, 0.42, 0.28, 22);
const yokeGeometry = new THREE.BoxGeometry(0.7, 0.46, 0.34);
const lensGeometry = new THREE.SphereGeometry(0.18, 18, 12);
const lensMaterial = new THREE.MeshBasicMaterial({
  color: 0x8effff,
  transparent: true,
  opacity: 0.88,
  blending: THREE.AdditiveBlending,
});

function addMovingHead(position: THREE.Vector3, color: number, index: number) {
  const base = new THREE.Mesh(headBaseGeometry, blackChrome.clone());
  base.position.copy(position);
  fixtureGroup.add(base);

  const yoke = new THREE.Mesh(yokeGeometry, stageMetal.clone());
  yoke.position.copy(position).add(new THREE.Vector3(0, 0.32, 0));
  fixtureGroup.add(yoke);

  const lens = new THREE.Mesh(lensGeometry, lensMaterial.clone());
  lens.position.copy(position).add(new THREE.Vector3(0, 0.35, -0.22));
  fixtureGroup.add(lens);

  const target = new THREE.Object3D();
  target.position.set(Math.sin(index) * 7, -2.1, -18 + Math.cos(index) * 9);
  scene.add(target);

  const light = new THREE.SpotLight(color, 20, 80, 0.14, 0.72, 1.25);
  light.position.copy(lens.position);
  light.target = target;
  scene.add(light);
  movingHeads.push({ base, yoke, lens, light, target });
}

let headIndex = 0;
for (let x = -14; x <= 14; x += 4) {
  addMovingHead(new THREE.Vector3(x, 7.55, -15.6), luxuryColors[headIndex % luxuryColors.length], headIndex);
  headIndex += 1;
  addMovingHead(new THREE.Vector3(x, 8.95, -22.3), luxuryColors[headIndex % luxuryColors.length], headIndex);
  headIndex += 1;
}
for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 5; i += 1) {
    addMovingHead(new THREE.Vector3(side * 18.9, 1.2 + i * 1.05, -15.4 - (i % 2) * 4.8), luxuryColors[headIndex % luxuryColors.length], headIndex);
    headIndex += 1;
  }
}

const particleCount = 2600;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSeeds = new Float32Array(particleCount);
for (let i = 0; i < particleCount; i += 1) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 48;
  particlePositions[i * 3 + 1] = Math.random() * 24 - 4;
  particlePositions[i * 3 + 2] = -Math.random() * 72 + 14;
  particleSeeds[i] = Math.random();
}
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particleMaterial = new THREE.PointsMaterial({
  size: 0.055,
  color: 0xd8ffff,
  transparent: true,
  opacity: 0.66,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const equalizerBars: THREE.Mesh[] = [];
const barMaterial = new THREE.MeshStandardMaterial({
  color: 0x34f7ff,
  emissive: 0x34f7ff,
  emissiveIntensity: 1.6,
  metalness: 0.4,
  roughness: 0.2,
});
for (let i = 0; i < 48; i += 1) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1, 0.32), barMaterial.clone());
  bar.position.set((i - 23.5) * 0.46, -1.82, -9.4);
  equalizerBars.push(bar);
  scene.add(bar);
}

const centerOrb = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.15, 3),
  new THREE.MeshStandardMaterial({
    color: 0x0efcff,
    emissive: 0xff2afc,
    emissiveIntensity: 1.25,
    metalness: 0.35,
    roughness: 0.08,
  }),
);
centerOrb.position.set(0, 2.2, -11.2);
scene.add(centerOrb);

function ensureAudioContext() {
  if (audioContext && analyser) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.frequencyBinCount);
}

function useAudioSource(source: AudioNode) {
  ensureAudioContext();
  if (!audioContext || !analyser) return;
  if (activeSource !== source) {
    activeSource?.disconnect();
    analyser.disconnect();
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    activeSource = source;
  }
}

function setupLocalAudio() {
  ensureAudioContext();
  if (!audioContext) return;
  localAudioSource ??= audioContext.createMediaElementSource(audio);
  useAudioSource(localAudioSource);
}

function isCaptureActive() {
  return !!captureStream?.getAudioTracks().some((track) => track.readyState === 'live');
}

function stopCapture() {
  captureStream?.getTracks().forEach((track) => track.stop());
  captureStream = undefined;
  captureSource?.disconnect();
  captureSource = undefined;
  captureAudio.textContent = '擷取音源';
  captureAudio.title = '擷取瀏覽器分頁或系統音訊';
}

function setControlsHidden(hidden: boolean) {
  controlsHidden = hidden;
  controlPanel.classList.toggle('is-hidden', hidden);
  hideControls.textContent = hidden ? '顯示' : '隱藏';
  hideControls.title = hidden ? '顯示控制列' : '隱藏控制列';
}

function wakeControls() {
  setControlsHidden(false);
  if (idleTimer) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if ((!audio.paused && audio.src) || isCaptureActive()) setControlsHidden(true);
  }, 3600);
}
function averageRange(start: number, end: number) {
  if (!analyser) return 0;
  let total = 0;
  const safeEnd = Math.min(end, frequencyData.length);
  for (let i = start; i < safeEnd; i += 1) total += frequencyData[i];
  return total / Math.max(1, safeEnd - start) / 255;
}

function waveformKick() {
  if (!analyser) return 0.2;
  analyser.getByteTimeDomainData(timeData);
  let sum = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const normalized = (timeData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.min(1.4, Math.sqrt(sum / timeData.length) * 3);
}

function updateMeters(bass: number, mid: number, high: number) {
  bassMeter.style.transform = `scaleX(${Math.min(1, bass * 1.8)})`;
  midMeter.style.transform = `scaleX(${Math.min(1, mid * 1.7)})`;
  highMeter.style.transform = `scaleX(${Math.min(1, high * 1.9)})`;
}

function animate() {
  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();
  const energy = Number(energySlider.value);
  const laserPower = Number(laserSlider.value);

  if (analyser) {
    analyser.getByteFrequencyData(frequencyData);
    const bass = averageRange(2, 22);
    const mid = averageRange(24, 128);
    const high = averageRange(150, 430);
    smoothedBass += (bass - smoothedBass) * 0.12;
    smoothedMid += (mid - smoothedMid) * 0.08;
    smoothedHigh += (high - smoothedHigh) * 0.14;
  } else {
    smoothedBass = 0.22 + Math.sin(elapsed * 1.9) * 0.08;
    smoothedMid = 0.18 + Math.sin(elapsed * 1.21 + 1.5) * 0.06;
    smoothedHigh = 0.14 + Math.sin(elapsed * 3.3) * 0.05;
  }

  const kick = waveformKick();
  const pulse = Math.max(smoothedBass * 1.6, kick * 0.6) * energy;
  updateMeters(smoothedBass, smoothedMid, smoothedHigh);

  camera.position.x = Math.sin(elapsed * 0.25) * (2.1 + pulse * 0.8);
  camera.position.y = 5.3 + Math.sin(elapsed * 0.5) * 0.45 + pulse * 0.28;
  camera.position.z = 22 - pulse * 2.1;
  camera.lookAt(Math.sin(elapsed * 0.38) * 2.4, 1.25 + smoothedMid * 2.1, -18.2);

  floorMaterial.emissiveIntensity = 0.12 + pulse * 0.28;
  stageMetal.emissiveIntensity = 0.18 + pulse * 0.42;
  blackChrome.emissiveIntensity = 0.07 + smoothedBass * 0.36;
  gridMaterial.opacity = 0.12 + smoothedHigh * 0.52;
  tunnel.rotation.z += delta * (0.06 + smoothedMid * 0.32);
  tunnelMaterial.opacity = 0.45 + smoothedBass * 0.32;

  centerOrb.rotation.x += delta * (0.5 + smoothedMid * 3);
  centerOrb.rotation.y += delta * (0.8 + smoothedHigh * 4);
  centerOrb.scale.setScalar(1 + pulse * 0.28);
  const orbMaterial = centerOrb.material as THREE.MeshStandardMaterial;
  orbMaterial.emissiveIntensity = 0.85 + pulse * 2.2;

  backLight.intensity = 34 + pulse * 80;
  magentaLight.intensity = 25 + smoothedMid * 78;
  limeLight.intensity = 14 + smoothedHigh * 95;
  backLight.position.x = Math.sin(elapsed * 0.7) * 10;
  magentaLight.position.z = -8 + Math.cos(elapsed * 0.5) * 10;

  heroScreenMaterial.opacity = 0.24 + smoothedMid * 0.34 + pulse * 0.08;
  heroScreenMaterial.color.setHSL((0.62 + elapsed * 0.018 + smoothedHigh * 0.08) % 1, 0.9, 0.48 + smoothedHigh * 0.16);

  ledMaterials.forEach((material, index) => {
    const row = Math.floor(index / 15);
    const col = index % 15;
    const ripple = Math.sin(elapsed * (1.2 + smoothedMid * 2.2) + col * 0.52 + row * 0.78);
    const sweep = Math.cos(elapsed * 0.85 - col * 0.34 + smoothedHigh * 4);
    const intensity = 1.05 + Math.max(0, ripple) * 1.75 + Math.max(0, sweep) * (0.7 + smoothedHigh * 3.2) + pulse * 0.72;
    material.opacity = Math.min(0.95, 0.34 + intensity * 0.18);
    material.color.setHSL((0.55 + col * 0.025 + row * 0.045 + elapsed * 0.035) % 1, 1, 0.42 + Math.min(0.28, intensity * 0.055));
  });

  ledStrips.forEach((strip, index) => {
    const material = strip.material as THREE.MeshBasicMaterial;
    material.opacity = 0.34 + smoothedHigh * 0.58 + Math.max(0, Math.sin(elapsed * 2.3 + index)) * 0.24;
    material.color.setHSL((0.52 + elapsed * 0.025 + index * 0.12) % 1, 1, 0.58);
    strip.scale.x = 1 + pulse * 0.025;
  });

  haloRings.forEach((halo, index) => {
    halo.rotation.z += delta * (0.18 + index * 0.05 + smoothedMid * 0.55);
    halo.rotation.y = Math.sin(elapsed * 0.42 + index) * 0.22;
    halo.scale.setScalar(1 + pulse * 0.08 + Math.sin(elapsed * 1.1 + index) * 0.035);
    const material = halo.material as THREE.MeshBasicMaterial;
    material.opacity = 0.2 + smoothedMid * 0.7 + pulse * 0.18;
    material.color.setHSL((0.76 + elapsed * 0.04 + index * 0.17) % 1, 1, 0.62);
  });

  jewelLights.forEach((jewel, index) => {
    const sparkle = Math.max(0, Math.sin(elapsed * (2.2 + (index % 7) * 0.08) + index * 0.61));
    const material = jewel.material as THREE.MeshBasicMaterial;
    material.opacity = 0.38 + sparkle * 0.42 + smoothedHigh * 0.35 + pulse * 0.08;
    material.color.setHSL((0.54 + elapsed * 0.05 + index * 0.035) % 1, 1, 0.62);
    jewel.scale.setScalar(0.8 + sparkle * 0.55 + pulse * 0.05);
  });

  stageWashLights.forEach((light, index) => {
    light.intensity = 18 + pulse * 62 + smoothedMid * 42 + Math.max(0, Math.sin(elapsed * 1.6 + index)) * 16;
    light.color.setHSL((0.56 + elapsed * 0.025 + index * 0.16) % 1, 0.92, 0.58);
  });

  boothMaterial.emissiveIntensity = 0.18 + pulse * 0.5;
  boothNeons.forEach((strip, index) => {
    const material = strip.material as THREE.MeshBasicMaterial;
    material.opacity = 0.52 + smoothedBass * 0.42 + Math.max(0, Math.sin(elapsed * 2.1 + index)) * 0.18;
    material.color.setHSL((0.84 + elapsed * 0.02 + index * 0.08) % 1, 1, 0.58);
  });
  platters.forEach((platter, index) => {
    platter.rotation.z += delta * (1.4 + index * 0.18 + smoothedHigh * 6);
    const material = platter.material as THREE.MeshBasicMaterial;
    material.opacity = 0.46 + smoothedHigh * 0.48;
    material.color.setHSL((0.52 + elapsed * 0.04 + index * 0.08) % 1, 1, 0.62);
  });
  djBody.position.y = -0.05 + Math.sin(elapsed * 2.4) * 0.025 + smoothedBass * 0.08;
  djHead.position.y = 0.88 + Math.sin(elapsed * 2.4 + 0.2) * 0.035 + smoothedBass * 0.08;
  headphone.position.copy(djHead.position).add(new THREE.Vector3(0, 0.02, 0));
  crowdBodies.position.y = Math.sin(elapsed * 2.0) * 0.035 + smoothedBass * 0.08;
  crowdHeads.position.y = crowdBodies.position.y;

  ceilingRings.forEach((ring, index) => {
    ring.rotation.z += delta * (0.08 + index * 0.03 + smoothedMid * 0.25);
    const material = ring.material as THREE.MeshBasicMaterial;
    material.opacity = 0.22 + smoothedMid * 0.42 + pulse * 0.08;
    material.color.setHSL((0.58 + index * 0.1 + elapsed * 0.025) % 1, 1, 0.58);
  });
  ceilingBulbs.forEach((bulb, index) => {
    const material = bulb.material as THREE.MeshBasicMaterial;
    const blink = Math.max(0, Math.sin(elapsed * 2.8 + index * 0.33));
    material.opacity = 0.36 + blink * 0.38 + smoothedHigh * 0.32;
    material.color.setHSL((0.55 + index * 0.018 + elapsed * 0.04) % 1, 1, 0.62);
    bulb.scale.setScalar(0.8 + blink * 0.5 + pulse * 0.04);
  });

  laserBeams.forEach((beam, index) => {
    const side = beam.position.x < 0 ? -1 : 1;
    beam.rotation.y = side * (0.3 + Math.sin(elapsed * (0.55 + index * 0.03) + index) * (0.55 + smoothedMid));
    beam.rotation.z = side * (Math.PI / 2 + Math.cos(elapsed * 1.15 + index) * (0.38 + smoothedHigh * 0.65));
    beam.scale.set(1 + smoothedHigh * 3.5 * laserPower, 1 + pulse * 1.2, 1 + smoothedHigh * 3.5 * laserPower);
    const material = beam.material as THREE.MeshBasicMaterial;
    material.opacity = Math.min(0.95, 0.18 + (smoothedHigh * 1.7 + pulse * 0.32) * laserPower);
  });

  spotlights.forEach((light, index) => {
    const lane = index - (spotlights.length - 1) / 2;
    light.intensity = 12 + (smoothedBass * 40 + smoothedHigh * 85) * energy;
    light.angle = 0.13 + smoothedMid * 0.28;
    light.target.position.set(
      Math.sin(elapsed * (0.8 + index * 0.04) + index) * 12 + lane * 0.26,
      -2.2,
      -24 + Math.cos(elapsed * 0.9 + index) * 13,
    );
  });

  movingHeads.forEach((head, index) => {
    const sideDrift = Math.sin(elapsed * (0.64 + index * 0.011) + index * 0.7);
    const depthDrift = Math.cos(elapsed * (0.72 + index * 0.009) + index);
    head.target.position.set(sideDrift * 16, -2.15 + smoothedBass * 1.4, -18 + depthDrift * 15);
    head.yoke.rotation.y = sideDrift * 0.65;
    head.yoke.rotation.x = -0.2 + depthDrift * 0.32;
    head.lens.position.copy(head.base.position).add(new THREE.Vector3(sideDrift * 0.1, 0.35 + smoothedBass * 0.12, -0.22));
    head.light.position.copy(head.lens.position);
    head.light.intensity = 10 + smoothedHigh * 130 + pulse * 55;
    head.light.angle = 0.08 + smoothedMid * 0.18;
    const lens = head.lens.material as THREE.MeshBasicMaterial;
    lens.opacity = 0.44 + smoothedHigh * 0.52;
    lens.color.setHSL((0.55 + index * 0.07 + elapsed * 0.055) % 1, 1, 0.68);
    head.light.color.copy(lens.color);
  });

  const positions = particleGeometry.attributes.position.array as Float32Array;
  for (let i = 0; i < particleCount; i += 1) {
    const offset = i * 3;
    positions[offset + 2] += delta * (3.2 + smoothedBass * 16 + particleSeeds[i] * 3);
    positions[offset] += Math.sin(elapsed * 0.9 + particleSeeds[i] * 18) * delta * (0.12 + smoothedHigh);
    if (positions[offset + 2] > 17) {
      positions[offset + 2] = -72;
      positions[offset] = (Math.random() - 0.5) * 48;
      positions[offset + 1] = Math.random() * 24 - 4;
    }
  }
  particleGeometry.attributes.position.needsUpdate = true;
  particleMaterial.size = 0.045 + smoothedHigh * 0.14;
  particleMaterial.opacity = 0.38 + smoothedMid * 0.55;

  equalizerBars.forEach((bar, index) => {
    const bin = frequencyData.length ? frequencyData[Math.floor((index / equalizerBars.length) * 360) + 6] / 255 : 0.2;
    const height = 0.18 + bin * 7.2 * energy;
    bar.scale.y += (height - bar.scale.y) * 0.28;
    bar.position.y = -2.25 + bar.scale.y * 0.5;
    const material = bar.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.7 + bin * 3.4;
    material.color.setHSL((0.52 + bin * 0.34 + index / 160) % 1, 0.95, 0.56);
    material.emissive.copy(material.color);
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

audioFile.addEventListener('change', () => {
  const file = audioFile.files?.[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  trackName.textContent = file.name;
  playPause.textContent = '播放';
  stopCapture();
  setupLocalAudio();
  wakeControls();
});

playPause.addEventListener('click', async () => {
  setupLocalAudio();
  await audioContext?.resume();
  if (!audio.src) {
    trackName.textContent = '請先載入本地音樂';
    return;
  }
  if (audio.paused) {
    await audio.play();
    playPause.textContent = '暫停';
    wakeControls();
  } else {
    audio.pause();
    playPause.textContent = '播放';
    setControlsHidden(false);
  }
});

captureAudio.addEventListener('click', async () => {
  if (isCaptureActive()) {
    stopCapture();
    trackName.textContent = audio.src ? '已停止擷取，回到本地音樂' : '尚未載入音源';
    if (audio.src) setupLocalAudio();
    setControlsHidden(false);
    return;
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    trackName.textContent = '此瀏覽器不支援分頁音訊擷取';
    return;
  }

  try {
    ensureAudioContext();
    await audioContext?.resume();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((track) => track.stop());
      trackName.textContent = '請重新選擇並勾選分享音訊';
      return;
    }

    audio.pause();
    playPause.textContent = '播放';
    captureStream = stream;
    captureSource = audioContext?.createMediaStreamSource(stream);
    if (captureSource) useAudioSource(captureSource);
    stream.getTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopCapture();
        setControlsHidden(false);
      });
    });
    captureAudio.textContent = '停止擷取';
    captureAudio.title = '停止擷取分頁或系統音訊';
    trackName.textContent = '正在擷取 YouTube / 分頁音訊';
    wakeControls();
  } catch {
    trackName.textContent = '音訊擷取已取消';
    stopCapture();
  }
});

fullscreen.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

audio.addEventListener('ended', () => {
  playPause.textContent = '播放';
  setControlsHidden(false);
});

hideControls.addEventListener('click', () => {
  setControlsHidden(!controlsHidden);
});

window.addEventListener('pointermove', wakeControls);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'h') setControlsHidden(!controlsHidden);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

