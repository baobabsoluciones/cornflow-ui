import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestEntry {
  title: string;
  titlePath: string[];
  file: string;
  status: string;
  duration: number;
  errors: string[];
  retry: number;
  tags: string[];
  screenshots: string[];
}

interface SuiteStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  timedOut: number;
  flaky: number;
  duration: number;
}

interface CorporateReporterOptions {
  /** Output file path relative to the project root. Default: 'playwright-report/corporate-report.html' */
  outputFile?: string;
  /** Company name shown in the header. Default: 'baobab soluciones' */
  companyName?: string;
  /** Project/product name. Default: 'Cornflow UI' */
  projectName?: string;
  /** Path to a logo image (PNG/SVG). Will be base64-embedded. */
  logoPath?: string;
  /** Whether to embed screenshot thumbnails for failed tests. Default: true */
  embedScreenshots?: boolean;
}

// ---------------------------------------------------------------------------
// Brand tokens – Baobab Soluciones corporate palette
// ---------------------------------------------------------------------------

const BRAND = {
  primary: '#213c52',
  primaryLight: '#326786',
  primaryLighter: '#e6f1f7',
  secondary: '#ffb458',
  accent: '#4e7f9c',
  success: '#3ba780',
  warning: '#ffb458',
  danger: '#f44336',
  dangerLight: '#fde8e6',
  background: '#f6f6f6',
  surface: '#ffffff',
  title: '#404040',
  subtitle: '#6e6e6e',
  border: '#e0e0e0',
  textOnPrimary: '#ffffff',
};

// ---------------------------------------------------------------------------
// Reporter implementation
// ---------------------------------------------------------------------------

class CorporateReporter implements Reporter {
  /**
   * Map keyed by TestCase.id so that only the **last** result per test
   * is kept. This prevents retry attempts from inflating the counters.
   */
  private testMap = new Map<string, TestEntry>();
  private tests: TestEntry[] = [];
  private stats: SuiteStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    flaky: 0,
    duration: 0,
  };
  private startTime = new Date();
  private options: Required<CorporateReporterOptions>;
  private config!: FullConfig;
  private rootSuite!: Suite;

  constructor(options: CorporateReporterOptions = {}) {
    this.options = {
      outputFile:
        options.outputFile || 'playwright-report/corporate-report.html',
      companyName: options.companyName || 'baobab soluciones',
      projectName: options.projectName || 'Cornflow UI',
      logoPath:
        options.logoPath ||
        path.resolve(
          process.cwd(),
          'src/app/assets/logo/baobab_full_logo.png',
        ),
      embedScreenshots:
        options.embedScreenshots !== undefined
          ? options.embedScreenshots
          : true,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle hooks
  // -----------------------------------------------------------------------

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.rootSuite = suite;
    this.startTime = new Date();
    this.stats.total = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Collect screenshots from attachments (handle both file path and in-memory body)
    const screenshots: string[] = [];
    if (this.options.embedScreenshots) {
      for (const attachment of result.attachments) {
        if (!attachment.contentType?.startsWith('image/')) continue;
        const mimeType = attachment.contentType;

        try {
          // Prefer reading from the file path
          if (attachment.path && fs.existsSync(attachment.path)) {
            const imgBuffer = fs.readFileSync(attachment.path);
            screenshots.push(
              `data:${mimeType};base64,${imgBuffer.toString('base64')}`,
            );
          } else if (attachment.body) {
            // Fallback: attachment stored as an in-memory Buffer
            screenshots.push(
              `data:${mimeType};base64,${attachment.body.toString('base64')}`,
            );
          }
        } catch {
          // Skip unreadable attachments
        }
      }
    }

    // Collect error messages
    const errors = result.errors.map((e) => {
      const message = e.message || '';
      const snippet = e.snippet || '';
      const stack = e.stack || '';
      return [message, snippet, stack].filter(Boolean).join('\n');
    });

    const entry: TestEntry = {
      title: test.title,
      titlePath: test.titlePath(),
      file: path.relative(this.config.rootDir, test.location.file),
      status: result.status,
      duration: result.duration,
      errors,
      retry: result.retry,
      tags: test.tags || [],
      screenshots,
    };

    // Overwrite any previous attempt for this test so only the final
    // retry is kept. This prevents retries from inflating the stats.
    this.testMap.set(test.id, entry);
  }

  async onEnd(result: FullResult): Promise<void> {
    // Build final tests array from the deduplicated map
    this.tests = Array.from(this.testMap.values());

    // Compute stats from unique final outcomes only
    this.stats = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
      flaky: 0,
      duration: result.duration,
    };
    for (const t of this.tests) {
      switch (t.status) {
        case 'passed':
          this.stats.passed++;
          if (t.retry > 0) this.stats.flaky++;
          break;
        case 'failed':
          this.stats.failed++;
          break;
        case 'skipped':
          this.stats.skipped++;
          break;
        case 'timedOut':
          this.stats.timedOut++;
          break;
      }
    }

    const html = this.generateHTML(result);
    // Resolve relative to process.cwd() (project root) instead of config.rootDir,
    // because rootDir points to testDir (specs/) which is not the desired location.
    const outputPath = path.resolve(process.cwd(), this.options.outputFile);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(
      `\n📊 Corporate report generated: ${path.relative(process.cwd(), outputPath)}\n`,
    );
  }

  printsToStdio(): boolean {
    return false;
  }

  // -----------------------------------------------------------------------
  // HTML generation
  // -----------------------------------------------------------------------

  private generateHTML(result: FullResult): string {
    const logo = this.getLogoBase64();
    const timestamp = new Date().toLocaleString('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const overallStatus = result.status;
    const passRate =
      this.stats.total > 0
        ? ((this.stats.passed / this.stats.total) * 100).toFixed(1)
        : '0';

    // Group tests by file
    const testsByFile = this.groupTestsByFile();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>E2E Test Report – ${this.escapeHtml(this.options.projectName)}</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header" style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryLight} 100%);color:#fff;padding:28px 32px;">
    <table class="header__table" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:1200px;margin:0 auto;">
      <tr>
        <td style="vertical-align:middle;">
          <div class="header__brand" style="display:flex;align-items:center;gap:16px;">
            ${logo ? `<img src="${logo}" alt="${this.escapeHtml(this.options.companyName)}" class="header__logo" style="height:48px;width:auto;border-radius:6px;background:rgba(255,255,255,0.15);padding:4px 8px;" />` : ''}
            <div class="header__titles">
              <h1 class="header__project" style="font-size:24px;font-weight:700;margin:0;color:#fff;">${this.escapeHtml(this.options.projectName)}</h1>
              <p class="header__subtitle" style="font-size:14px;opacity:0.85;margin:2px 0 0;">${this.escapeHtml('E2E Test Report')}</p>
            </div>
          </div>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <span class="badge badge--${overallStatus === 'passed' ? 'success' : 'danger'} badge--lg" style="display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:20px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#fff;background:${overallStatus === 'passed' ? BRAND.success : BRAND.danger};">
            ${overallStatus === 'passed' ? `${this.getStatusIcon('passed')}&nbsp;PASSED` : `${this.getStatusIcon('failed')}&nbsp;FAILED`}
          </span>
          <div style="margin-top:8px;">
            <time class="header__date" style="font-size:13px;opacity:0.8;color:#fff;">${timestamp}</time>
          </div>
        </td>
      </tr>
    </table>
  </header>

  <main class="main">
    <!-- Summary cards -->
    <section class="summary">
      <div class="card card--total">
        <span class="card__value">${this.stats.total}</span>
        <span class="card__label">Total tests</span>
      </div>
      <div class="card card--passed">
        <span class="card__value">${this.stats.passed}</span>
        <span class="card__label">Passed</span>
      </div>
      <div class="card card--failed">
        <span class="card__value">${this.stats.failed + this.stats.timedOut}</span>
        <span class="card__label">Failed</span>
      </div>
      <div class="card card--skipped">
        <span class="card__value">${this.stats.skipped}</span>
        <span class="card__label">Skipped</span>
      </div>
      <div class="card card--flaky">
        <span class="card__value">${this.stats.flaky}</span>
        <span class="card__label">Flaky</span>
      </div>
      <div class="card card--duration">
        <span class="card__value">${this.formatDuration(this.stats.duration)}</span>
        <span class="card__label">Duration</span>
      </div>
    </section>

    <!-- Progress bar -->
    <section class="progress-section">
      <div class="progress-bar">
        ${this.stats.passed > 0 ? `<div class="progress-bar__segment progress-bar__segment--passed" style="width:${(this.stats.passed / this.stats.total) * 100}%"></div>` : ''}
        ${this.stats.failed > 0 ? `<div class="progress-bar__segment progress-bar__segment--failed" style="width:${(this.stats.failed / this.stats.total) * 100}%"></div>` : ''}
        ${this.stats.timedOut > 0 ? `<div class="progress-bar__segment progress-bar__segment--timedOut" style="width:${(this.stats.timedOut / this.stats.total) * 100}%"></div>` : ''}
        ${this.stats.skipped > 0 ? `<div class="progress-bar__segment progress-bar__segment--skipped" style="width:${(this.stats.skipped / this.stats.total) * 100}%"></div>` : ''}
      </div>
      <p class="progress-section__label">${passRate}% pass rate</p>
    </section>

    <!-- Detailed results by file -->
    <section class="results">
      <h2 class="section-title">Detailed results</h2>
      ${this.renderTestsByFile(testsByFile)}
    </section>

    <!-- Failed test details -->
    ${this.stats.failed + this.stats.timedOut > 0 ? this.renderFailedDetails() : ''}
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer__inner">
      <p class="footer__brand">Powered by <strong>${this.escapeHtml(this.options.companyName)}</strong></p>
      <p class="footer__meta">
        Generated on ${timestamp} &middot;
        Playwright ${this.config.version || ''} &middot;
        Workers: ${this.config.workers}
      </p>
    </div>
  </footer>
</body>
</html>`;
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  private groupTestsByFile(): Map<string, TestEntry[]> {
    const map = new Map<string, TestEntry[]>();
    for (const t of this.tests) {
      const arr = map.get(t.file) || [];
      arr.push(t);
      map.set(t.file, arr);
    }
    return map;
  }

  private renderTestsByFile(testsByFile: Map<string, TestEntry[]>): string {
    let html = '';
    for (const [file, tests] of testsByFile) {
      const filePassed = tests.filter((t) => t.status === 'passed').length;
      const fileFailed = tests.filter(
        (t) => t.status === 'failed' || t.status === 'timedOut',
      ).length;
      const fileSkipped = tests.filter((t) => t.status === 'skipped').length;
      const fileStatus = fileFailed > 0 ? 'failed' : 'passed';

      html += `
      <div class="file-group">
        <div class="file-group__header file-group__header--${fileStatus}">
          <span class="file-group__icon">${this.getStatusIcon(fileStatus === 'passed' ? 'passed' : 'failed')}</span>
          <span class="file-group__name">${this.escapeHtml(file)}</span>
          <span class="file-group__stats">
            ${filePassed > 0 ? `<span class="tag tag--passed">${filePassed} passed</span>` : ''}
            ${fileFailed > 0 ? `<span class="tag tag--failed">${fileFailed} failed</span>` : ''}
            ${fileSkipped > 0 ? `<span class="tag tag--skipped">${fileSkipped} skipped</span>` : ''}
          </span>
        </div>
        <table class="test-table">
          <thead>
            <tr>
              <th class="test-table__th">Status</th>
              <th class="test-table__th test-table__th--name">Test name</th>
              <th class="test-table__th">Duration</th>
              <th class="test-table__th">Retry</th>
            </tr>
          </thead>
          <tbody>
            ${tests.map((t) => this.renderTestRow(t)).join('')}
          </tbody>
        </table>
      </div>`;
    }
    return html;
  }

  private renderTestRow(t: TestEntry): string {
    const statusIcon = this.getStatusIcon(t.status);
    const statusClass = t.status === 'timedOut' ? 'failed' : t.status;

    return `
    <tr class="test-row test-row--${statusClass}">
      <td class="test-row__status">
        <span class="status-icon status-icon--${statusClass}">${statusIcon}</span>
      </td>
      <td class="test-row__name">${this.escapeHtml(t.title)}</td>
      <td class="test-row__duration">${this.formatDuration(t.duration)}</td>
      <td class="test-row__retry">${t.retry > 0 ? `#${t.retry}` : '–'}</td>
    </tr>`;
  }

  private renderFailedDetails(): string {
    const failedTests = this.tests.filter(
      (t) => t.status === 'failed' || t.status === 'timedOut',
    );

    let html = `
    <section class="failures">
      <h2 class="section-title section-title--danger">Failure details</h2>`;

    for (const t of failedTests) {
      html += `
      <div class="failure-card">
        <div class="failure-card__header">
          <span class="status-icon status-icon--failed">${this.getStatusIcon('failed')}</span>
          <strong>${this.escapeHtml(t.title)}</strong>
          <span class="failure-card__file">${this.escapeHtml(t.file)}</span>
        </div>
        ${t.errors.length > 0 ? `<pre class="failure-card__error">${this.escapeHtml(t.errors.join('\n\n'))}</pre>` : ''}
        ${t.screenshots.length > 0 ? this.renderScreenshots(t.screenshots) : ''}
      </div>`;
    }

    html += '</section>';
    return html;
  }

  private renderScreenshots(screenshots: string[]): string {
    return `
    <div class="screenshots">
      <p class="screenshots__title">Screenshots:</p>
      <div class="screenshots__grid">
        ${screenshots
          .map(
            (src) =>
              `<img src="${src}" alt="Failure screenshot" class="screenshots__img" ` +
              `width="480" style="display:block;max-width:100%;width:480px;height:auto;` +
              `border-radius:6px;border:1px solid ${BRAND.border};box-shadow:0 2px 8px rgba(0,0,0,0.1);" />`,
          )
          .join('\n        ')}
      </div>
    </div>`;
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  private getLogoBase64(): string | null {
    try {
      if (fs.existsSync(this.options.logoPath)) {
        const buffer = fs.readFileSync(this.options.logoPath);
        const ext = path.extname(this.options.logoPath).toLowerCase();
        const mime =
          ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.png'
              ? 'image/png'
              : 'image/jpeg';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    } catch {
      // Silently ignore
    }
    return null;
  }

  /**
   * Returns an inline SVG icon using Material Design Icons paths.
   * The SVGs use `fill="currentColor"` so they inherit the parent color.
   */
  private getStatusIcon(status: string): string {
    const attrs =
      'xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"';
    switch (status) {
      case 'passed': // mdi-check
        return `<svg ${attrs}><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>`;
      case 'failed': // mdi-close
        return `<svg ${attrs}><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>`;
      case 'timedOut': // mdi-clock-outline
        return `<svg ${attrs}><path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/></svg>`;
      case 'skipped': // mdi-minus
        return `<svg ${attrs}><path d="M19,13H5V11H19V13Z"/></svg>`;
      default:
        return '?';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -----------------------------------------------------------------------
  // Styles
  // -----------------------------------------------------------------------

  private getStyles(): string {
    return `
    /* Reset & base */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: ${BRAND.background};
      color: ${BRAND.title};
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%);
      color: ${BRAND.textOnPrimary};
      padding: 24px 32px;
    }
    .header__inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header__brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header__logo {
      height: 48px;
      width: auto;
      border-radius: 6px;
      background: rgba(255,255,255,0.15);
      padding: 4px 8px;
    }
    .header__project {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header__subtitle {
      font-size: 14px;
      opacity: 0.85;
    }
    .header__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
    .header__date {
      font-size: 13px;
      opacity: 0.8;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1;
      vertical-align: middle;
    }
    .badge svg { flex-shrink: 0; }
    .badge--lg { font-size: 15px; padding: 10px 22px; }
    .badge--success { background: ${BRAND.success}; color: #fff; }
    .badge--danger { background: ${BRAND.danger}; color: #fff; }

    /* Main */
    .main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px;
    }

    /* Summary cards */
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: ${BRAND.surface};
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid ${BRAND.border};
      transition: box-shadow 0.2s;
    }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .card__value {
      display: block;
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }
    .card__label {
      display: block;
      font-size: 13px;
      color: ${BRAND.subtitle};
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card--total .card__value { color: ${BRAND.primary}; }
    .card--passed .card__value { color: ${BRAND.success}; }
    .card--failed .card__value { color: ${BRAND.danger}; }
    .card--skipped .card__value { color: ${BRAND.subtitle}; }
    .card--flaky .card__value { color: ${BRAND.warning}; }
    .card--duration .card__value { color: ${BRAND.accent}; font-size: 24px; }

    /* Progress bar */
    .progress-section { margin-bottom: 32px; }
    .progress-bar {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      background: ${BRAND.border};
    }
    .progress-bar__segment { height: 100%; transition: width 0.4s; }
    .progress-bar__segment--passed { background: ${BRAND.success}; }
    .progress-bar__segment--failed { background: ${BRAND.danger}; }
    .progress-bar__segment--timedOut { background: ${BRAND.warning}; }
    .progress-bar__segment--skipped { background: #bdbdbd; }
    .progress-section__label {
      text-align: right;
      font-size: 13px;
      color: ${BRAND.subtitle};
      margin-top: 6px;
    }

    /* Section titles */
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: ${BRAND.primary};
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${BRAND.primaryLighter};
    }
    .section-title--danger {
      color: ${BRAND.danger};
      border-bottom-color: ${BRAND.dangerLight};
    }

    /* File groups */
    .file-group {
      background: ${BRAND.surface};
      border-radius: 12px;
      border: 1px solid ${BRAND.border};
      margin-bottom: 16px;
      overflow: hidden;
    }
    .file-group__header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
    }
    .file-group__header--passed { background: #e8f5e9; color: #2e7d32; }
    .file-group__header--failed { background: ${BRAND.dangerLight}; color: #c62828; }
    .file-group__icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .file-group__icon svg { width: 18px; height: 18px; }
    .file-group__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 13px; }
    .file-group__stats { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 16px; padding-left: 16px; border-left: 1px solid rgba(0,0,0,0.12); }

    /* Tags */
    .tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      vertical-align: middle;
    }
    .tag--passed { background: ${BRAND.success}; color: #fff; }
    .tag--failed { background: ${BRAND.danger}; color: #fff; }
    .tag--skipped { background: #bdbdbd; color: #fff; }

    /* Test table */
    .test-table { width: 100%; border-collapse: collapse; }
    .test-table__th {
      text-align: left;
      padding: 8px 16px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${BRAND.subtitle};
      background: ${BRAND.background};
      border-bottom: 1px solid ${BRAND.border};
    }
    .test-table__th--name { width: 60%; }

    .test-row td {
      padding: 10px 16px;
      font-size: 14px;
      border-bottom: 1px solid ${BRAND.border};
    }
    .test-row:last-child td { border-bottom: none; }
    .test-row--passed { background: #fafffe; }
    .test-row--failed { background: #fffafa; }
    .test-row--skipped { background: #fafafa; }

    .test-row__status { width: 48px; text-align: center; }
    .test-row__name { font-weight: 500; }
    .test-row__duration { font-family: monospace; font-size: 13px; color: ${BRAND.subtitle}; white-space: nowrap; }
    .test-row__retry { font-size: 13px; color: ${BRAND.subtitle}; text-align: center; }

    /* Status icons */
    .status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      vertical-align: middle;
      flex-shrink: 0;
    }
    .status-icon svg { flex-shrink: 0; }
    .status-icon--passed { background: ${BRAND.success}; color: #fff; }
    .status-icon--failed { background: ${BRAND.danger}; color: #fff; }
    .status-icon--skipped { background: #bdbdbd; color: #fff; }

    /* Failure details */
    .failures { margin-top: 40px; }
    .failure-card {
      background: ${BRAND.surface};
      border: 1px solid ${BRAND.danger};
      border-left: 4px solid ${BRAND.danger};
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .failure-card__header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .failure-card__file {
      font-family: monospace;
      font-size: 12px;
      color: ${BRAND.subtitle};
      margin-left: auto;
    }
    .failure-card__error {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
    }

    /* Screenshots */
    .screenshots { margin-top: 16px; }
    .screenshots__title {
      font-size: 13px;
      font-weight: 600;
      color: ${BRAND.subtitle};
      margin-bottom: 10px;
    }
    .screenshots__grid {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .screenshots__img {
      display: block;
      max-width: 100%;
      width: 480px;
      height: auto;
      border-radius: 6px;
      border: 1px solid ${BRAND.border};
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      object-fit: contain;
    }

    /* Footer */
    .footer {
      background: ${BRAND.primary};
      color: ${BRAND.textOnPrimary};
      padding: 20px 32px;
      margin-top: 40px;
    }
    .footer__inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer__brand { font-size: 14px; opacity: 0.9; }
    .footer__meta { font-size: 12px; opacity: 0.7; }

    /* Responsive */
    @media (max-width: 768px) {
      .header__inner, .footer__inner { flex-direction: column; text-align: center; }
      .header__meta { align-items: center; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .file-group__header { flex-wrap: wrap; }
      .failure-card__file { margin-left: 0; }
    }
    `;
  }
}

export default CorporateReporter;
