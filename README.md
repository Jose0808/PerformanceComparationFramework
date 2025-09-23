# Performance Comparison Automation

Automated performance comparison between web applications using Playwright, TypeScript, and advanced reporting capabilities.

## 🚀 Features

- **Multi-Application Testing**: Compare performance between different web applications
- **Comprehensive Metrics**: Web Vitals, network metrics, custom timing measurements
- **Statistical Analysis**: Multiple iterations with statistical significance testing
- **Advanced Reporting**: HTML dashboards, comparison reports, CSV exports
- **Parallel Execution**: Configurable parallel test execution
- **Network Simulation**: Throttling for consistent network conditions
- **CI/CD Ready**: Docker support and pipeline integration

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (optional, for containerized execution)

## 🛠 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd performance-comparison-automation
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npm run install:browsers
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your application details
   ```

## ⚙️ Configuration

### Environment Variables

Copy the provided `.env` file and configure your applications:

```bash
# Application #1
APP1_NAME=Aplicativo_1
APP1_BASE_URL=https://app1.example.com
APP1_USERNAME=testuser
APP1_PASSWORD=testpass

# Application #2  
APP2_NAME=Aplicativo_2
APP2_BASE_URL=https://app2-cloud.example.com
APP2_USERNAME=testuser
APP2_PASSWORD=testpass

# Test Configuration
ENVIRONMENT=pre
ITERATIONS=3
PARALLEL_INSTANCES=1
```

### Key Configuration Options

- **ITERATIONS**: Number of test runs per application
- **PARALLEL_INSTANCES**: Concurrent browser instances
- **NETWORK_CONDITIONS**: Network throttling (4g, 3g, slow-3g)
- **CAPTURE_WEB_VITALS**: Enable Core Web Vitals collection
- **THRESHOLD_***: Performance thresholds for pass/fail criteria

## 🚀 Usage

### Basic Test Execution

```bash
# Run performance comparison tests
npm test

# Run with headed browsers (for debugging)
npm run test:headed

# Run with debug mode
npm run test:debug
```

### Advanced Options

```bash
# Run specific test suite
npx playwright test tests/login.spec.ts

# Run with specific browser
npx playwright test --project=chromium

# Run with UI mode
npm run test:ui
```

## 📊 Reports and Artifacts

### Generated Reports

1. **Dashboard** (`dashboard.html`): Executive summary with key metrics
2. **Comparison Report** (`comparison_report.html`): Side-by-side performance analysis  
3. **Individual App Reports**: Detailed metrics per application
4. **Playwright HTML Report**: Test execution details

### Report Locations

```
reports/
├── dashboard.html              # Main dashboard
├── comparison_report.html      # Detailed comparison
├── app1_report.html           # App 1 metrics
├── app2_report.html           # App 2 metrics
├── playwright-report/         # Playwright HTML report
├── screenshots/               # Test screenshots
├── raw-data/                 # CSV exports
└── SUMMARY.txt               # Text summary
```

### Metrics Collected

- **Core Web Vitals**: LCP, FID, CLS, TTFB, FCP
- **Loading Performance**: Total load time, DOM load time, network time
- **Resource Loading**: JS, CSS, image load times
- **Custom Metrics**: Login time, form processing, navigation
- **Network Metrics**: Request count, transfer size, resource count
- **Error Tracking**: JavaScript errors, console errors

## 🏗 Architecture

### Project Structure

```
src/
├── config/
│   └── ConfigManager.ts       # Configuration management
├── pages/
│   ├── BasePage.ts           # Base page object
│   └── LoginPage.ts          # Login page implementation
├── metrics/
│   └── MetricsCollector.ts   # Performance data collection
├── utils/
│   └── PerformanceComparator.ts # Statistical comparison
├── reporters/
│   └── PerformanceReporter.ts   # Custom Playwright reporter
└── setup/
    ├── GlobalSetup.ts        # Pre-test setup
    └── GlobalTeardown.ts     # Post-test cleanup
```

### Key Components

- **ConfigManager**: Centralized configuration management
- **MetricsCollector**: Performance data collection and analysis
- **PerformanceComparator**: Statistical comparison between applications
- **BasePage/LoginPage**: Page Object Model implementation
- **PerformanceReporter**: Custom reporting and artifact generation

## 🐳 Docker Support

### Build Docker Image

```bash
npm run docker:build
```

### Run in Docker

```bash
npm run docker:run
```

### Docker Compose (Advanced)

```yaml
version: '3.8'
services:
  performance-tests:
    build: .
    volumes:
      - ./reports:/app/reports
      - ./.env:/app/.env
    environment:
      - ENVIRONMENT=docker
```

## 🔧 Customization

### Adding New Applications

1. Update `.env` with new application details
2. Configure additional APP3_* variables
3. Update `ConfigManager.ts` to handle new applications

### Custom Metrics

```typescript
await this.metricsCollector.recordCustomMetric('custom_action_time', duration);
```

### New Test Scenarios

1. Create new page objects in `src/pages/`
2. Add test scenarios in `tests/`
3. Update performance thresholds in `.env`

### Custom Reports

Extend `PerformanceReporter.ts` to add new report formats:

```typescript
private async generateCustomReport(data: any): Promise<void> {
}
```

## 📈 Performance Analysis

### Statistical Analysis

The tool provides comprehensive statistical analysis:

- **Mean, Median, Standard Deviation**: Central tendency measurements
- **95th Percentile**: High-end performance analysis  
- **Outlier Detection**: Identify anomalous results
- **Regression Detection**: Alert on performance degradation

### Threshold Configuration

Set performance budgets in `.env`:

```bash
THRESHOLD_LOGIN_TIME=2000      # Maximum acceptable login time
THRESHOLD_LCP=2500            # Largest Contentful Paint limit
REGRESSION_THRESHOLD_PERCENTAGE=10  # Acceptable regression %
```

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Latency tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run install:browsers
      - run: npm test
      - uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: reports/
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm run install:browsers'
                sh 'npm test'
            }
        }
        stage('Reports') {
            steps {
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'reports',
                    reportFiles: 'dashboard.html',
                    reportName: 'Performance Report'
                ])
            }
        }
    }
}
```

## 🔍 Troubleshooting

### Common Issues

**Tests fail with timeout errors:**
- Increase `PAGE_LOAD_TIMEOUT` in `.env`
- Check network connectivity to target applications
- Verify application credentials

**No performance data collected:**
- Ensure `CAPTURE_*` flags are set to `true`
- Check browser console for JavaScript errors
- Verify page load completion

**Reports not generated:**
- Check `OUTPUT_PATH` directory permissions
- Verify sufficient disk space
- Review console output for reporter errors

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm test
```

### Verbose Network Logs

```bash
CAPTURE_NETWORK_LOGS=true npm test
```

## 📝 Best Practices

### Test Stability

1. **Use warmup iterations** to stabilize measurements
2. **Configure cooldown periods** between runs
3. **Implement retry logic** for flaky tests
4. **Use consistent network conditions**

### Performance Measurement

1. **Run multiple iterations** for statistical significance
2. **Set realistic thresholds** based on business requirements
3. **Focus on user-centric metrics** (Web Vitals)

### Maintenance

1. **Keep selectors up to date** with application changes
2. **Review and update thresholds** regularly
3. **Monitor test execution time** and optimize as needed
4. **Clean up old reports** periodically

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Create GitHub issues for bugs and feature requests
- Check existing documentation and troubleshooting guide
- Review sample configurations and examples

---

**Happy Latency testing! 🚀📊**