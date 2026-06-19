// netlify/functions/generate-audio.js

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

  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.log('[Audio] Texto vacío o invalido');
    return { statusCode: 400, body: JSON.stringify({ error: 'No hay texto para generar audio' }) };
  }

  // Limpiar markdown (**, #, etc.)
  let cleanText = text.replace(/[*#_]/g, '').trim();
  
  // Limitar a 200 caracteres máximo para evitar timeouts de Google TTS
  if (cleanText.length > 200) {
    cleanText = cleanText.substring(0, 197) + '...';
    console.log(`[Audio] Texto recortado de ${text.length} a ${cleanText.length} caracteres`);
  }

  console.log(`[Audio] Procesando ${cleanText.length} caracteres...`);

  try {
    const voiceLang = 'es-MX';
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${voiceLang}&client=tw-ob`;

    console.log('[Audio] Llamando a Google TTS...');
    
    // Usamos fetch NATIVO (disponible en Node.js 18+, sin dependencias externas)
    const response = await fetch(ttsUrl, { 
      method: 'GET',
      timeout: 10000 // 10 segundos de timeout
    });

    if (!response.ok) {
      throw new Error(`Google TTS devolvió status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');
    
    console.log('[Audio] ✅ Audio generado exitosamente.');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ audioBase64 }),
    };

  } catch (error) {
    console.error('[Audio] ❌ ERROR CRÍTICO:', error.message);
    console.error('[Audio] Código de error:', error.code || 'unknown');
    console.error('[Audio] Stack:', error.stack);
    
    return { 
      statusCode: 503, 
      body: JSON.stringify({ 
        error: 'Audio no disponible temporalmente',
        details: error.message 
      }) 
    };
  }
};