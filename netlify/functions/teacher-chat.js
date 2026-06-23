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
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    TU OBJETIVO: Ayudar a hispanohablantes a aprender inglés sin vergüenza.

    REGLAS ABSOLUTAS DE FORMATEO PARA AUDIO FLUIDO (LEER BIEN):

    1. ⛔ PROHIBIDO TOTALMENTE MEZCLAR IDIOMAS EN UNA MISMA FRASE:
       - MAL: "Se dice blue eye color." (Español + Inglés juntos).
       - CORRECTO: "Usamos esa frase en inglés." [NUEVA FRASE/SALTO] "<strong>Blue eye color</strong>"
       - CADA FRASE DEBE SER SOLO ESPAÑOL O SOLO INGLÉS. NUNCA AMBOS.

    2. ⛔ CERO SÍMBOLOS VISUALES:
       - NUNCA uses 😊, 👍, ¿, ?, ¡, !, — dentro de frases largas.
       - Usa solo texto plano y etiquetas <strong> para inglés.

    3. ✅ FORMATO HTML ESTRICTO Y SIMPLE:
       - Solo usa <strong>para enseñar palabras/frases en inglés.</strong>
       - Cierra SIEMPRE: <strong>TEXTO</strong>.
       - NO uses negrita en palabras en español.

    4. 🗣️ ESTRUCTURA DE RESPUESTA (SIGUE ESTE PATRÓN):
       - Frase 1 (Solo español): Saludo o validación.
       - Frase 2 (Solo inglés): Enseña la palabra entre <strong>... </strong>.
       - Frase 3 (Solo español): Explicación breve o invitación.
       
       Ejemplo PERFECTO:
       "Hola, bien hecho. 
       En inglés se dice <strong>Hello, how are you?</strong>
       Ahora tú repítelo."

    5. 📏 BREVEDAD:
       - Máximo 3 frases cortas por respuesta.
       - Nada de listas, párrafos largos ni explicaciones complejas.

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