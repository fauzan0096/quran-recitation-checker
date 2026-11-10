// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin — install support.
//
// Registers the service worker (which is what makes the app installable and
// usable offline), catches Chrome/Android's `beforeinstallprompt`, and shows one
// small install card. On iOS, where no such event exists, it explains the
// Share → Add to Home Screen route instead.

import { t } from './i18n.js';

(function () {
  const DISMISS_KEY = 'bayyin.installDismissed';
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  let deferredPrompt = null;
  let card = null;

  if ('serviceWorker' in navigator) {
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only reload when this page was already controlled by an older worker.
      if (!hadController || refreshing) return;
      refreshing = true;

      const reload = () => window.location.reload();
      // Never cut a recording or a model download in half.
      if (document.body.dataset.busy === '1') {
        window.bayyinReloadPending = reload;
        return;
      }
      reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js', { updateViaCache: 'none' })
        .then(async (registration) => {
          registration.update().catch(() => {});
          // Background Sync: ek dafa offline hone par bhi shell cache taza ho jaye.
          try {
            const ready = await navigator.serviceWorker.ready;
            if (ready.sync) await ready.sync.register('bayyin-sync');
            // Periodic Background Sync: roz ek dafa chupke se app ka code taza karna.
            if (ready.periodicSync && navigator.permissions) {
              const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
              if (status.state === 'granted') {
                await ready.periodicSync.register('bayyin-daily', { minInterval: 24 * 60 * 60 * 1000 });
              }
            }
          } catch (error) {
            /* not supported on this browser */
          }
        })
        .catch((error) => {
          console.warn('service worker register failed', error);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showCard();
  });

  window.addEventListener('appinstalled', () => {
    hideCard();
    dismiss();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('install-app');
    if (button) {
      button.addEventListener('click', () => openInstall());
      if (isStandalone()) {
        const cardEl = document.getElementById('install-card');
        if (cardEl) cardEl.hidden = true;
      }
    }
    window.setTimeout(() => {
      if (!isStandalone() && !wasDismissed()) showCard();
    }, 2500);
  });

  function wasDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (error) {
      /* private mode */
    }
  }

  function showCard() {
    if (isStandalone() || wasDismissed()) return;
    if (!deferredPrompt && !isIOS) return; // nothing we can offer on this browser
    if (card) return;

    card = document.createElement('div');
    card.className = 'install-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Install Bayyin');

    const icon = document.createElement('img');
    icon.src = 'icon-192.png';
    icon.alt = '';
    icon.className = 'install-icon';

    const text = document.createElement('div');
    text.className = 'install-text';
    const title = document.createElement('strong');
    title.lang = 'ar';
    title.dir = 'rtl';
    title.textContent = 'بيّن';
    const sub = document.createElement('span');
    sub.textContent = t('install.card.sub');
    text.append(title, sub);

    const install = document.createElement('button');
    install.type = 'button';
    install.className = 'btn primary small';
    install.textContent = t('install.card.button');
    install.addEventListener('click', () => openInstall());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-close';
    close.setAttribute('aria-label', t('install.close'));
    close.textContent = '×';
    close.addEventListener('click', () => {
      hideCard();
      dismiss();
    });

    card.append(icon, text, install, close);
    document.body.appendChild(card);
  }

  function hideCard() {
    if (card) {
      card.remove();
      card = null;
    }
  }

  async function openInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (error) {
        console.warn('install prompt failed', error);
      }
      deferredPrompt = null;
      hideCard();
      return;
    }
    showGuide();
  }

  function showGuide() {
    const overlay = document.createElement('div');
    overlay.className = 'install-overlay';
    overlay.setAttribute('role', 'dialog');

    const box = document.createElement('div');
    box.className = 'install-guide';

    const title = document.createElement('h3');
    title.textContent = t('install.heading');

    const steps = document.createElement('ol');
    const list = isIOS
      ? [t('install.ios.1'), t('install.ios.2'), t('install.ios.3')]
      : [t('install.and.1'), t('install.and.2'), t('install.and.3')];
    for (const step of list) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.appendChild(li);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn primary';
    close.textContent = t('install.ok');
    close.addEventListener('click', () => overlay.remove());

    box.append(title, steps, close);
    overlay.appendChild(box);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  // Lets other UI (settings) trigger the same flow.
  window.bayyinInstall = openInstall;
})();
