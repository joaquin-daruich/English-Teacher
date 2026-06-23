// Importamos la librería Axios para realizar peticiones HTTP externas (a Groq) fácilmente.
const axios = require('axios');

// Definimos la función principal 'handler' que Netlify ejecuta al recibir una petición.
exports.handler = async (event, context) => {
  // Verificamos que el método HTTP sea POST (necesario para enviar datos).
  if (event.httpMethod !== 'POST') {
    // Si no es POST, devolvemos error 405 (Método no permitido).
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    // Parseamos el cuerpo de la petición (JSON) para obtener la pregunta del usuario.
    const { question } = JSON.parse(event.body);
    
    // Validación básica: Si no hay pregunta o no es string, devolvemos error 400.
    if (!question || typeof question !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta la pregunta' }) };
    }

    // Obtenemos la API KEY de Groq desde las variables de entorno de Netlify (NO hardcodeadas).
    const GROQ_API_KEY = process.env.GROQ_API_KEY; 
    const MODEL_NAME = "openai/gpt-oss-120b"; // Modelo de Openai para respuestas inteligentes, por ahora alcanza para lo que es una prueba.
    
    // Validamos que la Key exista, si no, logueamos error y devolvemos 500.
    if (!GROQ_API_KEY) {
      console.error("❌ FALTA GROQ_API_KEY en Netlify Variables");
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuración faltante: Falta la API Key' }) };
    }

    // Prompt del sistema (System Message): Aquí definimos la PERSONALIDAD de Teacher Lily.
    // Le dictamos reglas estrictas: hablar en español, enseñar inglés, correcciones suaves, brevedad.
    const systemPrompt = `Actúa como "Teacher Lily", una profesora nativa de inglés experta, paciente y amigable. 
    SIGUE ESTAS REGLAS ESENCIALES:
    1. Responde siempre al usuario en ESPAÑOL cuando expliques conceptos.
    2. Siempre enseña la palabra o frase correcta en INGLÉS (usa <strong> si puedes </strong>).
    3. Si el usuario comete un error gramatical, corrígelo suavemente explicando la regla corta.
    4. Nunca hables de temas fuera de aprender inglés.`;

    let groqResponse;
    try {
      // Realizamos la petición POST a la API de Groq usando Axios.
      groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions', // Endpoint oficial de Chat Completions.
        {
          model: MODEL_NAME, // Usamos el modelo configurado.
          messages: [
            { role: "system", content: systemPrompt }, // Contexto fijo (la personalidad).
            { role: "user", content: question } // La entrada dinámica del usuario.
          ],
          temperature: 0.7, // Controla la aleatoriedad (0.7 es un buen balance entre creativo y preciso).
          max_tokens: 800, // Límite de tokens permitidos para evitar respuestas infinitas.
          top_p: 0.9, // Filtra opciones menos probables para mejorar coherencia.
          stream: false // Esperamos la respuesta completa antes de devolverla (no streaming en este caso).
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`, // Autenticación segura con Bearer Token.
            'Content-Type': 'application/json'
          },
          timeout: 25000 // Timeout de 25 segundos para evitar esperas eternas si la API tarda.
        }
      );
    } catch (groqErr) {
      // Manejo detallado de errores específicos de Groq.
      console.error("Error de Groq API:", groqErr.message);
      
      // Caso 429: Rate Limit (demasiadas peticiones). Mensaje amigable para el usuario.
      if (groqErr.response?.status === 429) {
         return { statusCode: 429, body: JSON.stringify({ error: 'Teacher Lily está descansando, espera unos minutos...' }) };
      }
      // Caso 401: API Key inválida.
      if (groqErr.response?.status === 401) {
         return { statusCode: 401, body: JSON.stringify({ error: 'API Key incorrecta' }) };
      }
      // Caso Timeout.
      if (groqErr.code === 'ECONNABORTED') {
         return { statusCode: 504, body: JSON.stringify({ error: 'Tiempo agotado, intenta de nuevo.' }) };
      }
      // Otros errores genéricos del servidor.
      return { statusCode: 500, body: JSON.stringify({ error: 'Hubo un problema conectando con Teacher Lily.' }) };
    }

    // Extraemos el texto de la respuesta de la IA del objeto JSON recibido.
    const replyText = groqResponse.data.choices[0].message.content;

    // --- INTEGRACIÓN CON SUPABASE (BASE DE DATOS) ---
    // Obtenemos las credenciales de Supabase desde variables de entorno.
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // Solo procedemos a guardar si ambas variables existen.
    if (supabaseUrl && supabaseKey) {
      // Intentamos determinar la fuente del tráfico (TikTok vs Directo).
      let source = 'web_direct';
      const referer = event.headers.referer || '';
      if (referer.toLowerCase().includes('tiktok')) {
        source = 'tiktok';
      }

      // Ejecutamos el guardado en segundo plano (Fire and Forget).
      // Usamos una IIFE (función asíncrona autoejecutable) para NO bloquear la respuesta al usuario.
      (async () => {
        try {
          // Petición POST a la API REST de Supabase hacia la tabla 'chat_logs'.
          const response = await fetch(`${supabaseUrl}/rest/v1/chat_logs`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey, // Clave para acceso público (anonima).
              'Authorization': `Bearer ${supabaseKey}`, // Header de autorización estándar.
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal' // Optimización: pedimos solo confirmación, no el cuerpo guardado.
            },
            body: JSON.stringify({
              user_question: question,
              ai_reply: replyText,
              source: source
            })
          });

          // Verificamos si la escritura fue exitosa.
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Supabase error ${response.status}:`, errorText);
          } else {
            console.log('✅ Log guardado en Supabase correctamente');
          }
        } catch (err) {
          // Cualquier error aquí es no crítico, solo logueamos para debug.
          console.error('⚠️ Error guardando log (no crítico):', err.message);
        }
      })();
    } else {
      console.log('ℹ️ Variables de Supabase no encontradas, saltando guardado.');
    }

    // Finalmente, devolvemos la respuesta de texto al frontend (Frontend).
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // CORS: Permitir origen de cualquier dominio (necesario para Netlify + Vite).
      },
      body: JSON.stringify({ reply: replyText }),
    };

  } catch (error) {
    // Catch general para cualquier error inesperado en la función.
    console.error("Error general en handler:", error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno del servidor.' }) };
  }
};