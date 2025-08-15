# Performance Comparison Framework

Framework para comparar métricas de performance entre dos aplicaciones web utilizando Playwright, TypeScript y Allure Reports.

## 🚀 Setup Inicial

### Prerrequisitos
- Node.js 18+ 
- npm o yarn

### Instalación Rápida
```bash
git clone <repository-url>
cd performance-comparison-framework
npm run setup
```

### Configuración Manual
1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Instalar browsers de Playwright:**
   ```bash
   npm run install:browsers
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

## ⚙️ Configuración

### Variables de Entorno Principales
- `TEST_ENVIRONMENT`: `pre` o `pro`
- `APP1_BASE_URL`: URL de la aplicación legacy
- `APP2_BASE_URL`: URL de la aplicación nueva
- `WORKER_COUNT`: Número de instancias paralelas
- `ITERATION_COUNT`: Número de iteraciones por escenario

### Configuración de Aplicaciones
Edita `src/config/environments.ts` para ajustar:
- URLs de aplicaciones
- Credenciales de acceso
- Thresholds de performance
- Configuraciones de red

## 🏃‍♂️ Ejecución

### Comandos Básicos
```bash
# Ejecutar en pre-producción
npm run test:pre

# Ejecutar en producción
npm run test:pro

# Ejecución paralela (por defecto)
npm run test:parallel

# Ejecución secuencial
npm run test:sequential

# Debug mode
npm run test:debug

# Con interfaz gráfica
npm run test:headed
```

### Generar Reportes
```bash
# Ver reporte HTML de Playwright
npm run report

# Generar y servir reporte Allure
npm run report:allure

# Solo generar reporte Allure
npm run report:generate
```

## 📊 Métricas Capturadas

### Core Web Vitals
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay) / **INP** (Interaction to Next Paint)
- **CLS** (Cumulative Layout Shift)

### Performance Metrics
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- DNS Resolution Time
- SSL Handshake Time
- Resource Loading Times

### Application Metrics (Personalizables)
- Tiempo de login
- Tiempo de carga de dashboard
- Tiempos de navegación
- Tiempos de respuesta de APIs
- Tiempos de procesamiento de formularios

## 🔧 Estructura del Proyecto

```
performance-comparison-framework/
├── src/
│   ├── config/           # Configuraciones de ambiente
│   ├── pages/           # Page Object Models
│   ├── tests/           # Tests de performance
│   ├── utils/           # Utilidades y helpers
│   └── types/           # Definiciones de TypeScript
├── data/                # Data-driven test scenarios
├── reports/             # Reportes generados
├── allure-results/      # Resultados para Allure
└── .env                # Variables de entorno
```

## 🚀 Preparación para Pipeline (Futuro)

El framework está diseñado para fácil integración con:
- **GitHub Actions**
- **Jenkins**
- **Azure DevOps**
- **GitLab CI/CD**

### Variables para Pipeline
```bash
PIPELINE_MODE=true
SLACK_WEBHOOK_URL=your-webhook
EMAIL_RECIPIENTS=team@company.com
BASELINE_BRANCH=main
```

## 📝 Próximos Pasos

1. Crear Page Object Models específicos para tus aplicaciones
2. Definir escenarios de prueba en data/
3. Configurar métricas específicas de tu aplicación
4. Establecer thresholds apropiados
5. Configurar notificaciones y alertas

## 🛠️ Comandos de Desarrollo

```bash
# Limpiar archivos generados
npm run clean

# Compilar TypeScript
npm run build

# Ejecutar un test específico
npx playwright test tests/login.spec.ts

# Ejecutar con configuración específica
TEST_ENVIRONMENT=pro WORKER_COUNT=1 npm test
```

## 📚 Documentación

- [Playwright Documentation](https://playwright.dev/)
- [Allure Report Documentation](https://docs.qameta.io/allure/)
- [Web Vitals Guide](https://web.dev/vitals/)