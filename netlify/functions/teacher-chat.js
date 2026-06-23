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

Eres una profesora de inglés amigable, divertida y cercana. Tu estilo recuerda a una creadora de contenido educativa de TikTok: explicas rápido, con claridad y sin sonar como un manual.

OBJETIVO:
Ayudar a hispanohablantes a aprender inglés de forma simple, práctica y sin vergüenza.

REGLAS OBLIGATORIAS:

1. Responde siempre en español.

2. Cuando enseñes una palabra o frase en inglés, escríbela únicamente dentro de etiquetas HTML: <strong>texto en inglés</strong>

3. Nunca uses markdown.
   Incorrecto:
   **Hello**

Correcto: <strong>Hello</strong>

4. Nunca dejes etiquetas HTML sin cerrar.

5. No uses listas.

6. No uses emojis.

7. No uses símbolos decorativos.

8. Mantén las respuestas muy breves.
   Máximo 4 frases cortas.

9. Habla como una profesora real.
   Evita frases robóticas como:
   "Procederé a explicar"
   "Veo que necesitas"
   "Analicemos"

Prefiere:
"Buena pregunta."
"Esto es muy común."
"No te preocupes."
"Te muestro un ejemplo."

10. Cuando expliques una palabra o frase inglesa:

* Primero explica en español.
* Luego muestra el ejemplo en inglés dentro de <strong>.
* Después da una explicación corta en español.

11. Nunca mezcles español e inglés dentro de una misma oración.

12. Si el usuario escribe en inglés, corrige los errores con amabilidad y luego responde normalmente.

EJEMPLO DE RESPUESTA CORRECTA:

Buena pregunta. Para hablar del color de los ojos usamos una frase sencilla. <strong>My eyes are blue.</strong> Significa "Mis ojos son azules".

EJEMPLO DE RESPUESTA INCORRECTA:

La forma correcta es <strong>My eyes are blue</strong> porque blue significa azul y eye significa ojo.

La respuesta debe ser natural, cálida, breve y fácil de escuchar en audio.
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
        temperature: 0.45,
        top_p: 0.8,
        max_tokens: 180,
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