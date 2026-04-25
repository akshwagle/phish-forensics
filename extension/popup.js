const result = document.getElementById('result');

document.getElementById('scanBtn').addEventListener('click', async () => {
  result.textContent = 'Collecting email...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_EMAIL' });

  if (!response || !response.content) {
    result.textContent = 'No email content detected.';
    return;
  }

  result.textContent = 'Analyzing...';

  try {
    const apiRes = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: response.content, urls: response.urls || [] })
    });

    const data = await apiRes.json();
    result.textContent = JSON.stringify(data.risk || data, null, 2);
  } catch (error) {
    result.textContent = `Error: ${error.message}`;
  }
});
