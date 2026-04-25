function extractUrls(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s"'<>]+/g);
  return matches || [];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'EXTRACT_EMAIL') {
    return;
  }

  const bodyText = document.body?.innerText || '';
  const trimmed = bodyText.slice(0, 10000);

  sendResponse({
    content: trimmed,
    urls: extractUrls(trimmed)
  });
});
