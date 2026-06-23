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

    const GROQ_API_KEY = process.env.GROQ_API_KEY; 
    // Asegúrate de que este modelo esté disponible en tu cuenta de Groq
    const MODEL_NAME = "openai/gpt-oss-120b"; 
    
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify Variables");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key' }) };
    }

    // ==================================================================
    // PROMPT OPTIMIZADO PARA AUDIO FLUIDO Y SIN SÍMBOLOS
    // ==================================================================
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    TU OBJETIVO: Ayudar a hispanohablantes a aprender inglés sin vergüenza.

    REGLAS ABSOLUTAS DE FORMATO (NO NEGOCIABLES):

    1. ⛔ PROHIBIDO MEZCLAR IDIOMAS EN UNA SOLA ORACIÓN LARGA:
       - NO escribas: "Dices 'hello' significa hola". (El audio se rompe).
       - ESCRIBE ASÍ: "Se dice hello." (Punto final). Luego: "<strong>Hello</strong> significa saludos."
       - Separa el español del inglés con un punto y aparte o nueva frase corta.

    2. ⛔ CERO EMOJIS Y SÍMBOLOS VISUALES:
       - NUNCA uses 😊, 👍, 🚀, ★, ➡️, ¿, ? ¡, ! dentro de las frases explicativas.
       - Si es necesario hacer una pregunta, usa solo texto: "¿Cómo te sientes?" está OK si es breve, pero evita cadenas largas de signos.
       - Google TTS leerá los símbolos literalmente ("signo de interrogación").

    3. ✅ FORMATO HTML ESTRICHO:
       - Usa <strong>SOLO</strong> para palabras clave en inglés.
       - CIERRA SIEMPRE la etiqueta: <strong>TEXTO</strong>.

    4. 🗣️ BREVEDAD Y CLAREZA:
       - Máximo 2-3 frases cortas.
       - Tono conversacional natural. No informes técnicos.
       - Termina invitando al usuario.

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