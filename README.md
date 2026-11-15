# Ritmo — hábitos, ánimo y progreso

App web (PWA, instalable y offline) para trackear hábitos sin límite, registrar tu estado de ánimo y analizar tu avance. Estética cálida y minimalista: fondo crema, tipografía serif, tarjetas suaves y modo oscuro.

## Abrirla

**https://nicotassi.github.io/Habbit-tracker/** — en el celular, abrila en el navegador y elegí “Agregar a pantalla de inicio” para instalarla como app. Cada push a la rama principal la republica automáticamente (`.github/workflows/deploy.yml`).

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/ (se puede subir a cualquier hosting estático)
```

Para ver todos los análisis funcionando enseguida: **Ajustes → Cargar demo** (carga 4 meses de datos simulados).

## Funciones

**Hábitos (sin límite)**
- 4 tipos: Sí/No, Contador (vasos de agua), Cantidad con unidad (min, páginas, km, $) y **Evitar** (malos hábitos: cada día limpio cuenta).
- Frecuencias: todos los días, días específicos o X veces por semana.
- Emoji, color, categoría, momento del día, recordatorio y “por qué lo hacés”.
- Notas por día, “saltear día justificado” (no rompe la racha), archivar, reordenar, plantillas rápidas.

**Ánimo y diario**
- Ánimo 1–5, energía, estrés, horas de sueño, emociones, etiquetas de contexto, gratitud y diario libre.
- Tendencias, “tu año en píxeles”, sueño vs ánimo (correlación), emociones frecuentes, ánimo por contexto, buscador del diario.

**Análisis**
- Cumplimiento diario + media móvil de 7 días + ánimo superpuesto, comparado contra el período anterior.
- Mapa de constancia anual estilo GitHub, tendencia semanal, rendimiento por día de la semana, hora pico.
- Ranking de hábitos con tendencia, **fuerza del hábito** (media móvil exponencial) y rachas.
- Radar de balance por área.
- **Qué hábitos mueven tu bienestar**: diferencia de ánimo/energía/estrés en días que cumplís vs que no.
- Insights automáticos en lenguaje natural.
- Página de detalle por hábito: evolución de la fuerza, heatmap, día de la semana, valores vs meta, mes a mes, impacto en el ánimo, notas.

**Rescate y pronóstico**
- **Nunca dos veces seguidas:** si fallaste un hábito el último día que tocaba, hoy aparece primero en “Rescate”, con aviso al recuperarlo (y logro “Rescatista”).
- **Pronóstico:** avisa los hábitos que solés fallar en el día de la semana de hoy y proyecta cuándo llegás a 66 días seguidos (hábito automático) o a fuerza 80% (consolidado).

**Cómo vas (análisis sin IA)**
- Informe diario con puntaje de 0 a 100 y cuatro áreas con semáforo: Constancia, Descanso, Movimiento y Mente.
- Compara tus datos recientes con tu propia normal (últimas 4 semanas), detecta tendencias de 2 semanas y encuentra patrones entre hábitos y salud, el mismo día y al día siguiente (por ejemplo, cómo dormís después de entrenar).
- Recomendaciones por reglas (día de recuperación, estrés alto, hábitos en rescate o en riesgo) y resumen semanal con logros, cosas para mejorar y una sugerencia concreta.
- Todo se calcula en el dispositivo (`src/lib/coach.ts`), es gratis y siempre muestra el dato que respalda cada conclusión.

**Datos del reloj**
- Subís una captura de la app de tu reloj y se lee en el propio celular (OCR con Tesseract.js, gratis y sin enviar la imagen a ningún servidor): sueño, puntaje de sueño, pasos, FC en reposo, VFC, estrés, Body Battery, calorías, oxígeno y distancia. Revisás los números antes de guardar; también se pueden cargar a mano.
- En Ánimo, “Tu reloj” muestra la evolución de cada dato y qué hábitos lo mueven.

**Extras**
- Cargar o corregir cualquier día anterior (hábitos, cantidades, notas y ánimo) con el selector de fecha de Hoy, Ánimo o el Calendario.
- Calendario mensual con edición de cualquier día.
- Pomodoro configurable (duración, descansos corto/largo, ciclos, meta diaria, inicio automático) que sigue corriendo al cambiar de pestaña, más foco libre y respiración guiada 4-4-4-4.
- Objetivos con ritmo necesario (“necesitás ~3 por semana”) y revisión semanal.
- XP, niveles y 26 logros desbloqueables. Confeti y sonido al completar.
- Paleta de comandos (⌘K / Ctrl+K), atajos de teclado (N, 1–8).
- Tema claro/oscuro/sistema y color de acento.
- Exportar backup JSON / CSV e importar.

## Cuentas y datos en la nube

Cada persona crea su cuenta con **usuario + PIN** desde la pantalla de inicio y entra desde cualquier celular o compu. Los datos se guardan en **Supabase** (proyecto compartido, tablas y funciones con prefijo `ritmo_`; ver `supabase/ritmo.sql`):

- El PIN se guarda encriptado (bcrypt) y nunca queda en el navegador; el dispositivo guarda solo un token de sesión.
- Las tablas están cerradas (RLS sin políticas): la app solo puede llamar a las funciones `ritmo_*`, que validan la sesión.
- 8 intentos fallidos bloquean el usuario 15 minutos.
- Cada cambio se sube solo; al volver a la app se traen los cambios hechos en otro dispositivo. El navegador guarda una copia para abrir rápido y funcionar sin conexión, y se borra al cerrar sesión.

## Instalar en el celular

Al abrir el link en el navegador del celular aparece un cartel para instalar Ritmo (botón directo en Android/Chrome, instrucciones de “Agregar a inicio” en iPhone). También está en Ajustes.

## Versión de un solo archivo

`npm run build:single` (versión sin cuentas, anterior a la nube) genera `dist/ritmo-single.html`: un HTML autocontenido (JS y CSS embebidos) que se puede publicar en cualquier lado, por ejemplo como Artifact de claude.ai para abrirlo desde el celular. Dentro de ese visor las descargas están bloqueadas, así que el backup se hace con **Copiar backup / Pegar backup**.

## Stack
React 18 + TypeScript + Vite, Zustand (estado persistente), Recharts (gráficos).
