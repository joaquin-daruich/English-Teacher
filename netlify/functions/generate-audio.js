// Esta función maneja la conversión de Texto a Audio (TTS) sin dependencias externas pesadas.

exports.handler = async (event, context) => {
  console.log('[Audio] Inicio de función...');
  
  // Validación del método HTTP.
  if (event.httpMethod !== 'POST') {
    console.log('[Audio] Método no permitido');
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let text;
  try {
    // Parseamos el cuerpo JSON para obtener el texto a convertir.
    const parsed = JSON.parse(event.body);
    text = parsed.text;
  } catch (e) {
    console.log('[Audio] Error parseando cuerpo:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Formato inválido' }) };
  }

  // Validación de contenido: El texto debe existir ser string y no estar vacío.
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.log('[Audio] Texto vacío o invalido');
    return { statusCode: 400, body: JSON.stringify({ error: 'No hay texto para generar audio' }) };
  }

  // Limpieza de datos: Eliminamos caracteres de Markdown (**, #, _) que la IA puede incluir.
  // Google TTS lee esos símbolos literalmente, lo cual suena mal.
  let cleanText = text.replace(/[*#_]/g, '').trim();
  
  // Limitación crítica: La API gratuita de Google Translate tiene un límite estricto (~200 caracteres).
  // Si el texto es más largo, lo cortamos estratégicamente para evitar fallos.
  if (cleanText.length > 200) {
    cleanText = cleanText.substring(0, 197) + '...'; // Cortamos y añadimos puntos suspensivos.
    console.log(`[Audio] Texto recortado de ${text.length} a ${cleanText.length} caracteres`);
  }

  console.log(`[Audio] Procesando ${cleanText.length} caracteres...`);

  try {
    // Configuración de la voz: Español Mexicano (es-MX) para un acento natural.
    const voiceLang = 'es-MX';
    
    // Construcción de la URL de la API pública de Google TTS.
    // Parámetros: ie=UTF-8 (codificación), q=texto, tl=idioma, client=tw-ob (cliente web).
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${voiceLang}&client=tw-ob`;

    console.log('[Audio] Llamando a Google TTS...');
    
    // Usamos fetch NATIVO (disponible en Node.js 18+, sin necesitar instalar paquetes extra).
    const response = await fetch(ttsUrl, { 
      method: 'GET',
      timeout: 10000 // Timeout de 10s para evitar colgar la función.
    });

    // Verificación de status HTTP.
    if (!response.ok) {
      throw new Error(`Google TTS devolvió status ${response.status}`);
    }

    // Lectura de la respuesta binaria (el archivo de audio MP3).
    const arrayBuffer = await response.arrayBuffer();
    
    // Conversión a Buffer de Node.js para manipulación de bytes.
    const buffer = Buffer.from(arrayBuffer);
    
    // Codificación a Base64 para poder enviarlo como texto en la respuesta JSON.
    const audioBase64 = buffer.toString('base64');
    
    console.log('[Audio] ✅ Audio generado exitosamente.');
    
    // Retorno exitoso al frontend.
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ audioBase64 }),
    };

  } catch (error) {
    // Manejo robusto de errores: Logueamos detalles técnicos completos para debugging.
    console.error('[Audio] ❌ ERROR CRÍTICO:', error.message);
    console.error('[Audio] Código de error:', error.code || 'unknown');
    console.error('[Audio] Stack:', error.stack);
    
    // En caso de fallo, devolvemos error 503 (Service Unavailable) pero con mensaje claro.
    return { 
      statusCode: 503, 
      body: JSON.stringify({ 
        error: 'Audio no disponible temporalmente',
        details: error.message 
      }) 
    };
  }
};