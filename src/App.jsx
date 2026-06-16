import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [inputValue, setInputValue] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')
  const [reproduciendo, setReproduciendo] = useState(false)

  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png')
  const audioRef = useRef(null)

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
      // 1. TEXTO
      const resText = await fetch('/.netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue }),
      })

      if (!resText.ok) {
        const errorData = await resText.json().catch(() => ({}))
        throw new Error(errorData.error || `Error del servidor: ${resText.status}`)
      }

      const dataText = await resText.json()

      if (dataText.reply) {
        setRespuestaIA(dataText.reply)
        setImagenTeacher(`/Teacher-${obtenerExpresion(dataText.reply)}.jpg`)

        // 2. AUDIO
        setReproduciendo(true)
        try {
          const resAudio = await fetch('/.netlify/functions/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: dataText.reply }),
          })

          if (resAudio.ok) {
            const dataAudio = await resAudio.json()
            
            if (dataAudio.audioBase64) {
              const byteCharacters = atob(dataAudio.audioBase64)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              const blob = new Blob([byteArray], { type: 'audio/mpeg' })
              const audioUrl = URL.createObjectURL(blob)

              if (audioRef.current) {
                audioRef.current.src = audioUrl
                await audioRef.current.play()
              }
            }
          } else {
            console.warn('Audio falló pero chat continúa')
          }
        } catch (audioErr) {
          console.warn('Error audio:', audioErr.message)
        }
      } else {
        setErrorMensaje('No se recibió respuesta de la profesora.')
      }
    } catch (err) {
      console.error('Error general:', err)
      setErrorMensaje(err.message || 'Problema con Teacher Lily')
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
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        padding: '10px',
        maxWidth: '500px',
        margin: '20px auto'
      }}>
        <img
          src={imagenTeacher}
          alt="Teacher"
          className='EnglishTeacher'
          style={{ width: '150px', height: 'auto', marginBottom: '15px', opacity: reproduciendo ? 0.8 : 1 }}
          onError={(e) => { e.target.style.display = 'none' }}
        />

        {reproduciendo && (
          <div style={{ color: '#4A90E2', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
            🔊 Teacher está hablando...
          </div>
        )}

        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            type="text"
            placeholder="Escribe tu pregunta en inglés..."
            disabled={cargando || reproduciendo}
            style={{ padding: '10px', fontSize: '16px', width: '70%', marginRight: '10px', opacity: cargando || reproduciendo ? 0.6 : 1 }}
          />
          <button
            type="submit"
            disabled={cargando || reproduciendo || !inputValue.trim()}
            style={{ padding: '10px 20px', backgroundColor: '#4A90E2', color: 'white', border: 'none', borderRadius: '5px', cursor: (cargando || reproduciendo) ? 'not-allowed' : 'pointer', opacity: cargando || reproduciendo ? 0.6 : 1 }}
          >
            {cargando ? '⏳ Pensando...' : reproduciendo ? '🔊 Escuchando...' : 'Enviar'}
          </button>
        </form>

        {errorMensaje && (
          <p style={{ color: 'red', marginTop: '15px', fontWeight: 'bold' }}>
            ⚠️ {errorMensaje}
          </p>
        )}

        {respuestaIA && (
          <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px', textAlign: 'left' }}>
            <strong>Teacher Lily dice:</strong><br/>
            <span style={{ marginTop: '10px', display: 'block', lineHeight: '1.5' }}>{respuestaIA}</span>
          </div>
        )}

        <audio ref={audioRef} style={{ display: 'none' }} onEnded={handleAudioEnd} />
      </div>
    </>
  )
}

export default App