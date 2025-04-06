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

  const filtered = (url) => {
    const p = new URLSearchParams(url.search);
    p.delete('page');
    return p.toString();
  };

  return filtered(newUrl) !== filtered(initialUrl);
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
};

const runAutoPlay = async () => {
  console.log('▶️ [BeatHub] AutoPlay Started');

  let hasNextPage = true;
  window.userStopped = false; // reset on each run

  const stopButtons = document.querySelectorAll('button[aria-label="play"]');
  const stopIcon = document.querySelector('#icon-stop-solid');

  if (stopIcon) stopIcon.addEventListener('click', handleStop);
  for (const stopButton of stopButtons)
    if (stopButton) stopButton.addEventListener('click', handleStop);

  const currentPlayingName = getCurrentPlayingName();
  let skipUntilFound = false;

  while (hasNextPage && !window.userStopped) {
    let rows = document.querySelectorAll('.asset-list-row');
    if (rows.length === 0) rows = document.querySelectorAll('.asset-row-wrap'); // logged out case

    if (!skipUntilFound && currentPlayingName)
      skipUntilFound = getSkipUntilFound(rows, currentPlayingName);

    for (let i = 0; i < rows.length; i++) {
      if (window.userStopped) break;

      const row = rows[i];

      if (skipUntilFound) {
        const filename = row.querySelector('.filename')?.textContent.trim();
        if (filename === currentPlayingName) {
          skipUntilFound = false;
          continue;
        } else {
          continue;
        }
      }

      let play = row.querySelector('.type-cell');
      if (!play) play = row.querySelector('.cell--playback'); // logged out case
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

const handleStop = () => {
  window.userStopped = true;
  chrome?.storage?.local?.set?.({ autoplayActive: false });
  // console.log('❌ [BeatHub] User manually stopped the autoplay');
};

const getCurrentPlayingName = () => {
  // logged in case
  let element = document.querySelector('.cell--track-details--filename');
  if (element) return element.textContent.trim();

  // logged out case
  return document.querySelector('.track-details--filename')?.textContent.trim();
};

const getNextBtn = () => {
  // logged in case
  const element = document.querySelector('button.next');
  if (element) return element;

  // Logged out case
  const iconUse = document.querySelector('use[href="#icon-arrow-right"]');
  if (iconUse) return iconUse.closest('a');
};

const getSkipUntilFound = (rows, currentPlayingName) =>
  Array.from(rows).some(
    (row) =>
      row.querySelector('.filename')?.textContent.trim() === currentPlayingName
  );
