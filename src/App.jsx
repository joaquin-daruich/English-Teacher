
import { useEffect, useState } from 'react'
import './app.css'

function App() {
const [ImagenTeacher, setImagenTeacher] =  useState('/Teacher-saludando.png')
const TextoParaIa = ['']
const CrearTextoParaIa = (e) => {
TextoParaIa[0] = e.target.value
}
const expresiones = ['alegre', 'dudando', 'triste' , 'consoladora']


const CambiarImagen =  (expresion) => {
  if (expresiones.includes(expresion)) {
    setImagenTeacher('/Teacher-'+ expresion + '.jpg')
  }
}

const RecibirTextoYPreguntarExpresion =  (texto) => {
  CambiarImagen(texto)
}

const HacerPregunta =  (e) => {
  e.preventDefault(),
  RecibirTextoYPreguntarExpresion(TextoParaIa[0])
}
  return (
    <>
<div className='banner'>
  <h1 className='Titulo'>English Teacher con IA</h1>
</div>
<div>
<form className='hablarConTeacher' action="submit" onSubmit={HacerPregunta}>
  <img src={ImagenTeacher} className='EnglishTeacher'></img>
  <input onChange={CrearTextoParaIa} type="text" />
</form>
    
</div>
    </>
  )
}

export default App
