/* ============================================
   PROCEDURAL 3D MAGICAL PLANT MODULE
   Branching tree structure, continuously driven
   Sequential: Growth → Bloom with glow effects
   ============================================ */

import * as THREE from 'three';

// ── Shared Materials ──────────
let SharedMaterials = null;

function initSharedMaterials() {
    if (SharedMaterials) return;
    
    SharedMaterials = {
        branch: new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.12, 0.45, 0.18),
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        }),
        vein: new THREE.LineBasicMaterial({
            color: new THREE.Color(0x6bffb8),
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }),
        leaf: new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x15, 0.55, 0.2),
            roughness: 0.6,
            metalness: 0.05,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        }),
        center: new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xffd700),
            emissive: new THREE.Color(0xffa500),
            emissiveIntensity: 0.8,
            roughness: 0.3,
            metalness: 0.2
        }),
        seed: new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x8B4513),
            roughness: 0.9,
            metalness: 0.0
        }),
        // Glow sphere material for bud glow effect
        budGlow: new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xffd700),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        }),
        petals: []
    };

    const petalColors = [
        new THREE.Color(0xff4d8a), new THREE.Color(0xff6b9d),
        new THREE.Color(0xe855a0), new THREE.Color(0xd447c4),
        new THREE.Color(0xc44dff), new THREE.Color(0xff69b4),
        new THREE.Color(0xff85c8), new THREE.Color(0xda70d6)
    ];

    for (let i = 0; i < 8; i++) {
        SharedMaterials.petals.push(new THREE.MeshStandardMaterial({
            color: petalColors[i],
            roughness: 0.4,
            metalness: 0.1,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            emissive: petalColors[i],
            emissiveIntensity: 0.2
        }));
    }
}

// ────────────────────────────────────────────────────

export class MagicalPlant {
    constructor(scene, position = { x: 0, y: -3, z: 0 }) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        initSharedMaterials();

        // ── Externally driven progress ──────────────
        this.growthProgress = 0;   // 0–1
        this.bloomProgress = 0;    // 0–1

        this.windTime = Math.random() * 100;
        this.windSpeed = 0.5;

        // Configuration
        this.maxDepth = 3; 
        
        // Data stores
        this.branches = []; // To easily iterate and update scales/wind
        this.flowers = [];
        this.leaves = [];
        this.terminalNodes = []; // World positions for particles

        // Seed
        this._createSeed();

        // Build the tree recursively
        this._buildBranch(this.group, 0, null);

        this.group.position.set(position.x, position.y, position.z);
    }

    /**
     * Returns true when the plant is fully grown and bloom can be enabled.
     */
    isFullyGrown() {
        return this.growthProgress >= 0.95;
    }

    /**
     * Recursively builds the plant structure.
     */
    _buildBranch(parentGroup, depth, parentCurve) {
        const branchGroup = new THREE.Group();
        parentGroup.add(branchGroup);

        // Branch parameters based on depth
        const length = depth === 0 ? 2.5 : (1.5 - depth * 0.3) * (0.8 + Math.random() * 0.4);
        const radius = 0.06 / (depth * 0.8 + 1);
        
        // Generate a curved path
        const points = [];
        const numPoints = 6;
        let tiltX = (Math.random() - 0.5) * 0.8;
        let tiltZ = (Math.random() - 0.5) * 0.8;
        
        if (depth === 0) {
            tiltX *= 0.3; // Trunk is straighter
            tiltZ *= 0.3;
        }

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const y = t * length;
            // Curved offset
            const cx = Math.sin(t * Math.PI * 0.5) * tiltX * length;
            const cz = Math.sin(t * Math.PI * 0.5) * tiltZ * length;
            points.push(new THREE.Vector3(cx, y, cz));
        }

        const curve = new THREE.CatmullRomCurve3(points);
        
        // Create Tube Geometry
        const stemGeo = new THREE.TubeGeometry(curve, 12, radius, 6, false);
        const stemMesh = new THREE.Mesh(stemGeo, SharedMaterials.branch);
        branchGroup.add(stemMesh);

        // Create Glowing Vein (Line inside/overlapping)
        const veinGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
        const veinMesh = new THREE.Line(veinGeo, SharedMaterials.vein);
        branchGroup.add(veinMesh);

        // Define growth window based on depth to create a sequential cascading growth
        const depthStep = 0.8 / (this.maxDepth + 1); // e.g. 0.2
        const startGrowth = depth * depthStep * 0.8; 
        const endGrowth = startGrowth + depthStep * 1.5;

        // Base rotation for wind
        const baseRot = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
        branchGroup.rotation.copy(baseRot);

        // Position branch on parent
        if (depth > 0 && parentCurve) {
            const tOrigin = 0.4 + Math.random() * 0.5; // emerge from upper half
            const pos = parentCurve.getPointAt(tOrigin);
            branchGroup.position.copy(pos);
            
            // Angle outwards
            const tangent = parentCurve.getTangentAt(tOrigin);
            const axis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
            if (axis.lengthSq() > 0.01) {
                const angle = 0.5 + Math.random() * 0.5;
                branchGroup.quaternion.setFromAxisAngle(axis, angle);
            }
        }

        this.branches.push({
            group: branchGroup,
            curve: curve,
            startGrowth,
            endGrowth,
            depth,
            baseRot,
            phase: Math.random() * Math.PI * 2,
            vein: veinMesh
        });

        // Add Leaves
        if (depth > 0) {
            const numLeaves = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numLeaves; i++) {
                const tLeaf = 0.2 + Math.random() * 0.6;
                this._createLeaf(branchGroup, curve, tLeaf, startGrowth, endGrowth);
            }
        }

        // Recursion or Flower
        if (depth < this.maxDepth) {
            const numChildren = depth === 0 ? 3 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numChildren; i++) {
                this._buildBranch(branchGroup, depth + 1, curve);
            }
        } else {
            // Terminal node -> Flower
            const tipPos = curve.getPointAt(1);
            this._createFlower(branchGroup, tipPos, endGrowth);
        }
    }

    _createSeed() {
        const seedGeo = new THREE.SphereGeometry(0.12, 16, 16);
        this.seed = new THREE.Mesh(seedGeo, SharedMaterials.seed);
        this.group.add(this.seed);
    }

    _createLeaf(parentGroup, parentCurve, t, branchStart, branchEnd) {
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.quadraticCurveTo(0.1, 0.1, 0.2, 0.05);
        leafShape.quadraticCurveTo(0.1, -0.05, 0, 0);
        const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
        const leaf = new THREE.Mesh(leafGeo, SharedMaterials.leaf);

        const pos = parentCurve.getPointAt(t);
        leaf.position.copy(pos);
        
        const baseRot = new THREE.Euler(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.5
        );
        leaf.rotation.copy(baseRot);

        parentGroup.add(leaf);
        
        // Leaf emerges slightly after the branch section reaches its point
        const leafStart = branchStart + (branchEnd - branchStart) * t;
        const leafEnd = leafStart + 0.15;

        this.leaves.push({
            mesh: leaf,
            startGrowth: leafStart,
            endGrowth: leafEnd,
            baseRot
        });
    }

    _createFlower(parentGroup, position, branchEnd) {
        const flowerGroup = new THREE.Group();
        flowerGroup.position.copy(position);
        parentGroup.add(flowerGroup);

        // Center
        const centerGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const center = new THREE.Mesh(centerGeo, SharedMaterials.center.clone());
        flowerGroup.add(center);

        // Bud glow sphere — a larger transparent sphere that glows before petals open
        const glowGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const glowMat = SharedMaterials.budGlow.clone();
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        flowerGroup.add(glowMesh);

        // Bud point light — golden light that illuminates surroundings
        const budLight = new THREE.PointLight(0xffd700, 0, 1.5, 2);
        flowerGroup.add(budLight);

        // Petals
        const petalCount = 6 + Math.floor(Math.random() * 4);
        const petals = [];
        
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const layer = i % 2;

            const petalShape = new THREE.Shape();
            const pLen = 0.2 + layer * 0.05;
            const pWid = 0.08 + layer * 0.02;

            petalShape.moveTo(0, 0);
            petalShape.bezierCurveTo(pWid, pLen * 0.3, pWid * 0.8, pLen * 0.7, 0, pLen);
            petalShape.bezierCurveTo(-pWid * 0.8, pLen * 0.7, -pWid, pLen * 0.3, 0, 0);

            const petalGeo = new THREE.ExtrudeGeometry(petalShape, { depth: 0.002, bevelEnabled: false, curveSegments: 6 });
            const mat = SharedMaterials.petals[Math.floor(Math.random() * SharedMaterials.petals.length)].clone();
            const petal = new THREE.Mesh(petalGeo, mat);

            const pGroup = new THREE.Group();
            pGroup.add(petal);
            pGroup.rotation.y = angle;
            
            flowerGroup.add(pGroup);

            petals.push({
                group: pGroup,
                mesh: petal,
                closedX: Math.PI * 0.5,
                openX: Math.PI * 0.1 + layer * 0.15 + Math.random() * 0.05,
                layerDelay: layer * 0.1
            });
        }

        const startGrowth = branchEnd - 0.05;
        const endGrowth = startGrowth + 0.15;

        this.flowers.push({
            group: flowerGroup,
            center: center,
            petals: petals,
            startGrowth,
            endGrowth,
            glowMesh: glowMesh,
            glowMat: glowMat,
            budLight: budLight,
            baseRot: new THREE.Euler((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5)
        });
    }

    /**
     * Update visuals based on growthProgress and bloomProgress.
     */
    update(deltaTime) {
        this.windTime += deltaTime * this.windSpeed;
        this.terminalNodes = []; // Reset for this frame

        this._updateSeed();
        this._updateBranches();
        this._updateLeaves();
        this._updateFlowers();
    }

    _updateSeed() {
        if (this.growthProgress < 0.05) {
            this.seed.visible = true;
            const seedScale = 1 + this.growthProgress * 5;
            this.seed.scale.set(seedScale, seedScale, seedScale);
        } else {
            this.seed.visible = false;
        }
    }

    _updateBranches() {
        for (const b of this.branches) {
            // Growth scaling
            let t = (this.growthProgress - b.startGrowth) / (b.endGrowth - b.startGrowth);
            t = Math.max(0, Math.min(1, t));

            if (t <= 0) {
                b.group.visible = false;
                continue;
            }

            b.group.visible = true;
            
            // Smooth easing
            const eased = this._easeOutBack(t);
            // Non-uniform scaling to make it grow along the curve naturally
            // We scale heavily on Y (length) and slightly on X/Z (thickness)
            b.group.scale.set(eased * 0.5 + 0.5 * t, eased, eased * 0.5 + 0.5 * t);

            // Wind Sway (applied to the local rotation)
            const sway = Math.sin(this.windTime + b.phase) * 0.03 * (b.depth + 1);
            const swayZ = Math.cos(this.windTime * 0.8 + b.phase) * 0.02 * (b.depth + 1);
            
            b.group.rotation.x = b.baseRot.x + sway;
            b.group.rotation.z = b.baseRot.z + swayZ;

            // Vein pulsing
            b.vein.material.opacity = 0.3 + Math.sin(this.windTime * 3 + b.phase) * 0.3 * this.growthProgress;
        }
    }

    _updateLeaves() {
        for (const l of this.leaves) {
            let t = (this.growthProgress - l.startGrowth) / (l.endGrowth - l.startGrowth);
            t = Math.max(0, Math.min(1, t));

            if (t <= 0) {
                l.mesh.visible = false;
                continue;
            }

            l.mesh.visible = true;
            const eased = this._easeOutBack(t);
            l.mesh.scale.set(eased, eased, eased);
        }
    }

    _updateFlowers() {
        const isFullyGrown = this.isFullyGrown();

        for (const f of this.flowers) {
            // 1. Bud Growth (driven by right hand / growthProgress)
            let gt = (this.growthProgress - f.startGrowth) / (f.endGrowth - f.startGrowth);
            gt = Math.max(0, Math.min(1, gt));

            if (gt <= 0) {
                f.group.visible = false;
                f.budLight.intensity = 0;
                f.glowMat.opacity = 0;
                continue;
            }

            f.group.visible = true;
            const budScale = this._easeOutBack(gt);
            f.group.scale.set(budScale, budScale, budScale);

            // Collect world positions for particle systems
            if (gt > 0.5) {
                const worldPos = new THREE.Vector3();
                f.group.getWorldPosition(worldPos);
                this.terminalNodes.push(worldPos);
            }

            // 2. Bloom (driven by left hand / bloomProgress)
            // Bloom ONLY applies if the plant is fully grown globally
            const effectiveBloom = isFullyGrown ? this.bloomProgress : 0;

            // 3. Glow effect — starts BEFORE petals open (leads by ~10%)
            // glowProgress ramps up from 0 to 1, leading the actual petal opening
            const glowProgress = Math.max(0, Math.min(1, effectiveBloom * 1.3));
            
            // Glow sphere: visible as soon as bloom begins, fades at full bloom
            const glowOpacity = glowProgress * (1 - effectiveBloom * 0.5) * 0.6;
            f.glowMat.opacity = glowOpacity;
            
            // Glow sphere pulsing scale
            const glowScale = 1.0 + Math.sin(this.windTime * 4) * 0.15 * glowProgress;
            f.glowMesh.scale.set(glowScale, glowScale, glowScale);

            // Bud point light: builds up before petals open
            f.budLight.intensity = glowProgress * 2.0;
            f.budLight.distance = 1.0 + glowProgress * 1.5;

            // 4. Petal opening — only after glow has had a chance to build
            // Petals start opening when effectiveBloom > 0.1 (glow has a 10% head start)
            const petalBloom = Math.max(0, (effectiveBloom - 0.1) / 0.9);

            for (const p of f.petals) {
                const bt = Math.max(0, Math.min(1, (petalBloom - p.layerDelay) / (1 - p.layerDelay)));
                const easedBloom = this._easeOutCubic(bt);

                p.mesh.rotation.x = THREE.MathUtils.lerp(p.closedX, p.openX, easedBloom);
                p.mesh.material.emissiveIntensity = 0.1 + easedBloom * 0.4 + glowProgress * 0.2;
                
                // Wind flutter on petals (only when petals are opening)
                const flutter = Math.sin(this.windTime * 5 + p.layerDelay * 10) * 0.05 * easedBloom;
                p.mesh.rotation.z = flutter;
            }

            // Center emissive intensity — pulses with warm light during bloom
            const centerPulse = Math.sin(this.windTime * 3) * 0.3 * effectiveBloom;
            f.center.material.emissiveIntensity = 0.5 + effectiveBloom * 1.5 + centerPulse;
            
            // Flower head wind sway
            f.group.rotation.x = f.baseRot.x + Math.sin(this.windTime * 1.5) * 0.1;
        }
    }

    getTerminalPositions() {
        return this.terminalNodes;
    }

    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const result = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        return Math.max(0, result);
    }

    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
        });
        this.scene.remove(this.group);
    }
}
