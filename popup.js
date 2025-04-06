const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

const updateButtonUI = (isPlaying) => {
  if (isPlaying) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
  } else {
    stopBtn.style.display = 'none';
    startBtn.style.display = 'inline-block';
  }
};

chrome?.storage?.local?.get(['autoplayActive'], (result) => {
  updateButtonUI(result.autoplayActive === true);
});

startBtn.addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    await chrome.tabs.sendMessage(tabs[0].id, { action: 'runAutoPlay' });
    updateButtonUI(true);
  });
});

stopBtn.addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    await chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAutoPlay' });
    updateButtonUI(false);
    chrome?.storage?.local?.set({ autoplayActive: false });
  });
});
