import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VOICE = "es-MX-DaliaNeural";

async function generateAudio(text) {
  try {
    // Importar edge-tts dinámicamente
    const edgeTts = await import('edge-tts');
    const { Communicate } = edgeTts;

    // Crear comunicador
    const communicate = new Communicate(text, VOICE);

    // Crear buffer de audio
    const audioChunks = [];

    return new Promise((resolve, reject) => {
      communicate.on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      communicate.on('end', () => {
        const audioBuffer = Buffer.concat(audioChunks);
        const base64Audio = audioBuffer.toString('base64');
        resolve(base64Audio);
      });

      communicate.on('error', (error) => {
        reject(error);
      });

      // Iniciar la generación
      communicate.send();
    });
  } catch (error) {
    throw new Error(`Error generando audio: ${error.message}`);
  }
}

export default async (req, context) => {
  // Validar método
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const body = await req.json();
    const text = body.text?.trim();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No hay texto para sintetizar' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    console.log(`[generate-audio] Generando audio para: "${text.substring(0, 50)}..."`);

    const audioBase64 = await generateAudio(text);

    return new Response(
      JSON.stringify({ audioBase64 }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('[generate-audio] Error:', error.message);
    
    return new Response(
      JSON.stringify({ error: `Error de TTS: ${error.message}` }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};
