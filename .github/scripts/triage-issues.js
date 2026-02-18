// @ts-check

/**
 * Auto-triage for new issues.
 * - Matches keywords in title + body to assign labels.
 * - Parses structured fields from YAML issue templates.
 * - Detects issues submitted from the app (<!-- Submitted from app -->).
 * - Assigns priority and area labels from template dropdowns.
 * - Posts a combined checklist comment with troubleshooting steps.
 */

// ── Label definitions ────────────────────────────────────────────────

const LABEL_COLORS = {
  bug: "d73a4a",
  feature: "a2eeef",
  "docker-error": "f9d0c4",
  "api-issue": "c5def5",
  "ai-provider": "d4c5f9",
  "auth-issue": "fef2c0",
  "env-config": "bfdadc",
  maps: "c2e0c6",
  frontend: "1d76db",
  backend: "0e8a16",
  orchestrator: "5319e7",
  database: "006b75",
  "mcp-server": "b60205",
  "ci-cd": "fbca04",
  documentation: "0075ca",
  "from-app": "7057ff",
  "priority: critical": "b60205",
  "priority: high": "d93f0b",
  "priority: medium": "fbca04",
  "priority: low": "0e8a16",
};

// ── Keyword rules (case-insensitive) ────────────────────────────────

const KEYWORD_RULES = [
  {
    label: "bug",
    keywords: [
      "bug",
      "error",
      "crash",
      "broken",
      "fail",
      "not working",
      "no funciona",
      "falla",
      "roto",
    ],
  },
  {
    label: "feature",
    keywords: [
      "feature",
      "request",
      "enhancement",
      "nueva funcionalidad",
      "mejora",
      "sugerencia",
    ],
  },
  {
    label: "docker-error",
    keywords: [
      "docker",
      "container",
      "compose",
      "volume",
      "image",
      "port",
      "contenedor",
    ],
  },
  {
    label: "api-issue",
    keywords: [
      "api key",
      "rate limit",
      "401",
      "403",
      "502",
      "timeout",
      "mapbox",
      "amadeus",
      "openrouteservice",
      "google maps",
    ],
  },
  {
    label: "ai-provider",
    keywords: [
      "anthropic",
      "openai",
      "claude",
      "gpt",
      "gemini",
      "llm",
      "chat not working",
      "modelo ia",
    ],
  },
  {
    label: "auth-issue",
    keywords: [
      "oauth",
      "login",
      "auth",
      "token",
      "jwt",
      "session",
      "credential",
      "autenticacion",
    ],
  },
  {
    label: "env-config",
    keywords: [
      ".env",
      "env var",
      "environment",
      "config",
      "secret_key",
      "fernet",
      "variable de entorno",
    ],
  },
  {
    label: "maps",
    keywords: [
      "mapbox",
      "map",
      "geocoding",
      "route",
      "directions",
      "mapa",
      "ruta",
    ],
  },
  {
    label: "frontend",
    keywords: [
      "frontend",
      "react",
      "vite",
      "nginx",
      "ui",
      "css",
      "tailwind",
      "browser",
      "navegador",
    ],
  },
  {
    label: "backend",
    keywords: [
      "backend",
      "fastapi",
      "api endpoint",
      "sqlalchemy",
      "database",
      "migration",
      "alembic",
    ],
  },
  {
    label: "orchestrator",
    keywords: [
      "orchestrator",
      "pydanticai",
      "websocket",
      "agent",
      "mcp",
      "tool calling",
      "orquestador",
    ],
  },
  {
    label: "documentation",
    keywords: [
      "docs",
      "documentation",
      "readme",
      "guide",
      "documentacion",
      "guia",
    ],
  },
];

// ── Checklist sections per label ────────────────────────────────────

const CHECKLISTS = {
  "docker-error": `### Docker / Contenedores

- [ ] Verifica que los directorios de bind mount existen en el host antes de \`docker compose up\`
- [ ] Asegurate de que \`SECRET_KEY\` esta definida en \`.env\` (obligatoria para que el backend arranque)
- [ ] Comprueba conflictos de puertos: \`80\`, \`8000\`, \`3001\`, \`5432\` deben estar libres
- [ ] Si usas la imagen Kartoza para PostgreSQL, la variable es \`POSTGRES_PASS\` (no \`POSTGRES_PASSWORD\`)
- [ ] Revisa los logs del contenedor que falla: \`docker compose logs <servicio>\``,

  "env-config": `### Variables de Entorno / Configuracion

- [ ] Copia \`.env.example\` a \`.env\` y rellena los valores necesarios
- [ ] Mapbox necesita **dos tokens con el mismo valor**: \`MAPBOX_ACCESS_TOKEN\` y \`VITE_MAPBOX_ACCESS_TOKEN\`
- [ ] Las variables \`VITE_*\` se inyectan en build time; en Docker se sobreescriben via \`env-config.js\` en runtime
- [ ] Necesitas al menos **una API key de AI**: \`ANTHROPIC_API_KEY\`, \`OPENAI_API_KEY\`, o \`GOOGLE_API_KEY\`
- [ ] Genera \`FERNET_KEY\` con: \`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"\`
- [ ] En produccion, configura \`CORS_ORIGINS\` con tu \`PUBLIC_URL\``,

  "api-issue": `### API Keys / Servicios Externos

- [ ] Verifica que la API key esta correctamente configurada en \`.env\` (sin espacios, sin comillas extra)
- [ ] Comprueba los limites del free tier del servicio (Mapbox: 50k/mes, ORS: 2k/dia, Google Maps: $200 credito)
- [ ] Prueba la key de forma independiente con \`curl\` para descartar problemas en la key
- [ ] Revisa los logs del backend para errores 401/403: \`docker compose logs backend\``,

  "ai-provider": `### AI Provider (Anthropic / OpenAI / Google)

- [ ] Necesitas al menos **una key** de AI configurada en \`.env\`
- [ ] Verifica el formato de la key (Anthropic: \`sk-ant-...\`, OpenAI: \`sk-...\`, Google: string alfanumerica)
- [ ] Revisa los logs del orchestrator: \`docker compose logs orchestrator\`
- [ ] Comprueba que el modelo solicitado esta disponible para tu key/plan`,

  "auth-issue": `### Autenticacion / OAuth

- [ ] Para activar OAuth, asegurate de que \`VITE_AUTH_ENABLED=true\` en \`.env\`
- [ ] Configura \`GOOGLE_CLIENT_ID\` y \`GOOGLE_CLIENT_SECRET\` (o equivalentes de GitHub)
- [ ] Las callback URLs en la consola de OAuth deben coincidir con tu \`PUBLIC_URL\`
- [ ] \`SECRET_KEY\` debe ser **consistente** entre backend y orchestrator`,

  maps: `### Mapas / Routing

- [ ] Configura **ambos** tokens Mapbox: \`MAPBOX_ACCESS_TOKEN\` y \`VITE_MAPBOX_ACCESS_TOKEN\` (mismo valor)
- [ ] Para rutas por carretera usa \`OPENROUTESERVICE_API_KEY\` (gratis, 2k req/dia)
- [ ] Para transporte publico usa \`GOOGLE_MAPS_API_KEY\` ($200/mes de credito gratis)
- [ ] Abre la consola del navegador (F12) para ver errores de carga del mapa`,

  frontend: `### Frontend (React / Vite / Nginx)

- [ ] Abre la consola del navegador (F12 > Console) para ver errores JavaScript
- [ ] Verifica que \`env-config.js\` se carga correctamente en el \`<head>\` del HTML
- [ ] Nginx hace proxy de \`/api\` a \`/api/v1\` en el backend — verifica la config de Nginx si las llamadas API fallan
- [ ] Limpia la cache del navegador y recarga con Ctrl+Shift+R`,

  backend: `### Backend (FastAPI)

- [ ] Comprueba que el backend responde: \`curl http://localhost:8000/health\`
- [ ] Verifica \`DATABASE_URL\` en \`.env\` (debe apuntar al servicio \`db\` de Docker Compose)
- [ ] Ejecuta migraciones: \`docker compose exec backend alembic upgrade head\`
- [ ] Revisa la configuracion de CORS si el frontend no puede conectar`,

  orchestrator: `### Orchestrator (PydanticAI)

- [ ] Comprueba que responde: \`curl http://localhost:3001/health\`
- [ ] \`JWT_SECRET_KEY\` debe coincidir con \`SECRET_KEY\` del backend
- [ ] Verifica que al menos una AI key esta configurada y es valida
- [ ] El MCP server se lanza como subprocess — revisa logs: \`docker compose logs orchestrator\``,
};

// ── Area dropdown → label mapping ────────────────────────────────────

const AREA_LABEL_MAP = {
  "Map / Routes": "maps",
  "AI Chat": "ai-provider",
  "Trip Management": "frontend",
  Destinations: "frontend",
  Accommodations: "frontend",
  "POIs / Itinerary": "frontend",
  Budget: "frontend",
  Documents: "frontend",
  Authentication: "auth-issue",
  Settings: "frontend",
};

// ── Severity dropdown → priority label mapping ───────────────────────

const SEVERITY_PRIORITY_MAP = {
  "Critical (app crashes or data loss)": "priority: critical",
  "High (major feature broken)": "priority: high",
  "Medium (feature partially broken)": "priority: medium",
  "Low (minor inconvenience)": "priority: low",
};

// ── Importance dropdown → priority label mapping ─────────────────────

const IMPORTANCE_PRIORITY_MAP = {
  "Essential (can't use the app without it)": "priority: critical",
  "Important (would significantly improve experience)": "priority: high",
  "Nice to have (quality of life improvement)": "priority: medium",
  "Minor (small enhancement)": "priority: low",
};

// ── Helpers ─────────────────────────────────────────────────────────

async function ensureLabel(github, owner, repo, name) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name });
  } catch {
    await github.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: LABEL_COLORS[name] || "ededed",
    });
  }
}

function matchLabels(text) {
  const lower = text.toLowerCase();
  const matched = [];

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        matched.push(rule.label);
        break;
      }
    }
  }

  return [...new Set(matched)];
}

/**
 * Parse structured fields from YAML template body.
 * Templates generate body with `### Field Name` headers followed by content.
 */
function parseTemplateFields(body) {
  if (!body) return {};
  const fields = {};
  const sections = body.split(/^### /m).slice(1);
  for (const section of sections) {
    const newlineIdx = section.indexOf("\n");
    if (newlineIdx === -1) continue;
    const key = section.substring(0, newlineIdx).trim();
    const value = section.substring(newlineIdx + 1).trim();
    if (value && value !== "_No response_") {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Check if an issue was submitted from the app.
 */
function isFromApp(body) {
  return body && body.includes("<!-- Submitted from app -->");
}

// ── Main ────────────────────────────────────────────────────────────

async function run({ github, context }) {
  const issue = context.payload.issue;
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const body = issue.body || "";
  const text = `${issue.title} ${body}`;

  const labels = matchLabels(text);
  const fields = parseTemplateFields(body);
  const fromApp = isFromApp(body);

  // Add from-app label if submitted from the app
  if (fromApp) {
    labels.push("from-app");
  }

  // Map Affected Area dropdown to labels
  const area = fields["Affected Area"] || fields["Area"];
  if (area && AREA_LABEL_MAP[area]) {
    labels.push(AREA_LABEL_MAP[area]);
  }

  // Map Severity dropdown to priority labels
  const severity = fields["Severity"];
  if (severity && SEVERITY_PRIORITY_MAP[severity]) {
    labels.push(SEVERITY_PRIORITY_MAP[severity]);
  }

  // Map Importance dropdown to priority labels (feature requests)
  const importance = fields["Importance"];
  if (importance && IMPORTANCE_PRIORITY_MAP[importance]) {
    labels.push(IMPORTANCE_PRIORITY_MAP[importance]);
  }

  // Deduplicate labels
  const uniqueLabels = [...new Set(labels)];

  if (uniqueLabels.length === 0) return;

  // Ensure all labels exist and apply them
  await Promise.all(
    uniqueLabels.map((l) => ensureLabel(github, owner, repo, l))
  );

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issue.number,
    labels: uniqueLabels,
  });

  // Build combined checklist comment
  const sections = uniqueLabels
    .filter((l) => CHECKLISTS[l])
    .map((l) => CHECKLISTS[l]);

  const commentParts = [];

  // Add app acknowledgment for issues submitted from the app
  if (fromApp) {
    commentParts.push(
      "Gracias por reportar desde la app! Hemos recibido tu reporte con toda la informacion del entorno, lo que nos ayudara a investigar mas rapido."
    );
    commentParts.push("");
  }

  if (sections.length > 0) {
    commentParts.push(
      "Hola! He detectado algunas areas relevantes en tu issue. Aqui tienes una checklist de diagnostico que podria ayudarte a resolver el problema:"
    );
    commentParts.push("");
    commentParts.push(...sections);
    commentParts.push("");
  }

  if (commentParts.length === 0) return;

  commentParts.push("---");
  commentParts.push(
    "_Si el problema persiste despues de revisar la checklist, anade mas detalles (logs, `.env` redactado, pasos para reproducir) y alguien del equipo lo revisara._"
  );
  commentParts.push("");
  commentParts.push(
    "_Etiquetas asignadas automaticamente: " +
      uniqueLabels.map((l) => `\`${l}\``).join(", ") +
      "_"
  );

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issue.number,
    body: commentParts.join("\n"),
  });
}

module.exports = { run };
