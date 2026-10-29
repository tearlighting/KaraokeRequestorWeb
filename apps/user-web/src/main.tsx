import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { markStandaloneDisplay } from './pwa';
import './styles.css';

markStandaloneDisplay();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
