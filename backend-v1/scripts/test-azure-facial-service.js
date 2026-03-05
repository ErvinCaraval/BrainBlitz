/**
 * Script para probar la conexión con el servicio facial en Azure
 * Uso: node scripts/test-azure-facial-service.js
 */

const axios = require('axios');

// URLs a probar
const urls = [
  'http://facial-service-ervin.brazilsouth.azurecontainer.io:5001/health',
  'http://20.201.44.212:5001/health'
];

async function testConnection(url) {
  try {
    console.log(`\n🔍 Probando: ${url}`);
    const response = await axios.get(url, { timeout: 10000 });
    console.log(`✅ ÉXITO - Status: ${response.status}`);
    console.log(`   Respuesta:`, JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ Error HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      console.log(`❌ Sin respuesta del servidor (timeout o conexión rechazada)`);
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Probando conexión con el servicio facial en Azure...\n');
  
  let success = false;
  for (const url of urls) {
    const result = await testConnection(url);
    if (result) {
      success = true;
      console.log(`\n✅ URL funcional encontrada: ${url}`);
      console.log(`\n💡 Actualiza tu .env con:`);
      const baseUrl = url.replace('/health', '');
      console.log(`   DEEPFACE_SERVICE_URL=${baseUrl}`);
      break;
    }
    // Esperar un poco entre intentos
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (!success) {
    console.log('\n❌ No se pudo conectar con ninguna URL.');
    console.log('\n💡 Verifica:');
    console.log('   1. Que el contenedor en Azure esté ejecutándose');
    console.log('   2. Que el puerto esté correctamente mapeado (80 o 5001)');
    console.log('   3. Que el firewall de Azure permita conexiones entrantes');
    console.log('   4. Que el servicio esté escuchando en 0.0.0.0 (no solo localhost)');
  }
}

main().catch(console.error);

