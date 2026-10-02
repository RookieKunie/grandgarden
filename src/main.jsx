import { Buffer } from 'buffer'; globalThis.Buffer = Buffer;
import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App.jsx'; import './index.css';

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)