import axios from 'axios';

export default async (req, context) => {
  // Permitir solo POST
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
    const question = body.question?.trim();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'La pregunta no puede estar vacía' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // CONFIGURACIÓN GROQ
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.error('[teacher-chat] GROQ_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'Falta configuración de Groq API Key' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Prompt maestro para Teacher Lily
    const systemPrompt = `Eres Teacher Lily, una profesora de inglés nativa, paciente y divertida. 
SIGUE ESTAS REGLAS ESENCIALES:
1. Responde siempre al usuario en ESPAÑOL cuando expliques conceptos.
2. Siempre enseña la palabra o frase correcta en INGLÉS.
3. Si el usuario comete un error gramatical, corrígelo suavemente explicando la regla corta.
4. Mantén las respuestas CORTAS (máximo 2-3 frases) porque esto se verá en TikTok/móvil.
5. Nunca hables de temas fuera de aprender inglés.`;

    console.log(`[teacher-chat] Pregunta recibida: "${question}"`);

    // Llamada a Groq API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
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
        timeout: 10000
      }
    );

    const replyText = response.data.choices[0].message.content;
    console.log(`[teacher-chat] Respuesta generada: "${replyText}"`);

    return new Response(
      JSON.stringify({ reply: replyText }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('[teacher-chat] Error:', error.message);

    // Manejo específico de errores
    if (error.response?.status === 429) {
      return new Response(
        JSON.stringify({ 
          error: 'Teacher Lily está descansando, espera unos minutos...' 
        }),
        { 
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    if (error.response?.status === 401) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuración incorrecta: Verifica la API Key' 
        }),
        { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Hubo un problema conectando con Teacher Lily.' 
      }),
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
