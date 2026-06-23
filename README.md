# 📚 Teacher Lily — Tutora de inglés con IA

Teacher Lily es una tutora virtual de inglés que habla en español con el usuario, responde con voz, cambia de expresión según la emoción de la conversación y guarda el historial para crear una experiencia más humana y cercana.

Este proyecto fue construido como **prototipo validable**: la idea es publicarlo en TikTok, observar cómo reaccionan los usuarios reales y, si tiene buena recepción, evolucionarlo hacia una versión más escalable y pulida, por ejemplo cambiando el sistema de TTS por una solución más natural y robusta.



---

## ✨ Descripción del proyecto

Teacher Lily busca hacer que practicar inglés se sienta menos rígido y más conversacional. La interfaz permite chatear con una profesora virtual que responde en texto y voz, acompañada por expresiones visuales coherentes con el tono de la conversación.

La propuesta combina:
- conversación con IA,
- salida de voz,
- historial persistente,
- y assets visuales personalizados creados localmente.

Además, el proyecto fue pensado como una pieza atractiva para redes sociales, especialmente TikTok, para validar interés, observar engagement y decidir qué mejoras vale la pena construir después.

---

## 🛠️ Tecnologías usadas

- **Frontend:** React, Vite, CSS
- **Backend:** Netlify Functions (Node.js)
- **IA principal:** Groq API (openai/gpt-oss-120b)
- **Texto a voz:** Google Translate TTS (`es-MX`)
- **Base de datos:** Supabase (`chat_logs`)
- **Imágenes:** ComfyUI + CyberRealistic XL
- **Eliminación de fondo:** rembg
- **Despliegue:** Netlify

---

## 🚀 Funcionalidades principales

- Chat interactivo para practicar inglés
- Respuestas en español e inglés según el contexto
- Voz generada automáticamente desde el texto
- Expresiones visuales del personaje según la emoción
- Historial de conversaciones guardado en Supabase
- Interfaz responsive con animaciones y estilo visual moderno
- Backend serverless para mantener el frontend ligero
- Pipeline local de imágenes personalizadas para el personaje
- Prototipo pensado para validación en TikTok y feedback real de usuarios

---

## 🧠 ¿Cómo funciona?

1. El usuario escribe un mensaje desde el frontend en React.
2. La app envía la petición a una Netlify Function.
3. La función consulta a Groq para generar la respuesta.
4. La respuesta vuelve al frontend.
5. En paralelo, el chat se guarda en Supabase sin bloquear la experiencia.
6. Si corresponde, otra función convierte el texto en audio.
7. La interfaz actualiza la expresión del personaje y reproduce la voz.

Este flujo permite separar la lógica sensible del frontend, mantener la app rápida y hacer más fácil escalar componentes en el futuro.

---





