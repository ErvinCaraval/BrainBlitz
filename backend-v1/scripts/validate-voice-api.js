#!/usr/bin/env node

/**
 * Script de Validación Completa de la API de Voz
 * Verifica que todas las funcionalidades estén funcionando correctamente
 */

const axios = require('axios');

// Configuración
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_USER_ID = 'test-user-validation-' + Date.now();
const TEST_QUESTION_ID = 'test-question-validation-' + Date.now();

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : 'red';
  const statusSymbol = status === 'PASS' ? '✅' : '❌';
  log(`${statusSymbol} ${testName}: ${status}`, statusColor);
  if (details) log(`   ${details}`, 'yellow');
}

// Tests de validación
const tests = [
  {
    name: 'Voice Controller - Validar respuesta válida',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-responses/validate`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        voiceResponse: 'A',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });
      
      if (response.status === 200 && response.data.valid === true) {
        return { status: 'PASS', details: `Matched: ${response.data.matchedOption}` };
      }
      return { status: 'FAIL', details: `Status: ${response.status}, Valid: ${response.data.valid}` };
    }
  },
  
  {
    name: 'Voice Controller - Rechazar respuesta inválida',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-responses/validate`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        voiceResponse: 'xyz invalid response',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });
      
      if (response.status === 200 && response.data.valid === false) {
        return { status: 'PASS', details: 'Correctly rejected invalid response' };
      }
      return { status: 'FAIL', details: `Expected invalid, got valid: ${response.data.valid}` };
    }
  },
  
  {
    name: 'Voice Controller - Validar por posición',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-responses/validate`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        voiceResponse: 'primera opción',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });
      
      if (response.status === 200 && response.data.valid === true && response.data.answerIndex === 0) {
        return { status: 'PASS', details: `Matched by position: ${response.data.matchedOption}` };
      }
      return { status: 'FAIL', details: `Position matching failed` };
    }
  },
  
  {
    name: 'Voice Controller - Validar por número',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-responses/validate`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        voiceResponse: '2',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });
      
      if (response.status === 200 && response.data.valid === true && response.data.answerIndex === 1) {
        return { status: 'PASS', details: `Matched by number: ${response.data.matchedOption}` };
      }
      return { status: 'FAIL', details: `Number matching failed` };
    }
  },
  
  {
    name: 'Voice Controller - Manejar campos faltantes',
    test: async () => {
      try {
        await axios.post(`${BASE_URL}/api/voice-responses/validate`, {
          userId: TEST_USER_ID
        });
        return { status: 'FAIL', details: 'Should have returned 400 error' };
      } catch (error) {
        if (error.response && error.response.status === 400) {
          return { status: 'PASS', details: 'Correctly returned 400 for missing fields' };
        }
        return { status: 'FAIL', details: `Unexpected error: ${error.message}` };
      }
    }
  },
  
  {
    name: 'Voice Controller - Procesar respuesta',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-responses/process`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        voiceResponse: 'B',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });
      
      if (response.status === 200 && response.data.success === true) {
        return { status: 'PASS', details: `Processed successfully` };
      }
      return { status: 'FAIL', details: `Processing failed` };
    }
  },
  
  {
    name: 'Voice Controller - Estadísticas',
    test: async () => {
      const response = await axios.get(`${BASE_URL}/api/voice-responses/stats/${TEST_USER_ID}`);
      
      if (response.status === 200 && response.data.hasOwnProperty('totalAttempts')) {
        return { status: 'PASS', details: `Stats retrieved: ${response.data.totalAttempts} attempts` };
      }
      return { status: 'FAIL', details: `Stats retrieval failed` };
    }
  },
  
  {
    name: 'AssemblyAI - Estado del servicio',
    test: async () => {
      const response = await axios.get(`${BASE_URL}/api/assemblyai/status`);
      
      if (response.status === 200 && response.data.hasOwnProperty('available')) {
        return { 
          status: 'PASS', 
          details: `Service status: ${response.data.available ? 'Available' : 'Not available'}` 
        };
      }
      return { status: 'FAIL', details: `Status check failed` };
    }
  },
  
  {
    name: 'Voice Interactions - Registrar interacción',
    test: async () => {
      const response = await axios.post(`${BASE_URL}/api/voice-interactions`, {
        userId: TEST_USER_ID,
        questionId: TEST_QUESTION_ID,
        action: 'voice_answer',
        duration: 5000,
        timestamp: new Date().toISOString(),
        voiceText: 'Test voice response',
        confidence: 0.85,
        metadata: {
          test: true,
          matchedOption: 'Opción A'
        }
      });
      
      if (response.status === 201) {
        return { status: 'PASS', details: 'Voice interaction registered' };
      }
      return { status: 'FAIL', details: `Registration failed: ${response.status}` };
    }
  },
  
  {
    name: 'Voice Interactions - Obtener historial',
    test: async () => {
      const response = await axios.get(`${BASE_URL}/api/voice-interactions/${TEST_USER_ID}`);
      
      if (response.status === 200 && Array.isArray(response.data)) {
        return { status: 'PASS', details: `History retrieved: ${response.data.length} interactions` };
      }
      return { status: 'FAIL', details: `History retrieval failed` };
    }
  },
  
  {
    name: 'Voice Interactions - Estadísticas',
    test: async () => {
      const response = await axios.get(`${BASE_URL}/api/voice-interactions/stats/${TEST_USER_ID}`);
      
      if (response.status === 200 && response.data.hasOwnProperty('total')) {
        return { status: 'PASS', details: `Stats: ${response.data.total} total interactions` };
      }
      return { status: 'FAIL', details: `Stats retrieval failed` };
    }
  }
];

// Función principal de validación
async function runValidation() {
  log('\n🚀 INICIANDO VALIDACIÓN COMPLETA DE LA API DE VOZ', 'bold');
  log('=' .repeat(60), 'blue');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      logTest(test.name, result.status, result.details);
      
      if (result.status === 'PASS') {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logTest(test.name, 'FAIL', `Error: ${error.message}`);
      failed++;
    }
  }
  
  log('\n' + '=' .repeat(60), 'blue');
  log(`📊 RESUMEN DE VALIDACIÓN:`, 'bold');
  log(`✅ Pruebas exitosas: ${passed}`, 'green');
  log(`❌ Pruebas fallidas: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`📈 Tasa de éxito: ${Math.round((passed / (passed + failed)) * 100)}%`, 'blue');
  
  if (failed === 0) {
    log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! La API de voz está funcionando correctamente.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Algunas pruebas fallaron. Revisar la implementación.', 'red');
    process.exit(1);
  }
}

// Ejecutar validación
runValidation().catch(error => {
  log(`\n💥 Error fatal en la validación: ${error.message}`, 'red');
  process.exit(1);
});