const output = document.getElementById('output');

function splitCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPayload() {
  return {
    content: document.getElementById('emailContent').value,
    headers: document.getElementById('emailHeaders').value,
    urls: splitCsv(document.getElementById('urls').value),
    attachments: splitCsv(document.getElementById('attachments').value)
  };
}

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  output.textContent = 'Running analysis...';
  try {
    const res = await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload())
    });
    const data = await res.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
});

document.getElementById('explainBtn').addEventListener('click', async () => {
  output.textContent = 'Requesting deep explanation...\n';
  try {
    const res = await fetch('http://localhost:3001/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: buildPayload() })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      output.textContent += decoder.decode(value);
    }
  } catch (error) {
    output.textContent += `\nError: ${error.message}`;
  }
});
