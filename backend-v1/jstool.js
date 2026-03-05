#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const VERSION = '2.0.0';
const SCRIPT_NAME = path.basename(process.argv[1]);

const HELP_MESSAGE = `
Uso: ${SCRIPT_NAME} [banderas] '<consulta_js>' [archivo_json]

Una herramienta para procesar JSON usando JavaScript directamente desde la línea de comandos.

Argumentos:
  <consulta_js>      Una cadena de texto con código JavaScript para procesar el JSON.
                     El JSON de entrada está disponible en una variable llamada 'data'.
  [archivo_json]     Ruta al archivo JSON de entrada. Si no se especifica,
                     se leerá desde la entrada estándar (stdin, usando pipe).

Banderas:
  -h, --help         Muestra este mensaje de ayuda.
  -v, --version      Muestra la versión de la herramienta.
  -c, --compact      Imprime el resultado en formato compacto (una sola línea).

Ejemplos:
  # Obtener el nombre del primer usuario desde un archivo
  ${SCRIPT_NAME} 'data.users[0].name' users.json

  # Filtrar usuarios activos usando un pipe
  cat users.json | ${SCRIPT_NAME} 'data.users.filter(u => u.isActive)'

  # Transformar datos y mostrarlos en formato compacto
  cat users.json | ${SCRIPT_NAME} -c 'data.users.map(u => ({ id: u.id }))'
`;

// --- Funciones auxiliares ---

function getInputJson(filePath) {
  let jsonString;
  try {
    if (filePath) {
      jsonString = fs.readFileSync(filePath, 'utf8');
    } else {
      jsonString = fs.readFileSync(0, 'utf-8'); // Lee desde stdin
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: No se encontró el archivo en la ruta: ${filePath}`);
    } else {
      console.error(`❌ Error al leer la fuente de datos: ${error.message}`);
    }
    process.exit(1);
  }

  if (!jsonString || jsonString.trim() === '') {
    console.error('❌ Error: La fuente de datos JSON está vacía.');
    process.exit(1);
  }
  
  return jsonString;
}

// --- Función principal ---
function main() {
  let args = process.argv.slice(2);

  // Manejo de banderas
  if (args.includes('-h') || args.includes('--help')) {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`${SCRIPT_NAME} versión ${VERSION}`);
    process.exit(0);
  }

  const isCompact = args.includes('-c') || args.includes('--compact');
  if (isCompact) {
    args = args.filter(arg => arg !== '-c' && arg !== '--compact');
  }

  const [query, filePath] = args;

  if (!query) {
    console.error('❌ Error: No se proporcionó ninguna consulta.');
    console.log(HELP_MESSAGE);
    process.exit(1);
  }

  const jsonString = getInputJson(filePath);
  let data;

  try {
    data = JSON.parse(jsonString);
  } catch (error) {
    console.error(`❌ Error: El JSON de entrada no es válido. Verifica la sintaxis.\n   Detalle: ${error.message}`);
    process.exit(1);
  }

  try {
    // ✅ SECURITY FIX: Use whitelist of allowed operations instead of dynamic code execution
    // Prevents RCE vulnerability from arbitrary JavaScript execution
    
    const allowedOperations = {
      // Access nested properties: 'data.users[0].name'
      'get': (data, queryPath) => {
        const parts = queryPath.split(/[\[\]\.]+/).filter(p => p);
        let result = data;
        for (const part of parts) {
          if (result == null) return undefined;
          result = result[part];
        }
        return result;
      },
      
      // Filter: 'filter:userId==123'
      'filter': (data, config) => {
        if (!Array.isArray(data)) return data;
        const [key, operator, value] = config.split(/(==|!=|>|<)/);
        return data.filter(item => {
          switch(operator) {
            case '==': return String(item[key.trim()]) === String(value.trim());
            case '!=': return String(item[key.trim()]) !== String(value.trim());
            case '>': return Number(item[key.trim()]) > Number(value);
            case '<': return Number(item[key.trim()]) < Number(value);
            default: return true;
          }
        });
      },
      
      // Map: 'map:id,name'
      'map': (data, fields) => {
        if (!Array.isArray(data)) return data;
        const fieldList = fields.split(',').map(f => f.trim());
        return data.map(item => {
          const obj = {};
          fieldList.forEach(field => {
            obj[field] = item[field];
          });
          return obj;
        });
      },
      
      // Sort: 'sort:name:asc'
      'sort': (data, config) => {
        if (!Array.isArray(data)) return data;
        const [field, order] = config.split(':');
        const sorted = [...data].sort((a, b) => {
          if (a[field] < b[field]) return -1;
          if (a[field] > b[field]) return 1;
          return 0;
        });
        return order === 'desc' ? sorted.reverse() : sorted;
      },
      
      // Length/Count: 'length'
      'length': (data) => {
        return Array.isArray(data) ? data.length : (data ? 1 : 0);
      }
    };

    // Parse query format: 'operation:params'
    const [operation, ...params] = query.split(':');
    const opFunc = allowedOperations[operation.toLowerCase()];
    
    if (!opFunc) {
      throw new Error(`❌ Operation not allowed: '${operation}'. Allowed: get, filter, map, sort, length`);
    }

    let result = opFunc(data, params.join(':'));

    // Si el resultado es undefined, lo convertimos a null para que sea visible.
    if (result === undefined) {
      result = null;
    }

    const output = JSON.stringify(result, null, isCompact ? 0 : 2);
    console.log(output);

  } catch (error) {
    if (error instanceof TypeError && error.message.includes('circular structure')) {
        console.error(`❌ Error: El resultado de tu consulta contiene una referencia circular que no se puede convertir a JSON.`);
    } else {
        console.error(`❌ Error en tu consulta de JavaScript: ${error.message}`);
    }
    process.exit(1);
  }
}

main();