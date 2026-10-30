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

**Extras**
- Calendario mensual con edición de cualquier día.
- Modo foco (pomodoro) vinculable a un hábito + respiración guiada 4-4-4-4.
- Objetivos con ritmo necesario (“necesitás ~3 por semana”) y revisión semanal.
- XP, niveles y 26 logros desbloqueables. Confeti y sonido al completar.
- Paleta de comandos (⌘K / Ctrl+K), atajos de teclado (N, 1–8).
- Tema claro/oscuro/sistema y color de acento.
- Exportar backup JSON / CSV e importar.

Los datos se guardan localmente en el navegador (localStorage).

## Versión de un solo archivo

`npm run build:single` genera `dist/ritmo-single.html`: un HTML autocontenido (JS y CSS embebidos) que se puede publicar en cualquier lado, por ejemplo como Artifact de claude.ai para abrirlo desde el celular. Dentro de ese visor las descargas están bloqueadas, así que el backup se hace con **Copiar backup / Pegar backup**.

## Stack
React 18 + TypeScript + Vite, Zustand (estado persistente), Recharts (gráficos).
