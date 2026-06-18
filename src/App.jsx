import { useState, useRef } from 'react'
import './App.css'

function App() {
  console.log('holaa')
  const [inputValue, setInputValue] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')
  const [reproduciendo, setReproduciendo] = useState(false)

  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png')
  const audioRef = useRef(null)

  const obtenerExpresion = (texto) => texto

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setCargando(true)
    setErrorMensaje('')
    setRespuestaIA('')
    setReproduciendo(false)

    try {
      // PASO 1: Texto
      const resText = await fetch('/.netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue }),
      });

      if (!resText.ok) {
        const errorData = await resText.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor: ${resText.status}`);
      }

      const dataText = await resText.json();

      if (!dataText.reply) {
        throw new Error("La profesora no respondió texto.");
      }

      setRespuestaIA(dataText.reply);

      // PASO 2: Expresión
      const promptExpresion = `Analiza el siguiente mensaje de Teacher Lily y elige UNA SOLA palabra de esta lista exacta: [alegre, dudando, triste, consoladora]. 
      
      Mensaje: "${dataText.reply}"
      
      Reglas:
      - Si hay alegría o felicidad, responde: alegre
      - Si hay duda o pregunta, responde: dudando
      - Si hay tristeza o lástima, responde: triste
      - Si hay consuelo o empatía, responde: consoladora
      - NO respondas nada más que la palabra seleccionada.
      
      Tu respuesta:`;

      let nombreExpresion = 'saludando';
      
      try {
        const resExpresion = await fetch('/.netlify/functions/teacher-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: promptExpresion }),
        });

        if (resExpresion.ok) {
          const dataExpresion = await resExpresion.json();
          if (dataExpresion.reply) {
            const cleanReply = dataExpresion.reply.toLowerCase().trim().replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");
            
            if (['alegre', 'dudando', 'triste', 'consoladora'].includes(cleanReply)) {
              nombreExpresion = cleanReply;
            }
          }
        }
      } catch (errExpr) {
        console.warn("No se pudo calcular la expresión:", errExpr.message);
      }

      setImagenTeacher(`/Teacher-${nombreExpresion}.png`);

      // PASO 3: Audio
      setReproduciendo(true);
      try {
        const resAudio = await fetch('/.netlify/functions/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: dataText.reply }),
        });

        if (resAudio.ok) {
          const dataAudio = await resAudio.json();
          if (dataAudio.audioBase64) {
             const byteCharacters = atob(dataAudio.audioBase64);
             const byteNumbers = new Array(byteCharacters.length);
             for (let i = 0; i < byteCharacters.length; i++) {
               byteNumbers[i] = byteCharacters.charCodeAt(i);
             }
             const byteArray = new Uint8Array(byteNumbers);
             const blob = new Blob([byteArray], { type: 'audio/mpeg' });
             const audioUrl = URL.createObjectURL(blob);
             
             if (audioRef.current) {
               audioRef.current.src = audioUrl;
               await audioRef.current.play();
             }
          }
        } else {
          console.warn('Audio falló pero chat continúa');
        }
      } catch (audioErr) {
        console.warn('Error audio:', audioErr.message);
      }

    } catch (err) {
      console.error('Error general:', err);
      setErrorMensaje(err.message || 'Problema con Teacher Lily');
    } finally {
      setCargando(false);
      setReproduciendo(false);
      setInputValue('');
    }
  }

  const handleAudioEnd = () => {
    setReproduciendo(false)
  }

  return (
    <>
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>
      
      <div>
        {reproduciendo && (
          <div>
            🔊 Teacher está hablando...
          </div>
        )}
        
        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          <img
            src={imagenTeacher}
            alt="Teacher"
            className='EnglishTeacher'
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            type="text"
            placeholder="Escribe tu pregunta en inglés..."
            disabled={cargando || reproduciendo}
          />
          <button
            type="submit"
            disabled={cargando || reproduciendo || !inputValue.trim()}
          >
            {cargando ? '⏳ Pensando...' : reproduciendo ? '🔊 Escuchando...' : 'Enviar'}
          </button>
        </form>

        {errorMensaje && (
          <p>
            ⚠️ {errorMensaje}
          </p>
        )}

        {respuestaIA && (
          <div>
            <strong>Teacher Lily dice:</strong><br/>
            <span>{respuestaIA}</span>
          </div>
        )}

        <audio ref={audioRef} style={{ display: 'none' }} onEnded={handleAudioEnd} />
      </div>
    </>
  )
}

export default App