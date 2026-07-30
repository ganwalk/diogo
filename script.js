(() => {
  const stage = document.getElementById("stage");
  const img = document.getElementById("diogo");
  const canvas = document.getElementById("splatCanvas");
  const ctx = canvas.getContext("2d");
  const popupLayer = document.getElementById("popupLayer");
  const hitsEl = document.getElementById("hits");
  const throwsEl = document.getElementById("throws");
  const accuracyEl = document.getElementById("accuracy");
  const resetBtn = document.getElementById("resetBtn");
  const soundBtn = document.getElementById("soundBtn");

  // Approximate face hit-zone as an ellipse, in fractions of the image size.
  const FACE = { cx: 0.5, cy: 0.46, rx: 0.19, ry: 0.29 };

  let hits = 0;
  let throwsCount = 0;
  let soundOn = true;
  let audioCtx = null;

  const splats = []; // stored as fractions so they redraw correctly on resize

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawSplats();
  }

  function redrawSplats() {
    const rect = stage.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const s of splats) {
      paintSplat(s, rect.width, rect.height);
    }
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function makeSplat(xFrac, yFrac) {
    const blobCount = Math.floor(rand(6, 10));
    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(0, 0.045);
      blobs.push({
        dxFrac: Math.cos(angle) * dist,
        dyFrac: Math.sin(angle) * dist,
        rFrac: rand(0.012, 0.045),
        alpha: rand(0.55, 0.9),
        dark: Math.random() < 0.35,
      });
    }
    const dripCount = Math.floor(rand(2, 5));
    const drips = [];
    for (let i = 0; i < dripCount; i++) {
      const angle = rand(Math.PI * 0.15, Math.PI * 0.85); // mostly downward
      drips.push({
        angle,
        length: rand(0.03, 0.09),
        widthFrac: rand(0.004, 0.01),
      });
    }
    return { xFrac, yFrac, blobs, drips, seedColor: rand(-8, 8) };
  }

  function paintSplat(s, w, h) {
    const scale = Math.min(w, h);
    const x = s.xFrac * w;
    const y = s.yFrac * h;

    for (const b of s.blobs) {
      const bx = x + b.dxFrac * scale;
      const by = y + b.dyFrac * scale;
      const r = b.rFrac * scale;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      const hue = b.dark ? 4 : 2;
      ctx.fillStyle = `hsla(${hue}, 78%, ${b.dark ? 28 : 42}%, ${b.alpha})`;
      ctx.fill();
    }

    for (const d of s.drips) {
      const ex = x + Math.cos(d.angle) * d.length * scale;
      const ey = y + Math.sin(d.angle) * d.length * scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.lineWidth = d.widthFrac * scale;
      ctx.strokeStyle = "hsla(3, 75%, 35%, 0.7)";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // small glossy seed highlight in the center
    ctx.beginPath();
    ctx.arc(x, y, scale * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = "hsla(4, 85%, 45%, 0.85)";
    ctx.fill();
  }

  function addSplat(xFrac, yFrac) {
    const s = makeSplat(xFrac, yFrac);
    splats.push(s);
    const rect = stage.getBoundingClientRect();
    paintSplat(s, rect.width, rect.height);
  }

  function isHit(xFrac, yFrac) {
    const nx = (xFrac - FACE.cx) / FACE.rx;
    const ny = (yFrac - FACE.cy) / FACE.ry;
    return nx * nx + ny * ny <= 1;
  }

  function showPopup(xFrac, yFrac, hit) {
    const rect = stage.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "popup " + (hit ? "hit" : "miss");
    const messages = hit
      ? ["ACERTOU! 🎯", "APANHADO! 🍅", "EM CHEIO! 💥", "BOOM! 🔥"]
      : ["quase...", "falhou!", "tenta outra vez"];
    el.textContent = messages[Math.floor(Math.random() * messages.length)];
    el.style.left = xFrac * rect.width + "px";
    el.style.top = yFrac * rect.height + "px";
    popupLayer.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function playSplatSound(hit) {
    if (!soundOn) return;
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;

    const bufferSize = ac.sampleRate * 0.18;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = hit ? 900 : 500;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(hit ? 0.5 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter).connect(gain).connect(ac.destination);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  function tomatoSVG() {
    return `
      <svg viewBox="0 0 40 40">
        <ellipse cx="20" cy="23" rx="15" ry="14" fill="#e0402a"/>
        <ellipse cx="15" cy="18" rx="5" ry="4" fill="#f2745e" opacity="0.7"/>
        <path d="M20 9 C17 4, 12 6, 12 10 C15 8, 17 9, 20 12 C23 9, 25 8, 28 10 C28 6, 23 4, 20 9 Z" fill="#3d8b3d"/>
      </svg>`;
  }

  function throwTomato(targetXFrac, targetYFrac) {
    const rect = stage.getBoundingClientRect();
    const startX = rect.width * 0.5;
    const startY = rect.height * 1.05;
    const endX = targetXFrac * rect.width;
    const endY = targetYFrac * rect.height;

    const el = document.createElement("div");
    el.className = "tomato";
    el.innerHTML = tomatoSVG();
    popupLayer.appendChild(el);

    const duration = 380;
    const startTime = performance.now();
    const spins = rand(1.5, 3) * (Math.random() < 0.5 ? -1 : 1) * 360;
    const arcHeight = rand(60, 120);

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = t; // linear horizontal/vertical base, arc via sine bump
      const x = startX + (endX - startX) * ease;
      const y = startY + (endY - startY) * ease - Math.sin(ease * Math.PI) * arcHeight;
      const rotation = spins * ease;
      const scale = 0.7 + 0.5 * Math.sin(ease * Math.PI * 0.5);
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.transform = `rotate(${rotation}deg) scale(${scale})`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.remove();
        landTomato(targetXFrac, targetYFrac);
      }
    }
    requestAnimationFrame(frame);
  }

  function landTomato(xFrac, yFrac) {
    const hit = isHit(xFrac, yFrac);
    addSplat(xFrac, yFrac);
    showPopup(xFrac, yFrac, hit);
    playSplatSound(hit);

    throwsCount++;
    if (hit) hits++;
    throwsEl.textContent = throwsCount;
    hitsEl.textContent = hits;
    accuracyEl.textContent = Math.round((hits / throwsCount) * 100) + "%";

    stage.classList.remove("shake");
    if (hit) {
      // small screen shake feedback
      stage.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: "translate(-4px, 2px)" },
          { transform: "translate(4px, -2px)" },
          { transform: "translate(0, 0)" },
        ],
        { duration: 200 }
      );
    }
  }

  function handleThrow(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const xFrac = (clientX - rect.left) / rect.width;
    const yFrac = (clientY - rect.top) / rect.height;
    if (xFrac < 0 || xFrac > 1 || yFrac < 0 || yFrac > 1) return;
    throwTomato(xFrac, yFrac);
  }

  stage.addEventListener("click", (e) => {
    handleThrow(e.clientX, e.clientY);
  });

  resetBtn.addEventListener("click", () => {
    splats.length = 0;
    hits = 0;
    throwsCount = 0;
    hitsEl.textContent = "0";
    throwsEl.textContent = "0";
    accuracyEl.textContent = "0%";
    redrawSplats();
    popupLayer.innerHTML = "";
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊 Som" : "🔇 Som";
    soundBtn.classList.toggle("muted", !soundOn);
    if (soundOn) ensureAudio();
  });

  window.addEventListener("resize", resizeCanvas);
  if (img.complete) {
    resizeCanvas();
  } else {
    img.addEventListener("load", resizeCanvas);
  }
})();
