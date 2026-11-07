# AGENTS.md — MisCheles

Estas instrucciones aplican al trabajo en `C:\Proyectos\MisCheles`.

## Flujo de trabajo y eficiencia

- Antes de investigar, define el objetivo y los archivos o símbolos probablemente afectados.
- Lee solo los archivos y fragmentos necesarios; usa búsquedas acotadas con `rg` y evita recorrer o imprimir el repositorio completo.
- Consulta GitNexus por símbolo, relación o impacto cuando ayude a entender consumidores o riesgo. Omite análisis extensos para cambios triviales y aislados.
- Reutiliza análisis previos mientras el código relevante no haya cambiado; no repitas contexto ya confirmado.
- No hagas refactorizaciones ajenas al objetivo ni generes documentos de auditoría para tareas sencillas.
- Mantén las respuestas breves y centradas en cambios, validación y pendientes.

## Arquitectura

- Conserva la arquitectura existente: React/vistas para presentación, `application` para coordinación y casos de uso, `domain` para reglas y cálculos, y servicios/repositorios/Firebase/exportadores para infraestructura.
- No traslades cálculos financieros a componentes visuales ni concentres funcionalidades en `App.tsx` si existe un lugar adecuado.
- Antes de crear código, busca una implementación reutilizable y revisa sus consumidores cuando sea compartida.
- Prefiere la solución más sencilla que cumpla el requisito. Mantén tipos explícitos, errores claros y responsabilidades coherentes.
- Evita duplicación real, estados derivados redundantes, dependencias circulares, abstracciones innecesarias y dependencias nuevas si las existentes bastan.
- Crea componentes compartidos cuando tengan más de un uso o una complejidad que justifique separarlos; no fragmentes funciones simples en muchos archivos.

## Rendimiento e interfaz

- Evita cálculos costosos o filtros repetidos, consultas duplicadas y carga/renderizado de registros innecesarios.
- Usa memoización cuando exista una razón medida o clara; conserva la paginación de movimientos.
- Optimiza gráficos, filtros y reportes sin alterar resultados financieros.
- Mantén la identidad visual de MisCheles, prioriza móvil, evita información redundante y conserva las rutas y funcionalidades existentes.

## Invariantes financieras

- Los aportes a ahorro son transferencias internas, no gastos; los retiros no son ingresos nuevos.
- Los gastos pagados desde ahorros sí son gastos; el ahorro no forma parte del disponible para gastar.
- Los remanentes trasladados no son ingresos nuevos.
- No dupliques movimientos o transferencias, elimines historial ni alteres saldos para ocultar errores.
- Todo cambio que pueda afectar estas reglas debe tener pruebas financieras específicas. Si implica riesgo de pérdida de datos o dinero registrado, detén el cambio y explica el riesgo.

## Validación

- Cambios pequeños: ejecuta las pruebas relacionadas y TypeScript cuando corresponda.
- Cambios medianos: pruebas del módulo, TypeScript y build si aplica.
- Cambios transversales o financieros: pruebas relevantes, TypeScript, build y suite completa una vez al final.
- No repitas suites completas sin necesidad ni declares una comprobación exitosa si no se ejecutó.

## Git

- Trabaja en la rama activa autorizada. No modifiques `main` ni descartes cambios preexistentes del usuario.
- Revisa el estado de Git antes de editar y limita los cambios a lo solicitado.
- Usa commits descriptivos para cambios validados. Publica cambios solo si la solicitud actual o una instrucción explícita vigente lo indica.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **MisCheles**. Graph counts change as the project evolves; do not rely on hard-coded counts.

> Prefer GitNexus MCP. If the index is stale, run `analyze --index-only` with the available GitNexus CLI; bootstrap it only if the CLI is unavailable.

## Graph workflow for relevant code changes

Use the requirements below when changing code symbols, shared behavior, or sensitive flows. For isolated trivial edits and documentation/configuration-only changes, do not run extensive graph analysis. Update the index after relevant code changes, not after every small edit.

- For relevant symbol changes, run `impact({target: "symbolName", direction: "upstream"})` and report callers, processes, and risk. Never substitute grep for a useful graph query.
- Before committing code, run `detect_changes({scope: "all"})`. Treat partial/truncated output as unresolved and rerun; for regression review, use `scope: "compare"` with the selected base ref.
- Resolve HIGH/CRITICAL impact warnings before editing. Do not use `riskSharedAxes` to waive them. MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- Use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, and `impact` for blast radius. Use text search to verify empty/`UNKNOWN` results or locate literal strings.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do during graph-reviewed changes

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/MisCheles/context` | Codebase overview, check index freshness |
| `gitnexus://repo/MisCheles/clusters` | All functional areas |
| `gitnexus://repo/MisCheles/processes` | All execution flows |
| `gitnexus://repo/MisCheles/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
