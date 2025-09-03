/***** Camera background *****/
async function startCameraBackground() {
  const video = document.getElementById('camera-bg');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (e1) {
    console.warn('env camera failed, fallback', e1);
    try {
      const stream2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream2;
      await video.play();
    } catch (e2) {
      console.error('camera fail', e2);
      alert('Please allow camera access.');
    }
  }
}
function stopCameraBackground() {
  const video = document.getElementById('camera-bg');
  const s = video?.srcObject;
  if (s && s.getTracks) s.getTracks().forEach(t => t.stop());
}

/***** THREE helpers *****/
function waitForModel(el) {
  return new Promise(res => {
    if (el.getObject3D('mesh')) return res();
    el.addEventListener('model-loaded', () => res(), { once: true });
  });
}
function playOnceFreeze(el, speed = 0.5) {
  return new Promise(resolve => {
    const mesh = el.getObject3D('mesh');
    const clips = mesh?.animations;
    const mixer = el.components?.['animation-mixer']?.mixer;
    if (!clips?.length || !mixer) return resolve(0);
    const clip = clips[0];
    const action = mixer.clipAction(clip);
    action.reset(); action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.setEffectiveTimeScale(speed);
    action.play();
    const ms = (clip.duration / speed) * 1000;
    setTimeout(() => resolve(ms), ms + 50);
  });
}
function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(ch => {
    if (ch.isMesh) {
      ch.geometry?.dispose();
      const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(m => {
        for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose?.();
      });
    }
  });
}
function removeAndDispose(el) {
  if (!el) return;
  try { el.components?.['animation-mixer']?.mixer?.stopAllAction(); } catch {}
  disposeObject3D(el.getObject3D('mesh'));
  el.parentNode?.removeChild(el);
}

/***** UI helpers *****/
const showFlex = (...els) => els.forEach(el => el && (el.style.display = 'flex'));
const showBlock = (...els) => els.forEach(el => el && (el.style.display = 'block'));
const hideUI = (...els) => els.forEach(el => el && (el.style.display = 'none'));
const showEntity = (...els) => els.forEach(el => el && el.setAttribute('visible', true));
const hideEntity = (...els) => els.forEach(el => el && el.setAttribute('visible', false));

/***** Exit helpers *****/
function exitApp() {
  stopCameraBackground();
  try { window.close(); } catch {}
  try { open('', '_self')?.close(); } catch {}
  try { location.replace('about:blank'); return; } catch {}
  document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font:16px system-ui;background:#000;color:#fff">You can now close this tab.</div>';
}

/***** Main component *****/
AFRAME.registerComponent('click-to-start-animation', {
  init: function () {
    // UI
    const overlay       = document.getElementById('overlay');
    const question      = document.getElementById('question');
    const overlay2      = document.getElementById('overlay2');
    const noteWetFloor  = document.getElementById('note-wetfloor');

    const btnClear1     = document.getElementById('clear-button');
    const btnClear2     = document.getElementById('clear-button-2');
    const btnAddSign    = document.getElementById('add-sign-button');

    // Models
    let workerTripping     = document.getElementById('workerTripping');
    let workerSafe         = document.getElementById('workerSafe');
    let workerWalkingSafe  = document.getElementById('workerWalkingSafe');
    let workerSlipping     = document.getElementById('workerSlipping');
    let workerSlipping2    = document.getElementById('workerSlipping2');
    let workerSafeSign     = document.getElementById('workerSafeSign');
    let pallet             = document.getElementById('palletModel');

    // State
    let busy = false;
    let scene2AwaitTap = false;
    let questionOpen = false;

    // Safety: ensure buttons/overlays start hidden except start overlay
    hideUI(question, overlay2, noteWetFloor, btnClear1, btnClear2, btnAddSign);
    showFlex(overlay);

    /********* START *********/
    const onStartTap = async (ev) => {
      ev.stopPropagation();
      if (busy) return; busy = true;

      overlay.style.display = 'none';
      await startCameraBackground();

      // Phase 1: play Tripping, freeze
      hideEntity(workerSafe, workerWalkingSafe, workerSlipping, workerSlipping2, workerSafeSign, pallet);
      await waitForModel(workerTripping);
      showEntity(workerTripping);
      await playOnceFreeze(workerTripping, 0.5);

      // Show question
      questionOpen = true;
      showFlex(question);
      busy = false;
    };
    overlay.addEventListener('click', onStartTap, { once: true });
    overlay.addEventListener('touchend', onStartTap, { once: true });

    /********* PHASE 1: question → show Safe + Pallet + Clear *********/
    const onQuestionTap = (ev) => {
      ev.stopPropagation();
      if (!questionOpen || busy) return;
      questionOpen = false;
      question.style.display = 'none';

      // Remove Tripping
      if (workerTripping) { removeAndDispose(workerTripping); workerTripping = null; }

      // Show pallet + safe + button
      showEntity(pallet, workerSafe);
      showBlock(btnClear1);
    };
    question.addEventListener('click', onQuestionTap);
    question.addEventListener('touchend', onQuestionTap);

    /********* PHASE 1: Clear Path → WalkingSafe → Scene2 overlay *********/
    const onClear1 = async (ev) => {
      ev.stopPropagation();
      if (busy) return; busy = true;

      btnClear1.style.display = 'none';

      // Remove pallet + safe
      if (pallet) { removeAndDispose(pallet); pallet = null; }
      if (workerSafe) { removeAndDispose(workerSafe); workerSafe = null; }

      // Play WalkingSafe, freeze
      await waitForModel(workerWalkingSafe);
      showEntity(workerWalkingSafe);
      await playOnceFreeze(workerWalkingSafe, 0.5);

      // Show Scene 2 overlay
      scene2AwaitTap = true;
      showFlex(overlay2);
      busy = false;
    };
    btnClear1.addEventListener('click', onClear1);
    btnClear1.addEventListener('touchend', onClear1);

    /********* PHASE 2: overlay tap → Slipping *********/
    const onOverlay2Tap = async (ev) => {
      ev.stopPropagation();
      if (!scene2AwaitTap || busy) return; busy = true;
      scene2AwaitTap = false;

      overlay2.style.display = 'none';

      // Remove WalkingSafe
      if (workerWalkingSafe) { removeAndDispose(workerWalkingSafe); workerWalkingSafe = null; }

      // Play Slipping, then show Clear 2
      await waitForModel(workerSlipping);
      showEntity(workerSlipping);
      await playOnceFreeze(workerSlipping, 0.5);

      showBlock(btnClear2);
      busy = false;
    };
    overlay2.addEventListener('click', onOverlay2Tap);
    overlay2.addEventListener('touchend', onOverlay2Tap);

    /********* PHASE 2: Clear 2 → Slipping2 → note overlay *********/
    const onClear2 = async (ev) => {
      ev.stopPropagation();
      if (busy) return; busy = true;

      btnClear2.style.display = 'none';

      // Remove Slipping
      if (workerSlipping) { removeAndDispose(workerSlipping); workerSlipping = null; }

      // Play Slipping2, freeze
      await waitForModel(workerSlipping2);
      showEntity(workerSlipping2);
      await playOnceFreeze(workerSlipping2, 0.5);

      // Note overlay → tap to show Add Sign
      showFlex(noteWetFloor);
      const closeNote = (e2) => {
        e2.stopPropagation?.();
        noteWetFloor.style.display = 'none';
        showBlock(btnAddSign);
        noteWetFloor.removeEventListener('click', closeNote);
        noteWetFloor.removeEventListener('touchend', closeNote);
        busy = false;
      };
      noteWetFloor.addEventListener('click', closeNote, { once: true });
      noteWetFloor.addEventListener('touchend', closeNote, { once: true });
    };
    btnClear2.addEventListener('click', onClear2);
    btnClear2.addEventListener('touchend', onClear2);

    /********* FINAL: Add Sign → SafeSign → wait 2s → exit *********/
    const onAddSign = async (ev) => {
      ev.stopPropagation();
      if (busy) return; busy = true;

      btnAddSign.style.display = 'none';

      // Remove Slipping2
      if (workerSlipping2) { removeAndDispose(workerSlipping2); workerSlipping2 = null; }

      // Play SafeSign
      await waitForModel(workerSafeSign);
      showEntity(workerSafeSign);
      await playOnceFreeze(workerSafeSign, 1.0);

      setTimeout(exitApp, 2000);
    };
    btnAddSign.addEventListener('click', onAddSign);
    btnAddSign.addEventListener('touchend', onAddSign);
  }
});
