(() => {
  const screens = {
    form: document.getElementById('screen-form'),
    sign: document.getElementById('screen-sign'),
    loading: document.getElementById('screen-loading'),
    qr: document.getElementById('screen-qr'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---------- Bước 1: form ----------
  const inpName = document.getElementById('inp-name');
  const inpPhone = document.getElementById('inp-phone');
  const inpAgency = document.getElementById('inp-agency');
  const formError = document.getElementById('form-error');

  document.getElementById('btn-to-sign').addEventListener('click', () => {
    formError.textContent = '';
    if (!inpName.value.trim() || !inpPhone.value.trim() || !inpAgency.value.trim()) {
      formError.textContent = 'Vui lòng điền đầy đủ thông tin.';
      return;
    }
    showScreen('sign');
    resizeCanvas();
  });

  // ---------- Bước 2: chữ ký ----------
  const canvas = document.getElementById('signature-canvas');
  const signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgba(0,0,0,0)', // nền trong suốt
    penColor: 'rgb(20,20,20)',
  });

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear();
  }
  window.addEventListener('resize', resizeCanvas);

  document.getElementById('btn-clear').addEventListener('click', () => signaturePad.clear());
  document.getElementById('btn-back').addEventListener('click', () => showScreen('form'));

  const signError = document.getElementById('sign-error');

  document.getElementById('btn-submit').addEventListener('click', async () => {
    signError.textContent = '';
    if (signaturePad.isEmpty()) {
      signError.textContent = 'Vui lòng ký tên trước khi hoàn tất.';
      return;
    }

    showScreen('loading');

    try {
      const signatureDataUrl = signaturePad.toDataURL('image/png');
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inpName.value.trim(),
          phone: inpPhone.value.trim(),
          agency: inpAgency.value.trim(),
          signature: signatureDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');

      document.getElementById('qr-image').src = data.qrDataUrl;
      showScreen('qr');
    } catch (err) {
      showScreen('sign');
      signError.textContent = err.message || 'Có lỗi xảy ra, vui lòng thử lại.';
    }
  });

  // ---------- Bước 4: xong, reset về màn hình đầu ----------
  document.getElementById('btn-done').addEventListener('click', resetKiosk);

  // Tự động reset sau 25s nếu khách không bấm "Xong" (tránh kẹt máy cho người tiếp theo)
  let autoResetTimer = null;
  function armAutoReset() {
    clearTimeout(autoResetTimer);
    autoResetTimer = setTimeout(resetKiosk, 25000);
  }
  const qrObserver = new MutationObserver(() => {
    if (screens.qr.classList.contains('active')) armAutoReset();
  });
  qrObserver.observe(screens.qr, { attributes: true, attributeFilter: ['class'] });

  function resetKiosk() {
    inpName.value = '';
    inpPhone.value = '';
    inpAgency.value = '';
    signaturePad.clear();
    formError.textContent = '';
    signError.textContent = '';
    showScreen('form');
  }

  showScreen('form');
})();
