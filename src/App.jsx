import { useState, useRef } from 'react'
import './App.css'

function App() {
  // --- ESTADOS DEL CHAT ---
  const [inputValue, setInputValue] = useState('')
  const [respuestaIA, setRespuestaIA] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')

  // --- ESTADO DE IMÁGENES (Lo dejaremos básico por ahora) ---
  const [imagenTeacher, setImagenTeacher] = useState('/Teacher-saludando.png')
  const audioRef = useRef(null)

  // Función para detectar expresiones simples (Lógica educativa para el portafolio)
  const obtenerExpresion = (texto) => {
    if (!texto) return 'saludando'
    const t = texto.toLowerCase()
    if (t.includes('feliz') || t.includes('gracias') || t.includes('bueno')) return 'alegre'
    if (t.includes('ayuda') || t.includes('duda') || t.includes('pregunta')) return 'dudando'
    if (t.includes('triste') || t.includes('mal') || t.includes('ayuda')) return 'triste'
    if (t.includes('consuelo') || t.includes('lindo')) return 'consoladora'
    return 'saludando'
  }

  // Lógica principal al enviar mensaje
  const manejarEnvio = async (e) => {
    e.preventDefault()
    
    // 1. Validaciones básicas
    if (!inputValue.trim()) return
    
    setCargando(true)
    setErrorMensaje('')
    setRespuestaIA('') // Limpiar respuesta anterior
    setImagenTeacher('/Teacher-saludando.png') // Reset imagen

    try {
      // 2. Llamar a Teacher Lily (Groq API - Texto)
      const resText = await fetch('/netlify/functions/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue }),
      })
      
      // Verificar si hubo errores HTTP antes de intentar leer JSON
      if (!resText.ok) {
        throw new Error(`Error del servidor: ${resText.status}`)
      }

      const dataText = await resText.json()
      
      if (dataText.reply) {
        // MOSTRAR TEXTO
        setRespuestaIA(dataText.reply)
        
        // CAMBIAR IMAGEN
        const expresion = obtenerExpresion(dataText.reply)
        setImagenTeacher(`/Teacher-${expresion}.jpg`)
        
        // GENERAR AUDIO (OPCIONAL - Si falla no bloquea el chat)
        console.log("Intentando generar audio...")
        try {
          const resAudio = await fetch('/netlify/functions/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: dataText.reply }),
          })
          
          if (resAudio.ok) {
            const dataAudio = await resAudio.json()
            
            if (dataAudio.audioBase64) {
              // Convertir base64 a Blob URL
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
                audioRef.current.play().catch(e => console.log("Error al reproducir:", e))
              }
            }
          } else {
            console.warn("La función de audio no está disponible aún.")
          }
        } catch (audioErr) {
          // Silenciar el error de audio para no molestar al usuario
          console.warn("Audio falló pero el chat continúa:", audioErr.message)
        }
        
      } else {
        setErrorMensaje("No se recibió respuesta de la profesora.")
      }

    } catch (err) {
      console.error("Error general:", err)
      setErrorMensaje("Hubo un problema conectando con Teacher Lily. Revisa la consola.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {/* Banner superior */}
      <div className='banner'>
        <h1 className='Titulo'>English Teacher con IA</h1>
      </div>
      
      {/* Contenedor Principal */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px', 
        padding: '10px',
        maxWidth: '500px',
        margin: '20px auto'
      }}>
        
        {/* Imagen de Teacher (Placeholder hasta que cargues las imágenes reales) */}
        <img 
          src={imagenTeacher} 
          alt="Teacher" 
          className='EnglishTeacher' 
          style={{ width: '150px', height: 'auto', marginBottom: '15px' }}
          onError={(e) => {
            // Si falla cargar la imagen, mostrar un placeholder
            e.target.style.display = 'none'
          }}
        />
        
        {/* Formulario de Input */}
        <form className='hablarConTeacher' onSubmit={manejarEnvio}>
          <input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            type="text" 
            placeholder="Escribe tu pregunta en inglés..."
            disabled={cargando}
            style={{ 
              padding: '10px', 
              fontSize: '16px', 
              width: '70%',
              marginRight: '10px'
            }}
          />
          <button 
            type="submit" 
            disabled={cargando || !inputValue.trim()}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#4A90E2',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}
          >
            {cargando ? 'Pensando...' : 'Enviar'}
          </button>
        </form>

        {/* Área de Respuesta */}
        {errorMensaje && (
          <p style={{ color: 'red', marginTop: '15px' }}>{errorMensaje}</p>
        )}
        
        {respuestaIA && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f0f0f0', 
            borderRadius: '8px',
            textAlign: 'left'
          }}>
            <strong>Teacher Lily dice:</strong><br/>
            <span style={{ marginTop: '10px', display: 'block', lineHeight: '1.5' }}>
              {respuestaIA}
            </span>
          </div>
        )}
        
        {/* Elemento de audio oculto */}
        <audio ref={audioRef} controls style={{ display: 'none' }} />
      </div>
    </>
  )
}

export default App