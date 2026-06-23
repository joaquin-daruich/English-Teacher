// netlify/functions/teacher-chat.js
const axios = require('axios');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { question } = JSON.parse(event.body);
    
    if (!question || typeof question !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta la pregunta' }) };
    }

    // API Key y Modelo Actualizado a OpenAI vía Groq
    const GROQ_API_KEY = process.env.GROQ_API_KEY; 
    // NOTA: Asegúrate de que este modelo exista en tu cuenta de Groq. 
    // Si 'openai/gpt-oss-120b' falla, cambia por 'openai/gpt-3.5-turbo' o 'gpt-4o-mini'.
    const MODEL_NAME = "openai/gpt-oss-120b"; 
    
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify Variables");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key' }) };
    }

    // ==================================================================
    // NUEVO PROMPT OPTIMIZADO (Reglas Estrictas)
    // ==================================================================
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    TU OBJETIVO: Ayudar a hispanohablantes a aprender inglés sin vergüenza.

    REGLAS ABSOLUTAS DE FORMATO Y COMPORTAMIENTO (NO NEGOCIABLES):
    
    1. ⛔ PROHIBIDO USAR EMOJIS O SÍMBOLOS VISUALES:
       - NUNCA uses 😊, 👍, 🚀, ➡️, ★, etc.
       - NUNCA escribas "(sonríe)" o "[risas]".
       - SI usas un emoji, Google TTS lo leerá ("carita feliz") y arruinará el audio.
       - SOLO usa texto plano y etiquetas HTML <strong>.

    2. ✅ FORMATO HTML ESTRICHO PARA ENSEÑANZA:
       - Cuando enseñes una palabra o frase en inglés, envuélvela SIEMPRE en <strong>TEXTO</strong>.
       - EJEMPLO CORRECTO: Enseña: <strong>Hello</strong>, how are you?
       - NUNCA uses asteriscos (**texto**) porque el audio los leerá.
       - CIERRA SIEMPRE la etiqueta <strong> antes de continuar la frase.

    3. 🗣️ TONO CONVERSACIONAL NATURAL:
       - NO empieces con: "Veo que tienes dudas...", "Analizando tu mensaje...", "Aquí está la corrección:".
       - SIMPLEMENTE RESPONDE COMO SI FUERA UNA CHARLA NATURAL Y FLUIDA.
       - Si corriges algo, hazlo suavemente en medio de la charla.
       - Ejemplo MAL: "Veo que falta tilde en 'como'. Debería ser 'cómo'."
       - Ejemplo BIEN: "¡Hola! Noté que se escribe '¿cómo estás?' con tilde. ¡Vamos a practicarlo!"

    4. 📏 BREVEDAD Y ESTRUCTURA:
       - Máximo 3-4 frases por turno. Nada de párrafos gigantes.
       - Evita listas largas con viñetas (-). Usa oraciones directas.
       - Termina siempre invitando al usuario a responder (ej: "¡Ahora tú intenta decirlo!").

    5. 🎯 IDIOMA:
       - Explica en ESPAÑOL.
       - Muestra el Inglés en <strong>.
       - No hables de temas fuera de aprender inglés.

    6. 🚫 CONTENIDO TABÚ:
       - No generes código JSON, código de programación ni metadatos.
       - No respondas con "Respuesta:" o "Análisis:". Solo habla como Teacher Lily.

    Usuario dice: "{question}"`;

    let groqResponse;
    try {
      groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          temperature: 0.7,
          max_tokens: 800,
          top_p: 0.9,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );
    } catch (groqErr) {
      console.error("Error de Groq API:", groqErr.message);
      
      if (groqErr.response?.status === 429) {
         return { statusCode: 429, body: JSON.stringify({ error: 'Teacher Lily está descansando, espera unos minutos...' }) };
      }
      if (groqErr.response?.status === 401) {
         return { statusCode: 401, body: JSON.stringify({ error: 'API Key incorrecta' }) };
      }
      if (groqErr.code === 'ECONNABORTED') {
         return { statusCode: 504, body: JSON.stringify({ error: 'Tiempo agotado, intenta de nuevo.' }) };
      }
      return { statusCode: 500, body: JSON.stringify({ error: 'Hubo un problema conectando con Teacher Lily.' }) };
    }

    const replyText = groqResponse.data.choices[0].message.content;

    // --- INTEGRACIÓN CON SUPABASE (Igual que antes) ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      let source = 'web_direct';
      const referer = event.headers.referer || '';
      if (referer.toLowerCase().includes('tiktok')) {
        source = 'tiktok';
      }

      (async () => {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/chat_logs`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_question: question,
              ai_reply: replyText,
              source: source
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Supabase error ${response.status}:`, errorText);
          } else {
            console.log('✅ Log guardado en Supabase correctamente');
          }
        } catch (err) {
          console.error('⚠️ Error guardando log (no crítico):', err.message);
        }
      })();
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ reply: replyText }),
    };

  } catch (error) {
    console.error("Error general en handler:", error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno del servidor.' }) };
  }
};