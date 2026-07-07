/* ============================================
   PARTICLE SYSTEMS MODULE
   Global ambient pollen, bloom bursts, butterflies, sparkles, and falling petals
   ============================================ */

import * as THREE from 'three';

// ------------------------------------------------
// Texture Generators
// ------------------------------------------------
function createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    const x = 32, y = 20, s = 14;
    ctx.moveTo(x, y + s);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.5);
    ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.5, x, y + s * 1.8);
    ctx.bezierCurveTo(x, y + s * 1.5, x + s, y + s, x + s, y + s * 0.5);
    ctx.bezierCurveTo(x + s, y, x, y, x, y + s);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

function createGlowTexture(color = [255, 255, 255]) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`);
    gradient.addColorStop(0.3, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`);
    gradient.addColorStop(0.7, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.15)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function createPetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffb3c6';
    ctx.beginPath();
    ctx.ellipse(16, 16, 8, 14, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

// ================================================
// GLOBAL AMBIENT POLLEN (Persistent)
// ================================================
export class GlobalPollenSystem {
    constructor(scene, count = 300) {
        this.scene = scene;
        this.count = count;
        this.time = 0;

        this.data = [];
        const positions = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 16;
            positions[i * 3 + 1] = Math.random() * 10 - 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 4;

            this.data.push({
                speed: 0.05 + Math.random() * 0.1,
                phase: Math.random() * Math.PI * 2,
                driftX: (Math.random() - 0.5) * 0.3,
                driftZ: (Math.random() - 0.5) * 0.3
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            map: createGlowTexture([255, 230, 150]),
            size: 0.025, // Tinier floating pollen
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);
    }

    update(deltaTime) {
        this.time += deltaTime;
        const positions = this.points.geometry.attributes.position.array;

        for (let i = 0; i < this.count; i++) {
            const d = this.data[i];
            
            // Gentle upward drift and sway
            positions[i * 3 + 1] += deltaTime * d.speed;
            positions[i * 3] += Math.sin(this.time + d.phase) * deltaTime * d.driftX;
            positions[i * 3 + 2] += Math.cos(this.time + d.phase) * deltaTime * d.driftZ;

            // Wrap around
            if (positions[i * 3 + 1] > 8) {
                positions[i * 3 + 1] = -3;
                positions[i * 3] = (Math.random() - 0.5) * 16;
            }
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}

// ================================================
// BRANCH SPARKLES SYSTEM
// Sparkles travelling along the plant branches
// ================================================
export class BranchSparkleSystem {
    constructor(scene) {
        this.scene = scene;
        this.maxSparkles = 200;
        this.sparkles = [];
        this.activeCount = 0;

        const positions = new Float32Array(this.maxSparkles * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const mat = new THREE.PointsMaterial({
            map: createGlowTexture([107, 255, 184]), // Bright green/cyan
            size: 0.05,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);
        
        for (let i = 0; i < this.maxSparkles; i++) {
            this.sparkles.push({ active: false, t: 0, speed: 0, branchIndex: 0, offset: new THREE.Vector3() });
        }
    }

    update(deltaTime, plant) {
        if (!plant || !plant.branches || plant.branches.length === 0) return;
        
        // Randomly emit new sparkles if plant is grown
        if (plant.growthProgress > 0.1 && Math.random() < plant.growthProgress * 2.0) {
            this._emit(plant.branches);
        }

        const positions = this.points.geometry.attributes.position.array;
        
        // Temporary vector for conversions
        const worldPos = new THREE.Vector3();

        for (let i = 0; i < this.maxSparkles; i++) {
            const s = this.sparkles[i];
            if (!s.active) {
                // Hide inactive particles
                positions[i*3] = 9999; 
                positions[i*3+1] = 9999;
                positions[i*3+2] = 9999;
                continue;
            }

            s.t += s.speed * deltaTime;
            if (s.t >= 1.0) {
                s.active = false;
                continue;
            }

            const branch = plant.branches[s.branchIndex];
            if (!branch || !branch.group.visible) {
                s.active = false;
                continue;
            }

            // Get local position along the curve
            branch.curve.getPointAt(s.t, worldPos);
            // Add offset for thickness
            worldPos.add(s.offset);
            // Convert to world space
            branch.group.localToWorld(worldPos);

            positions[i*3] = worldPos.x;
            positions[i*3+1] = worldPos.y;
            positions[i*3+2] = worldPos.z;
        }

        this.points.geometry.attributes.position.needsUpdate = true;
    }

    _emit(branches) {
        // Find an inactive sparkle
        const idx = this.sparkles.findIndex(s => !s.active);
        if (idx === -1) return;

        const s = this.sparkles[idx];
        s.active = true;
        s.t = 0;
        s.speed = 0.5 + Math.random() * 1.5; // Travels the branch in 0.5 to 2 seconds
        
        // Pick a random visible branch
        const visibleBranches = branches.filter(b => b.group.visible);
        if (visibleBranches.length === 0) {
            s.active = false;
            return;
        }
        
        const branch = visibleBranches[Math.floor(Math.random() * visibleBranches.length)];
        s.branchIndex = branches.indexOf(branch);

        // Random offset from the curve center
        const radius = 0.05;
        s.offset.set(
            (Math.random() - 0.5) * radius,
            (Math.random() - 0.5) * radius,
            (Math.random() - 0.5) * radius
        );
    }
}

// ================================================
// FALLING PETALS SYSTEM
// ================================================
export class FallingPetalSystem {
    constructor(scene) {
        this.scene = scene;
        this.maxPetals = 150;
        this.petals = [];
        
        const geo = new THREE.PlaneGeometry(0.08, 0.08);
        const tex = createPetalTexture();
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            color: 0xffffff
        });
        
        this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxPetals);
        this.scene.add(this.instancedMesh);
        
        // Initialize instances off-screen
        const dummy = new THREE.Object3D();
        dummy.position.set(9999, 9999, 9999);
        dummy.updateMatrix();
        
        for (let i = 0; i < this.maxPetals; i++) {
            this.instancedMesh.setMatrixAt(i, dummy.matrix);
            this.petals.push({
                active: false,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                rot: new THREE.Vector3(),
                rotVel: new THREE.Vector3(),
                life: 0,
                maxLife: 4 + Math.random() * 3
            });
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    update(deltaTime, terminalNodes, bloomProgress) {
        const dummy = new THREE.Object3D();
        
        // Emit new petals if blooming
        if (bloomProgress > 0.9 && terminalNodes.length > 0) {
            // Number of petals to emit depends on how many flowers are open
            if (Math.random() < 0.3) { // 30% chance per frame to emit a petal
                this._emit(terminalNodes);
            }
        }

        for (let i = 0; i < this.maxPetals; i++) {
            const p = this.petals[i];
            
            if (!p.active) continue;

            p.life += deltaTime;
            if (p.life > p.maxLife) {
                p.active = false;
                dummy.position.set(9999, 9999, 9999);
                dummy.updateMatrix();
                this.instancedMesh.setMatrixAt(i, dummy.matrix);
                continue;
            }

            // Physics
            p.pos.addScaledVector(p.vel, deltaTime);
            p.rot.addScaledVector(p.rotVel, deltaTime);
            
            // Wind drift (gentle sway)
            p.pos.x += Math.sin(p.life * 2) * deltaTime * 0.1;
            p.pos.z += Math.cos(p.life * 1.5) * deltaTime * 0.1;
            
            dummy.position.copy(p.pos);
            dummy.rotation.setFromVector3(p.rot);
            
            // Fade out by shrinking at the very end
            let scale = 1.0;
            const remaining = p.maxLife - p.life;
            if (remaining < 1.0) scale = remaining;
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    _emit(terminalNodes) {
        const idx = this.petals.findIndex(p => !p.active);
        if (idx === -1) return;

        const p = this.petals[idx];
        p.active = true;
        p.life = 0;
        
        // Pick random flower
        const origin = terminalNodes[Math.floor(Math.random() * terminalNodes.length)];
        p.pos.copy(origin);
        // Slightly offset
        p.pos.x += (Math.random() - 0.5) * 0.2;
        p.pos.y += (Math.random() - 0.5) * 0.2;
        p.pos.z += (Math.random() - 0.5) * 0.2;

        p.vel.set(
            (Math.random() - 0.5) * 0.2,
            -0.2 - Math.random() * 0.3, // Falling down
            (Math.random() - 0.5) * 0.2
        );

        p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        p.rotVel.set(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        );
    }
}

// ================================================
// BLOOM BURST SYSTEM (Triggered per flower)
// ================================================
export class BloomBurstSystem {
    constructor(scene) {
        this.scene = scene;
        this.bursts = []; // Array of active bursts
        
        // Cache textures
        this.texGlow = createGlowTexture([255, 200, 255]);
        this.texHeart = createHeartTexture();
        this.texPetal = createPetalTexture();
    }

    trigger(positions) {
        // Trigger at multiple positions (e.g. all terminal nodes)
        if (!positions || positions.length === 0) return;

        for (const pos of positions) {
            const burst = {
                time: 0,
                duration: 2.0,
                particles: []
            };

            const count = 20; // Reduced count per flower to save performance
            const posArray = new Float32Array(count * 3);
            const types = []; 

            for (let i = 0; i < count; i++) {
                posArray[i*3] = pos.x;
                posArray[i*3+1] = pos.y;
                posArray[i*3+2] = pos.z;

                const type = Math.random();
                let pType = 0;
                if (type > 0.8) pType = 1; // hearts
                else if (type > 0.6) pType = 2; // petals

                types.push(pType);

                burst.particles.push({
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 1.5,
                        Math.random() * 1.5 + 0.5,
                        (Math.random() - 0.5) * 1.5
                    ),
                    type: pType,
                    phase: Math.random() * Math.PI * 2
                });
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

            burst.meshSparkle = new THREE.Points(geo.clone(), new THREE.PointsMaterial({
                map: this.texGlow, size: 0.08, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            burst.meshHeart = new THREE.Points(geo.clone(), new THREE.PointsMaterial({
                map: this.texHeart, size: 0.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            burst.meshPetal = new THREE.Points(geo.clone(), new THREE.PointsMaterial({
                map: this.texPetal, size: 0.08, transparent: true, depthWrite: false
            }));

            this.scene.add(burst.meshSparkle);
            this.scene.add(burst.meshHeart);
            this.scene.add(burst.meshPetal);

            this.bursts.push(burst);
        }
    }

    update(deltaTime) {
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.time += deltaTime;

            if (b.time > b.duration) {
                this.scene.remove(b.meshSparkle);
                this.scene.remove(b.meshHeart);
                this.scene.remove(b.meshPetal);
                b.meshSparkle.geometry.dispose();
                b.meshHeart.geometry.dispose();
                b.meshPetal.geometry.dispose();
                this.bursts.splice(i, 1);
                continue;
            }

            const t = b.time / b.duration;
            const opacity = 1 - Math.pow(t, 2); // Fade out

            b.meshSparkle.material.opacity = opacity;
            b.meshHeart.material.opacity = opacity * 0.8;
            b.meshPetal.material.opacity = opacity * 0.9;

            const posS = b.meshSparkle.geometry.attributes.position.array;
            const posH = b.meshHeart.geometry.attributes.position.array;
            const posP = b.meshPetal.geometry.attributes.position.array;

            for (let j = 0; j < b.particles.length; j++) {
                const p = b.particles[j];
                
                // Gravity and drag
                p.velocity.y -= deltaTime * 0.5; // gravity
                p.velocity.multiplyScalar(0.95); // drag

                const sway = Math.sin(b.time * 3 + p.phase) * deltaTime * 0.5;

                const dx = p.velocity.x * deltaTime + sway;
                const dy = p.velocity.y * deltaTime;
                const dz = p.velocity.z * deltaTime;

                if (p.type === 0) {
                    posS[j*3] += dx; posS[j*3+1] += dy; posS[j*3+2] += dz;
                } else if (p.type === 1) {
                    posH[j*3] += dx; posH[j*3+1] += dy; posH[j*3+2] += dz;
                } else {
                    posP[j*3] += dx; posP[j*3+1] += dy * 0.5; posP[j*3+2] += dz; 
                }
            }

            b.meshSparkle.geometry.attributes.position.needsUpdate = true;
            b.meshHeart.geometry.attributes.position.needsUpdate = true;
            b.meshPetal.geometry.attributes.position.needsUpdate = true;
        }
    }
}

// ================================================
// BUTTERFLY SYSTEM
// ================================================
export class ButterflySystem {
    constructor(scene) {
        this.scene = scene;
        this.butterflies = [];
        
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.ellipse(10, 16, 8, 12, -Math.PI/6, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(22, 16, 8, 12, Math.PI/6, 0, Math.PI*2);
        ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(0.2, 0.2);
        geo.translate(0, 0.1, 0); 
        
        this.material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.geometry = geo;
    }

    trigger(position) {
        const count = 1 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.material.clone());
            mesh.position.copy(position);
            mesh.position.x += (Math.random() - 0.5) * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.5;
            
            this.scene.add(mesh);
            
            this.butterflies.push({
                mesh: mesh,
                time: 0,
                duration: 8.0,
                flapSpeed: 15 + Math.random() * 10,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    0.2 + Math.random() * 0.3,
                    (Math.random() - 0.5) * 0.3
                ),
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    update(deltaTime) {
        for (let i = this.butterflies.length - 1; i >= 0; i--) {
            const b = this.butterflies[i];
            b.time += deltaTime;
            
            if (b.time > b.duration) {
                this.scene.remove(b.mesh);
                b.mesh.material.dispose();
                this.butterflies.splice(i, 1);
                continue;
            }
            
            b.mesh.position.addScaledVector(b.velocity, deltaTime);
            
            const flap = Math.sin(b.time * b.flapSpeed);
            b.mesh.scale.x = Math.max(0.1, Math.abs(flap));
            
            b.mesh.position.x += Math.sin(b.time * 2 + b.phase) * deltaTime * 0.5;
            b.mesh.position.z += Math.cos(b.time * 2 + b.phase) * deltaTime * 0.5;
            
            b.mesh.rotation.y = Math.atan2(b.velocity.x, b.velocity.z);
            
            const t = b.time / b.duration;
            b.mesh.material.opacity = 1 - Math.pow(t, 3);
        }
    }
}

// ================================================
// MAGICAL ENERGY STRING (Tube with particles)
// ================================================
function createPulseTexture(baseColorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    // Darker ends, bright middle
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.3, `rgba(255,255,255,0.4)`);
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(0.7, `rgba(255,255,255,0.4)`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 16);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

export class MagicalEnergyString {
    constructor(scene, colorHex) {
        this.scene = scene;
        this.color = new THREE.Color(colorHex);
        
        // Track smoothed endpoints for jitter reduction
        this.smoothedP1 = null;
        this.smoothedP2 = null;
        this.currentOpacity = 0;
        
        // Tube Mesh
        this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3()]);
        this.tubeGeo = new THREE.TubeGeometry(this.curve, 20, 0.01, 8, false);
        this.pulseTex = createPulseTexture(colorHex);
        
        this.tubeMat = new THREE.MeshBasicMaterial({
            color: this.color,
            map: this.pulseTex,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        this.tubeMesh = new THREE.Mesh(this.tubeGeo, this.tubeMat);
        this.tubeMesh.frustumCulled = false;
        this.scene.add(this.tubeMesh);
        
        // Orbiting Sparkles
        this.maxSparkles = 40;
        this.sparkles = [];
        const sGeo = new THREE.BufferGeometry();
        const sPos = new Float32Array(this.maxSparkles * 3);
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        
        this.sparkleMat = new THREE.PointsMaterial({
            map: createGlowTexture([255, 255, 255]),
            size: 0.04,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: this.color
        });
        this.sparklePoints = new THREE.Points(sGeo, this.sparkleMat);
        this.sparklePoints.frustumCulled = false;
        this.scene.add(this.sparklePoints);
        
        for (let i = 0; i < this.maxSparkles; i++) {
            this.sparkles.push({
                t: Math.random(),
                speed: 0.5 + Math.random() * 1.5,
                angle: Math.random() * Math.PI * 2,
                radius: 0.02 + Math.random() * 0.05
            });
        }
        
        // Trail Particles
        this.maxTrail = 100;
        this.trail = [];
        this.trailIdx = 0;
        const tGeo = new THREE.BufferGeometry();
        const tPos = new Float32Array(this.maxTrail * 3);
        tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
        
        this.trailMat = new THREE.PointsMaterial({
            map: createGlowTexture([255, 200, 255]),
            size: 0.06,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: this.color
        });
        this.trailPoints = new THREE.Points(tGeo, this.trailMat);
        this.trailPoints.frustumCulled = false;
        this.scene.add(this.trailPoints);
        
        for (let i = 0; i < this.maxTrail; i++) {
            this.trail.push({ active: false, life: 0, maxLife: 1.0 });
        }
    }
    
    update(p1, p2, distance, time, deltaTime) {
        // Smoothly fade in/out
        const targetOpacity = (p1 && p2) ? 1.0 : 0.0;
        this.currentOpacity += (targetOpacity - this.currentOpacity) * 10.0 * deltaTime;
        
        if (this.currentOpacity < 0.01) {
            this.tubeMat.opacity = 0;
            this.sparklePoints.visible = false;
            this.smoothedP1 = null;
            this.smoothedP2 = null;
            return;
        }
        
        this.sparklePoints.visible = true;
        
        // If we have targets, smooth towards them
        if (p1 && p2) {
            if (!this.smoothedP1) {
                this.smoothedP1 = p1.clone();
                this.smoothedP2 = p2.clone();
            } else {
                const lerpFactor = 1.0 - Math.pow(0.001, deltaTime); // Frame-rate independent lerp
                this.smoothedP1.lerp(p1, lerpFactor);
                this.smoothedP2.lerp(p2, lerpFactor);
            }
        }
        
        // Use smoothed positions for rendering
        const renderP1 = this.smoothedP1;
        const renderP2 = this.smoothedP2;
        
        // 1. Build curve with sag and wobble
        const points = [];
        const segments = 10;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const pt = new THREE.Vector3().lerpVectors(renderP1, renderP2, t);
            
            // Sag in the middle
            const sag = Math.sin(t * Math.PI) * distance * 0.15;
            pt.y -= sag;
            
            // Dynamic wobble
            const wobble = Math.sin(time * 10 + t * 5) * 0.02 * distance * Math.sin(t * Math.PI);
            pt.x += wobble;
            pt.z += wobble;
            
            points.push(pt);
        }
        
        this.curve = new THREE.CatmullRomCurve3(points);
        
        // 2. Update Tube
        const radius = 0.005 + Math.min(distance * 0.02, 0.04);
        if (this.tubeMesh.geometry) this.tubeMesh.geometry.dispose();
        this.tubeMesh.geometry = new THREE.TubeGeometry(this.curve, 20, radius, 8, false);
        
        // Base opacity based on fade state AND distance
        this.tubeMat.opacity = this.currentOpacity * (0.3 + distance * 0.7);
        this.pulseTex.offset.x -= deltaTime * (1.0 + distance * 2); // Pulse speed
        
        // 4. Update Orbiting Sparkles
        const sPos = this.sparklePoints.geometry.attributes.position.array;
        let activeSparkles = Math.floor(this.maxSparkles * Math.min(distance * 1.5, 1.0));
        
        const tangent = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const binormal = new THREE.Vector3();
        const up = new THREE.Vector3(0,1,0);
        
        for (let i = 0; i < this.maxSparkles; i++) {
            if (i >= activeSparkles) {
                sPos[i*3] = 9999;
                continue;
            }
            
            const s = this.sparkles[i];
            s.t += s.speed * deltaTime;
            if (s.t > 1) s.t = 0;
            
            s.angle += deltaTime * 5;
            
            const pt = this.curve.getPointAt(s.t);
            tangent.copy(this.curve.getTangentAt(s.t));
            
            // Build local coordinate system along curve
            normal.crossVectors(tangent, up).normalize();
            if (normal.lengthSq() < 0.001) normal.set(1,0,0);
            binormal.crossVectors(tangent, normal).normalize();
            
            const orbitR = radius + s.radius + distance * 0.02;
            const ox = Math.cos(s.angle) * orbitR;
            const oy = Math.sin(s.angle) * orbitR;
            
            pt.addScaledVector(normal, ox);
            pt.addScaledVector(binormal, oy);
            
            sPos[i*3] = pt.x;
            sPos[i*3+1] = pt.y;
            sPos[i*3+2] = pt.z;
        }
        this.sparklePoints.geometry.attributes.position.needsUpdate = true;
        this.sparklePoints.material.opacity = 0.2 + distance * 0.8;
        
        // 5. Update Trail
        if (Math.random() < distance * 2) {
            // Emit from random points along the string, not just the center
            const tPt = this.curve.getPointAt(Math.random());
            const tr = this.trail[this.trailIdx];
            tr.active = true;
            tr.life = 0;
            const tPosArr = this.trailPoints.geometry.attributes.position.array;
            tPosArr[this.trailIdx*3] = tPt.x + (Math.random()-0.5)*0.1;
            tPosArr[this.trailIdx*3+1] = tPt.y + (Math.random()-0.5)*0.1;
            tPosArr[this.trailIdx*3+2] = tPt.z + (Math.random()-0.5)*0.1;
            this.trailIdx = (this.trailIdx + 1) % this.maxTrail;
        }
        
        const tPosArr = this.trailPoints.geometry.attributes.position.array;
        for (let i = 0; i < this.maxTrail; i++) {
            const tr = this.trail[i];
            if (!tr.active) {
                tPosArr[i*3] = 9999;
                continue;
            }
            tr.life += deltaTime;
            if (tr.life >= tr.maxLife) {
                tr.active = false;
                tPosArr[i*3] = 9999;
            } else {
                tPosArr[i*3+1] += deltaTime * 0.1;
            }
        }
        this.trailPoints.geometry.attributes.position.needsUpdate = true;
        this.trailPoints.material.opacity = 0.5 * (0.3 + distance * 0.7);
    }
}

// ================================================
// FLOWER GLOW SYSTEM
// Orbiting sparkles + drifting pollen around buds
// during bloom phase. Creates the "magical energy
// building inside the bud" effect.
// ================================================
export class FlowerGlowSystem {
    constructor(scene) {
        this.scene = scene;
        this.time = 0;

        // ── Orbiting sparkles around buds ──
        this.maxSparkles = 200;
        const sparklePositions = new Float32Array(this.maxSparkles * 3);
        const sparkleGeo = new THREE.BufferGeometry();
        sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));

        this.sparkleMat = new THREE.PointsMaterial({
            map: createGlowTexture([255, 215, 80]),  // Golden
            size: 0.045,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.sparklePoints = new THREE.Points(sparkleGeo, this.sparkleMat);
        this.sparklePoints.frustumCulled = false;
        this.scene.add(this.sparklePoints);

        // Pre-allocate sparkle data
        this.sparkleData = [];
        for (let i = 0; i < this.maxSparkles; i++) {
            this.sparkleData.push({
                angle: Math.random() * Math.PI * 2,
                speed: 2.0 + Math.random() * 3.0,
                radius: 0.08 + Math.random() * 0.12,
                yOffset: (Math.random() - 0.5) * 0.15,
                phase: Math.random() * Math.PI * 2
            });
        }

        // ── Drifting pollen from blooming flowers ──
        this.maxPollen = 120;
        this.pollenData = [];
        const pollenPositions = new Float32Array(this.maxPollen * 3);
        const pollenGeo = new THREE.BufferGeometry();
        pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));

        this.pollenMat = new THREE.PointsMaterial({
            map: createGlowTexture([255, 240, 180]),  // Warm gold
            size: 0.03,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.pollenPoints = new THREE.Points(pollenGeo, this.pollenMat);
        this.pollenPoints.frustumCulled = false;
        this.scene.add(this.pollenPoints);

        for (let i = 0; i < this.maxPollen; i++) {
            this.pollenData.push({
                active: false,
                life: 0,
                maxLife: 2 + Math.random() * 3,
                vel: new THREE.Vector3(),
                drift: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * @param {number} deltaTime
     * @param {THREE.Vector3[]} terminalNodes - world positions of flower buds
     * @param {number} bloomProgress - 0–1 bloom factor
     */
    update(deltaTime, terminalNodes, bloomProgress) {
        this.time += deltaTime;
        const nodeCount = terminalNodes ? terminalNodes.length : 0;

        // ── Orbiting sparkles ──────────────────────────
        const sPos = this.sparklePoints.geometry.attributes.position.array;
        // How many sparkles to show, scaled by bloom and flower count
        const activeSparkles = Math.min(
            this.maxSparkles,
            Math.floor(nodeCount * 12 * bloomProgress)
        );

        this.sparkleMat.opacity = bloomProgress * 0.9;

        for (let i = 0; i < this.maxSparkles; i++) {
            if (i >= activeSparkles || nodeCount === 0) {
                sPos[i * 3] = 9999;
                sPos[i * 3 + 1] = 9999;
                sPos[i * 3 + 2] = 9999;
                continue;
            }

            const d = this.sparkleData[i];
            const nodeIdx = i % nodeCount;
            const center = terminalNodes[nodeIdx];

            d.angle += d.speed * deltaTime;

            // Orbit in a wobbly circle around the bud
            const r = d.radius * (0.8 + 0.2 * Math.sin(this.time * 2 + d.phase));
            sPos[i * 3]     = center.x + Math.cos(d.angle) * r;
            sPos[i * 3 + 1] = center.y + d.yOffset + Math.sin(this.time * 1.5 + d.phase) * 0.03;
            sPos[i * 3 + 2] = center.z + Math.sin(d.angle) * r;
        }
        this.sparklePoints.geometry.attributes.position.needsUpdate = true;

        // ── Drifting pollen ────────────────────────────
        const pPos = this.pollenPoints.geometry.attributes.position.array;
        this.pollenMat.opacity = bloomProgress * 0.7;

        // Emit new pollen when bloom is above 30%
        if (bloomProgress > 0.3 && nodeCount > 0 && Math.random() < bloomProgress * 0.6) {
            this._emitPollen(terminalNodes, pPos);
        }

        for (let i = 0; i < this.maxPollen; i++) {
            const p = this.pollenData[i];
            if (!p.active) {
                pPos[i * 3] = 9999;
                continue;
            }

            p.life += deltaTime;
            if (p.life > p.maxLife) {
                p.active = false;
                pPos[i * 3] = 9999;
                continue;
            }

            // Drift outward and upward
            pPos[i * 3]     += p.vel.x * deltaTime + Math.sin(this.time + p.drift) * deltaTime * 0.03;
            pPos[i * 3 + 1] += p.vel.y * deltaTime;
            pPos[i * 3 + 2] += p.vel.z * deltaTime + Math.cos(this.time + p.drift) * deltaTime * 0.03;
        }
        this.pollenPoints.geometry.attributes.position.needsUpdate = true;
    }

    _emitPollen(terminalNodes, pPos) {
        const idx = this.pollenData.findIndex(p => !p.active);
        if (idx === -1) return;

        const p = this.pollenData[idx];
        const origin = terminalNodes[Math.floor(Math.random() * terminalNodes.length)];

        p.active = true;
        p.life = 0;
        p.maxLife = 2 + Math.random() * 3;

        // Start at flower position with slight offset
        pPos[idx * 3]     = origin.x + (Math.random() - 0.5) * 0.1;
        pPos[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.1;
        pPos[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.1;

        // Drift outward
        p.vel.set(
            (Math.random() - 0.5) * 0.08,
            0.02 + Math.random() * 0.04,
            (Math.random() - 0.5) * 0.08
        );
        p.drift = Math.random() * Math.PI * 2;
    }
}

