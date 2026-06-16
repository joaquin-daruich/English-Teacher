const edgeTts = require('edge-tts');

exports.handler = async (event, context) => {
  // Log para debugging
  console.log('[generate-audio] Función iniciada');
  console.log('[generate-audio] Evento recibido:', event.httpMethod);

  // Validar método
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    // Parsear body
    const body = JSON.parse(event.body);
    const text = body.text?.trim();

    console.log('[generate-audio] Texto recibido:', text?.substring(0, 50));

    if (!text) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No hay texto para sintetizar' }),
      };
    }

    // Generar audio con edge-tts
    console.log('[generate-audio] Iniciando síntesis de voz...');
    
    const communicate = new edgeTts.Communicate(text, 'es-MX-DaliaNeural');
    const audioChunks = [];

    // Recopilar chunks de audio
    await new Promise((resolve, reject) => {
      communicate.on('data', (chunk) => {
        console.log('[generate-audio] Chunk recibido:', chunk.length, 'bytes');
        audioChunks.push(chunk);
      });

      communicate.on('end', () => {
        console.log('[generate-audio] Síntesis completada');
        resolve();
      });

      communicate.on('error', (error) => {
        console.error('[generate-audio] Error en edge-tts:', error);
        reject(error);
      });
    });

    // Concatenar chunks en un buffer
    const audioBuffer = Buffer.concat(audioChunks);
    console.log('[generate-audio] Buffer total:', audioBuffer.length, 'bytes');

    // Convertir a base64
    const audioBase64 = audioBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ audioBase64 }),
    };

  } catch (error) {
    console.error('[generate-audio] Error general:', error.message);
    console.error('[generate-audio] Stack:', error.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: `Error de TTS: ${error.message}`,
        details: error.stack 
      }),
    };
  }
};
