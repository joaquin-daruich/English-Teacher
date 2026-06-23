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

  // ==================================================================
  // LIMPIEZA SUPER AGRESIVA PARA AUDIO
  // ==================================================================
  let cleanText = text;

  // 1. Eliminar TODAS las etiquetas HTML (<strong>, </strong>, <br>, etc.)
  cleanText = cleanText.replace(/<[^>]*>/g, ''); 

  // 2. Eliminar caracteres especiales que Google lee mal
  //    Eliminamos interrogaciones, exclamaciones, comillas, guiones raros, emojis
  cleanText = cleanText.replace(/[¿?¡!'"–—…°®©™]/g, '');

  // 3. Reemplazar múltiples espacios, tabulaciones y saltos de línea con UN solo espacio
  cleanText = cleanText.replace(/\s+/g, ' ');

  // 4. Recortar espacios extremos
  cleanText = cleanText.trim();

  // Verificación final
  if (!cleanText || cleanText.length === 0) {
     console.log('[Audio] Texto vacío tras limpieza.');
     return { statusCode: 200, body: JSON.stringify({ audioBase64: '' }) };
  }

  // Limitar a 200 caracteres
  if (cleanText.length > 200) {
    const corte = cleanText.lastIndexOf(' ', 200);
    cleanText = cleanText.substring(0, corte !== -1 ? corte : 200) + '...';
    console.log(`[Audio] Texto recortado a ${cleanText.length} chars.`);
  }

  console.log(`[Audio] Procesando limpio: "${cleanText}"`);

  try {
    const voiceLang = 'es-MX';
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${voiceLang}&client=tw-ob`;

    console.log('[Audio] Llamando a Google TTS...');
    
    const response = await fetch(ttsUrl, { 
      method: 'GET',
      timeout: 10000
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