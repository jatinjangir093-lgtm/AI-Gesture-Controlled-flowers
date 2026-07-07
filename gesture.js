/* ============================================
   GESTURE RECOGNITION MODULE
   Continuous distance-based control
   ============================================ */

export class GestureManager {
    constructor() {
        // ── Hand presence ───────────────────────────
        this.rightHandActive = false;
        this.leftHandActive  = false;

        // ── Continuous distances (0–1, clamped) ─────
        // 0 = fingers touching, 1 = fingers fully spread
        this.rightDistance = 0;
        this.leftDistance  = 0;

        // ── Smoothed output (what the rest of the app uses) ──
        this._smoothedRightDist = 0;
        this._smoothedLeftDist  = 0;

        // ── Raw landmark positions for elastic string ──
        this.rightThumbTip = null;  // { x, y, z } in normalized coords
        this.rightIndexTip = null;
        this.leftThumbTip  = null;
        this.leftIndexTip  = null;

        // ── Landmark smoothing ──────────────────────
        this._smoothedLandmarks = { left: null, right: null };
        this._landmarkSmoothing = 0.4;  // Higher = more responsive

        // ── Distance smoothing factor ───────────────
        // Controls how fast the output tracks the raw input.
        // 0.15 = very smooth, 0.5 = snappy
        this._distSmoothing = 0.25;

        // ── Calibration ─────────────────────────────
        // These define what normalized distance maps to 0 and 1.
        // Normalized distance = (thumb-index dist) / (wrist-middleBase dist)
        this._minDist = 0.08;  // fingers touching
        this._maxDist = 1.2;   // fingers spread wide
    }

    /**
     * Process parsed hand data each frame.
     * @param {Object} hands - { left, right } from HandTrackingManager.parseHands()
     */
    update(hands) {
        // ══════════════════════════════════════════════
        // RIGHT HAND — Growth
        // ══════════════════════════════════════════════
        this.rightHandActive = !!hands.right;

        if (hands.right) {
            const raw = hands.right.landmarks;
            // Store RAW fingertip positions for zero-lag elastic string
            this.rightThumbTip = { x: raw[4].x, y: raw[4].y, z: raw[4].z };
            this.rightIndexTip = { x: raw[8].x, y: raw[8].y, z: raw[8].z };
            
            const lm = this._smoothLandmarks('right', raw);
            const rawDist = this._getNormalizedDistance(lm);

            // Map to 0–1 range
            const mapped = this._mapToRange(rawDist);
            
            // Smooth
            this._smoothedRightDist += (mapped - this._smoothedRightDist) * this._distSmoothing;
            this.rightDistance = this._smoothedRightDist;
        } else {
            this._smoothedLandmarks.right = null;
            this.rightThumbTip = null;
            this.rightIndexTip = null;
            // Smoothly decay to 0 when hand is lost
            this._smoothedRightDist *= 0.92;
            this.rightDistance = this._smoothedRightDist;
        }

        // ══════════════════════════════════════════════
        // LEFT HAND — Bloom
        // ══════════════════════════════════════════════
        this.leftHandActive = !!hands.left;

        if (hands.left) {
            const raw = hands.left.landmarks;
            // Store RAW fingertip positions for zero-lag elastic string
            this.leftThumbTip = { x: raw[4].x, y: raw[4].y, z: raw[4].z };
            this.leftIndexTip = { x: raw[8].x, y: raw[8].y, z: raw[8].z };
            
            const lm = this._smoothLandmarks('left', raw);
            const rawDist = this._getNormalizedDistance(lm);

            // Map to 0–1 range
            const mapped = this._mapToRange(rawDist);

            // Smooth
            this._smoothedLeftDist += (mapped - this._smoothedLeftDist) * this._distSmoothing;
            this.leftDistance = this._smoothedLeftDist;
        } else {
            this._smoothedLandmarks.left = null;
            this.leftThumbTip = null;
            this.leftIndexTip = null;
            // Smoothly decay to 0 when hand is lost
            this._smoothedLeftDist *= 0.92;
            this.leftDistance = this._smoothedLeftDist;
        }
    }

    // ─────────────────────────────────────────────────
    // Landmark smoothing (exponential moving average)
    // ─────────────────────────────────────────────────
    _smoothLandmarks(hand, rawLandmarks) {
        if (!this._smoothedLandmarks[hand]) {
            this._smoothedLandmarks[hand] = rawLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));
            return this._smoothedLandmarks[hand];
        }

        const alpha = this._landmarkSmoothing;
        const sm    = this._smoothedLandmarks[hand];

        for (let i = 0; i < rawLandmarks.length; i++) {
            sm[i].x += (rawLandmarks[i].x - sm[i].x) * alpha;
            sm[i].y += (rawLandmarks[i].y - sm[i].y) * alpha;
            sm[i].z += (rawLandmarks[i].z - sm[i].z) * alpha;
        }
        return sm;
    }

    // ─────────────────────────────────────────────────
    // Distance between thumb tip (4) and index tip (8),
    // normalized by palm size (wrist→middle-base).
    // ─────────────────────────────────────────────────
    _getNormalizedDistance(landmarks) {
        const thumbTip   = landmarks[4];
        const indexTip   = landmarks[8];
        const wrist      = landmarks[0];
        const middleBase = landmarks[9];

        const pinchDist = Math.sqrt(
            (thumbTip.x - indexTip.x) ** 2 +
            (thumbTip.y - indexTip.y) ** 2 +
            (thumbTip.z - indexTip.z) ** 2
        );

        const palmSize = Math.sqrt(
            (wrist.x - middleBase.x) ** 2 +
            (wrist.y - middleBase.y) ** 2 +
            (wrist.z - middleBase.z) ** 2
        );

        return palmSize > 0.01 ? pinchDist / palmSize : 0;
    }

    // ─────────────────────────────────────────────────
    // Map raw normalized distance to 0–1 output range
    // ─────────────────────────────────────────────────
    _mapToRange(rawDist) {
        const t = (rawDist - this._minDist) / (this._maxDist - this._minDist);
        return Math.max(0, Math.min(1, t));
    }

    // ─────────────────────────────────────────────────
    // State snapshot for UI and rendering
    // ─────────────────────────────────────────────────
    getState() {
        return {
            // Hand presence
            rightHandActive: this.rightHandActive,
            leftHandActive:  this.leftHandActive,

            // Continuous 0–1 distance values
            rightDistance: this.rightDistance,
            leftDistance:  this.leftDistance,

            // Fingertip positions for elastic string visualization
            rightThumbTip: this.rightThumbTip,
            rightIndexTip: this.rightIndexTip,
            leftThumbTip:  this.leftThumbTip,
            leftIndexTip:  this.leftIndexTip
        };
    }
}
