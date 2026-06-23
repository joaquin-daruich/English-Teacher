import { useState, useRef } from 'react' // Importamos los hooks de React: useState para gestionar el estado de la UI y useRef para acceder directamente a elementos del DOM (como el audio) sin provocar re-renderizados innecesarios.
import './App.css' // Importamos los estilos CSS personalizados definidos en el archivo App.css.

function App() {
  // --- DEFINICIÓN DE ESTADOS (State Management) ---
  // Estado para el texto que el usuario escribe en el input
  const [inputValue, setInputValue] = useState('') 
  
  // Estado para almacenar y mostrar la respuesta de texto generada por la IA
  const [respuestaIA, setRespuestaIA] = useState('') 
  
  // Estado booleano para deshabilitar inputs y mostrar "Pensando..." mientras carga la respuesta
  const [cargando, setCargando] = useState(false) 
  
  // Estado para manejar mensajes de error críticos y mostrarlos al usuario
  const [errorMensaje, setErrorMensaje] = useState('') 
  
  // Estado booleano para saber si el audio está reproduciéndose, útil para UX (deshabilitar botón, cambiar icono)
  const [reproduciendo, setReproduciendo] = useState(false)

  // Estado para controlar dinámicamente la imagen mostrada según la emoción detectada (saludando, alegre, triste, etc.)
  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png') 
  
  // Referencia directa al elemento <audio> del DOM para poder controlarlo programáticamente (play, pause, src) sin re-renderizar la vista.
  const audioRef = useRef(null)

  // Función auxiliar que actualmente retorna el texto tal cual. 
  // Se mantuvo por compatibilidad con la estructura original o podría usarse aquí una lógica simple de mapeo de expresiones si no se usara la IA.
  const obtenerExpresion = (texto) => texto

  // Manejador principal del envío del formulario. Es asíncrono porque realiza múltiples llamadas a APIs externas.
  const manejarEnvio = async (e) => {
    e.preventDefault() // Evita que el formulario recargue la página (comportamiento por defecto de HTML).
    
    // Validación temprana: Si el input está vacío o solo tiene espacios, no hacemos nada.
    if (!inputValue.trim()) return

    // Preparamos la interfaz de usuario: activamos el loading, limpiamos errores anteriores y respuestas previas.
    setCargando(true)
    setErrorMensaje('')
    setRespuestaIA('')
    setReproduciendo(false)

    try {
      // ==================================================================
      // PASO 1: Obtener Respuesta de Texto (Integración con Groq/IA)
      // ==================================================================
      
      // Enviamos la pregunta del usuario a nuestra Serverless Function (Netlify Functions) que actúa como proxy seguro hacia la API de Groq.
      const resText = await fetch('/.netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // Definimos que enviamos datos JSON.
        body: JSON.stringify({ question: inputValue }), // Serializamos el objeto con la pregunta a formato JSON string.
      });

      // Verificamos si la respuesta HTTP fue exitosa (status 200-299). Si no, capturamos el error del servidor.
      if (!resText.ok) {
        // Intentamos leer el mensaje de error devuelto por nuestro backend para dar feedback específico al usuario.
        const errorData = await resText.json().catch(() => ({}));
        // Lanzamos un Error personalizado que incluye el mensaje del servidor o el código de estado si falla el parseo.
        throw new Error(errorData.error || `Error del servidor: ${resText.status}`);
      }

      // Parseamos la respuesta JSON recibida del backend.
      const dataText = await resText.json();

      // Validamos que realmente hayamos recibido una respuesta de texto en el objeto.
      if (!dataText.reply) {
        throw new Error("La profesora no respondió texto.");
      }

      // Actualizamos el estado de respuesta para que el componente renderice el texto de la IA en pantalla.
      setRespuestaIA(dataText.reply);

      // ==================================================================
      // PASO 2: Determinar Expresión Emocional (Lógica de Análisis)
      // ==================================================================
      
      // Construimos un prompt especializado para pedirle a la IA que actúe como un "analista de emociones".
      // Le damos contexto (el mensaje), reglas estrictas (elegir solo una palabra de la lista) y ejemplos implícitos.
      // Esta técnica se llama "Prompt Engineering" para extraer datos estructurados sin necesitar una segunda API.
      const promptExpresion = `Analiza el siguiente mensaje de Teacher Lily y elige UNA SOLA palabra de esta lista exacta: [alegre, dudando, triste, consoladora]. 
      
      Mensaje: "${dataText.reply}"
      
      Reglas:
      - Si hay alegría o felicidad, responde: alegre
      - Si hay duda o pregunta, responde: dudando
      - Si hay tristeza o lástima, responde: triste
      - Si hay consuelo o empatía, responde: consoladora
      - NO respondas nada más que la palabra seleccionada.
      
      Tu respuesta:`;

      // Iniciamos la variable con un valor por defecto ('saludando') para usarla si la detección falla.
      let nombreExpresion = 'saludando';
      
      try {
        // Hacemos una segunda llamada a la misma función backend para que la IA analice su propia respuesta anterior.
        const resExpresion = await fetch('/.netlify/functions/teacher-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: promptExpresion }),
        });

        // Solo procesamos si la petición fue exitosa.
        if (resExpresion.ok) {
          const dataExpresion = await resExpresion.json();
          
          // Si la respuesta contiene texto, lo preparamos para su uso.
          if (dataExpresion.reply) {
            // LIMPIEZA DE DATOS (Sanitization): 
            // 1. lowerCase(): todo a minúsculas.
            // 2. trim(): quitar espacios extra.
            // 3. replace(/[^\w\s]|_/g, ""): eliminar símbolos extraños (puntos, comas, exclamaciones) que la IA pueda haber incluido.
            // 4. replace(/\s+/g, ""): unir palabras si hubiera espacios inesperados.
            // El objetivo es obtener una "palabra pura" (ej: "alegre") para formar la ruta de la imagen correctamente.
            const cleanReply = dataExpresion.reply.toLowerCase().trim().replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");
            
            // VALIDACIÓN ESTRUCTURAL:
            // Verificamos que el resultado limpio esté dentro de las opciones permitidas.
            // Esto evita errores 404 si la IA devuelve algo inesperado como "feliz" en lugar de "alegre".
            if (['alegre', 'dudando', 'triste', 'consoladora'].includes(cleanReply)) {
              nombreExpresion = cleanReply;
            }
          }
        }
      } catch (errExpr) {
        // Capturamos cualquier error en este paso secundario.
        // IMPORTANTE: Usamos console.warn en lugar de lanzar error para que si falla la detección de emoción, 
        // la app no se rompa completamente y siga mostrando el chat y el audio.
        console.warn("No se pudo calcular la expresión:", errExpr.message);
      }

      // Actualizamos la imagen de la Teacher basada en la emoción detectada (o el default).
      // La ruta dinámica cambia automáticamente (ej: /Teacher-alegre.png).
      setImagenTeacher(`/Teacher-${nombreExpresion}.png`);

      // ==================================================================
      // PASO 3: Generar y Reproducir Audio (TTS - Text to Speech)
      // ==================================================================
      
      // Activamos el estado de reproducción para actualizar la UI (mostrar icono, deshabilitar input).
      setReproduciendo(true);
      
      try {
        // Llamamos a nuestra función backend de audio que conecta con Google Translate TTS (u otro servicio).
        const resAudio = await fetch('/.netlify/functions/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: dataText.reply }), // Enviamos el texto generado en el Paso 1.
        });

        // Si la generación de audio fue exitosa...
        if (resAudio.ok) {
          const dataAudio = await resAudio.json();
          
          // Verificamos que hayamos recibido el base64 del audio.
          if (dataAudio.audioBase64) {
             // DECODIFICACIÓN Y CREACIÓN DE BLOB:
             // 1. atob(): Convierte el string base64 recibido a binario crudo.
             // 2. Crear un array de bytes y llenarlo con los códigos Unicode de cada carácter.
             // 3. Transformar ese array en un Uint8Array (formato de datos binarios de JS).
             // 4. Crear un Blob (Binary Large Object) de tipo 'audio/mpeg' para que el navegador lo entienda como sonido.
             const byteCharacters = atob(dataAudio.audioBase64);
             const byteNumbers = new Array(byteCharacters.length);
             for (let i = 0; i < byteCharacters.length; i++) {
               byteNumbers[i] = byteCharacters.charCodeAt(i);
             }
             const byteArray = new Uint8Array(byteNumbers);
             const blob = new Blob([byteArray], { type: 'audio/mpeg' });
             
             // Crear una URL temporal (objectURL) que apunte al Blob en memoria para poder asignarla al elemento <audio>.
             const audioUrl = URL.createObjectURL(blob);
             
             // ACCESO AL DOM DIRECTO:
             // Usamos .current para acceder al elemento HTML real del audio.
             // Asignamos la URL y ejecutamos play().
             if (audioRef.current) {
               audioRef.current.src = audioUrl;
               await audioRef.current.play(); // Esperamos a que termine de cargar/startear el audio.
             }
          }
        } else {
          // Si falla el audio, avisamos en consola pero NO detenemos el flujo de la aplicación.
          console.warn('Audio falló pero chat continúa');
        }
      } catch (audioErr) {
        // Capturamos errores específicos del audio (timeout, red caída, etc.).
        console.warn('Error audio:', audioErr.message);
      }

    } catch (err) {
      // Bloque CATCH GENERAL:
      // Captura cualquier error ocurrido en los pasos 1, 2 o 3 que no haya sido manejado individualmente.
      console.error('Error general:', err);
      // Mostramos un mensaje amigable al usuario derivado del error técnico.
      setErrorMensaje(err.message || 'Problema con Teacher Lily');
    } finally {
      // Bloque FINALLY:
      // Se ejecuta SIEMPRE, sin importar si hubo éxito o error.
      // Restaura la interfaz de usuario a su estado normal (quitando loaders, habilitando botones, limpiando el input).
      setCargando(false);
      setReproduciendo(false);
      setInputValue(''); // Borra el campo de texto para preparar la siguiente interacción.
    }
  }

  // Manejador para cuando termina de reproducirse el audio.
  // Resetea el estado de reproducción para permitir volver a interactuar.
  const handleAudioEnd = () => {
    setReproduciendo(false)
  }

  // --- RENDERIZADO (VISTA) ---
  return (
    <>
      {/* Header/Banner de la aplicación */}
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>
      
      {/* Contenedor Principal centrando el contenido */}
      <div>
        {/* Condicional: Muestra indicador de "Escuchando" solo si el estado de reproducción es true */}
        {reproduciendo && (
          <div>
            🔊 Teacher está hablando...
          </div>
        )}
        
        {/* Formulario que captura la interacción del usuario */}
        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          {/* Imagen dinámica: Cambia su fuente (src) según el estado imagenTeacher */}
          <img
            src={imagenTeacher}
            alt="Teacher"
            className='EnglishTeacher'
            // onErrore: Si la imagen falla al cargar (ej: archivo no encontrado), oculta el elemento para no mostrar el icono de error feo.
            onError={(e) => { e.target.style.display = 'none' }}
          />
          
          {/* Input de texto: Controlado por React (value) y actualizado con onChange */}
          <input className='inputTeacher'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            type="text"
            placeholder="Escribe tu pregunta en inglés..."
            // Deshabilitado visualmente mientras se carga o reproduce audio.
            disabled={cargando || reproduciendo}
          />
          
          {/* Botón de envío: Texto dinámico según el estado (cargando/reproduciendo/enviar) */}
          <button className='botonTeacher'
            type="submit"
            // Lógica de deshabilitado: No enviar si está cargando, reproduciendo o está vacío.
            disabled={cargando || reproduciendo || !inputValue.trim()}
          >
            {cargando ? '⏳ Pensando...' : reproduciendo ? '🔊 Escuchando...' : 'Enviar'}
          </button>
        </form>

        {/* Mostrar mensaje de error si existe (condicional) */}
        {errorMensaje && (
          <p>
            ⚠️ {errorMensaje}
          </p>
        )}

        {/* Mostrar respuesta de la IA si existe (condicional) */}
        {respuestaIA && (
          <div className='respuestaTeacher'>
            <strong>Teacher Lily dice:</strong><br/>
            <span>{respuestaIA}</span>
          </div>
        )}

        {/* Elemento de audio oculto (display: none en CSS) que maneja la reproducción */}
        <audio ref={audioRef} style={{ display: 'none' }} onEnded={handleAudioEnd} />
      </div>
    </>
  )
}

export default App