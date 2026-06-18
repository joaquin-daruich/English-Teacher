// netlify/functions/generate-audio.js
const axios = require('axios');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { text } = JSON.parse(event.body);

    if (!text || text.trim() === '') {
      return { statusCode: 400, body: JSON.stringify({ error: 'No hay texto para generar audio' }) };
    }

    // Limpiar markdown y limitar a 200 caracteres (límite de Google TTS gratuito)
    const cleanText = text.replace(/[*\#\[\]]/g, '').trim();
    const maxLength = 200;
    const textToSpeak = cleanText.length > maxLength ? cleanText.substring(0, maxLength) : cleanText;

    if (!textToSpeak) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Texto demasiado corto tras limpieza' }) };
    }

    const voiceLang = 'es-MX'; // Voz mexicana
    
    // URL directa de Google Translate TTS (no requiere API key, gratis para pruebas)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeak)}&tl=${voiceLang}&client=tw-ob`;

    // Descargar audio MP3
    const response = await axios.get(ttsUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000
    });

    // Convertir buffer a Base64 para enviar al frontend
    const audioBase64 = Buffer.from(response.data).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ 
        audioBase64,
        textUsed: textToSpeak 
      }),
    };

  } catch (error) {
    console.error('[Audio Error]', error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Fallo al generar audio. Intenta de nuevo.',
        details: error.message 
      }) 
    };
  }
};