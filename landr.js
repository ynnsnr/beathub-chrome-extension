console.log('[BeatHub] content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'stopAutoPlay') {
    stopAutoPlay();
    sendResponse({ status: 'stopped' });
  }

  if (message.action === 'runAutoPlay') {
    runAutoPlay();
    sendResponse({ status: 'started' });
  }

  return true;
});

window.addEventListener('load', () =>
  chrome?.storage?.local?.set?.({ autoplayActive: false })
);

if (typeof window.userStopped === 'undefined') window.userStopped = false;
if (typeof window.currentPlayingName === 'undefined')
  window.currentPlayingName = '';

function shouldStop(initialUrl) {
  const newUrl = new URL(location.href);
  if (newUrl.pathname !== initialUrl.pathname) return true;

  const filtered = (url) => {
    const p = new URLSearchParams(url.search);
    p.delete('page');
    return p.toString();
  };

  return filtered(newUrl) !== filtered(initialUrl);
}

async function onUrlChange(event) {
  if (window.userStopped) return;

  const initialUrl = new URL(location.href);
  await new Promise((res) => setTimeout(res, 1));

  if (shouldStop(initialUrl)) {
    // console.log('🟡 [BeatHub] URL changed, stopping playback...');
    window.userStopped = true;
    chrome?.storage?.local?.set?.({ autoplayActive: false });
    console.log('🛑 [BeatHub] AutoPlay stopped');
  }
}

if (navigation) navigation.addEventListener('navigate', onUrlChange);

document.addEventListener(
  'click',
  (event) => {
    const target = event.target.closest('button[aria-label="Play"]');
    if (!target || !event.isTrusted) return;

    const filename = target
      .closest('.Table__row')
      ?.querySelector('.Truncate')
      ?.textContent.trim();

    if (filename) window.currentPlayingName = filename;
    if (!window.userStopped) handleStop();
  },
  true
);

document.addEventListener(
  'click',
  (event) => {
    const target = event.target.closest('button[aria-label="Pause"]');
    if (!target || !event.isTrusted) return;

    handleStop();
  },
  true
);

function stopAutoPlay() {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  // console.log('🟥 STOP button clicked from popup');

  let rows = document.querySelectorAll('.Table__row');

  for (const row of rows) {
    const button = row.querySelector('button');
    const ariaLabel = button?.getAttribute('aria-label');

    if (button && ariaLabel === 'Pause') {
      button.click();
      // console.log('⏹️ [BeatHub] Playback stopped immediately');
      break;
    }
  }
}

async function runAutoPlay() {
  console.log('▶️ [BeatHub] AutoPlay started');
  window.userStopped = false; // reset on each run
  let hasNextPage = true;
  let skipUntilFound = false;

  // const stopButtons = document.querySelectorAll('button[aria-label="Play"]');
  // for (const stopButton of stopButtons)
  //   if (stopButton) stopButton.addEventListener('click', handleStop, true)

  while (hasNextPage && !window.userStopped) {
    let rows = document.querySelectorAll('.Table__row');

    if (!skipUntilFound && window.currentPlayingName)
      skipUntilFound = getSkipUntilFound(rows, window.currentPlayingName);

    for (let i = 0; i < rows.length; i++) {
      if (window.userStopped) break;

      const filename = rows[i].querySelector('.Truncate')?.textContent.trim();

      if (skipUntilFound) {
        if (filename === window.currentPlayingName) {
          skipUntilFound = false;
          continue;
        } else {
          continue;
        }
      }

      const button = rows[i].querySelector('button');
      if (!button) continue;

      button.click();
      window.currentPlayingName = filename;
      chrome?.storage?.local?.set?.({ autoplayActive: true });

      const started = await waitForIconChange(button, 'Pause', 3000);
      if (!started) continue;

      await waitForIconChange(button, 'Play', 60000);
    }

    if (window.userStopped) break;

    const nextBtn = getNextBtn();

    if (nextBtn && !nextBtn.disabled) {
      console.log('➡️ [BeatHub] Going to next page...');
      nextBtn.click();
      await new Promise((res) => setTimeout(res, 4000));
    } else {
      console.log('✅ [BeatHub] No next page.');
      hasNextPage = false;
    }
  }

  // for (const stopButton of stopButtons)
  //   if (stopButton) stopButton.removeEventListener('click', handleStop);

  chrome?.storage?.local?.set?.({ autoplayActive: false });
  console.log('🛑 [BeatHub] AutoPlay stopped');
}

function handleStop() {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  console.log('❌ [BeatHub] User manually stopped the autoplay');
}

function getNextBtn() {
  const selector = document.querySelector('.Pagination');
  if (!selector) return null;

  const element = Array.from(selector.querySelectorAll('a')).pop();
  if (element) return element;
}

async function waitForIconChange(element, targetAriaLabel, timeout) {
  const start = Date.now();

  while (true) {
    if (window.userStopped) return false;

    const currentAriaLabel = element.getAttribute('aria-label');
    if (currentAriaLabel === targetAriaLabel) return true;

    if (Date.now() - start > timeout) return false;
    await new Promise((res) => setTimeout(res, 250));
  }
}

function getSkipUntilFound(rows, currentPlayingName) {
  return Array.from(rows).some(
    (row) =>
      row.querySelector('.Truncate')?.textContent.trim() === currentPlayingName
  );
}
