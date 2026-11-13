// Página inicial: destaca a plataforma de quem visita e ajusta o botão de instalar a app.
// A instalação em si acontece dentro da app (app/?instalar=1), que é onde o manifest se aplica.
(() => {
  'use strict';

  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'android'
    : (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'ios'
    : /windows/i.test(ua) ? 'windows'
    : null;
  if (!platform) return;

  const labels = { android: 'Instalar no Android', ios: 'Instalar no iPhone', windows: 'Instalar no Windows' };
  document.getElementById('install-cta-label').textContent = labels[platform];
  document.querySelector(`.platform[data-platform="${platform}"]`)?.classList.add('is-current');
})();
