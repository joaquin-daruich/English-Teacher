// netlify/functions/teacher-chat.js

// ... (tu código existente hasta recibir dataText.reply) ...

      const replyText = response.data.choices[0].message.content;

      // --- NUEVO: GUARDAR DATOS EN SUPABASE ---
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        try {
          // Intentamos guardar en segundo plano (no bloquea la respuesta al usuario)
          fetch(`${supabaseUrl}/rest/v1/chat_logs`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal' // No necesitamos la respuesta de la DB para no ralentizar
            },
            body: JSON.stringify({
              user_question: question,
              ai_reply: replyText,
              source: 'tiktok' // Puedes cambiarlo dinámicamente si detectas referrer
            })
          }).catch(err => console.error("Error guardando log:", err));
          
        } catch (e) {
          console.error("Error intentando guardar en Supabase:", e);
          // Si falla, no pasamos nada, el chat sigue funcionando normal
        }
      }
      // -----------------------------------------

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ reply: replyText }),
      };