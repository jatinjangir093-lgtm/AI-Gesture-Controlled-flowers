/* ============================================
   HAND TRACKING MODULE
   MediaPipe Tasks Vision — HandLandmarker
   ============================================ */

// NOTE: We use dynamic import() for MediaPipe so that:
// 1. A CDN failure doesn't kill the entire module graph silently
// 2. The rest of the app can start and show progress before the model loads
// 3. We can show user-friendly errors if the CDN is unavailable

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandTrackingManager {
    constructor() {
        this.handLandmarker = null;
        this.videoElement   = null;
        this.isRunning      = false;
        this.lastFrameTime  = -1;
        this.results        = null;
        this.onResultsCallback = null;
        this.stream         = null;
    }

    /**
     * Initialize MediaPipe HandLandmarker and start webcam
     * @param {HTMLVideoElement} videoElement
     * @param {Function} onStatusUpdate - callback(message, progress)
     */
    async initialize(videoElement, onStatusUpdate = () => {}) {
        this.videoElement = videoElement;

        // ── Step 1: Load MediaPipe via dynamic import ────────────────
        // Using dynamic import() instead of top-level static import.
        // A top-level CDN import failure kills the whole module graph
        // silently — dynamic import() throws a catchable error instead.
        onStatusUpdate("Loading AI vision library...", 20);

        let FilesetResolver, HandLandmarker;
        try {
            const mp = await import(MEDIAPIPE_CDN);
            FilesetResolver = mp.FilesetResolver;
            HandLandmarker  = mp.HandLandmarker;
        } catch (importErr) {
            throw new Error(
                "Failed to load MediaPipe library from CDN. " +
                "Check your internet connection. (" + importErr.message + ")"
            );
        }

        // ── Step 2: Load WASM runtime ────────────────────────────────
        onStatusUpdate("Loading AI vision model...", 35);

        let vision;
        try {
            vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        } catch (wasmErr) {
            throw new Error(
                "Failed to load MediaPipe WASM runtime. " +
                "Check your internet connection. (" + wasmErr.message + ")"
            );
        }

        // ── Step 3: Create HandLandmarker (GPU → CPU fallback) ───────
        onStatusUpdate("Initializing hand detection...", 55);

        const handOptions = {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence:  0.5,
            minTrackingConfidence:      0.5
        };

        try {
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, handOptions);
        } catch (gpuErr) {
            console.warn("[HandTracking] GPU delegate failed, retrying with CPU:", gpuErr.message);
            handOptions.baseOptions.delegate = "CPU";
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, handOptions);
        }

        // ── Step 4: Start webcam ─────────────────────────────────────
        onStatusUpdate("Requesting camera access...", 75);
        await this.startWebcam();

        onStatusUpdate("Camera ready!", 90);
    }

    /**
     * Request webcam access and start the video stream.
     * Throws an error if permission is denied.
     */
    async startWebcam() {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
        } catch (err) {
            console.error("[HandTracking] Camera access denied:", err);
            throw new Error(
                "Camera access denied. Please allow camera access in your browser and reload."
            );
        }

        this.stream = stream;
        this.videoElement.srcObject = stream;

        // Wait for the video to be ready, with a 10-second timeout
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("Webcam timed out — video did not start within 10 seconds."));
            }, 10000);

            const onReady = () => {
                clearTimeout(timer);
                const playPromise = this.videoElement.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => { this.isRunning = true; resolve(); })
                        .catch(e => {
                            console.warn("[HandTracking] Autoplay blocked:", e.message);
                            this.isRunning = true;
                            resolve();
                        });
                } else {
                    this.isRunning = true;
                    resolve();
                }
            };

            // If video data is already available (e.g., already loaded), resolve immediately
            if (this.videoElement.readyState >= 2) {
                onReady();
            } else {
                this.videoElement.addEventListener('loadedmetadata', onReady, { once: true });
            }
        });
    }

    /**
     * Detect hand landmarks in the current video frame.
     * Call this every animation frame.
     * @returns {Object|null} MediaPipe detection results
     */
    detect() {
        if (!this.isRunning || !this.handLandmarker || !this.videoElement) return null;
        if (this.videoElement.readyState < 2) return this.results;

        const currentTime = this.videoElement.currentTime;
        if (currentTime === this.lastFrameTime) return this.results;
        this.lastFrameTime = currentTime;

        try {
            this.results = this.handLandmarker.detectForVideo(
                this.videoElement,
                performance.now()
            );
        } catch (e) {
            // Ignore per-frame detection errors (e.g., video frame not ready)
        }

        if (this.onResultsCallback && this.results) {
            this.onResultsCallback(this.results);
        }

        return this.results;
    }

    /**
     * Parse raw MediaPipe results into { left, right } hand objects.
     * Accounts for video mirroring (left/right are flipped from camera POV).
     */
    parseHands(results) {
        const hands = { left: null, right: null };
        if (!results?.landmarks?.length) return hands;

        for (let i = 0; i < results.landmarks.length; i++) {
            const handedness = results.handednesses[i];
            if (!handedness?.length) continue;

            // Camera sees "Left" where the user's right hand is (mirror effect)
            const label    = handedness[0].categoryName;
            const userHand = label === "Left" ? "right" : "left";

            hands[userHand] = {
                landmarks:  results.landmarks[i],
                confidence: handedness[0].score
            };
        }

        return hands;
    }

    /** Get video dimensions */
    getVideoDimensions() {
        return { width: this.videoElement.videoWidth, height: this.videoElement.videoHeight };
    }

    /** Release all resources */
    destroy() {
        this.isRunning = false;
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    }
}
