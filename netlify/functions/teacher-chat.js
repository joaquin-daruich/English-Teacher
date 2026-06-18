// netlify/functions/teacher-chat.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Validar método
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    // Parsear cuerpo
    const { question } = JSON.parse(event.body);
    
    if (!question || typeof question !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta la pregunta o formato inválido' }) };
    }

    // Configurar Groq
    const GROQ_API_KEY = process.env.GROQ_API_KEY; 
    const MODEL_NAME = "llama-3.1-8b-instant"; 
    
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify Variables");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key en Netlify' }) };
    }

    // Prompt del sistema
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    SIGUE ESTAS REGLAS ESENCIALES:
    1. Responde siempre al usuario en ESPAÑOL cuando expliques conceptos.
    2. Siempre enseña la palabra o frase correcta en INGLÉS (usa negrita con **si puedes**).
    3. Si el usuario comete un error gramatical, corrígelo suavemente explicando la regla corta.
    4. Mantén las respuestas CORTAS (máximo 2-3 frases) porque esto se verá en TikTok/móvil.
    5. Nunca hables de temas fuera de aprender inglés.`;

    // 1. Llamar a Groq API
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

    // Extraer texto
    const replyText = groqResponse.data.choices[0].message.content;

    // 2. Guardar en Supabase (Opcional - No bloquea respuesta)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      let source = 'web_direct';
      const referer = event.headers.referer || '';
      if (referer.toLowerCase().includes('tiktok')) {
        source = 'tiktok';
      }

      // Fetch SIN TIMEOUT AGRESIVO (background job)
      fetch(`${supabaseUrl}/rest/v1/chat_logs`, {
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
      }).then(() => console.log('✅ Log guardado en Supabase'))
        .catch(err => console.error('⚠️ Error guardando log (no crítico):', err.message));
    } else {
      console.log('ℹ️ Variables de Supabase no encontradas, saltando guardado.');
    }

    // 3. Devolver respuesta
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