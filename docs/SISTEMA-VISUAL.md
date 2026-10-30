# Sistema visual de MisCheles

## Tipografía

- **Familia de interfaz:** Plus Jakarta Sans. Se usa para navegación, encabezados, controles y lectura cotidiana.
- **Familia numérica:** JetBrains Mono para cantidades donde importa alinear dígitos; se activa con `.type-money`. Los importes también usan números tabulares.
- **Escala:** display 32 px (28 px en móvil); título de pantalla 24 px (22 px en móvil); título de sección 16 px; texto principal 14 px; apoyo 13 px; etiquetas y metadatos mínimo 12 px. Evitamos texto menor a 12 px en interfaz de uso normal.
- **Jerarquía:** primario es el dato o acción que resuelve la tarea; secundario aporta contexto; terciario/metadata solo describe fecha, método o estado. No usar mayúsculas sostenidas como única forma de jerarquía.

## Color

El color de marca por defecto es **Azul MisCheles `#012677`**. La persona puede seleccionar otro acento en Perfil; ese ajuste se aplica a controles de marca y se conserva entre modo claro y oscuro. El tono de hover y la superficie suave se derivan del acento elegido. Los colores semánticos mantienen un significado independiente del acento.

| Rol | Color | Uso |
|---|---|---|
| Marca principal | `#012677` | Acción primaria, selección, navegación activa y marca |
| Marca hover | Derivado del acento | Hover y presión con contraste visible |
| Fondo tenue de marca | Derivado del acento | Selección y resaltado discreto; se adapta al tema oscuro |
| Azul de apoyo | `#2563EB` | Gráficos y datos no semánticos |
| Texto principal | `#172033` | Texto y cifras principales |
| Texto secundario | `#687386` | Instrucciones breves y contexto |
| Separador | `#E3E7EE` | Líneas finas entre secciones y filas |
| Positivo | `#17845D` | Ingreso, saldo positivo y éxito |
| Negativo | `#C2414B` | Gasto, error y acción destructiva |
| Atención | `#B76A12` | Aviso que requiere atención |
| Acentos opcionales | `#0F766E`, `#6D28D9`, `#B54737`, `#8A4B08` | Transferencias, visualizaciones o personalización |

El tema oscuro cambia superficies, texto, líneas y tonos semánticos. Mantiene el acento elegido y revisa contraste antes de usar un tono sobre otro. El verde y el rojo no se reutilizan como decoración neutra: comunican estado del dinero.

## Botones y controles

- **Primario:** acción principal única por contexto; fondo marca, texto blanco, altura mínima 44 px y radio 12 px.
- **Secundario:** borde sutil y fondo transparente; acción alternativa.
- **Quieto:** enlace o acción terciaria sin caja.
- **Icono:** mínimo 44 × 44 px y con etiqueta accesible. La acción flotante principal es un solo botón circular de 56 × 56 px; al tocarlo, abre una lista uniforme para elegir gasto, ingreso o transferencia.
- **Destructivo:** rojo únicamente cuando elimina o invalida información; nunca para gastos ordinarios.
- Estados hover, foco visible, presionado e inhabilitado deben poder distinguirse sin depender solo del color.

## Diseño de información

La interfaz usa espacio, agrupación y líneas finas. Una superficie destacada se usa cuando representa un conjunto conceptual; no se encajona cada cifra o fila. Las listas separan elementos con divisores. Las tarjetas se reservan para opciones seleccionables o datos que necesitan énfasis.

## Revisión de pantallas

El sistema aplica a Inicio, Movimientos, Ahorro, Perfil, navegación, formularios, filtros, gráficos, avisos y diálogos. Antes de publicar, revisar tamaños pequeños, ampliación de texto, foco con teclado, contraste en ambos temas, safe areas y lector de pantalla en Android y web.
