// Bayyin — install support.
//
// Registers the service worker (which is what makes the app installable and
// usable offline), catches Chrome/Android's `beforeinstallprompt`, and shows one
// small install card. On iOS, where no such event exists, it explains the
// Share → Add to Home Screen route instead.

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
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => {}))
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
    sub.textContent = 'Home screen par install karein — bina browser, tez aur offline.';
    text.append(title, sub);

    const install = document.createElement('button');
    install.type = 'button';
    install.className = 'btn primary small';
    install.textContent = 'Install';
    install.addEventListener('click', () => openInstall());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-close';
    close.setAttribute('aria-label', 'Band karein');
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
    title.textContent = 'App install karein';

    const steps = document.createElement('ol');
    const list = isIOS
      ? [
          'Safari me neeche Share button (□↑) dabaein.',
          'List me "Add to Home Screen" chunein.',
          'Naam "بيّن" rahega — "Add" dabaein.',
        ]
      : [
          'Browser menu (⋮) kholein.',
          '"Install app" ya "Add to Home screen" chunein.',
          'Home screen par بيّن ka icon aa jayega.',
        ];
    for (const step of list) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.appendChild(li);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn primary';
    close.textContent = 'Samajh gaya';
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
