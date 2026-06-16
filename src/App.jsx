import { useEffect, useState, useRef } from 'react'
import './App.css'

function App() {
  // Estado de las imágenes
  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png')
  
  // Estado del chat
  const [inputValue, setInputValue] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoAudio, setCargandoAudio] = useState(false)
  
  // Ref para el audio
  const audioRef = useRef(null)

  // Palabras clave simples para cambiar la expresión (para mostrar lógica básica al empleador)
  const obtenerExpresion = (texto) => {
    const t = texto.toLowerCase()
    if (t.includes('feliz') || t.includes('gracias') || t.includes('bueno')) return 'alegre'
    if (t.includes('ayuda') || t.includes('no entiendo') || t.includes('duda')) return 'dudando'
    if (t.includes('triste') || t.includes('mal') || t.includes('duelo')) return 'triste'
    if (t.includes('consuelo') || t.includes('lindo')) return 'consoladora'
    return 'saludando' // Default
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setCargando(true)
    setRespuestaIA('') // Limpiar respuesta anterior
    
    try {
      // 1. Llamar a Teacher Lily (Groq)
      const resText = await fetch('/.netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue }),
      })
      
      const dataText = await resText.json()
      
      if (dataText.reply) {
        setRespuestaIA(dataText.reply)
        
        // 2. Cambiar imagen basada en la respuesta (Lógica simple)
        const expresion = obtenerExpresion(dataText.reply)
        setImagenTeacher(`/Teacher-${expresion}.jpg`)

        // 3. Generar Audio con el texto de la respuesta
        setCargandoAudio(true)
        const resAudio = await fetch('/.netlify/functions/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: dataText.reply }),
        })
        
        const dataAudio = await resAudio.json()
        
        if (dataAudio.audioBase64) {
          // Convertir base64 a Blob URL para reproducir
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
            audioRef.current.play()
          }
        }
      }
    } catch (err) {
      console.error("Error:", err)
      alert("Hubo un error conectando con la profesora.")
    } finally {
      setCargando(false)
      setCargandoAudio(false)
    }
  }

  return (
    <>
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <img src={imagenTeacher} alt="Teacher" className='EnglishTeacher' />
        
        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          <input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            type="text" 
            placeholder="Escribe tu pregunta..."
            disabled={cargando}
          />
          <button type="submit" disabled={cargando}>
            {cargando ? 'Pensando...' : 'Enviar'}
          </button>
        </form>

        {/* Mostrar respuesta */}
        {respuestaIA && (
          <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '8px' }}>
            <strong>Teacher Lily dice:</strong><br/>
            {respuestaIA}
          </div>
        )}
        
        {/* Elemento de audio oculto */}
        <audio ref={audioRef} controls style={{ display: 'none' }} />
        
        {cargandoAudio && <p>🔊 Generando voz...</p>}
      </div>
    </>
  )
}

export default App