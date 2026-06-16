import { useState, useRef } from 'react'
import './App.css'

function App() {
  // --- ESTADOS DEL CHAT ---
  const [inputValue, setInputValue] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')
  const [reproduciendo, setReproduciendo] = useState(false)

  // --- ESTADO DE IMÁGENES ---
  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png')
  const audioRef = useRef(null)

  // Función para detectar expresiones
  const obtenerExpresion = (texto) => {
    if (!texto) return 'saludando'
    const t = texto.toLowerCase()
    if (t.includes('feliz') || t.includes('gracias') || t.includes('bueno')) return 'alegre'
    if (t.includes('ayuda') || t.includes('duda') || t.includes('pregunta')) return 'dudando'
    if (t.includes('triste') || t.includes('mal')) return 'triste'
    if (t.includes('consuelo') || t.includes('lindo')) return 'consoladora'
    return 'saludando'
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()

    if (!inputValue.trim()) return

    setCargando(true)
    setErrorMensaje('')
    setRespuestaIA('')
    setImagenTeacher('/Teacher-saludando.png')

    try {
      // 1. LLAMADA AL CHAT (obtener respuesta de texto)
      console.log('[App] Enviando pregunta a teacher-chat...')
      const resText = await fetch('/.netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue }),
      })

      if (!resText.ok) {
        const errorData = await resText.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Error del servidor: ${resText.status}`
        )
      }

      const dataText = await resText.json()

      if (dataText.reply) {
        setRespuestaIA(dataText.reply)

        // Cambiar expresión de Teacher
        const expresion = obtenerExpresion(dataText.reply)
        setImagenTeacher(`/Teacher-${expresion}.jpg`)

        // 2. LLAMADA AL AUDIO (generar síntesis de voz)
        console.log('[App] Generando audio...')
        try {
          setReproduciendo(true)
          const resAudio = await fetch('/.netlify/functions/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: dataText.reply }),
          })

          if (!resAudio.ok) {
            const errorData = await resAudio.json().catch(() => ({}))
            console.warn('[App] Error en generate-audio:', errorData.error)
            setReproduciendo(false)
            return // Continuar sin audio
          }

          const dataAudio = await resAudio.json()

          if (dataAudio.audioBase64) {
            console.log('[App] Audio recibido, decodificando...')
            
            // Convertir base64 a Blob
            const byteCharacters = atob(dataAudio.audioBase64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'audio/mpeg' })
            const audioUrl = URL.createObjectURL(blob)

            // Reproducir
            if (audioRef.current) {
              audioRef.current.src = audioUrl
              audioRef.current
                .play()
                .then(() => {
                  console.log('[App] Audio reproduciéndose...')
                })
                .catch((e) => {
                  console.warn('[App] Error al reproducir audio:', e.message)
                  setReproduciendo(false)
                })
            }
          }
        } catch (audioErr) {
          console.warn('[App] Error de audio (continuando con chat):', audioErr.message)
          setReproduciendo(false)
        }
      } else {
        setErrorMensaje('No se recibió respuesta de la profesora.')
      }
    } catch (err) {
      console.error('[App] Error general:', err)
      setErrorMensaje(err.message || 'Hubo un problema conectando con Teacher Lily.')
    } finally {
      setCargando(false)
      setReproduciendo(false)
      setInputValue('')
    }
  }

  const handleAudioEnd = () => {
    setReproduciendo(false)
  }

  return (
    <>
      {/* Banner superior */}
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>

      {/* Contenedor Principal */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '20px',
          padding: '10px',
          maxWidth: '500px',
          margin: '20px auto',
        }}
      >
        {/* Imagen de Teacher */}
        <img
          src={imagenTeacher}
          alt="Teacher"
          className='EnglishTeacher'
          style={{
            width: '150px',
            height: 'auto',
            marginBottom: '15px',
            transition: 'opacity 0.3s ease',
            opacity: reproduciendo ? 0.8 : 1,
          }}
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />

        {/* Indicador de reproducción */}
        {reproduciendo && (
          <div style={{ 
            color: '#4A90E2', 
            marginBottom: '10px', 
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            🔊 Teacher está hablando...
          </div>
        )}

        {/* Formulario de Input */}
        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            type="text"
            placeholder="Escribe tu pregunta en inglés..."
            disabled={cargando || reproduciendo}
            style={{
              padding: '10px',
              fontSize: '16px',
              width: '70%',
              marginRight: '10px',
              opacity: cargando || reproduciendo ? 0.6 : 1,
            }}
          />
          <button
            type="submit"
            disabled={cargando || reproduciendo || !inputValue.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4A90E2',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: cargando || reproduciendo ? 'not-allowed' : 'pointer',
              opacity: cargando || reproduciendo ? 0.6 : 1,
            }}
          >
            {cargando ? '⏳ Pensando...' : reproduciendo ? '🔊 Escuchando...' : 'Enviar'}
          </button>
        </form>

        {/* Área de Respuesta */}
        {errorMensaje && (
          <p style={{ color: 'red', marginTop: '15px', fontWeight: 'bold' }}>
            ⚠️ {errorMensaje}
          </p>
        )}

        {respuestaIA && (
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              background: '#f0f0f0',
              borderRadius: '8px',
              textAlign: 'left',
            }}
          >
            <strong>Teacher Lily dice:</strong>
            <br />
            <span style={{ marginTop: '10px', display: 'block', lineHeight: '1.5' }}>
              {respuestaIA}
            </span>
          </div>
        )}

        {/* Elemento de audio oculto */}
        <audio 
          ref={audioRef} 
          style={{ display: 'none' }}
          onEnded={handleAudioEnd}
        />
      </div>
    </>
  )
}

export default App
