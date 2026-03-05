/**
 * Script de diagnóstico para el servicio facial
 * Verifica la configuración y conectividad
 */

require('dotenv').config();
const axios = require('axios');
const deepfaceService = require('../services/deepface.service');

async function diagnose() {
  console.log('🔍 Diagnóstico del Servicio Facial\n');
  console.log('='.repeat(60));
  
  // 1. Verificar variable de entorno
  console.log('\n1️⃣ Verificando variable de entorno:');
  const envUrl = process.env.DEEPFACE_SERVICE_URL;
  if (envUrl) {
    console.log(`   ✅ DEEPFACE_SERVICE_URL está definida: ${envUrl}`);
  } else {
    console.log(`   ⚠️  DEEPFACE_SERVICE_URL NO está definida`);
  }
  
  // 2. Verificar URL en el servicio
  console.log('\n2️⃣ URL configurada en el servicio:');
  console.log(`   ${deepfaceService.baseURL}`);
  
  // 3. Probar conexión directa con axios
  console.log('\n3️⃣ Probando conexión directa:');
  try {
    const response = await axios.get(`${deepfaceService.baseURL}/health`, {
      timeout: 10000
    });
    console.log(`   ✅ Conexión exitosa`);
    console.log(`   Respuesta:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`   ❌ Error de conexión:`);
    console.log(`   - Código: ${error.code || 'N/A'}`);
    console.log(`   - Mensaje: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   → El servicio no está accesible en ${deepfaceService.baseURL}`);
      console.log(`   → Verifica que el servicio esté ejecutándose`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`   → Timeout al conectar`);
      console.log(`   → El servicio puede estar sobrecargado o inaccesible`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`   → No se puede resolver el DNS`);
      console.log(`   → Verifica que la URL sea correcta`);
    }
  }
  
  // 4. Probar healthCheck del servicio
  console.log('\n4️⃣ Probando healthCheck del servicio:');
  try {
    const result = await deepfaceService.healthCheck();
    console.log(`   ✅ Health check exitoso`);
    console.log(`   Resultado:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(`   ❌ Health check falló:`);
    console.log(`   - Error: ${error.message}`);
  }
  
  // 5. Resumen
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Resumen:');
  console.log(`   URL configurada: ${deepfaceService.baseURL}`);
  console.log(`   Variable de entorno: ${envUrl || 'NO DEFINIDA'}`);
  console.log(`\n💡 Si hay errores:`);
  console.log(`   1. Verifica que el archivo .env tenga DEEPFACE_SERVICE_URL`);
  console.log(`   2. Reinicia el backend después de cambiar .env`);
  console.log(`   3. Verifica que el servicio en Azure esté ejecutándose`);
  console.log(`   4. Revisa los logs del backend para más detalles\n`);
}

diagnose().catch(console.error);

