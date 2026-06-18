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

    // Limpiar texto: quitar markdown (**, #, etc.) para que la voz no lea asteriscos
    let cleanText = text.replace(/[*#_]/g, '').trim();
    
    // Limpiamos saltos de línea múltiples pero dejamos uno simple para pausas
    cleanText = cleanText.replace(/\n+/g, '. ').replace(/\.\s*\./g, '.').trim();

    // Si el texto es corto (< 200 chars), hacerlo directamente
    if (cleanText.length <= 190) {
      return await generarAudioSingle(cleanText);
    }

    // Si es largo, dividimos en oraciones (aprox 150-180 caracteres por fragmento)
    const fragmentos = dividirTexto(cleanText, 180);
    
    console.log(`Dividiendo texto en ${fragmentos.length} fragmentos...`);

    // Generar audio para cada fragmento
    const audiosPromises = fragmentos.map(async (fragmento) => {
      try {
        const res = await generarAudioSingle(fragmento);
        return Buffer.from(res.audioBase64, 'base64');
      } catch (e) {
        console.error("Error en fragmento:", e.message);
        return null;
      }
    });

    const buffers = await Promise.all(audiosPromises);
    
    // Filtrar buffers nulos y unirlos
    const validBuffers = buffers.filter(b => b !== null);
    
    if (validBuffers.length === 0) {
      throw new Error("No se pudo generar ningún fragmento de audio");
    }

    // Concatenar Buffers
    const totalLength = validBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const mergedBuffer = Buffer.concat(validBuffers, totalLength);
    
    const finalBase64 = mergedBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ 
        audioBase64: finalBase64,
        originalLength: cleanText.length,
        fragmentCount: validBuffers.length
      }),
    };

  } catch (error) {
    console.error('[Audio Error]', error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Fallo al generar audio completo.',
        details: error.message 
      }) 
    };
  }
};

// Función auxiliar para dividir texto en oraciones sin cortar palabras
function dividirTexto(texto, maxLen) {
  const fragmentos = [];
  let resto = texto;

  while (resto.length > 0) {
    if (resto.length <= maxLen) {
      fragmentos.push(resto);
      break;
    }

    // Buscar el último espacio antes del límite máximo
    const corte = resto.lastIndexOf(' ', maxLen);
    
    if (corte === -1) {
      // Si no hay espacio (palabra muy larga), cortar forzadamente o buscar punto
      const punto = resto.indexOf('.', maxLen);
      if (punto !== -1 && punto < maxLen + 20) {
        fragmentos.push(resto.substring(0, punto + 1));
        resto = resto.substring(punto + 1).trim();
      } else {
        fragmentos.push(resto.substring(0, maxLen));
        resto = resto.substring(maxLen).trim();
      }
    } else {
      fragmentos.push(resto.substring(0, corte));
      resto = resto.substring(corte + 1).trim();
    }
  }
  return fragmentos;
}

// Función para llamar a la API de Google TTS (limpia)
async function generarAudioSingle(texto) {
  const voiceLang = 'es-MX'; // Voz mexicana
  // URL oficial de Google Translate TTS
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(texto)}&tl=${voiceLang}&client=tw-ob`;

  const response = await axios.get(ttsUrl, { 
    responseType: 'arraybuffer',
    timeout: 15000
  });

  const audioBase64 = Buffer.from(response.data).toString('base64');
  return { audioBase64 };
}