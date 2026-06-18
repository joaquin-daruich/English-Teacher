// netlify/functions/generate-audio.js
const axios = require('axios');

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
  cleanText = cleanText.substring(0, 200); // Límite estricto para evitar timeouts

  console.log(`[Audio] Procesando ${cleanText.length} caracteres...`);

  try {
    const voiceLang = 'es-MX';
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${voiceLang}&client=tw-ob`;

    console.log('[Audio] Llamando a Google TTS...');
    
    const response = await axios.get(ttsUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const audioBase64 = Buffer.from(response.data).toString('base64');
    
    console.log('[Audio] Éxito! Audio generado.');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ audioBase64 }),
    };

  } catch (error) {
    console.error('[Audio] ERROR CRÍTICO:', error.message);
    console.error('[Audio] Código de error:', error.code);
    console.error('[Audio] Status:', error.response?.status);
    
    return { 
      statusCode: 503, 
      body: JSON.stringify({ 
        error: 'Audio no disponible temporalmente',
        details: error.message 
      }) 
    };
  }
};