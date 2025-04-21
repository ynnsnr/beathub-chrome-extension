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

async function stopAutoPlay() {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  // console.log('🟥 STOP button clicked from popup');

  let rows = document.querySelectorAll('.asset-list-row');
  if (rows.length === 0) rows = document.querySelectorAll('.asset-row-wrap'); // logged out case

  for (const row of rows) {
    let play = row.querySelector('.type-cell');
    if (!play) play = row.querySelector('.cell--playback'); // logged out case
    const iconUse = play?.querySelector('use');

    if (iconUse?.getAttribute('xlink:href') === '#icon-stop-solid') {
      const stopButton = iconUse.closest('button');

      if (stopButton) {
        stopButton.click();
        // console.log('⏹️ [BeatHub] Playback stopped immediately');
        break;
      }
    }
  }
}

async function runAutoPlay() {
  console.log('▶️ [BeatHub] AutoPlay started');
  window.userStopped = false; // reset on each run
  let hasNextPage = true;
  let skipUntilFound = false;

  const stopButtons = document.querySelectorAll('button[aria-label="play"]');
  const stopIcon = document.querySelector('#icon-stop-solid');

  if (stopIcon) stopIcon.addEventListener('click', handleStop);
  for (const stopButton of stopButtons)
    if (stopButton) stopButton.addEventListener('click', handleStop);

  const currentPlayingName = getCurrentPlayingName();

  while (hasNextPage && !window.userStopped) {
    let rows = document.querySelectorAll('.asset-list-row');
    if (rows.length === 0) rows = document.querySelectorAll('.asset-row-wrap'); // logged out case

    if (!skipUntilFound && currentPlayingName)
      skipUntilFound = getSkipUntilFound(rows, currentPlayingName);

    for (let i = 0; i < rows.length; i++) {
      if (window.userStopped) break;

      if (skipUntilFound) {
        const filename = rows[i].querySelector('.filename')?.textContent.trim();
        if (filename === currentPlayingName) {
          skipUntilFound = false;
          continue;
        } else {
          continue;
        }
      }

      let play = rows[i].querySelector('.type-cell');
      if (!play) play = rows[i].querySelector('.cell--playback'); // logged out case
      if (!play) continue;

      const icon = play.querySelector('use');
      if (!icon) continue;

      play.click();
      chrome?.storage?.local?.set?.({ autoplayActive: true });

      const started = await waitForIconChange(play, '#icon-stop-solid', 3000);
      if (!started) continue;

      await waitForIconChange(play, '#icon-play-solid', 60000);
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

  if (stopIcon) stopIcon.removeEventListener('click', handleStop);
  for (const stopButton of stopButtons)
    if (stopButton) stopButton.removeEventListener('click', handleStop);

  chrome?.storage?.local?.set?.({ autoplayActive: false });
  console.log('🛑 [BeatHub] AutoPlay stopped');
}

async function waitForIconChange(container, targetHref, timeout) {
  const start = Date.now();

  while (true) {
    if (window.userStopped) return false;

    const icon = container.querySelector('.play-controls')
      ? container.querySelector('.play-controls').querySelector('use') // logged out case
      : container.querySelector('use');

    const currentHref =
      icon?.getAttribute('xlink:href') || icon?.getAttribute('href'); // logged out case

    if (currentHref === targetHref) return true;

    if (Date.now() - start > timeout) return false;
    await new Promise((res) => setTimeout(res, 250));
  }
}

function handleStop() {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  console.log('❌ [BeatHub] User manually stopped the autoplay');
}

function getCurrentPlayingName() {
  // logged in case
  let element = document.querySelector('.cell--track-details--filename');
  if (element) return element.textContent.trim();

  // logged out case
  return document.querySelector('.track-details--filename')?.textContent.trim();
}

function getNextBtn() {
  // logged in case
  const element = document.querySelector('button.next');
  if (element) return element;

  // Logged out case
  const iconUse = document.querySelector('use[href="#icon-arrow-right"]');
  if (iconUse) return iconUse.closest('a');
}

function getSkipUntilFound(rows, currentPlayingName) {
  return Array.from(rows).some(
    (row) =>
      row.querySelector('.filename')?.textContent.trim() === currentPlayingName
  );
}
