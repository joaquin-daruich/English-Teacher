// netlify/functions/generate-audio.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  console.log('[Audio] Inicio de función...');
  
  if (event.httpMethod !== 'POST') {
    console.log('[Audio] Método no permitido');
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let text;
  try {
    const parsed = JSON.parse(event.body);
    text = parsed.text;
  } catch (e) {
    console.log('[Audio] Error parseando cuerpo:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Formato inválido' }) };
  }

  if (!text || text.trim() === '') {
    console.log('[Audio] Texto vacío');
    return { statusCode: 400, body: JSON.stringify({ error: 'No hay texto' }) };
  }

  // Limpiar markdown
  let cleanText = text.replace(/[*#_]/g, '').trim();
  cleanText = cleanText.substring(0, 200);

  console.log(`[Audio] Procesando ${cleanText.length} caracteres...`);

  // REINTENTOS
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Audio] Intento ${attempt}/${maxRetries}...`);

      const voiceLang = 'en'; // Cambié a 'en' para inglés (era 'es-MX')
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${voiceLang}&client=tw-ob`;

      console.log('[Audio] Llamando a Google TTS...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(ttsUrl, { 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
        signal: controller.signal,
        timeout: 8000
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[Audio] HTTP ${response.status} en intento ${attempt}`);
        
        if (response.status === 429) {
          lastError = new Error('Rate limited by Google (429)');
          throw lastError;
        }
        
        if (response.status === 403) {
          lastError = new Error('Google bloqueó la IP (403)');
          throw lastError;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        throw lastError;
      }

      const buffer = await response.buffer();

      if (buffer.length === 0) {
        lastError = new Error('Audio buffer vacío');
        throw lastError;
      }

      const audioBase64 = buffer.toString('base64');
      
      console.log(`[Audio] ✅ Éxito en intento ${attempt}! ${buffer.length} bytes`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ audioBase64 }),
      };

    } catch (error) {
      lastError = error;
      console.error(`[Audio] Error en intento ${attempt}:`, error.message);

      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Audio] Esperando ${waitTime}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  console.error(`[Audio] ❌ Todos los ${maxRetries} intentos fallaron:`, lastError.message);
  
  return { 
    statusCode: 503, 
    body: JSON.stringify({ 
      error: 'Audio no disponible temporalmente',
      details: lastError.message 
    }) 
  };
};
