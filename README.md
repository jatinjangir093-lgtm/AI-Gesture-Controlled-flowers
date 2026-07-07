# Magical Flower — Growing Love 🌸

An AI-powered, interactive web experience where you grow and bloom a magical digital flower using your hand gestures via webcam. A digital gift of love that uses MediaPipe hand tracking and Three.js 3D rendering to create a serene, magical experience.

## ✨ Features

- **Interactive Hand Tracking:** Uses Google MediaPipe to track your hands in real time.
- **Sequential Growth & Bloom:** 
  - **Right Hand:** Spread your thumb and index finger to grow the plant (Seed → Stem → Leaves → Branches → Buds).
  - **Left Hand:** Once fully grown, use your left hand to trigger the magical blooming sequence.
- **Magical Energy Strings:** Glowing, animated energy ropes attach perfectly to your fingertips to show tracking connection.
- **Beautiful Particle Effects:** Procedurally generated orbiting sparkles, drifting pollen, and blooming magical lights.
- **Responsive 3D Scene:** Powered by Three.js with custom glowing materials and realistic bloom lighting.

## 🚀 How to Run

You can run this project using any local web server. For example, using Node.js:

1. **Install `serve` globally (if you haven't already):**
   ```bash
   npm install -g serve
   ```
2. **Run the server from the project directory:**
   ```bash
   npx serve .
   ```
3. **Open in Browser:**
   Navigate to `http://localhost:3000` in your web browser. 
   *(Note: You must allow camera permissions when prompted).*

## 🎮 How to Play

1. Hold your **Right Hand** up to the camera.
2. Pinch and slowly pull your right **Thumb and Index finger** apart. The plant will grow as you spread your fingers.
3. Once the growth reaches **100%**, a *"Bloom Unlocked!"* badge will appear.
4. Hold your **Left Hand** up to the camera.
5. Pinch and slowly pull your left **Thumb and Index finger** apart to unleash the magical blooming effect.
6. Close your fingers at any time to reverse the growth/bloom smoothly.

## 🛠️ Built With
- **[Three.js](https://threejs.org/)** — For 3D WebGL rendering, lighting, and procedural plant generation.
- **[MediaPipe (Google)](https://mediapipe.dev/)** — For real-time, browser-based hand landmark tracking.
- **[Vanilla HTML/CSS/JS](https://developer.mozilla.org/)** — Zero heavy frontend frameworks, designed to be lightweight and fast.

## 📂 Project Structure

- `index.html` — The main entry point and UI overlay.
- `style.css` — Modern, responsive styling with glassmorphism and animations.
- `js/script.js` — The main application orchestrator and Three.js animation loop.
- `js/flower.js` — Procedural generation logic for the plant structure, growth, and blooming.
- `js/particles.js` — Custom particle systems (Sparkles, Pollen, Magical Energy Strings).
- `js/effects.js` — WebGL background handling, post-processing, and bloom effects.
- `js/handTracking.js` — Integration with the MediaPipe Hands API.
- `js/gesture.js` — Translates raw hand landmarks into smoothed growth/bloom values.
