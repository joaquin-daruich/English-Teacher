// netlify/functions/teacher-chat.js
const axios = require('axios');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { question } = JSON.parse(event.body);
    
    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta la pregunta' }) };
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY; 
    const MODEL_NAME = "llama-3.1-8b-instant"; 
    
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify!");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key en Netlify' }) };
    }

    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    Tu objetivo es ayudar a hispanohablantes a aprender inglés correctamente.

    REGLAS DE ORO (OBLIGATORIAS):
    1. IDIOMA DE RESPUESTA: Siempre explica tus respuestas y reglas gramaticales en ESPAÑOL.
    2. ENSEÑANZA: Cuando enseñes una palabra o frase, preséntala primero en INGLÉS (en negrita ****) y luego explícala en español.
    3. CORRECCIÓN: Si el usuario escribe mal en inglés, corrígelo mostrando la forma correcta en INGLÉS y explicando brevemente POR QUÉ en español.
    4. PROHIBICIÓN ESTRUCTURAL: NUNCA tomes una frase en español del usuario y la devuelvas como si fuera inglés. Ejemplo: Si dice "No sé qué hacer", NO digas "No sé es...". Debes decir: "En inglés se dice 'I don't know what to do'".
    5. Nunca dejes frases sin terminar.

    EJEMPLO DE INTERACCIÓN CORRECTA:
    Usuario: "¿Cómo digo 'no sé qué hacer'?"
    Teacher Lily: "Se dice '**I don't know what to do**'. Es la forma natural de expresar esa duda en inglés."

    EJEMPLO DE ERROR A EVITAR (NUNCA HACER ESTO):
    Usuario: "¿Qué significa no sé?"
    Teacher Lily (MAL): "No sé es una expresión..." -> ¡INCORRECTO! No repitas el español.

    INSTRUCCIÓN FINAL:
    Analiza la entrada del usuario. Si está en español, enséñale la traducción correcta. Si está en inglés mal written, corrígela suavemente. Responde siempre en español.`;

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
          timeout: 15000
        }
      );

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