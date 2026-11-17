// Se importa la primera en el layout raíz para capturar errores desde el arranque.
import './polyfills';
import { installJsErrorHandler } from './crash';

installJsErrorHandler();
