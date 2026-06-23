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
    const MODEL_NAME = "openai/gpt-oss-120b"; 
    
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify Variables");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key' }) };
    }

    // ==================================================================
    // PROMPT REESCRITO PARA EVITAR MEZCLA DE IDIOMAS EN AUDIO
    // ==================================================================
    const systemPrompt = `Eres Teacher Lily.

Eres una profesora de inglés amigable y cercana.

Ayudas a hispanohablantes a aprender inglés de forma simple.

Reglas:

- Responde en español.
- Mantén respuestas cortas.
- Máximo 4 frases.
- No uses emojis.
- No uses listas.
- Cuando enseñes una palabra o frase en inglés, escríbela dentro de <strong></strong>.
- Nunca uses markdown.
- Habla de forma natural y conversacional.
- Si el usuario solo saluda, responde saludando y preguntando en qué puedes ayudar.
- Si el usuario pregunta algo sobre inglés, explícalo de forma sencilla y muestra un ejemplo.

Ejemplo:

Hola. Me alegra verte. ¿Qué te gustaría aprender hoy?

Ejemplo:

Buena pregunta. Para decir que la comida está muy rica puedes usar <strong>The food is very tasty.</strong> Se usa cuando algo tiene muy buen sabor.
`;

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
          temperature: 0.45,       // ✅ Corregido: número directo, sin comillas ni errores de sintaxis
          top_p: 0.8,              // ✅ Alineado correctamente
          max_tokens: 333,         // ✅ Límite estricto para evitar respuestas largas
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

    console.log("=== RESPUESTA COMPLETA DE GROQ ===");
    console.log(JSON.stringify(groqResponse.data, null, 2));

const choice = groqResponse?.data?.choices?.[0];

    console.log("=== CHOICE ===");
    console.log(JSON.stringify(choice, null, 2));

    const replyText =
      choice?.message?.content ??
      choice?.content ??
      choice?.text ??
      '';

    console.log("=== TEXTO EXTRAIDO ===");
    console.log(JSON.stringify(replyText));

    // --- INTEGRACIÓN CON SUPABASE ---
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