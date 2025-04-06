chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'stopAutoPlay') {
    stopAutoPlay();
    sendResponse({ status: 'stopped' });
  }

  if (message.action === 'runAutoPlay') {
    runAutoPlay();
    sendResponse({ status: 'started' });
  }
});

window.addEventListener('load', () =>
  chrome?.storage?.local?.set?.({ autoplayActive: false })
);

if (typeof window.userStopped === 'undefined') window.userStopped = false;

const shouldStop = (initialUrl) => {
  const newUrl = new URL(location.href);
  if (newUrl.pathname !== initialUrl.pathname) return true;

  const initialParams = new URLSearchParams(initialUrl.search);
  const newParams = new URLSearchParams(newUrl.search);

  for (const [key, value] of newParams.entries())
    if (initialParams.get(key) !== value) return true;

  return false;
};

const onUrlChange = async (event) => {
  if (window.userStopped) return;

  const initialUrl = new URL(location.href);
  await new Promise((res) => setTimeout(res, 1));

  if (shouldStop(initialUrl)) {
    // console.log('🟡 [BeatHub] URL changed, stopping playback...');
    window.userStopped = true;
    chrome?.storage?.local?.set?.({ autoplayActive: false });
    console.log('🛑 [BeatHub] AutoPlay stopped');
  }
};

navigation.addEventListener('navigate', onUrlChange);

const stopAutoPlay = () => {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  // console.log('🟥 STOP button clicked from popup');

  const rows = document.querySelectorAll('.asset-list-row');

  for (const row of rows) {
    const playCell = row.querySelector('.type-cell');
    const iconUse = playCell?.querySelector('use');

    if (iconUse?.getAttribute('xlink:href') === '#icon-stop-solid') {
      const stopButton = iconUse.closest('button');

      if (stopButton) {
        stopButton.click();
        // console.log('⏹️ [BeatHub] Playback stopped immediately');
        break;
      }
    }
  }
};

const runAutoPlay = async () => {
  console.log('▶️ [BeatHub] AutoPlay Started');

  let hasNextPage = true;
  window.userStopped = false; // reset on each run

  const stopButtons = document.querySelectorAll('button[aria-label="play"]');
  const stopIcon = document.querySelector('#icon-stop-solid');

  const handleStop = () => {
    window.userStopped = true;
    chrome?.storage?.local?.set?.({ autoplayActive: false });
    // console.log('❌ [BeatHub] User manually stopped the autoplay');
  };

  if (stopIcon) stopIcon.addEventListener('click', handleStop);
  for (const stopButton of stopButtons)
    if (stopButton) stopButton.addEventListener('click', handleStop);

  const currentPlayingName = document
    .querySelector('.cell--track-details--filename')
    ?.textContent.trim();
  let skipUntilFound = false;

  while (hasNextPage && !window.userStopped) {
    const rows = document.querySelectorAll('.asset-list-row');

    if (!skipUntilFound && currentPlayingName) {
      skipUntilFound = Array.from(rows).some(
        (row) =>
          row.querySelector('h6.filename')?.textContent.trim() ===
          currentPlayingName
      );
    }

    for (let i = 0; i < rows.length; i++) {
      if (window.userStopped) break;

      const row = rows[i];

      if (skipUntilFound) {
        const filename = row.querySelector('h6.filename')?.textContent.trim();
        if (filename === currentPlayingName) {
          skipUntilFound = false;
          continue;
        } else {
          continue;
        }
      }

      const playCell = row.querySelector('.type-cell');
      if (!playCell) continue;

      const icon = playCell.querySelector('use');
      if (!icon) continue;

      playCell.click();
      chrome?.storage?.local?.set?.({ autoplayActive: true });

      const started = await waitForIconChange(
        playCell,
        '#icon-stop-solid',
        3000
      );
      if (!started) continue;

      await waitForIconChange(playCell, '#icon-play-solid', 60000);
    }

    if (window.userStopped) break;

    const nextBtn = document.querySelector('button.next');
    if (nextBtn && !nextBtn.disabled) {
      console.log('➡️ [BeatHub] Going to next page...');
      nextBtn.click();
      await new Promise((res) => setTimeout(res, 3000));
    } else {
      console.log('✅ [BeatHub] No next page.');
      hasNextPage = false;
    }
  }

  if (stopIcon) stopIcon.removeEventListener('click', handleStop);
  for (const stopButton of stopButtons)
    if (stopButton) stopButton.addEventListener('click', handleStop);

  chrome?.storage?.local?.set?.({ autoplayActive: false });
  console.log('🛑 [BeatHub] AutoPlay stopped');
};

const waitForIconChange = async (container, targetHref, timeout = 10000) => {
  const start = Date.now();

  while (true) {
    const icon = container.querySelector('use');
    const currentHref = icon?.getAttribute('xlink:href');
    if (currentHref === targetHref) return true;

    if (Date.now() - start > timeout) return false;
    await new Promise((res) => setTimeout(res, 250));
  }
};
