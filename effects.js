/* ============================================
   VISUAL EFFECTS MODULE
   Post-processing, bloom, lighting, background
   ============================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class EffectsManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        // Post-processing composer
        this.composer = new EffectComposer(renderer);

        // Render pass
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // Unreal bloom pass
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5,   // strength (will be animated)
            0.6,   // radius
            0.3    // threshold
        );
        this.composer.addPass(this.bloomPass);

        // Output pass (tone mapping + color space)
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        // Lighting
        this._setupLighting();

        // Background
        this._setupBackground();

        // Webcam background texture
        this.webcamTexture = null;
    }

    _setupLighting() {
        // Soft ambient light
        this.ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(this.ambientLight);

        // Hemisphere light (sky + ground)
        this.hemiLight = new THREE.HemisphereLight(0x6666ff, 0x225522, 0.4);
        this.hemiLight.position.set(0, 5, 0);
        this.scene.add(this.hemiLight);

        // Main directional light
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(3, 5, 2);
        this.dirLight.castShadow = false;
        this.scene.add(this.dirLight);

        // Flower point light (will be at flower center)
        this.flowerLight = new THREE.PointLight(0xff69b4, 0, 5);
        this.flowerLight.position.set(0, 1, 0);
        this.scene.add(this.flowerLight);

        // Golden center light
        this.centerLight = new THREE.PointLight(0xffd700, 0, 3);
        this.centerLight.position.set(0, 1, 0);
        this.scene.add(this.centerLight);
    }

    _setupBackground() {
        // Dark gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(256, 200, 50, 256, 256, 400);
        gradient.addColorStop(0, '#1a0a2e');
        gradient.addColorStop(0.4, '#0f0a1e');
        gradient.addColorStop(0.8, '#080610');
        gradient.addColorStop(1, '#050408');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        const bgTexture = new THREE.CanvasTexture(canvas);
        this.scene.background = bgTexture;
    }

    /**
     * Initialize webcam background (AR-like effect)
     * @param {HTMLVideoElement} videoElement
     */
    setupWebcamBackground(videoElement) {
        this.webcamTexture = new THREE.VideoTexture(videoElement);
        this.webcamTexture.minFilter = THREE.LinearFilter;
        this.webcamTexture.magFilter = THREE.LinearFilter;
        this.webcamTexture.colorSpace = THREE.SRGBColorSpace;
        
        // Mirror the texture to match the CSS transform: scaleX(-1)
        this.webcamTexture.center.set(0.5, 0.5);
        this.webcamTexture.repeat.set(-1, 1);

        // Create background plane with blurred webcam
        // We'll use a very dark, semi-transparent overlay
        const bgGeo = new THREE.PlaneGeometry(16, 9);
        const bgMat = new THREE.MeshBasicMaterial({
            map: this.webcamTexture,
            transparent: true,
            opacity: 0.15,  // Very subtle
            side: THREE.FrontSide
        });

        this.webcamBg = new THREE.Mesh(bgGeo, bgMat);
        this.webcamBg.position.set(0, 0, -8);
        this.webcamBg.scale.set(2, 2, 1);
        this.scene.add(this.webcamBg);
    }

    /**
     * Update effects based on garden state
     * @param {number} gardenBloomLevel 0-1 (average of all flowers)
     * @param {number} deltaTime
     */
    update(combinedEnergy, deltaTime) {
        // Dynamic bloom intensity (reduced to prevent blowing out the branches)
        const targetStrength = 0.2 + combinedEnergy * 0.6;
        this.bloomPass.strength += (targetStrength - this.bloomPass.strength) * 0.05;

        // Bloom threshold
        const targetThreshold = 0.5 - combinedEnergy * 0.2;
        this.bloomPass.threshold += (targetThreshold - this.bloomPass.threshold) * 0.05;

        // Magical center lights scale with energy
        this.flowerLight.intensity = combinedEnergy * 3.0;
        this.centerLight.intensity = combinedEnergy * 2.0;

        // Ambient light warms up as energy progresses
        const ambientIntensity = 0.5 + combinedEnergy * 0.5;
        this.ambientLight.intensity = ambientIntensity;

        // Subtle color shift in ambient
        const r = 0.25 + combinedEnergy * 0.25;
        const g = 0.25 + combinedEnergy * 0.15;
        const b = 0.37 + combinedEnergy * 0.2;
        this.ambientLight.color.setRGB(r, g, b);
    }

    /**
     * Render the scene through the post-processing pipeline
     */
    render() {
        this.composer.render();
    }

    /**
     * Handle window resize
     */
    resize(width, height) {
        this.composer.setSize(width, height);
        if (this.bloomPass.resolution) {
            this.bloomPass.resolution.set(width, height);
        }
    }

    /**
     * Clean up
     */
    dispose() {
        this.composer.dispose();
        if (this.webcamTexture) this.webcamTexture.dispose();
    }
}
