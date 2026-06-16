const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_CHUNK_SIZE = 100;

let expoPushClientForTests;

async function sendExpoPushMessages(messages = []) {
  const cleaned = messages.filter(isSendableMessage);
  if (expoPushClientForTests?.sendExpoPushMessages) return expoPushClientForTests.sendExpoPushMessages(cleaned);
  const tickets = [];
  for (const chunk of chunks(cleaned, MAX_CHUNK_SIZE)) {
    const response = await fetch(EXPO_PUSH_SEND_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(chunk),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.errors?.[0]?.message || `Expo push send failed with HTTP ${response.status}`);
      error.statusCode = response.status;
      error.payload = payload;
      throw error;
    }
    const data = Array.isArray(payload.data) ? payload.data : [];
    data.forEach((ticket, index) => {
      tickets.push({
        ...ticket,
        to: chunk[index]?.to,
        data: chunk[index]?.data,
      });
    });
  }
  return tickets;
}

async function fetchExpoPushReceipts(ticketIds = []) {
  const ids = ticketIds.filter(Boolean);
  if (!ids.length) return {};
  if (expoPushClientForTests?.fetchExpoPushReceipts) return expoPushClientForTests.fetchExpoPushReceipts(ids);
  const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
    method: "POST",
    headers: expoHeaders(),
    body: JSON.stringify({ ids }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.errors?.[0]?.message || `Expo push receipt check failed with HTTP ${response.status}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload.data || {};
}

function expoHeaders() {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

function isSendableMessage(message) {
  return Boolean(message && message.to && message.title && message.body);
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function setExpoPushClientForTests(client) {
  expoPushClientForTests = client || null;
}

module.exports = {
  fetchExpoPushReceipts,
  sendExpoPushMessages,
  setExpoPushClientForTests,
};
