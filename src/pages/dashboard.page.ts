import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { ApplicationConfig } from '../types';

export class DashboardPage extends BasePage {
  // Selectors - Customize these for your dashboard
  private selectors = {
    dashboardContainer: '[data-testid="dashboard"], .dashboard, main, #main-content',
    loadingSpinner: '[data-testid="loading"], .loading, .spinner, .skeleton',
    navigationMenu: '[data-testid="navigation"], .nav, .sidebar, nav',
    userProfile: '[data-testid="user-profile"], .user-info, .profile',
    
    // Dashboard widgets/components
    widgets: {
      charts: '[data-testid="chart"], .chart, canvas, svg',
      tables: '[data-testid="table"], .table, table',
      cards: '[data-testid="card"], .card, .widget',
      stats: '[data-testid="stats"], .stats, .metrics'
    },
    
    // Interactive elements
    filters: '[data-testid="filter"], .filter, .search-filter',
    searchBox: '[data-testid="search"], input[type="search"], .search-input',
    refreshButton: '[data-testid="refresh"], .refresh, [aria-label*="refresh"]',
    
    // Content areas
    mainContent: '[data-testid="main-content"], .main-content, .content-area',
    sidePanel: '[data-testid="side-panel"], .side-panel, .sidebar-content'
  };

  constructor(page: Page, appConfig: ApplicationConfig) {
    super(page, appConfig);
  }

  /**
   * Navigate to dashboard and measure load time
   */
  async navigateToDashboard(): Promise<number> {
    const dashboardUrl = `${this.appConfig.baseUrl}/dashboard`;
    const navigationTime = await this.navigateTo(dashboardUrl);
    
    await this.verifyDashboardLoaded();
    return navigationTime;
  }

  /**
   * Wait for dashboard to fully load and measure components
   */
  async measureDashboardLoad(): Promise<{
    totalLoadTime: number;
    containerLoadTime: number;
    navigationLoadTime: number;
    widgetsLoadTime: number;
    dataLoadTime: number;
  }> {
    const startTime = Date.now();
    
    // Measure container load
    const containerStartTime = Date.now();
    await this.waitForElement(this.selectors.dashboardContainer);
    const containerLoadTime = Date.now() - containerStartTime;

    // Measure navigation load
    const navigationStartTime = Date.now();
    await this.waitForElement(this.selectors.navigationMenu);
    const navigationLoadTime = Date.now() - navigationStartTime;

    // Measure widgets load
    const widgetsLoadTime = await this.measureWidgetsLoad();

    // Measure data load (wait for loading spinners to disappear)
    const dataLoadTime = await this.measureDataLoad();

    const totalLoadTime = Date.now() - startTime;

    // Store metrics
    this.setCustomMetric('dashboard_total_load', totalLoadTime);
    this.setCustomMetric('dashboard_container_load', containerLoadTime);
    this.setCustomMetric('dashboard_navigation_load', navigationLoadTime);
    this.setCustomMetric('dashboard_widgets_load', widgetsLoadTime);
    this.setCustomMetric('dashboard_data_load', dataLoadTime);

    return {
      totalLoadTime,
      containerLoadTime,
      navigationLoadTime,
      widgetsLoadTime,
      dataLoadTime
    };
  }

  /**
   * Measure time for widgets/components to load
   */
  private async measureWidgetsLoad(): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Wait for different types of widgets
      const widgetPromises = [
        this.measureContentLoad(this.selectors.widgets.charts, 'charts'),
        this.measureContentLoad(this.selectors.widgets.tables, 'tables'),
        this.measureContentLoad(this.selectors.widgets.cards, 'cards'),
        this.measureContentLoad(this.selectors.widgets.stats, 'stats')
      ];

      await Promise.allSettled(widgetPromises);
    } catch (error) {
      console.warn('Some widgets failed to load within timeout');
    }

    return Date.now() - startTime;
  }

  /**
   * Measure data loading time (when spinners disappear)
   */
  private async measureDataLoad(): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Wait for loading spinners to appear and then disappear
      const spinners = this.page.locator(this.selectors.loadingSpinner);
      const spinnerCount = await spinners.count();
      
      if (spinnerCount > 0) {
        // Wait for all spinners to disappear
        await spinners.first().waitFor({ state: 'detached', timeout: 30000 });
      }
      
      // Additional wait for network to be idle
      await this.waitForNetworkIdle();
      
    } catch (error) {
      console.warn('Data loading measurement timeout');
    }

    return Date.now() - startTime;
  }

  /**
   * Verify dashboard loaded correctly
   */
  async verifyDashboardLoaded(): Promise<void> {
    await this.verifyPageLoaded('/dashboard');
    
    // Verify essential dashboard elements
    await this.waitForElement(this.selectors.dashboardContainer);
    await this.waitForElement(this.selectors.navigationMenu);
  }

  /**
   * Measure search functionality performance
   */
  async measureSearchPerformance(searchTerm: string): Promise<number> {
    if (!await this.elementExists(this.selectors.searchBox, 2000)) {
      return 0;
    }

    const searchTime = await this.metricsCollector.measureActionTime(async () => {
      await this.fillAndMeasure(this.selectors.searchBox, searchTerm, 'search');
      await this.page.keyboard.press('Enter');
      await this.waitForNetworkIdle();
    });

    this.setCustomMetric('dashboard_search_time', searchTime);
    return searchTime;
  }

  /**
   * Measure filter application performance
   */
  async measureFilterPerformance(): Promise<number> {
    if (!await this.elementExists(this.selectors.filters, 2000)) {
      return 0;
    }

    const filterTime = await this.metricsCollector.measureActionTime(async () => {
      const firstFilter = this.page.locator(this.selectors.filters).first();
      await firstFilter.click();
      await this.waitForNetworkIdle();
    });

    this.setCustomMetric('dashboard_filter_time', filterTime);
    return filterTime;
  }

  /**
   * Measure refresh functionality
   */
  async measureRefreshPerformance(): Promise<number> {
    if (!await this.elementExists(this.selectors.refreshButton, 2000)) {
      return 0;
    }

    const refreshTime = await this.metricsCollector.measureActionTime(async () => {
      await this.clickAndMeasure(this.selectors.refreshButton, 'refresh');
      await this.measureDataLoad();
    });

    this.setCustomMetric('dashboard_refresh_time', refreshTime);
    return refreshTime;
  }

  /**
   * Measure navigation between dashboard sections
   */
  async measureSectionNavigation(sectionName: string, sectionSelector: string): Promise<number> {
    const navigationTime = await this.metricsCollector.measureActionTime(async () => {
      await this.clickAndMeasure(sectionSelector, `navigation_${sectionName}`);
      await this.waitForNetworkIdle();
    });

    this.setCustomMetric(`dashboard_nav_${sectionName}`, navigationTime);
    return navigationTime;
  }

  /**
   * Count and measure different types of content
   */
  async measureContentMetrics(): Promise<{
    chartCount: number;
    tableCount: number;
    cardCount: number;
    chartLoadTime: number;
    tableLoadTime: number;
  }> {
    const [chartCount, tableCount, cardCount] = await Promise.all([
      this.page.locator(this.selectors.widgets.charts).count(),
      this.page.locator(this.selectors.widgets.tables).count(),
      this.page.locator(this.selectors.widgets.cards).count()
    ]);

    // Measure specific content load times
    const chartLoadTime = chartCount > 0 ? await this.measureContentLoad(this.selectors.widgets.charts, 'charts_detailed') : 0;
    const tableLoadTime = tableCount > 0 ? await this.measureContentLoad(this.selectors.widgets.tables, 'tables_detailed') : 0;

    return {
      chartCount,
      tableCount,
      cardCount,
      chartLoadTime,
      tableLoadTime
    };
  }

  /**
   * Measure API calls made by dashboard
   */
  async measureApiCalls(): Promise<{ [endpoint: string]: number }> {
    const apiTimes: { [endpoint: string]: number } = {};
    
    const commonEndpoints = [
      '/api/dashboard/data',
      '/api/dashboard/stats',
      '/api/dashboard/charts',
      '/api/user/profile',
      '/api/notifications'
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const apiTime = await this.waitForApiResponse(endpoint, 5000);
        apiTimes[endpoint] = apiTime;
      } catch {
        // API endpoint might not exist or timeout
      }
    }

    return apiTimes;
  }

  /**
   * Perform comprehensive dashboard performance test
   */
  async performComprehensiveTest(): Promise<{
    loadMetrics: any;
    contentMetrics: any;
    apiMetrics: any;
    interactionMetrics: {
      searchTime: number;
      filterTime: number;
      refreshTime: number;
    };
  }> {
    // Setup performance monitoring
    await this.setupPerformanceMonitoring();

    // Navigate and measure initial load
    await this.navigateToDashboard();
    const loadMetrics = await this.measureDashboardLoad();

    // Measure content
    const contentMetrics = await this.measureContentMetrics();

    // Measure API calls
    const apiMetrics = await this.measureApiCalls();

    // Measure interactions
    const searchTime = await this.measureSearchPerformance('test search');
    const filterTime = await this.measureFilterPerformance();
    const refreshTime = await this.measureRefreshPerformance();

    const interactionMetrics = {
      searchTime,
      filterTime,
      refreshTime
    };

    return {
      loadMetrics,
      contentMetrics,
      apiMetrics,
      interactionMetrics
    };
  }

  /**
   * Get user information from dashboard
   */
  async getUserInfo(): Promise<string | null> {
    if (await this.elementExists(this.selectors.userProfile, 2000)) {
      return await this.page.locator(this.selectors.userProfile).textContent();
    }
    return null;
  }

  /**
   * Check if dashboard has loaded with data
   */
  async isDashboardDataLoaded(): Promise<boolean> {
    // Check if there are no loading spinners and content is present
    const hasLoadingSpinners = await this.elementExists(this.selectors.loadingSpinner, 1000);
    const hasContent = await this.elementExists(this.selectors.mainContent, 1000);
    
    return !hasLoadingSpinners && hasContent;
  }
}