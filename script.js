/* ============================================
   MAIN ORCHESTRATOR — script.js
   Sequential: Growth (Right) → Bloom (Left)
   Distance-based continuous control
   ============================================ */

import * as THREE from 'three';
import { HandTrackingManager } from './handTracking.js';
import { GestureManager } from './gesture.js';
import { MagicalPlant } from './flower.js';
import { GlobalPollenSystem, BloomBurstSystem, ButterflySystem, BranchSparkleSystem, FallingPetalSystem, MagicalEnergyString, FlowerGlowSystem } from './particles.js';
import { EffectsManager } from './effects.js';

// ============================================
// GLOBALS
// ============================================
let renderer, scene, camera;
let effectsManager;
let handTracker, gestureManager;
let pollen, bloomBurst, butterflies, sparkles, fallingPetals, flowerGlow;
let plant;

// Magical Energy Strings
let rightMagicString = null;
let leftMagicString = null;

// Smoothed display values (for lerp)
let displayGrowth = 0;
let displayBloom = 0;

// Bloom gate — tracks whether bloom is enabled
let bloomEnabled = false;

const clock = new THREE.Clock();
let fpsFrames = 0;
let fpsTime = 0;

let instructionsHidden = false;
let animationStarted = false;

// ============================================
// DOM ELEMENTS
// ============================================
const loadingScreen  = document.getElementById('loading-screen');
const loadingBar     = document.getElementById('loading-bar');
const loadingStatus  = document.getElementById('loading-status');
const uiOverlay      = document.getElementById('ui-overlay');
const statGrowth     = document.getElementById('stat-growth');
const statBloom      = document.getElementById('stat-bloom');
const statEnergy     = document.getElementById('stat-energy');
const trackingStatus = document.getElementById('stat-tracking');
const labelRight     = document.getElementById('label-right');
const labelLeft      = document.getElementById('label-left');
const instructions   = document.getElementById('instructions');
const fpsCounter     = document.getElementById('fps-counter');
const videoElement   = document.getElementById('webcam-video');
const canvas         = document.getElementById('scene-canvas');
const bloomBadge     = document.getElementById('bloom-unlocked');

// ============================================
// LOADING HELPERS
// ============================================
function updateLoading(message, progress) {
    if (loadingStatus) loadingStatus.textContent = message;
    if (loadingBar)    loadingBar.style.width = `${progress}%`;
}

function yieldFrame() {
    return new Promise(resolve => setTimeout(resolve, 16));
}

function showFatalError(error) {
    const msg = error && error.message ? error.message : String(error);
    console.error('[MagicalFlower] Fatal init error:', error);
    if (loadingStatus) {
        loadingStatus.textContent = `⚠ ${msg}`;
        loadingStatus.style.color = '#ff6b6b';
    }
    if (loadingBar) {
        loadingBar.style.background = '#ff4444';
        loadingBar.style.width = '100%';
    }
}

// ============================================
// INITIALIZATION
// ============================================

const INIT_TIMEOUT_MS = 60000;

async function initWithTimeout() {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
            "Initialization timed out (60s). Check your internet connection and camera permissions."
        )), INIT_TIMEOUT_MS)
    );
    try {
        await Promise.race([init(), timeout]);
    } catch (error) {
        showFatalError(error);
    }
}

async function init() {
    updateLoading("Setting up 3D engine...", 5);
    await yieldFrame();
    setupThreeJS();

    updateLoading("Growing magical plant...", 10);
    await yieldFrame();
    plant = new MagicalPlant(scene);

    updateLoading("Creating magical particles...", 15);
    await yieldFrame();
    pollen = new GlobalPollenSystem(scene, 300);
    bloomBurst = new BloomBurstSystem(scene);
    butterflies = new ButterflySystem(scene);
    sparkles = new BranchSparkleSystem(scene);
    fallingPetals = new FallingPetalSystem(scene);
    flowerGlow = new FlowerGlowSystem(scene);

    updateLoading("Preparing visual effects...", 18);
    await yieldFrame();
    effectsManager = new EffectsManager(renderer, scene, camera);

    initDebugSpheres();

    // Create magical energy strings
    rightMagicString = new MagicalEnergyString(scene, 0xff6b9d); // Neon pink
    leftMagicString = new MagicalEnergyString(scene, 0xc44dff);  // Neon purple

    handTracker = new HandTrackingManager();
    gestureManager = new GestureManager();

    try {
        await handTracker.initialize(videoElement, (msg, progress) => {
            updateLoading(msg, progress);
        });

        updateLoading("Finalizing scene...", 93);
        await yieldFrame();
        effectsManager.setupWebcamBackground(videoElement);

    } catch (cameraError) {
        console.warn('[MagicalFlower] Camera/MediaPipe unavailable, running in demo mode:', cameraError.message);
        updateLoading("⚠ No camera — running in demo mode", 90);
        await yieldFrame();
    }

    updateLoading("✨ Ready!", 100);
    await yieldFrame();

    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        uiOverlay.classList.add('visible');

        if (!animationStarted) {
            animationStarted = true;
            clock.start();
            animate();
        }
    }, 500);
}


// ============================================
// THREE.JS SCENE SETUP
// ============================================
function setupThreeJS() {
    renderer = new THREE.WebGLRenderer({
        canvas:           canvas,
        antialias:        true,
        alpha:            false,
        powerPreference:  'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace   = THREE.SRGBColorSpace;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    // Move camera slightly back to see the whole plant
    camera.position.set(0, 1.5, 6.0);
    camera.lookAt(0, 1.0, 0);

    window.addEventListener('resize', onWindowResize);
}

// Debug markers for hand tracking
const debugSpheres = [];
const DEBUG_TRACKING = true;

function initDebugSpheres() {
    if (!DEBUG_TRACKING) return;
    const geo = new THREE.SphereGeometry(0.05, 8, 8);
    const matNormal = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false });
    const matSpecial = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }); // for 4 and 8
    
    for (let i = 0; i < 42; i++) { // 21 per hand max
        const isSpecial = (i % 21 === 4) || (i % 21 === 8);
        const mesh = new THREE.Mesh(geo, isSpecial ? matSpecial : matNormal);
        mesh.visible = false;
        scene.add(mesh);
        debugSpheres.push(mesh);
    }
}

function updateDebugSpheres(hands) {
    if (!DEBUG_TRACKING) return;
    
    // Hide all first
    debugSpheres.forEach(s => s.visible = false);
    
    let idx = 0;
    if (hands.right && hands.right.landmarks) {
        hands.right.landmarks.forEach((lm, i) => {
            const pos = landmarkToWorld(lm, 5.0); // same depth as string
            debugSpheres[idx].position.copy(pos);
            debugSpheres[idx].visible = true;
            idx++;
        });
    }
    // Skip to next hand index block
    idx = 21;
    if (hands.left && hands.left.landmarks) {
        hands.left.landmarks.forEach((lm, i) => {
            const pos = landmarkToWorld(lm, 5.0);
            debugSpheres[idx].position.copy(pos);
            debugSpheres[idx].visible = true;
            idx++;
        });
    }
}

function landmarkToWorld(lm, stringDepth = 3.5) {
    // The webcam background is a 16x9 plane at z=-8, scaled by (2,2,1).
    // So its width is 32, height is 18.
    // MediaPipe x=0 is left of the raw image, y=0 is top.
    // Since we mirrored the webcamTexture in effects.js (repeat.x = -1),
    // the left of the raw image (x=0) is rendered on the RIGHT of the plane.
    // Plane coordinates: x from -16 (left) to 16 (right).
    
    const planeX = -(lm.x - 0.5) * 32;  // Mirrored X
    const planeY = -(lm.y - 0.5) * 18;  // Y is down in image, up in 3D
    const planeZ = -8;
    
    const pointOnPlane = new THREE.Vector3(planeX, planeY, planeZ);
    const camPos = camera.position;
    
    // Direction from camera to the exact pixel on the video plane
    const dir = new THREE.Vector3().subVectors(pointOnPlane, camPos).normalize();
    
    // Project along that sightline to the desired depth
    return camPos.clone().add(dir.multiplyScalar(stringDepth));
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    // ── 1. Hand tracking
    const results = handTracker.detect();
    let hands = { left: null, right: null };
    if (results) {
        hands = handTracker.parseHands(results);
    }

    // ── 2. Gesture recognition
    gestureManager.update(hands);
    const state = gestureManager.getState();
    updateDebugSpheres(hands);

    // ── 3. SEQUENTIAL CONTROL ──────────────────────────
    //
    // RIGHT HAND → Growth only (0–1)
    // LEFT HAND  → Bloom only (0–1), but ONLY when plant is fully grown
    //
    const targetGrowth = state.rightHandActive ? state.rightDistance : displayGrowth * 0.98;

    // Gate bloom on full growth
    bloomEnabled = displayGrowth >= 0.95;

    let targetBloom;
    if (bloomEnabled && state.leftHandActive) {
        targetBloom = state.leftDistance;
    } else if (!bloomEnabled) {
        // Plant not fully grown: force bloom to 0
        targetBloom = 0;
    } else {
        // Fully grown but no left hand: smoothly decay
        targetBloom = displayBloom * 0.98;
    }

    const lerpSpeed = 0.08; 
    displayGrowth += (targetGrowth - displayGrowth) * lerpSpeed;
    displayBloom  += (targetBloom - displayBloom) * lerpSpeed;

    displayGrowth = Math.max(0, Math.min(1, displayGrowth));
    displayBloom  = Math.max(0, Math.min(1, displayBloom));

    // ── 4. Drive the plant directly
    plant.growthProgress = displayGrowth;
    plant.bloomProgress  = displayBloom;
    plant.update(deltaTime);

    const terminalNodes = plant.getTerminalPositions();

    // ── 5. Update magical energy strings
    const rP1 = state.rightThumbTip ? landmarkToWorld(state.rightThumbTip) : null;
    const rP2 = state.rightIndexTip ? landmarkToWorld(state.rightIndexTip) : null;
    rightMagicString.update(rP1, rP2, state.rightDistance, time, deltaTime);

    const lP1 = state.leftThumbTip ? landmarkToWorld(state.leftThumbTip) : null;
    const lP2 = state.leftIndexTip ? landmarkToWorld(state.leftIndexTip) : null;
    leftMagicString.update(lP1, lP2, state.leftDistance, time, deltaTime);

    // ── 6. Update particles
    pollen.update(deltaTime);
    bloomBurst.update(deltaTime);
    butterflies.update(deltaTime);
    sparkles.update(deltaTime, plant);
    fallingPetals.update(deltaTime, terminalNodes, displayBloom);
    flowerGlow.update(deltaTime, terminalNodes, displayBloom);

    const combinedEnergy = Math.max(displayGrowth, displayBloom);
    if (pollen.points) {
        pollen.points.material.opacity = 0.2 + combinedEnergy * 0.6;
        pollen.points.material.size = 0.025 + combinedEnergy * 0.02;
    }

    // ── 7. Update post-processing effects
    effectsManager.update(combinedEnergy, deltaTime);

    // ── 8. Update UI
    updateUI(state);
    updateFPS(deltaTime);

    // ── 9. Render
    effectsManager.render();
}

// ============================================
// UI UPDATES
// ============================================
function updateUI(state) {
    if (statGrowth) statGrowth.textContent = `${Math.round(displayGrowth * 100)}%`;
    if (statBloom)  statBloom.textContent  = `${Math.round(displayBloom * 100)}%`;
    if (statEnergy) {
        const energy = Math.round(Math.max(displayGrowth, displayBloom) * 100);
        statEnergy.textContent = `${energy}%`;
    }

    if (trackingStatus) {
        if (state.rightHandActive || state.leftHandActive) {
            trackingStatus.textContent = "Active";
            trackingStatus.style.color = "var(--color-accent-green)";
        } else {
            trackingStatus.textContent = "No Hands";
            trackingStatus.style.color = "var(--color-text-dim)";
        }
    }

    if (labelRight) {
        labelRight.classList.toggle('active', state.rightHandActive);
    }
    if (labelLeft) {
        labelLeft.classList.toggle('active', state.leftHandActive);
        // Dim the left-hand label when bloom is not yet enabled
        labelLeft.classList.toggle('disabled', !bloomEnabled);
    }

    // Bloom-unlocked badge
    if (bloomBadge) {
        if (bloomEnabled) {
            bloomBadge.classList.add('visible');
        } else {
            bloomBadge.classList.remove('visible');
        }
    }

    if (!instructionsHidden && (state.rightHandActive || state.leftHandActive)) {
        instructionsHidden = true;
        if (instructions) instructions.classList.add('hidden');
    }
}

function updateFPS(deltaTime) {
    fpsFrames++;
    fpsTime += deltaTime;
    if (fpsTime >= 0.5) {
        const fps = Math.round(fpsFrames / fpsTime);
        if (fpsCounter) fpsCounter.textContent = `${fps} FPS`;
        fpsFrames = 0;
        fpsTime   = 0;
    }
}

// ============================================
// EVENT HANDLERS
// ============================================
function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
    if (effectsManager) effectsManager.resize(w, h);
}

// ============================================
// START
// ============================================
initWithTimeout();
