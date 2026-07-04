import './styles.css';
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#club-scene')!;
const audio = document.querySelector<HTMLAudioElement>('#audio')!;
const audioFile = document.querySelector<HTMLInputElement>('#audioFile')!;
const playPause = document.querySelector<HTMLButtonElement>('#playPause')!;
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
let source: MediaElementAudioSourceNode | undefined;
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
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04020c, 0.055);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 4.8, 18);

const clock = new THREE.Clock();
const floorGroup = new THREE.Group();
const laserGroup = new THREE.Group();
const beamGroup = new THREE.Group();
const fixtureGroup = new THREE.Group();
scene.add(floorGroup, laserGroup, beamGroup, fixtureGroup);

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

function setupAudio() {
  if (audioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.frequencyBinCount);
  source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
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
    if (!audio.paused && audio.src) setControlsHidden(true);
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

  camera.position.x = Math.sin(elapsed * 0.29) * (1.4 + pulse);
  camera.position.y = 4.8 + Math.sin(elapsed * 0.58) * 0.45 + pulse * 0.35;
  camera.position.z = 17.5 - pulse * 2.2;
  camera.lookAt(Math.sin(elapsed * 0.42) * 1.8, 0.45 + smoothedMid * 2.2, -15);

  floorMaterial.emissiveIntensity = 0.12 + pulse * 0.28;
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
  setupAudio();
  wakeControls();
});

playPause.addEventListener('click', async () => {
  setupAudio();
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
