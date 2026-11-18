# APP DE PLAN DE COMIDAS Y ENTRENAMIENTO ORIENTATIVO, CON META Y FECHA (v2)

Construí una app móvil (PWA) en español rioplatense (voseo, tono directo y cercano). **No escribas código todavía.** Primero entrá en modo plan y entregame: arquitectura, stack, modelo de datos, estructura de carpetas, el recorte del MVP (sección 3) y el orden de construcción. Esperá mi OK.

## 0. CÓMO TRABAJAR
1. Plan primero, esperá mi OK.
2. Guardá este documento en el repo como `SPEC.md` y las reglas permanentes (vocabulario prohibido, límites de seguridad, restricciones) en `CLAUDE.md`, para que no se pierdan entre sesiones.
3. Construí por etapas (sección 3). Cada etapa termina con tests verdes y un flujo probado en navegador con viewport de celular (Playwright) antes de pasar a la siguiente.
4. Si algo no es viable sin servicios pagos, decímelo y proponé una alternativa gratuita antes de seguir.
5. Cuando algo dependa de un dato que no podés verificar (licencias, fórmulas, valores nutricionales), marcalo como `POR VERIFICAR` en vez de inventarlo.
6. README con cómo agregar contenido y cómo desplegar.

## 1. CONCEPTO
La persona define una meta con fecha ("bajar 6 kg para el verano", "ganar masa muscular en 12 semanas"). Todos los días abre la app y ve qué le toca comer (con receta completa) y, si lo activó, qué entrenar. Marca si pudo, cambia por una alternativa o saltea. La app le muestra cómo viene y ajusta.
- **No hay registro de comidas**: sin buscador de alimentos ni carga de calorías.
- El entrenamiento es opcional y modificable después; si está activo, se trata igual que las comidas.
- Muy simple de usar. Se siente como coach personalizado aunque no use IA (sección 9).
- El producto se va a vender por suscripción mensual baja, pero la Fase 1 funciona sin cuentas ni cobros.
- El valor que tiene que dar es: decidir por la persona lo que hoy le cuesta decidir, y ayudarla a ganar autonomía con el tiempo (explica el porqué de cada decisión; hay "fichas" para aprender). No diseñes mecánicas pensadas para generar culpa, ansiedad o dependencia compulsiva.

## 2. RESTRICCIONES
- **Cero IA y cero APIs pagas dentro de la app.** Todo con reglas, datos y contenido precargado.
- Costo de infraestructura ≈ cero: offline-first, hosting estático gratuito.
- 100% celular: PWA instalable, mobile-first, funciona sin internet.
- Persistencia en IndexedDB (no localStorage), con versionado de esquema y migraciones. Pedí almacenamiento persistente (`navigator.storage.persist()`) y explicá qué pasa en iPhone si la PWA no está instalada.
- Backup: exportar/importar JSON, con recordatorio periódico de exportar y aviso claro de que los datos viven solo en el dispositivo.
- IDs estables en todo el contenido (recetas, ejercicios, ingredientes) para que actualizar contenido no rompa el historial.
- Capa de datos preparada para sumar después login + suscripción (por ejemplo Supabase + Mercado Pago) sin reescribir. No lo implementes ahora. En el plan, decime cómo se haría el control de acceso (qué es del cliente y qué necesita servidor) y qué pasa con el uso offline de un suscriptor.
- Generadores determinísticos (con semilla) para que los tests sean reproducibles.

## 3. ETAPAS
- **ETAPA 0, vertical slice (primero):** onboarding mínimo → cálculo → plan de 1 semana con ~30 recetas → pantalla Hoy → marcar/cambiar/saltear → lista de compras. Sin entrenamiento, sin gamificación. Sirve para probar el concepto con personas reales antes de invertir en todo el contenido.
- **FASE 1:** perfil "Salud y composición" completo (secciones 4 a 7).
- **FASE 2:** perfil "Deportista", importación de datos del reloj por captura, estadísticas ampliadas, recetario y biblioteca (sección 8).
- **FASE 3:** comunidad y lectura (sección 8).
Los dos perfiles ("Salud y composición" y "Deportista") se soportan en el modelo de datos desde el inicio.

## 4. ONBOARDING (conversacional, botones de respuesta rápida)
1. Aviso legal y de salud con aceptación obligatoria (sección 11).
2. Cuestionario de salud: si indica condiciones médicas, embarazo, lactancia, ser menor de 18, o antecedentes de trastornos de la conducta alimentaria, **no se genera plan** y se deriva a un profesional. Sumá un cribado breve de conducta alimentaria (tipo SCOFF; verificá licencia y uso) y tratá las respuestas con cuidado: sin diagnosticar, solo derivar.
3. Meta: tipo (bajar grasa / tonificar / ganar músculo / mantener / rendimiento), peso actual, peso objetivo, fecha objetivo, medidas iniciales. Fotos de progreso opcionales, solo en el dispositivo, sin análisis.
4. Datos: edad, sexo, altura, nivel de actividad, alergias y restricciones, alimentos que no le gustan, comidas por día, tiempo para cocinar, y **presupuesto** (bajo / medio / sin límite) y si cocina para más de una persona.
5. "¿Querés incluir entrenamiento?" (Sí/No, modificable). Si sí: nivel, equipamiento, días por semana, tiempo por sesión, lesiones, y un cuestionario de aptitud (PAR-Q+; verificá los términos de uso, porque pide usarlo sin modificar) que derive a un profesional si corresponde.
6. Hidratación: "¿Tenés indicación médica sobre cuántos líquidos tomar?" Si sí, se desactiva la meta automática.
7. Si es deportista: años de experiencia, deportes, objetivo (incluye evento con fecha), y "mi propia rutina" vs "plan sugerido".

**Cálculo (todo configurable y documentado con fuente):** Mifflin-St Jeor + factor de actividad, macros, déficit/superávit conservador, piso calórico configurable (valores de partida: proponelos con fuente y marcalos `POR VERIFICAR`), ritmo máximo semanal seguro de cambio de peso (como % del peso corporal). Calorías distintas en día de entreno y de descanso.

**Guardas de seguridad obligatorias:**
- No se aceptan metas cuyo peso objetivo dé un IMC por debajo del rango normal (el umbral va configurable y documentado). Si la persona ya está en rango saludable y pide "bajar", ofrecer "tonificar" o "mantener".
- Viabilidad por reglas: si el ritmo necesario supera el máximo seguro, decirlo con franqueza amable y proponer otra fecha o meta (decide la persona).
- Nunca prometer resultados; aviso de que varían de persona a persona.
- Opción en ajustes de **ocultar números de calorías y de peso** en pantallas diarias (modo "sin números").

## 5. CICLO DIARIO Y PANTALLA "HOY"
La app abre siempre en "Hoy". Muestra:
1. Frase del día.
2. Comidas del día con receta completa (ingredientes con cantidades, pasos, tiempo, calorías y macros).
3. Sesión de entrenamiento (si está activa): calentamiento, ejercicios (series, reps, descansos, técnica, progresiones/regresiones), vuelta a la calma.
4. Barra de hidratación.
5. Check-in de 10 segundos: ánimo y descanso (un toque cada uno).
Acciones iguales para comidas y entrenos: "Hecho" (comida: "Pude comerla"), "Cambiar" y "Saltear" con motivo en 1 toque.
Cierre del día: cómo va + mensaje del coach.

**Recordatorios (ya investigado, confirmalo en el plan):** en iPhone las notificaciones push de una PWA requieren que esté instalada (iOS 16.4+) y un servidor que las envíe; sin backend no hay recordatorios locales programados confiables en la web. Alternativa gratuita: exportar los horarios al calendario del celular (archivo `.ics` con alarmas) + recordatorios dentro de la app al abrirla. Si ves otra opción realmente confiable y gratuita, proponela.

## 6. FUNCIONES FASE 1
1. **Plan semanal de comidas por reglas** sobre una base de recetas etiquetadas (tipo, calorías, macros, tiempo, dificultad, costo relativo, ingredientes con cantidades, pasos, restricciones que cumple). Cierra calorías y macros hacia la meta, con rotación para no repetir.
2. **Plan semanal de entrenamiento por reglas** según objetivo, nivel, días, tiempo y equipamiento, con descansos, coordinado con las comidas.
3. **Modo cocinar:** pasos a pantalla completa, temporizadores, pantalla encendida (Wake Lock; verificá soporte en iOS).
4. **Modo entrenar:** sesión guiada con temporizadores de trabajo/descanso, series y reps, circuito/HIIT, pantalla encendida y registro automático (duración, series, reps, esfuerzo percibido en 1 toque). Completarla = "Hecho".
5. **Alternativas de comida:** mismo tipo, calorías y macros equivalentes (margen configurable), respetando restricciones, con filtro por tiempo o ingredientes en casa. El resto de la semana se rebalancea si hace falta.
6. **Alternativas de entrenamiento:** más corta, más liviana, sin equipamiento, o ejercicio equivalente del mismo patrón. Si saltea, se reprograma sin acumular ni castigar.
7. **Progresión por reglas:** sube si completa con esfuerzo adecuado, baja si saltea mucho, reporta esfuerzo muy alto o dolor. Descargas programadas cada N semanas.
8. **Lista de compras:** del menú, cantidades sumadas, agrupada por sección del supermercado, con tildes y compartir por WhatsApp. Medidas caseras (tazas, cucharadas, unidades) además de gramos.
9. **Preferencias:** me gusta / no me gusta en recetas, ejercicios y rutinas; los generadores las usan.
10. **"Me salí del plan":** 1 toque (chico/medio/grande), sin carga detallada.
11. **Hidratación:** meta por reglas según peso, actividad, entreno del día y tipo de plan (verificá fórmula y rangos con fuentes confiables; configurables). Registro en 1 toque, tamaños configurables, barra en Hoy. Con tope: nunca empujar a tomar de más. Sin meta si hay indicación médica.
12. **Frase diaria:** una por día, elegida por reglas (inicio, racha larga, racha cortada, cerca de la fecha, entreno duro, descanso). Tras un día fallado, tono de reenganche sin culpa. Banco de ≥365 frases **originales** (nada de citas de terceros con derechos), en archivos editables, con favorita y compartir como imagen.
13. **Constancia:** métrica principal = adherencia al plan. Racha, puntos, niveles y resumen semanal. **Las rachas no se "rompen" por un día de descanso planificado, por saltear con motivo (dolor, enfermedad) ni por una comida libre**; mostrá "días cumplidos de los últimos 7/30" junto a la racha para que un tropiezo no borre todo. Si el entrenamiento está desactivado, no se muestra ni penaliza.
14. **Comida libre planificada:** el plan incluye una comida libre por semana, **no es un premio que se gana ni que se pierde**. Mensajes sin culpa; prohibido lenguaje de castigo, de "pecado" o de "premio por sufrir".
15. **Ajuste del plan:** si peso/medidas no avanzan como se espera, sugerir ajuste de calorías y/o de carga (con confirmación y dentro de los límites). Usá peso suavizado (media móvil), esperá al menos 2 a 3 semanas de datos antes de sugerir un cambio, y no sugerir bajar calorías de forma repetida ni por debajo del piso.
16. **Seguridad en el entrenamiento:** si marca dolor al saltear o terminar, aviso de que pare y consulte a un profesional, y baja de carga en las siguientes sesiones.

## 7. PANEL "¿CÓMO VOY?"
- Curva real vs esperada, días restantes y proyección ("a este ritmo llegás el [fecha]").
- Adherencia (comidas y entrenos), racha y puntos.
- Semáforo en camino / atención / ajustar, con motivo explicado y botón "aplicar ajuste" (calorías, carga o fecha), siempre con confirmación.
- Relación sueño/ánimo vs cumplimiento cuando haya datos suficientes.
- Respeta el modo "sin números".

## 8. FASES 2 Y 3
**FASE 2**
17. Perfil Deportista: periodización por bloques (volumen, intensificación, descarga, mantenimiento, pre-evento) con calendario de evento; registro de cargas (peso, reps, series, RIR/RPE) con historial, récords, 1RM estimado y volumen semanal por grupo muscular; sobrecarga progresiva por reglas; "usar mi propia rutina"; nutrición para rendimiento con comidas pre y post entreno. **Sin cortes de peso agresivos ni deshidratación.**
18. Importar datos del reloj por captura de pantalla: OCR en el dispositivo (Tesseract.js, gratuito), parser configurable por marca, empezando por Zepp. El usuario SIEMPRE revisa y corrige antes de guardar. Informame la precisión real que logres. Los datos alimentan al coach (por ejemplo, sueño bajo → sesión más liviana).
19. Estadísticas ampliadas con tendencias semanales y mensuales.
20. Recetario y biblioteca de ejercicios, con búsqueda y filtros.
**FASE 3**
21. Comunidad: botón a grupo externo (Instagram/WhatsApp) y "compartir mi semana" como tarjeta. Sin chat propio.
22. Lectura: artículos y fichas en Markdown/JSON en el hosting; la app los trae al abrir para publicar sin actualizar la app.

## 9. QUE SE SIENTA COMO UN COACH, SIN IA
- Motor de mensajes por reglas: plantillas con variables (nombre, meta, racha, días que faltan, última comida hecha), condiciones y muchas variantes. Tono cercano y rioplatense.
- Explicar el "por qué" de cada decisión.
- Detección de patrones por reglas con datos propios (por ejemplo, fines de semana difíciles → comidas más simples los sábados).
- Hitos y celebraciones (primera semana, 25/50/75% de la meta, rachas).
- Saludos según hora, racha e hitos.
- No decir "IA" en la interfaz ni en la comunicación; es un "coach personalizado". No engañar sobre cómo funciona: en "Cómo funciona" (ajustes) explicar con claridad que son reglas, no una persona ni una IA.

## 10. CONTENIDO Y CÁLCULO CONFIABLE
Todo el contenido vive en JSON/Markdown separados del código, con **esquema documentado y validado (por ejemplo Zod)**.
- Nutrición: ~120 recetas argentinas cotidianas (desayunos, almuerzos, cenas, colaciones) con variantes por restricción. **Arrancá con ~30 para la Etapa 0 y ampliá después.**
- Entrenamiento: ~60 ejercicios (calistenia, HIIT, cardio de golpeo tipo Muay Thai) con progresiones y regresiones; programas de 4 a 8 semanas por nivel y equipamiento.
- Frases: 365. Mensajes de coach: ≥60 con variantes.
- **Valores nutricionales:** se calculan de una tabla de composición de alimentos, nunca se escriben a mano ni los inventás. Prioridad ARGENFOODS (UNLu); complemento USDA FoodData Central (dominio público/CC0: confirmalo). Verificá condiciones de uso de cada fuente y avisame antes de incluir sus datos; si ARGENFOODS no se puede redistribuir, decímelo y proponé alternativa. Guardá la fuente de cada dato. Receta = suma de ingredientes (cantidad × valor/100 g), con factores de rendimiento y cocción cuando corresponda.
- **Validador automático (falla el build):** macros vs calorías (4/4/9 con tolerancia), rangos plausibles por tipo de comida, ingredientes existentes en la tabla, restricciones y alérgenos correctamente etiquetados, cantidades razonables, IDs únicos, y **lint de vocabulario prohibido** en todos los textos de la app (sección 11).
- Generá un primer borrador y marcá claramente qué hay que verificar. Idealmente lo revisa una nutricionista y una persona de educación física antes de salir a la venta (no lo digas en la app).

## 11. LENGUAJE Y PRESENTACIÓN
- Se presenta como "plan de comidas orientativo" y "plan de entrenamiento orientativo". Prohibido en la interfaz y los textos: "nutricionista", "dieta médica", "tratamiento", "prescripción", "diagnóstico", y promesas de resultado.
- Aviso visible en el onboarding (aceptación obligatoria) y siempre accesible desde ajustes: orientación general y educativa, no reemplaza a un profesional de la salud; no apto para menores, embarazadas, personas con enfermedades o condiciones médicas, ni con antecedentes de trastornos alimentarios sin consultar antes.
- Pisos calóricos, topes de pérdida semanal y topes de líquidos en todos los perfiles.
- Nota para mí (no para la app): antes de cobrar, revisar con un abogado en Argentina el alcance legal de dar planes alimentarios personalizados y el tratamiento de datos de salud (Ley 25.326) cuando se sumen cuentas.

## 12. UX
- Abre en "Hoy". Acciones en 1 o 2 toques. Lo secundario en secciones aparte.
- Navegación inferior corta: Hoy, Semana/Compras, Progreso, Biblioteca.
- Mobile-first, rápida, accesible (contraste, áreas táctiles), modo oscuro, tamaño de letra ajustable.
- Probá cada flujo con la pregunta: ¿alguien poco técnico lo entiende sin explicación?

## 13. TESTS
Cálculo calórico y de requerimientos, guardas de seguridad (IMC mínimo, piso calórico, tope semanal), viabilidad de la meta, generador de menús, generador de entrenamiento y su progresión, alternativas, lista de compras, hidratación, rachas (incluyendo que un descanso planificado o un salteo con motivo no la rompan), validador de contenido y migraciones de IndexedDB.
