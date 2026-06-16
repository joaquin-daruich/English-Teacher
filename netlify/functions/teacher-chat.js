const axios = require('axios');

exports.handler = async (event, context) => {
  // Permitir solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { question } = JSON.parse(event.body);
    
    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: 'La pregunta no puede estar vacía' }) };
    }

    // CONFIGURACIÓN GROQ
    const GROQ_API_KEY = process.env.GROQ_API_KEY; // Variable de entorno de Netlify
    const MODEL_NAME = "llama-3.1-8b-instant"; // Modelo elegido
    
    if (!GROQ_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Falta configuración de Groq API Key' }) };
    }

    // Prompt maestro para Teacher Lily
    const systemPrompt = `Eres Teacher Lily, una profesora de inglés nativa, paciente y divertida. 
    SIGUE ESTAS REGLAS ESENCIALES:
    1. Responde siempre al usuario en ESPAÑOL cuando expliques conceptos.
    2. Siempre enseña la palabra o frase correcta en INGLÉS (usa negrita con **si puedes**).
    3. Si el usuario comete un error gramatical, corrígelo suavemente explicando la regla corta.
    4. Mantén las respuestas CORTAS (máximo 2-3 frases) porque esto se verá en TikTok/móvil.
    5. Nunca hables de temas fuera de aprender inglés.`;

    // Llamada a Groq API (compatible con formato OpenAI)
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          temperature: 0.7,
          max_tokens: 150,
          top_p: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 segundos debería ser suficiente con Groq
        }
      );

      // Extraer respuesta
      const replyText = response.data.choices[0].message.content;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ reply: replyText }),
      };

    } catch (apiError) {
      console.error("Error de Groq API:", apiError.message);
      
      if (apiError.response?.status === 429) {
         return { statusCode: 429, body: JSON.stringify({ error: 'Teacher Lily está descansando, espera unos minutos...' }) };
      }
      
      if (apiError.response?.status === 401) {
         return { statusCode: 401, body: JSON.stringify({ error: 'Configuración incorrecta: Verifica la API Key' }) };
      }

      return { statusCode: 500, body: JSON.stringify({ error: 'Hubo un problema conectando con Teacher Lily.' }) };
    }

  } catch (error) {
    console.error("Error general:", error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Ocurrió un error interno.' }) };
  }
};