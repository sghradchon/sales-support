// import React from "react";
// import ReactDOM from "react-dom/client";
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import '@aws-amplify/ui-react/styles.css'
import { ChakraProvider } from '@chakra-ui/react';


Amplify.configure(outputs);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
  <ChakraProvider >
  <App />
    </ChakraProvider>
  </StrictMode>,
);
