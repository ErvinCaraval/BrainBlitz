// Script de diagnóstico para el sistema de voz
console.log('🔍 Iniciando diagnóstico del sistema de voz...');

// 1. Verificar soporte del navegador
console.log('\n📊 1. VERIFICACIÓN DEL NAVEGADOR:');
console.log('User Agent:', navigator.userAgent);
console.log('Plataforma:', navigator.platform);
console.log('Idioma:', navigator.language);

// 2. Verificar APIs de voz
console.log('\n🎤 2. VERIFICACIÓN DE APIs DE VOZ:');
console.log('speechSynthesis disponible:', 'speechSynthesis' in window);
console.log('SpeechSynthesisUtterance disponible:', 'SpeechSynthesisUtterance' in window);

if ('speechSynthesis' in window) {
    console.log('Estado actual de speechSynthesis:');
    console.log('- Hablando:', speechSynthesis.speaking);
    console.log('- Pausado:', speechSynthesis.paused);
    console.log('- Pendiente:', speechSynthesis.pending);
}

// 3. Verificar voces disponibles
console.log('\n🗣️ 3. VERIFICACIÓN DE VOCES:');
if ('speechSynthesis' in window) {
    const voices = speechSynthesis.getVoices();
    console.log('Total de voces:', voices.length);
    
    if (voices.length > 0) {
        console.log('Voces disponibles:');
        voices.forEach((voice, index) => {
            console.log(`  ${index + 1}. ${voice.name} (${voice.lang}) ${voice.gender ? `[${voice.gender}]` : ''} ${voice.default ? '[Por defecto]' : ''}`);
        });
        
        const spanishVoices = voices.filter(v => v.lang.includes('es'));
        console.log('Voces en español:', spanishVoices.length);
        if (spanishVoices.length > 0) {
            console.log('Voces españolas:');
            spanishVoices.forEach(voice => {
                console.log(`  - ${voice.name} (${voice.lang})`);
            });
        }
    } else {
        console.log('❌ No hay voces disponibles');
    }
} else {
    console.log('❌ speechSynthesis no está disponible');
}

// 4. Verificar permisos de audio
console.log('\n🔊 4. VERIFICACIÓN DE PERMISOS DE AUDIO:');
console.log('AudioContext disponible:', 'AudioContext' in window || 'webkitAudioContext' in window);
console.log('MediaDevices disponible:', 'mediaDevices' in navigator);
console.log('getUserMedia disponible:', 'getUserMedia' in navigator.mediaDevices);

// 5. Función de prueba de voz
function testVoice() {
    console.log('\n🧪 5. PRUEBA DE VOZ:');
    
    if (!('speechSynthesis' in window)) {
        console.log('❌ No se puede probar: speechSynthesis no disponible');
        return;
    }
    
    const testText = "Prueba de diagnóstico de voz";
    console.log(`Probando con texto: "${testText}"`);
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = function() {
        console.log('✅ Voz iniciada correctamente');
    };
    
    utterance.onend = function() {
        console.log('✅ Voz terminada correctamente');
    };
    
    utterance.onerror = function(event) {
        console.log('❌ Error en la voz:', event.error);
    };
    
    console.log('Iniciando síntesis de voz...');
    speechSynthesis.speak(utterance);
}

// 6. Función para probar con voz específica
function testWithSpanishVoice() {
    console.log('\n🇪🇸 6. PRUEBA CON VOZ ESPAÑOLA:');
    
    const voices = speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.includes('es'));
    
    if (spanishVoices.length === 0) {
        console.log('❌ No hay voces en español disponibles');
        return;
    }
    
    const testText = "Prueba con voz en español";
    console.log(`Probando con voz: ${spanishVoices[0].name}`);
    console.log(`Texto: "${testText}"`);
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.voice = spanishVoices[0];
    utterance.lang = 'es-ES';
    
    utterance.onstart = function() {
        console.log('✅ Voz española iniciada');
    };
    
    utterance.onend = function() {
        console.log('✅ Voz española terminada');
    };
    
    utterance.onerror = function(event) {
        console.log('❌ Error con voz española:', event.error);
    };
    
    speechSynthesis.speak(utterance);
}

// 7. Función para verificar configuración del sistema
function checkSystemConfig() {
    console.log('\n⚙️ 7. CONFIGURACIÓN DEL SISTEMA:');
    
    if ('speechSynthesis' in window) {
        console.log('Configuración actual:');
        console.log('- Volumen:', speechSynthesis.volume);
        console.log('- Velocidad:', speechSynthesis.rate);
        console.log('- Tono:', speechSynthesis.pitch);
    }
}

// Ejecutar diagnóstico completo
console.log('\n🚀 Ejecutando diagnóstico completo...');
checkSystemConfig();

// Esperar un poco para que las voces se carguen
setTimeout(() => {
    testVoice();
    
    setTimeout(() => {
        testWithSpanishVoice();
    }, 2000);
}, 1000);

console.log('\n📋 RESUMEN DEL DIAGNÓSTICO:');
console.log('1. Revisa la consola para ver todos los resultados');
console.log('2. Si no escuchas nada, verifica el volumen del sistema');
console.log('3. Si hay errores, revisa la configuración del navegador');
console.log('4. Prueba con un navegador diferente si es necesario');

console.log('\n✅ Diagnóstico completado. Revisa los resultados arriba.');
