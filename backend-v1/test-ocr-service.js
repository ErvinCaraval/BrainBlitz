/**
 * Test file for Azure OCR Service
 * Tests the text extraction and question parsing functionality
 */

const azureOCRService = require('./services/azureOCRService');

console.log('🧪 Testing Azure OCR Service\n');

// Test 1: Parse question with standard format
console.log('Test 1: Parse question with standard format');
const testText1 = `Pregunta: ¿Cuál es el planeta más cercano al sol?

A) Venus
B) Mercurio
C) Tierra
D) Marte`;

try {
  const result1 = azureOCRService.parseQuestionFromText(testText1);
  console.log('✅ Result:', JSON.stringify(result1, null, 2));
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

// Test 2: Parse question with alternative format (A: instead of A))
console.log('Test 2: Parse question with alternative format (A: format)');
const testText2 = `¿Cuál es la capital de Francia?

A: París
B: Lyon
C: Marseille
D: Toulouse`;

try {
  const result2 = azureOCRService.parseQuestionFromText(testText2);
  console.log('✅ Result:', JSON.stringify(result2, null, 2));
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

// Test 3: Parse question with lowercase format
console.log('Test 3: Parse question with lowercase format');
const testText3 = `¿Cuál es el color del cielo?

a) Azul
b) Verde
c) Rojo
d) Amarillo`;

try {
  const result3 = azureOCRService.parseQuestionFromText(testText3);
  console.log('✅ Result:', JSON.stringify(result3, null, 2));
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

// Test 4: Parse question with multiline options
console.log('Test 4: Parse question with multiline options');
const testText4 = `¿Cuál es el resultado de 2 + 2?

A) El resultado es
cuatro
B) El resultado es dos
C) El resultado es seis
D) El resultado es ocho`;

try {
  const result4 = azureOCRService.parseQuestionFromText(testText4);
  console.log('✅ Result:', JSON.stringify(result4, null, 2));
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

// Test 5: Extract text from response (simulated Azure response)
console.log('Test 5: Extract text from Azure response format');
const mockAzureResponse = {
  regions: [
    {
      lines: [
        {
          words: [
            { text: 'Pregunta:' },
            { text: '¿Cuál' },
            { text: 'es' },
            { text: 'el' },
            { text: 'idioma' },
            { text: 'oficial' },
            { text: 'de' },
            { text: 'España?' }
          ]
        },
        {
          words: [
            { text: 'A)' },
            { text: 'Inglés' }
          ]
        },
        {
          words: [
            { text: 'B)' },
            { text: 'Español' }
          ]
        },
        {
          words: [
            { text: 'C)' },
            { text: 'Francés' }
          ]
        },
        {
          words: [
            { text: 'D)' },
            { text: 'Portugués' }
          ]
        }
      ]
    }
  ]
};

try {
  const extractedText = azureOCRService.extractTextFromResponse(mockAzureResponse);
  console.log('✅ Extracted text:', extractedText);
  const parsed = azureOCRService.parseQuestionFromText(extractedText);
  console.log('✅ Parsed result:', JSON.stringify(parsed, null, 2));
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

// Test 6: Ensure all four options are present
console.log('Test 6: Ensure all four options are present');
const testText6 = `¿Cuál es el resultado?
A) Opción 1
B) Opción 2`;

try {
  const result6 = azureOCRService.parseQuestionFromText(testText6);
  console.log('✅ Result:', JSON.stringify(result6, null, 2));
  if (result6.opciones.c && result6.opciones.d) {
    console.log('✅ Missing options filled with placeholder text');
  }
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('');
}

console.log('✅ All tests completed!');
