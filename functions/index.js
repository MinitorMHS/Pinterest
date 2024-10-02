// functions/[file].js

const BOT_TOKEN = "7020367717:AAGfZWdfB02fyb56Ne0oybdrHdDzUm7Dzbg"; // Add your actual bot token here.
const SIA_NUMBER = 6391549154518104053; // Same random integer used in file encoding/decoding.

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const fileParam = url.searchParams.get('file');
  const mode = url.searchParams.get('mode') || 'attachment';

  if (!fileParam) {
    return new Response(JSON.stringify({ error: 'Missing file parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Decode the file path from base64
    const file_path = atob(fileParam);

    // Parse channel ID and message ID from the file path
    const channel_id = parseInt(file_path.split('/')[0]) / -SIA_NUMBER;
    const message_id = parseInt(file_path.split('/')[1]) / SIA_NUMBER;

    // Fetch file info from Telegram
    const telegramFile = await fetchTelegramFile(channel_id, message_id);
    if (telegramFile.error) {
      return new Response(JSON.stringify(telegramFile), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the file from Telegram to the user
    return await streamFileFromTelegram(telegramFile.file_path, telegramFile.file_name, telegramFile.mime_type, mode);
    
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid file parameter or fetch error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Fetch file info (file path) from Telegram API
async function fetchTelegramFile(channel_id, message_id) {
  const editMessageUrl = apiUrl('editMessageCaption', {
    chat_id: channel_id,
    message_id: message_id,
    caption: 'Fetching file...',
  });

  const response = await fetch(editMessageUrl);
  const data = await response.json();

  if (response.status !== 200 || !data.result) {
    return { error: 'File not found in Telegram' };
  }

  const fileData = data.result.document || data.result.audio || data.result.video || data.result.photo[data.result.photo.length - 1];
  const file_id = fileData.file_id;

  // Get file path from Telegram
  const fileResponse = await fetch(apiUrl('getFile', { file_id }));
  const fileResult = await fileResponse.json();

  if (fileResponse.status !== 200 || !fileResult.result) {
    return { error: 'Unable to retrieve file path from Telegram' };
  }

  return {
    file_path: fileResult.result.file_path,
    file_name: fileData.file_name || `${fileData.file_unique_id}.jpg`,
    mime_type: fileData.mime_type || 'image/jpeg',
  };
}

// Stream file from Telegram API to the client
async function streamFileFromTelegram(file_path, file_name, mime_type, mode) {
  const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`;

  const fileResponse = await fetch(telegramFileUrl);

  if (!fileResponse.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch file from Telegram' }), {
      status: fileResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(fileResponse.body, {
    status: 200,
    headers: {
      'Content-Disposition': `${mode}; filename="${file_name}"`,
      'Content-Type': mime_type,
      'Content-Length': fileResponse.headers.get('Content-Length'),
    },
  });
}

// Construct Telegram API URL
function apiUrl(methodName, params = null) {
  let query = '';
  if (params) {
    query = '?' + new URLSearchParams(params).toString();
  }
  return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`;
      }
    
