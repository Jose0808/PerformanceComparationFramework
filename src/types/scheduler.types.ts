import { TestExecution } from './timer.types';
import { ComparisonReport } from './timer.types';

// ============================================================================
// PERFIL DE SCHEDULER
// ============================================================================

export interface SchedulerProfile {
  id: string;
  name: string;
  description: string;
  created: Date;
  updated: Date;
  schedule: ScheduleConfig;
  tests: TestConfig;
  reporting: ReportingConfig;
  notifications: NotificationConfig;
  thresholds: ThresholdConfig;
}

export interface ScheduleConfig {
  intervalMinutes: number;              // Cada cuántos minutos ejecutar
  startTime: string;                    // "08:00" - Hora de inicio diario
  endTime: string;                      // "18:00" - Hora de fin diario
  daysOfWeek: number[];                 // [1,2,3,4,5] - Lunes a Viernes (0=Domingo)
  timezone: string;                     // "America/Bogota"
  duration?: ScheduleDuration;          // Duración total del monitoreo
}

export interface ScheduleDuration {
  type: 'indefinite' | 'days' | 'weeks' | 'months' | 'until_date';
  value?: number;                       // Para types con duración específica
  endDate?: Date;                       // Para type 'until_date'
}

export interface TestConfig {
  enabled: boolean;
  testFiles: string[];                  // ['CambioDeNumero.spec.ts', 'login.spec.ts']
  iterations: number;                   // Cuántas iteraciones por ejecución
  parallelInstances: number;            // Instancias paralelas
  clearCacheBetweenRuns: boolean;
  browserRestartFrequency: number;      // Cada cuántas ejecuciones reiniciar browser
  cooldownBetweenRuns: number;          // ms entre ejecuciones
  timeoutMinutes: number;               // Timeout por ejecución completa
}

export interface ReportingConfig {
  generateIndividualReports: boolean;   // Reporte individual por ejecución
  generateConsolidatedReport: boolean;  // Reporte consolidado periódico
  consolidatedFrequency: ConsolidatedFrequency;
  retentionDays: number;                // Días para mantener reportes
  exportFormats: ExportFormat[];        // Formatos de exportación
  includeScreenshots: boolean;
  includeTrendAnalysis: boolean;
}

export type ConsolidatedFrequency = 'hourly' | 'every_4_hours' | 'every_8_hours' | 'daily' | 'weekly';
export type ExportFormat = 'html' | 'pdf' | 'json' | 'csv' | 'excel';

export interface NotificationConfig {
  enabled: boolean;
  onSuccess: boolean;                   // Notificar ejecuciones exitosas
  onFailure: boolean;                   // Notificar fallas
  onThresholdExceeded: boolean;         // Notificar cuando se superen umbrales
  onCompletion: boolean;                // Notificar finalización de ciclo
  methods: NotificationMethod[];
}

export interface NotificationMethod {
  type: 'email' | 'webhook' | 'file' | 'windows_notification';
  config: EmailConfig | WebhookConfig | FileConfig | WindowsNotificationConfig;
  enabled: boolean;
}

export interface EmailConfig {
  to: string[];
  subject: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface FileConfig {
  filePath: string;
  format: 'json' | 'txt' | 'csv';
}

export interface WindowsNotificationConfig {
  title: string;
  message: string;
  icon?: string;
}

export interface ThresholdConfig {
  enabled: boolean;
  latencyThresholds: {
    onpremiseMaxSeconds: number;
    cloudMaxSeconds: number;
    differenceMaxSeconds: number;
    degradationPercentage: number;      // % de degradación para alertar
  };
  reliabilityThresholds: {
    minSuccessRate: number;             // % mínimo de éxito
    maxConsecutiveFailures: number;
  };
  stepThresholds: Array<{
    stepName: string;
    maxSeconds: number;
  }>;
}

// ============================================================================
// ESTADO Y EJECUCIÓN
// ============================================================================

export interface SchedulerStatus {
  isRunning: boolean;
  currentProfile?: SchedulerProfile;
  nextExecution?: Date;
  lastExecution?: ExecutionRecord;
  lastHeartbeat?: Date;
  taskSchedulerTaskName?: string;
  processId?: number;
  statistics?: SchedulerStatistics;
}

export interface SchedulerStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;        // En segundos
  uptimePercentage: number;
  lastResetDate: Date;
}

export interface ExecutionRecord {
  id: string;
  profileId: string;
  timestamp: Date;
  startTime: Date;
  endTime: Date;
  duration: number;                     // Duración total en ms
  status: ExecutionStatus;
  results?: ExecutionResults;
  comparison?: ComparisonReport;
  errors?: ExecutionError[];
  metadata: ExecutionMetadata;
}

export type ExecutionStatus = 'success' | 'partial' | 'failed' | 'timeout' | 'cancelled';

export interface ExecutionResults {
  onpremise?: TestExecution;
  cloud?: TestExecution;
  iterations: number;
  completedIterations: number;
  browserRestarts: number;
}

export interface ExecutionError {
  type: 'test_failure' | 'timeout' | 'network' | 'browser' | 'system';
  message: string;
  step?: string;
  timestamp: Date;
  stack?: string;
}

export interface ExecutionMetadata {
  schedulerVersion: string;
  playwrightVersion: string;
  nodeVersion: string;
  systemInfo: {
    platform: string;
    arch: string;
    totalMemory: number;
    freeMemory: number;
    cpuUsage: number;
  };
  networkInfo: {
    latency?: number;
    downloadSpeed?: number;
    uploadSpeed?: number;
  };
}

// ============================================================================
// REPORTES CONSOLIDADOS
// ============================================================================

export interface ConsolidatedMetrics {
  period: MetricsPeriod;
  summary: MetricsSummary;
  performance: PerformanceMetrics;
  reliability: ReliabilityMetrics;
  trends: TrendAnalysis;
  insights: PerformanceInsights;
  stepAnalysis: StepAnalysisMetrics[];
  hourlyBreakdown: HourlyMetrics[];
}

export interface MetricsPeriod {
  start: Date;
  end: Date;
  totalExecutions: number;
  successfulExecutions: number;
  profileId: string;
  generatedAt: Date;
}

export interface MetricsSummary {
  averages: {
    onpremise: number;
    cloud: number;
    difference: number;
    totalExecutionTime: number;
  };
  medians: {
    onpremise: number;
    cloud: number;
    difference: number;
  };
  percentiles: {
    p95: { onpremise: number; cloud: number; };
    p99: { onpremise: number; cloud: number; };
  };
}

export interface PerformanceMetrics {
  bestPerformance: {
    onpremise: { value: number; timestamp: Date; };
    cloud: { value: number; timestamp: Date; };
  };
  worstPerformance: {
    onpremise: { value: number; timestamp: Date; };
    cloud: { value: number; timestamp: Date; };
  };
  improvementOverTime: number;          // % de mejora
  degradationAlerts: DegradationAlert[];
}

export interface ReliabilityMetrics {
  successRate: number;                  // % de ejecuciones exitosas
  failureRate: number;                  // % de ejecuciones fallidas
  partialSuccessRate: number;           // % de ejecuciones parciales
  averageFailureRecoveryTime: number;   // Tiempo promedio para recuperarse
  longestUptime: { duration: number; start: Date; end: Date; };
  failurePatterns: FailurePattern[];
}

export interface TrendAnalysis {
  dailyTrends: DailyTrend[];
  hourlyPattern: HourlyPattern[];
  weeklyComparison: WeeklyComparison[];
  seasonalEffects?: SeasonalEffect[];
}

export interface DailyTrend {
  date: string;                         // YYYY-MM-DD
  avgOnpremise: number;
  avgCloud: number;
  executionCount: number;
  successRate: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface HourlyPattern {
  hour: number;                         // 0-23
  avgOnpremise: number;
  avgCloud: number;
  executionCount: number;
  reliability: number;
  performanceGrade: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface HourlyMetrics {
  hour: number;
  executions: ExecutionRecord[];
  averageLatency: {
    onpremise: number;
    cloud: number;
  };
  successRate: number;
  trends: {
    improving: boolean;
    degrading: boolean;
    stable: boolean;
  };
}

export interface WeeklyComparison {
  week: string;                         // ISO week (2024-W10)
  metrics: MetricsSummary;
  comparisonToPrevious: number;         // % de cambio
}

export interface SeasonalEffect {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  impact: number;                       // Factor multiplicativo
  confidence: number;                   // 0-1
}

export interface PerformanceInsights {
  slowestHours: number[];               // Horas más lentas del día
  fastestHours: number[];               // Horas más rápidas del día
  optimalExecutionTimes: string[];      // Horarios recomendados
  degradationAlerts: DegradationAlert[];
  recommendations: PerformanceRecommendation[];
}

export interface DegradationAlert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  threshold: number;
  actualValue: number;
  environment: 'onpremise' | 'cloud' | 'both';
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceRecommendation {
  type: 'schedule_optimization' | 'threshold_adjustment' | 'infrastructure' | 'test_optimization';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: string;
  actionRequired: boolean;
}

export interface FailurePattern {
  type: string;
  frequency: number;
  lastOccurrence: Date;
  affectedSteps: string[];
  averageRecoveryTime: number;
}

export interface StepAnalysisMetrics {
  stepName: string;
  executionCount: number;
  averages: {
    onpremise: number;
    cloud: number;
    difference: number;
  };
  reliability: number;                  // % de éxito para este paso
  frequencyOfExecution: number;         // % de ejecuciones que incluyen este paso
  performanceGrade: 'excellent' | 'good' | 'fair' | 'poor';
  trends: {
    improving: boolean;
    degrading: boolean;
    stable: boolean;
  };
  subSteps?: SubStepMetrics[];
}

export interface SubStepMetrics {
  name: string;
  averages: {
    onpremise: number;
    cloud: number;
  };
  executionCount: number;
  reliability: number;
}

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================

export interface SchedulerConfig {
  version: string;
  dataDirectory: string;
  maxHistoryDays: number;
  maxExecutionTimeoutMinutes: number;
  heartbeatIntervalSeconds: number;
  cleanupIntervalHours: number;
  defaultProfile?: string;
  globalThresholds: ThresholdConfig;
  logging: LoggingConfig;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file: string;
  maxSize: string;                      // "10MB"
  maxFiles: number;
  console: boolean;
}

// ============================================================================
// COMUNICACIÓN ELECTRON - SCHEDULER
// ============================================================================

export interface SchedulerCommand {
  type: 'create_profile' | 'update_profile' | 'delete_profile' | 'start_task' | 
        'stop_task' | 'run_now' | 'get_status' | 'get_history' | 'get_metrics' |
        'pause_all' | 'resume_all' | 'cleanup_all';
  profileId?: string;
  profile?: SchedulerProfile;
  params?: Record<string, any>;
}

export interface SchedulerResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// UTILIDADES Y HELPERS
// ============================================================================

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaskHealthCheck {
  taskExists: boolean;
  isEnabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
  status: string;
  details?: any;
}

// Export de todas las interfaces y tipos
export * from './timer.types';  