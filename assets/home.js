// Página inicial: instala a app do Baldio daqui mesmo, como no openquadro.
//   - manifest.json (na raiz) aponta para app/ — o Chrome e o Edge oferecem a instalação nesta página
//   - regista o service worker da app: ao instalar, a app já fica guardada para abrir sem rede
//   - Android e Windows: o botão abre o pedido de instalação do browser
//   - iPhone (e browsers sem pedido): o botão leva à app, que mostra os passos (app/?instalar=1)
(() => {
  'use strict';

  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'android'
    : (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'ios'
    : /windows/i.test(ua) ? 'windows'
    : null;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const cta = document.getElementById('install-cta');
  const label = document.getElementById('install-cta-label');
  const labels = { android: 'Instalar no Android', ios: 'Instalar no iPhone', windows: 'Instalar no Windows' };
  if (platform) {
    label.textContent = labels[platform];
    document.querySelector(`.platform[data-platform="${platform}"]`)?.classList.add('is-current');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('app/sw.js', { scope: 'app/' }).catch(() => { /* a app regista-o outra vez ao abrir */ });
    });
  }

  let installEvent = null;
  const installed = () => {
    installEvent = null;
    label.textContent = 'App instalada — abrir';
    cta.href = 'app/';
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
  });
  window.addEventListener('appinstalled', installed);

  cta.addEventListener('click', async (e) => {
    if (!installEvent || standalone) return; // segue a ligação para app/?instalar=1
    e.preventDefault();
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') installed();
    else installEvent = null;
  });
})();
