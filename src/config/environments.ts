import { TestConfig } from '../types';

export const testConfig: TestConfig = {
  applications: {
    app1: {
      name: 'Legacy Application',
      baseUrl: process.env.APP1_BASE_URL || 'https://bes.nh.inet:12700/oc/bes/sm/login/login-colombia.html',
      technology: 'Legacy Tech Stack',
      credentials: {
        accountType: process.env.APP1_ACCOUTN_TYPE || 'InternalAccount',
        username: process.env.APP1_USERNAME || 'test018',
        password: process.env.APP1_PASSWORD || 'Abc1234%'
      }
    },
    app2: {
      name: 'New Application',
      baseUrl: process.env.APP2_BASE_URL || 'https://10.203.113.119/oc/bes/sm/login/login-colombia.html',
      technology: 'Modern Tech Stack',
      credentials: {
        accountType: process.env.APP1_ACCOUTN_TYPE || 'InternalAccount',
        username: process.env.APP2_USERNAME || 'test018',
        password: process.env.APP2_PASSWORD || 'Abc1234%'
      }
    }
  },
  
  environments: {
    pre: {
      name: 'Pre-production',
      networkConditions: {
        offline: false,
        downloadThroughput: 1.5 * 1024 * 1024, // 1.5 Mbps
        uploadThroughput: 750 * 1024, // 750 Kbps
        latency: 40 // 40ms
      },
      parallelInstances: parseInt(process.env.PRE_PARALLEL_INSTANCES || '3'),
      iterations: parseInt(process.env.PRE_ITERATIONS || '5')
    },
    
    pro: {
      name: 'Production',
      networkConditions: {
        offline: false,
        downloadThroughput: 10 * 1024 * 1024, // 10 Mbps
        uploadThroughput: 2 * 1024 * 1024, // 2 Mbps
        latency: 20 // 20ms
      },
      parallelInstances: parseInt(process.env.PRO_PARALLEL_INSTANCES || '2'),
      iterations: parseInt(process.env.PRO_ITERATIONS || '1')
    }
  },
  
  execution: {
    scenarios: ['login', 'dashboard', 'navigation', 'form-processing'],
    outputPath: process.env.OUTPUT_PATH || './reports',
    reportFormat: ['allure', 'json'],
    thresholds: {
      lcp: 2500, // 2.5 seconds
      fid: 100,  // 100 milliseconds
      cls: 0.1,  // 0.1 score
      ttfb: 600, // 600 milliseconds
      totalLoadTime: 5000 // 5 seconds
    }
  }
};

// Environment-specific configurations
export const getCurrentEnvironment = (): 'pre' | 'pro' => {
  const env = process.env.TEST_ENVIRONMENT as 'pre' | 'pro';
  return env || 'pre';
};

export const getAppConfig = (appName: 'app1' | 'app2') => {
  return testConfig.applications[appName];
};

export const getEnvironmentConfig = () => {
  const currentEnv = getCurrentEnvironment();
  return testConfig.environments[currentEnv];
};

// Utility functions for configuration
export const shouldRunInParallel = (): boolean => {
  return process.env.RUN_PARALLEL !== 'false';
};

export const getWorkerCount = (): number => {
  const envConfig = getEnvironmentConfig();
  return parseInt(process.env.WORKER_COUNT || envConfig.parallelInstances.toString());
};

export const getIterationCount = (): number => {
  const envConfig = getEnvironmentConfig();
  return parseInt(process.env.ITERATION_COUNT || envConfig.iterations.toString());
};