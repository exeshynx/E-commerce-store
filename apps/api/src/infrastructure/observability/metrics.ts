const counters = new Map<string, number>();
const durations = new Map<string, { count: number; sum: number }>();

const increment = (name: string, value = 1) => {
  counters.set(name, (counters.get(name) ?? 0) + value);
};

const label = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

export const metrics = {
  recordDatabaseQuery: (durationSeconds: number) => {
    const key = 'aurelia_database_query_duration_seconds';
    const current = durations.get(key) ?? { count: 0, sum: 0 };
    durations.set(key, { count: current.count + 1, sum: current.sum + durationSeconds });
  },
  recordSlowQuery: () => increment('aurelia_database_slow_queries_total'),
  recordError: (code: string) => increment(`aurelia_errors_total{code="${label(code)}"}`),
  recordHttp: (method: string, route: string, statusCode: number, durationSeconds: number) => {
    const labels = `method="${label(method)}",route="${label(route)}",status="${statusCode}"`;
    increment(`aurelia_http_requests_total{${labels}}`);
    const key = `aurelia_http_request_duration_seconds{method="${label(method)}",route="${label(route)}"}`;
    const current = durations.get(key) ?? { count: 0, sum: 0 };
    durations.set(key, { count: current.count + 1, sum: current.sum + durationSeconds });
  },
  recordJob: (job: string, result: 'failed' | 'succeeded', processed: number) => {
    increment(`aurelia_background_job_runs_total{job="${label(job)}",result="${result}"}`);
    if (processed > 0) {
      increment(`aurelia_background_job_items_total{job="${label(job)}"}`, processed);
    }
  },
  render: (gauges: Record<string, number>) => {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const lines = [
      '# HELP aurelia_process_uptime_seconds API process uptime.',
      '# TYPE aurelia_process_uptime_seconds gauge',
      `aurelia_process_uptime_seconds ${process.uptime().toFixed(3)}`,
      '# HELP aurelia_process_resident_memory_bytes Resident memory size.',
      '# TYPE aurelia_process_resident_memory_bytes gauge',
      `aurelia_process_resident_memory_bytes ${memory.rss}`,
      '# TYPE aurelia_process_heap_used_bytes gauge',
      `aurelia_process_heap_used_bytes ${memory.heapUsed}`,
      '# TYPE aurelia_process_heap_total_bytes gauge',
      `aurelia_process_heap_total_bytes ${memory.heapTotal}`,
      '# TYPE aurelia_process_external_memory_bytes gauge',
      `aurelia_process_external_memory_bytes ${memory.external}`,
      '# TYPE aurelia_process_cpu_user_seconds_total counter',
      `aurelia_process_cpu_user_seconds_total ${(cpu.user / 1_000_000).toFixed(6)}`,
      '# TYPE aurelia_process_cpu_system_seconds_total counter',
      `aurelia_process_cpu_system_seconds_total ${(cpu.system / 1_000_000).toFixed(6)}`,
    ];
    for (const [name, value] of [...counters].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      lines.push(`${name} ${value}`);
    }
    for (const [name, value] of [...durations].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      lines.push(`${name}_count ${value.count}`, `${name}_sum ${value.sum.toFixed(6)}`);
    }
    for (const [name, value] of Object.entries(gauges).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      lines.push(`${name} ${value}`);
    }
    return `${lines.join('\n')}\n`;
  },
};
