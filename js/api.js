export async function requestJSON(path, {signal, body} = {}) {
  const response = await fetch(path, {
    signal,
    headers: body ? {'Content-Type': 'application/json'} : {},
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Không nhận được JSON từ backend. Hãy chạy website bằng web_server.py.'); }
  if (!response.ok) throw new Error(data.error?.message || `Backend trả lỗi ${response.status}.`);
  return data;
}
