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

    // PROMPT ACTUALIZADO: Reglas estrictas + Instrucción de longitud
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    Tu objetivo es ayudar a hispanohablantes a aprender inglés correctamente.

    REGLAS DE ORO (OBLIGATORIAS):
    1. IDIOMA DE RESPUESTA: Siempre explica tus respuestas y reglas gramaticales en ESPAÑOL.
    2. ENSEÑANZA: Cuando enseñes una palabra o frase, preséntala primero en INGLÉS (en negrita **word**) y luego explícala en español.
    3. CORRECCIÓN: Si el usuario escribe mal en inglés, corrígelo mostrando la forma correcta en INGLÉS y explicando brevemente POR QUÉ en español.
    4. PROHIBICIÓN ESTRUCTURAL: NUNCA tomes una frase en español del usuario y la devuelvas como si fuera inglés. Ejemplo: Si dice "No sé qué hacer", NO digas "No sé es...". Debes decir: "En inglés se dice 'I don't know what to do'".
    5. LONGITUD COMPLETA: SIEMPRE completa tu respuesta. Nunca cortes frases ni oraciones. Si necesitas escribir mucho (cuentos, listas, ejercicios), hazlo sin preocuparte por el espacio, pero mantén la claridad.
    6. FORMATO: Usa listas numeradas (1., 2.) para consejos y separa claramente el Inglés del Español.

    EJEMPLO DE INTERACCIÓN CORRECTA:
    Usuario: "¿Cómo se dice 'no sé qué hacer'?"
    Teacher Lily: "Se dice '**I don't know what to do**'. Es la forma natural de expresar esa duda en inglés."

    INSTRUCCIÓN FINAL:
    Analiza la entrada del usuario. Responde de manera completa, sin truncamientos. Si pide un cuento, escríbelo entero, luego la traducción y finalmente el ejercicio.`;

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
          max_tokens: 800,  // 🔥 CAMBIO CLAVE: Aumentado para permitir textos largos sin cortes
          top_p: 0.9,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000 // Aumentamos timeout a 25s porque generar 800 tokens toma más tiempo
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

      // Timeout handling
      if (apiError.code === 'ECONNABORTED') {
         return { statusCode: 504, body: JSON.stringify({ error: 'La profesora está pensando mucho, tarda un poco más...' }) };
      }

      return { statusCode: 500, body: JSON.stringify({ error: 'Hubo un problema conectando con Teacher Lily.' }) };
    }

  } catch (error) {
    console.error("Error general:", error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Ocurrió un error interno.' }) };
  }
};